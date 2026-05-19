from fastapi import APIRouter, UploadFile, File, HTTPException
from pathlib import Path
from datetime import datetime, timezone
from bson import ObjectId

from app.database import get_db
from app.models.media_job import MediaJobResponse
from app.models.common import doc
from app.config import get_settings

router = APIRouter()
settings = get_settings()

VIDEO_EXTS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv"}
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


@router.post("/upload", response_model=MediaJobResponse, status_code=202)
async def upload_media(file: UploadFile = File(...)):
    db = get_db()
    suffix = Path(file.filename).suffix.lower()

    if suffix in VIDEO_EXTS:
        file_type = "video"
    elif suffix in IMAGE_EXTS:
        file_type = "image"
    else:
        raise HTTPException(status_code=415, detail=f"Unsupported file type: {suffix}")

    data = await file.read()
    dest_dir = settings.uploads_dir / "raw"
    dest_dir.mkdir(parents=True, exist_ok=True)
    from uuid import uuid4
    job_id_hex = uuid4().hex
    dest = dest_dir / f"{job_id_hex}{suffix}"
    dest.write_bytes(data)

    now = datetime.now(timezone.utc)
    job_doc = {
        "filename": file.filename,
        "file_path": str(dest),
        "file_type": file_type,
        "celery_task_id": None,
        "status": "queued",
        "total_frames": 0,
        "processed_frames": 0,
        "detections_found": 0,
        "error": None,
        "created_at": now,
        "completed_at": None,
    }
    result = await db.media_jobs.insert_one(job_doc)
    job_id = str(result.inserted_id)
    job_doc["id"] = job_id

    # Enqueue Celery task
    try:
        import asyncio
        task_id = await asyncio.to_thread(_enqueue, file_type, job_id, str(dest))
        await db.media_jobs.update_one(
            {"_id": result.inserted_id},
            {"$set": {"celery_task_id": task_id, "status": "queued"}},
        )
        job_doc["celery_task_id"] = task_id
    except Exception as e:
        await db.media_jobs.update_one(
            {"_id": result.inserted_id},
            {"$set": {"status": "failed", "error": str(e)}},
        )
        job_doc["status"] = "failed"
        job_doc["error"] = str(e)

    return MediaJobResponse(**job_doc)


@router.get("/jobs/{job_id}", response_model=MediaJobResponse)
async def get_job(job_id: str):
    db = get_db()
    if not ObjectId.is_valid(job_id):
        raise HTTPException(status_code=400, detail="Invalid job id")
    d = await db.media_jobs.find_one({"_id": ObjectId(job_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Job not found")
    return MediaJobResponse(**doc(d))


@router.get("/jobs", response_model=list[MediaJobResponse])
async def list_jobs(skip: int = 0, limit: int = 20):
    db = get_db()
    cursor = db.media_jobs.find({}).sort("created_at", -1).skip(skip).limit(limit)
    return [MediaJobResponse(**doc(d)) for d in await cursor.to_list(length=limit)]


def _enqueue(file_type: str, job_id: str, file_path: str) -> str:
    if file_type == "video":
        from app.tasks.analyze_video import analyze_video
        task = analyze_video.delay(job_id, file_path)
    else:
        from app.tasks.analyze_image import analyze_image
        task = analyze_image.delay(job_id, file_path)
    return task.id
