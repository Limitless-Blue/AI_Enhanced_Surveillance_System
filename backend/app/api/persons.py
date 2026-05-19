from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends, Request
from typing import Optional
from datetime import datetime, timezone

from app.database import get_db
from app.models.person import PersonCreate, PersonResponse, AlertContact
from app.models.common import doc, docs
from bson import ObjectId

router = APIRouter()


def _build_image_url(request: Request, image_path: str | None) -> str | None:
    if not image_path:
        return None
    # Convert absolute path to a URL under /uploads
    from app.config import get_settings
    settings = get_settings()
    try:
        rel = Path(image_path).relative_to(settings.uploads_dir)
        return str(request.base_url) + "uploads/" + str(rel).replace("\\", "/")
    except Exception:
        return None


from pathlib import Path


@router.get("", response_model=list[PersonResponse])
async def list_persons(request: Request, skip: int = 0, limit: int = 100):
    db = get_db()
    cursor = db.persons.find({}, {"embedding": 0}).sort("created_at", -1).skip(skip).limit(limit)
    result = []
    async for d in cursor:
        d = doc(d)
        d["image_url"] = _build_image_url(request, d.get("image_path"))
        d["has_embedding"] = bool(d.get("embedding_norm"))
        result.append(PersonResponse(**d))
    return result


@router.get("/{person_id}", response_model=PersonResponse)
async def get_person(person_id: str, request: Request):
    db = get_db()
    if not ObjectId.is_valid(person_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    d = await db.persons.find_one({"_id": ObjectId(person_id)}, {"embedding": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Person not found")
    d = doc(d)
    d["image_url"] = _build_image_url(request, d.get("image_path"))
    d["has_embedding"] = bool(d.get("embedding_norm"))
    return PersonResponse(**d)


@router.post("", response_model=PersonResponse, status_code=201)
async def create_person(
    request: Request,
    name: str = Form(...),
    category: str = Form("suspect"),
    other_details: str = Form(""),
    telegram_chat_id: str = Form(""),
    email: str = Form(""),
    ntfy_topic: str = Form(""),
    image: Optional[UploadFile] = File(None),
):
    db = get_db()

    existing = await db.persons.find_one({"name": name})
    if existing:
        raise HTTPException(status_code=409, detail=f"Person '{name}' already exists")

    now = datetime.now(timezone.utc)
    person_doc: dict = {
        "name": name,
        "category": category,
        "alert_contact": {
            "telegram_chat_id": telegram_chat_id,
            "email": email,
            "ntfy_topic": ntfy_topic,
        },
        "other_details": other_details,
        "image_path": None,
        "embedding": None,
        "embedding_norm": None,
        "num_images": 0,
        "created_at": now,
        "updated_at": now,
    }

    if image:
        from app.config import get_settings
        from app.utils.image import save_upload, read_image_bytes, resize_max
        import asyncio

        settings = get_settings()
        img_bytes = await image.read()

        # Save original image
        suffix = Path(image.filename).suffix or ".jpg"
        img_path = save_upload(img_bytes, settings.uploads_dir / "persons", suffix)
        person_doc["image_path"] = str(img_path)

        # Run AI enrollment in a thread (CPU-bound)
        try:
            embedding = await asyncio.to_thread(_enroll_image, img_bytes)
            if embedding is not None:
                person_doc["embedding"] = embedding.tolist()
                person_doc["embedding_norm"] = float((embedding ** 2).sum() ** 0.5)
                person_doc["num_images"] = 1
        except Exception as e:
            import structlog
            structlog.get_logger().warning("enrollment.ai_failed", error=str(e))

    result = await db.persons.insert_one(person_doc)
    person_doc["id"] = str(result.inserted_id)

    # Hot-reload matcher
    try:
        from app.services.person_service import reload_matcher
        await asyncio.to_thread(reload_matcher_sync)
    except Exception:
        pass

    person_doc["image_url"] = _build_image_url(request, person_doc.get("image_path"))
    person_doc["has_embedding"] = person_doc["embedding"] is not None
    return PersonResponse(**person_doc)


@router.post("/{person_id}/images", response_model=PersonResponse)
async def add_enrollment_image(person_id: str, request: Request, image: UploadFile = File(...)):
    """Add an additional enrollment image to an existing person."""
    import asyncio
    db = get_db()
    if not ObjectId.is_valid(person_id):
        raise HTTPException(status_code=400, detail="Invalid id")

    d = await db.persons.find_one({"_id": ObjectId(person_id)})
    if not d:
        raise HTTPException(status_code=404, detail="Person not found")

    img_bytes = await image.read()
    new_emb = await asyncio.to_thread(_enroll_image, img_bytes)
    if new_emb is None:
        raise HTTPException(status_code=422, detail="No usable face detected in image")

    existing_emb = d.get("embedding")
    num = d.get("num_images", 1)

    if existing_emb:
        import numpy as np
        avg = (np.array(existing_emb) * num + new_emb) / (num + 1)
        avg = avg / np.linalg.norm(avg)
        new_embedding = avg.tolist()
    else:
        new_embedding = new_emb.tolist()

    from datetime import timezone
    now = datetime.now(timezone.utc)
    await db.persons.update_one(
        {"_id": ObjectId(person_id)},
        {"$set": {"embedding": new_embedding, "num_images": num + 1, "updated_at": now}},
    )

    try:
        import asyncio
        await asyncio.to_thread(reload_matcher_sync)
    except Exception:
        pass

    updated = await db.persons.find_one({"_id": ObjectId(person_id)}, {"embedding": 0})
    d = doc(updated)
    d["image_url"] = _build_image_url(request, d.get("image_path"))
    d["has_embedding"] = True
    return PersonResponse(**d)


@router.post("/search", response_model=dict)
async def search_person(image: UploadFile = File(...)):
    """Match a query image against all enrolled persons."""
    import asyncio
    img_bytes = await image.read()
    embedding = await asyncio.to_thread(_enroll_image, img_bytes)
    if embedding is None:
        raise HTTPException(status_code=422, detail="No face detected in query image")

    from app.services.person_service import get_matcher
    matcher = get_matcher()
    match = matcher.find_match(embedding)
    if not match:
        return {"match": False}
    return {
        "match": True,
        "person_name": match["person"]["name"],
        "person_id": str(match["person"].get("_id", "")),
        "score": match["score"],
        "confidence": match["confidence"],
    }


@router.delete("/{person_id}", status_code=204)
async def delete_person(person_id: str):
    import asyncio
    db = get_db()
    if not ObjectId.is_valid(person_id):
        raise HTTPException(status_code=400, detail="Invalid id")
    result = await db.persons.delete_one({"_id": ObjectId(person_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Person not found")
    try:
        await asyncio.to_thread(reload_matcher_sync)
    except Exception:
        pass


# ── helpers (sync, run in thread) ────────────────────────────────────────────

def _enroll_image(img_bytes: bytes):
    from app.ai.embedder import get_embedder
    from app.ai.quality import is_quality_face
    from app.utils.image import read_image_bytes, resize_max
    img = read_image_bytes(img_bytes)
    if img is None:
        return None
    img = resize_max(img)
    embedder = get_embedder()
    faces = embedder.get_faces(img)
    quality = [f for f in faces if is_quality_face(f, img)]
    if not quality:
        return None
    largest = max(quality, key=lambda f: (f.bbox[2] - f.bbox[0]) * (f.bbox[3] - f.bbox[1]))
    return largest.embedding


def reload_matcher_sync():
    from app.services.person_service import reload_matcher_sync as _r
    _r()
