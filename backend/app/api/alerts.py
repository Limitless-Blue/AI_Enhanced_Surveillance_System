from fastapi import APIRouter
from app.database import get_db
from app.models.alert import AlertResponse
from app.models.common import doc

router = APIRouter()


@router.get("", response_model=list[AlertResponse])
async def list_alerts(skip: int = 0, limit: int = 50, status: str | None = None):
    db = get_db()
    flt: dict = {}
    if status:
        flt["status"] = status
    cursor = db.alerts.find(flt).sort("sent_at", -1).skip(skip).limit(limit)
    result = []
    async for d in cursor:
        d = doc(d)
        for k in ("detection_id", "person_id"):
            if d.get(k):
                d[k] = str(d[k])
        result.append(AlertResponse(**d))
    return result
