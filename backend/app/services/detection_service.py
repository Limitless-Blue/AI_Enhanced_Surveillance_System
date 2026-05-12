from datetime import datetime, timezone
from pathlib import Path
import numpy as np
from bson import ObjectId
from pymongo.database import Database
import structlog

log = structlog.get_logger()


def save_detection_sync(
    db: Database,
    *,
    frame: np.ndarray,
    bbox: tuple[int, int, int, int],
    person: dict | None,
    match_score: float | None,
    confidence: str | None,
    source_type: str,
    source_id: str | None,
    location: dict | None,
    uploads_dir: Path,
) -> str:
    from app.utils.image import save_frame_crop

    snapshot_path = None
    try:
        snap_dir = uploads_dir / "snapshots"
        snap_file = save_frame_crop(frame, bbox, snap_dir)
        snapshot_path = str(snap_file)
    except Exception as e:
        log.warning("detection.snapshot_failed", error=str(e))

    now = datetime.now(timezone.utc)
    x1, y1, x2, y2 = bbox
    doc = {
        "source_type": source_type,
        "source_id": ObjectId(source_id) if source_id and ObjectId.is_valid(source_id) else None,
        "frame_timestamp": now,
        "bounding_box": {"x1": x1, "y1": y1, "x2": x2, "y2": y2},
        "snapshot_path": snapshot_path,
        "person_id": ObjectId(str(person["_id"])) if person and "_id" in person else None,
        "person_name": person["name"] if person else None,
        "match_score": match_score,
        "confidence": confidence,
        "location": location,
        "created_at": now,
    }
    result = db.detections.insert_one(doc)
    return str(result.inserted_id)
