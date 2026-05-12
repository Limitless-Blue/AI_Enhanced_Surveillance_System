from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient

from app.tasks.celery_app import celery_app
from app.tasks._helpers import _load_persons, _build_matcher, _build_pipeline, _handle_match
from app.config import get_settings
import structlog

log = structlog.get_logger()


@celery_app.task(bind=True, name="analyze_video")
def analyze_video(self, job_id: str, video_path: str):
    settings = get_settings()
    client = MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]

    try:
        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "processing"}},
        )

        import cv2
        cap = cv2.VideoCapture(video_path)
        total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 0
        cap.release()

        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"total_frames": total}},
        )

        persons = _load_persons(db)
        matcher = _build_matcher(persons)
        pipeline = _build_pipeline(matcher)

        from app.ai.stream_reader import StreamReader
        reader = StreamReader(video_path, frame_skip=5, motion_threshold=1.5)

        processed = 0
        detection_count = 0
        alerted_tracks: set[str] = set()   # deduplicate by person per video

        for frame in reader.frames():
            processed += 1
            result = pipeline.run(frame)

            for match in result.high_confidence_matches:
                key = match.person_name
                if key in alerted_tracks:
                    continue
                alerted_tracks.add(key)
                _handle_match(db, match, frame, source_type="video_file",
                              source_id=job_id, location=None, settings=settings)
                detection_count += 1

            if processed % 50 == 0:
                self.update_state(state="PROGRESS", meta={"processed": processed, "total": total})
                db.media_jobs.update_one(
                    {"_id": ObjectId(job_id)},
                    {"$set": {"processed_frames": processed, "detections_found": detection_count}},
                )

        now = datetime.now(timezone.utc)
        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "done",
                "processed_frames": processed,
                "detections_found": detection_count,
                "completed_at": now,
            }},
        )
        log.info("analyze_video.done", job_id=job_id, processed=processed, detections=detection_count)

    except Exception as e:
        log.error("analyze_video.failed", job_id=job_id, error=str(e))
        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed", "error": str(e), "completed_at": datetime.now(timezone.utc)}},
        )
        raise
    finally:
        client.close()
