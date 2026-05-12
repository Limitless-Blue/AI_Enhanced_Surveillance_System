from fastapi import APIRouter, Request
from bson import ObjectId

from app.database import get_db
from app.models.detection import DetectionResponse
from app.models.common import doc

router = APIRouter()


def _snap_url(request: Request, snapshot_path: str | None) -> str | None:
    if not snapshot_path:
        return None
    from app.config import get_settings
    from pathlib import Path
    settings = get_settings()
    try:
        rel = Path(snapshot_path).relative_to(settings.uploads_dir)
        return str(request.base_url) + "uploads/" + str(rel).replace("\\", "/")
    except Exception:
        return None


@router.get("", response_model=list[DetectionResponse])
async def list_detections(
    request: Request,
    skip: int = 0,
    limit: int = 50,
    person_id: str | None = None,
    confidence: str | None = None,
):
    db = get_db()
    flt: dict = {}
    if person_id and ObjectId.is_valid(person_id):
        flt["person_id"] = ObjectId(person_id)
    if confidence:
        flt["confidence"] = confidence

    cursor = db.detections.find(flt).sort("created_at", -1).skip(skip).limit(limit)
    result = []
    async for d in cursor:
        d = doc(d)
        d["snapshot_url"] = _snap_url(request, d.get("snapshot_path"))
        if d.get("person_id"):
            d["person_id"] = str(d["person_id"])
        if d.get("source_id"):
            d["source_id"] = str(d["source_id"])
        result.append(DetectionResponse(**d))
    return result


@router.get("/stats")
async def detection_stats():
    db = get_db()
    total = await db.detections.count_documents({})
    high = await db.detections.count_documents({"confidence": "HIGH"})
    review = await db.detections.count_documents({"confidence": "REVIEW"})
    return {"total": total, "high": high, "review": review}
