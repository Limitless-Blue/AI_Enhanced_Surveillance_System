import json
import time
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient

from app.tasks.celery_app import celery_app
from app.tasks._helpers import _load_persons, _build_matcher, _build_pipeline, _handle_match
from app.config import get_settings
import structlog

log = structlog.get_logger()

RELOAD_EVERY_N_FRAMES = 100   # refresh persons from DB every N processed frames


@celery_app.task(bind=True, name="stream_worker")
def stream_worker(self, camera_id: str):
    settings = get_settings()
    client = MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]

    camera = db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not camera:
        log.error("stream_worker.camera_not_found", camera_id=camera_id)
        return

    source = camera["source"]
    try:
        source = int(source)   # webcam index
    except (ValueError, TypeError):
        pass

    threshold = camera.get("match_threshold", 0.45)
    frame_skip = camera.get("frame_skip", 3)
    location = camera.get("location")

    log.info("stream_worker.started", camera_id=camera_id, source=str(source))

    persons = _load_persons(db)
    matcher = _build_matcher(persons)
    pipeline = _build_pipeline(matcher)

    from app.ai.stream_reader import StreamReader
    from app.ai.tracker import PersonTracker
    reader = StreamReader(source, frame_skip=frame_skip)
    tracker = PersonTracker(max_age=30)

    redis_client = _get_redis(settings)
    ALERT_COOLDOWN = 60   # seconds before re-alerting the same person
    name_cooldowns: dict[str, float] = {}

    frame_count = 0

    try:
        for frame in reader.frames():
            frame_count += 1

            # Periodically refresh persons
            if frame_count % RELOAD_EVERY_N_FRAMES == 0:
                persons = _load_persons(db)
                matcher.load(persons)

            # Get faces from pipeline's embedder, then track them
            faces = pipeline.embedder.get_faces(frame)
            from app.ai.quality import is_quality_face
            quality_faces = [f for f in faces if is_quality_face(f, frame)]

            tracks = tracker.update(quality_faces, frame)

            for track in tracks:
                if track["already_alerted"]:
                    continue

                match = matcher.find_match(track["embedding"], threshold)
                if not match or match["confidence"] != "HIGH":
                    continue

                name = match["person"]["name"]
                now_ts = time.time()
                if now_ts - name_cooldowns.get(name, 0) < ALERT_COOLDOWN:
                    continue
                name_cooldowns[name] = now_ts

                if track["track_id"] is not None:
                    tracker.mark_alerted(track["track_id"])

                # Build a fake MatchResult for _handle_match
                from app.ai.pipeline import MatchResult
                match_result = MatchResult(
                    person_name=name,
                    person_id=str(match["person"].get("_id", "")),
                    score=match["score"],
                    confidence=match["confidence"],
                    bbox=track["bbox"],
                )

                detection_id = _handle_match(
                    db, match_result, frame,
                    source_type="camera",
                    source_id=camera_id,
                    location=location,
                    settings=settings,
                    camera=camera,
                )

                # Publish to Redis for Socket.IO broadcast
                if redis_client and detection_id:
                    event = {
                        "detection_id": detection_id,
                        "person_name": name,
                        "score": match.score,
                        "confidence": match.confidence,
                        "camera_id": camera_id,
                        "camera_name": camera.get("name", ""),
                        "location": location,
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                    }
                    try:
                        redis_client.publish("detections", json.dumps(event))
                    except Exception:
                        pass

    except Exception as e:
        log.error("stream_worker.error", camera_id=camera_id, error=str(e))
    finally:
        # Mark camera as inactive in DB
        db.cameras.update_one(
            {"_id": ObjectId(camera_id)},
            {"$set": {"is_active": False, "celery_task_id": None}},
        )
        client.close()
        log.info("stream_worker.stopped", camera_id=camera_id)


def _get_redis(settings):
    try:
        import redis
        return redis.Redis.from_url(settings.redis_url, decode_responses=True)
    except Exception:
        return None
