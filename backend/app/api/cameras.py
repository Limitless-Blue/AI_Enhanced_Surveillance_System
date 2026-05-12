from fastapi import APIRouter, HTTPException
from datetime import datetime, timezone
from bson import ObjectId

from app.database import get_db
from app.models.camera import CameraCreate, CameraResponse
from app.models.common import doc, docs

router = APIRouter()


@router.get("", response_model=list[CameraResponse])
async def list_cameras():
    db = get_db()
    cursor = db.cameras.find({}).sort("created_at", -1)
    return [CameraResponse(**doc(d)) for d in await cursor.to_list(length=200)]


@router.get("/{camera_id}", response_model=CameraResponse)
async def get_camera(camera_id: str):
    db = get_db()
    if not ObjectId.is_valid(camera_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    d = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Camera not found")
    return CameraResponse(**doc(d))


@router.post("", response_model=CameraResponse, status_code=201)
async def create_camera(data: CameraCreate):
    db = get_db()
    now = datetime.now(timezone.utc)
    camera_doc = {
        **data.model_dump(),
        "is_active": False,
        "celery_task_id": None,
        "created_at": now,
    }
    result = await db.cameras.insert_one(camera_doc)
    camera_doc["id"] = str(result.inserted_id)
    return CameraResponse(**camera_doc)


@router.delete("/{camera_id}", status_code=204)
async def delete_camera(camera_id: str):
    db = get_db()
    if not ObjectId.is_valid(camera_id):
        raise HTTPException(status_code=400, detail="Invalid id")

    d = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Camera not found")

    if d.get("is_active") and d.get("celery_task_id"):
        try:
            from app.services.camera_service import stop_camera_sync
            import asyncio
            await asyncio.to_thread(stop_camera_sync, d["celery_task_id"])
        except Exception:
            pass

    await db.cameras.delete_one({"_id": ObjectId(camera_id)})


@router.post("/{camera_id}/start", response_model=CameraResponse)
async def start_camera(camera_id: str):
    import asyncio
    db = get_db()
    if not ObjectId.is_valid(camera_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    d = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Camera not found")
    if d.get("is_active"):
        raise HTTPException(status_code=409, detail="Camera already active")

    task_id = await asyncio.to_thread(_start_stream_task, camera_id)

    from datetime import timezone
    now = datetime.now(timezone.utc)
    await db.cameras.update_one(
        {"_id": ObjectId(camera_id)},
        {"$set": {"is_active": True, "celery_task_id": task_id, "updated_at": now}},
    )
    updated = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    return CameraResponse(**doc(updated))


@router.post("/{camera_id}/stop", response_model=CameraResponse)
async def stop_camera(camera_id: str):
    import asyncio
    db = get_db()
    if not ObjectId.is_valid(camera_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    d = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Camera not found")

    task_id = d.get("celery_task_id")
    if task_id:
        await asyncio.to_thread(_stop_stream_task, task_id)

    from datetime import timezone
    now = datetime.now(timezone.utc)
    await db.cameras.update_one(
        {"_id": ObjectId(camera_id)},
        {"$set": {"is_active": False, "celery_task_id": None, "updated_at": now}},
    )
    updated = await db.cameras.find_one({"_id": ObjectId(camera_id)})
    return CameraResponse(**doc(updated))


@router.get("/{camera_id}/status")
async def camera_status(camera_id: str):
    db = get_db()
    if not ObjectId.is_valid(camera_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    d = await db.cameras.find_one({"_id": ObjectId(camera_id)}, {"name": 1, "is_active": 1, "celery_task_id": 1})
    if not d:
        raise HTTPException(status_code=404, detail="Camera not found")
    return {
        "camera_id": camera_id,
        "name": d.get("name"),
        "is_active": d.get("is_active", False),
        "task_id": d.get("celery_task_id"),
    }


def _start_stream_task(camera_id: str) -> str:
    from app.tasks.stream_worker import stream_worker
    task = stream_worker.delay(camera_id)
    return task.id


def _stop_stream_task(task_id: str):
    from app.tasks.celery_app import celery_app
    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
