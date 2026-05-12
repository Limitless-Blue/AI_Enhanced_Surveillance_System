from datetime import datetime, timezone
from bson import ObjectId
from pymongo import MongoClient

from app.tasks.celery_app import celery_app
from app.tasks._helpers import _load_persons, _build_matcher, _build_pipeline, _handle_match
from app.config import get_settings
import structlog

log = structlog.get_logger()


@celery_app.task(bind=True, name="analyze_image")
def analyze_image(self, job_id: str, image_path: str):
    settings = get_settings()
    client = MongoClient(settings.mongo_uri)
    db = client[settings.mongo_db_name]

    try:
        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "processing"}},
        )

        import cv2
        frame = cv2.imread(image_path)
        if frame is None:
            raise RuntimeError(f"Cannot read image: {image_path}")

        persons = _load_persons(db)
        matcher = _build_matcher(persons)
        pipeline = _build_pipeline(matcher)

        result = pipeline.run(frame)

        detection_count = 0
        for match in result.high_confidence_matches:
            _handle_match(db, match, frame, source_type="image",
                          source_id=job_id, location=None, settings=settings)
            detection_count += 1

        now = datetime.now(timezone.utc)
        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {
                "status": "done",
                "total_frames": 1,
                "processed_frames": 1,
                "detections_found": detection_count,
                "completed_at": now,
            }},
        )
        log.info("analyze_image.done", job_id=job_id, detections=detection_count)

    except Exception as e:
        log.error("analyze_image.failed", job_id=job_id, error=str(e))
        db.media_jobs.update_one(
            {"_id": ObjectId(job_id)},
            {"$set": {"status": "failed", "error": str(e), "completed_at": datetime.now(timezone.utc)}},
        )
        raise
    finally:
        client.close()
