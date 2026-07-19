"""Shared helpers imported by all three Celery task modules."""
from pymongo.database import Database
from bson import ObjectId


def _load_persons(db: Database) -> list[dict]:
    return list(db.persons.find(
        {"embedding": {"$ne": None}},
        {"name": 1, "embedding": 1, "alert_contact": 1, "category": 1},
    ))


def _build_matcher(persons: list[dict]):
    from app.ai.matcher import FaceMatcher
    m = FaceMatcher()
    m.load(persons)
    return m


def _build_pipeline(matcher):
    from app.ai.embedder import get_embedder
    from app.ai.pipeline import AIPipeline
    return AIPipeline(get_embedder(), matcher)


def _handle_match(db, match, frame, *, source_type, source_id, location, settings, camera=None) -> str | None:
    from app.services.detection_service import save_detection_sync
    from app.services.alert_service import dispatch_all
    from pathlib import Path

    # match is a MatchResult dataclass from the pipeline; resolve the full
    # person document by name (prefer id when available).
    person_doc = None
    if getattr(match, "person_id", None) and ObjectId.is_valid(match.person_id):
        person_doc = db.persons.find_one({"_id": ObjectId(match.person_id)})
    if not person_doc:
        person_doc = db.persons.find_one({"name": match.person_name})
    if not person_doc:
        return None

    detection_id = save_detection_sync(
        db,
        frame=frame,
        bbox=match.bbox,
        person=person_doc,
        match_score=match.score,
        confidence=match.confidence,
        source_type=source_type,
        source_id=source_id,
        location=location,
        uploads_dir=Path(settings.uploads_dir),
    )

    snapshot_path = None
    try:
        det = db.detections.find_one({"_id": __import__("bson").ObjectId(detection_id)})
        snapshot_path = det.get("snapshot_path") if det else None
    except Exception:
        pass

    dispatch_all(
        db,
        detection_id=detection_id,
        person=person_doc,
        camera=camera,
        snapshot_path=snapshot_path,
        settings=settings,
    )

    return detection_id
