from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING, IndexModel
from pymongo import MongoClient
from app.config import get_settings
import structlog

log = structlog.get_logger()
settings = get_settings()

_client: AsyncIOMotorClient | None = None

DETECTION_TTL_DAYS = 90   # auto-expire raw detections after 90 days


def get_client() -> AsyncIOMotorClient:
    if _client is None:
        raise RuntimeError("Database not initialised. Call connect_db() first.")
    return _client


def get_db() -> AsyncIOMotorDatabase:
    return get_client()[settings.mongo_db_name]


def get_sync_db():
    """Sync MongoDB client for use inside Celery workers."""
    client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    return client[settings.mongo_db_name]


async def connect_db() -> None:
    global _client
    _client = AsyncIOMotorClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    await _client.admin.command("ping")
    log.info("mongodb.connected", uri=settings.mongo_uri, db=settings.mongo_db_name)
    await _create_indexes()
    await _reset_active_cameras()


async def close_db() -> None:
    global _client
    if _client:
        _client.close()
        _client = None
        log.info("mongodb.disconnected")


async def _reset_active_cameras() -> None:
    """On startup, mark all cameras as inactive (Celery workers stopped when server restarted)."""
    db = get_db()
    result = await db.cameras.update_many(
        {"is_active": True},
        {"$set": {"is_active": False, "celery_task_id": None}},
    )
    if result.modified_count:
        log.info("mongodb.cameras_reset", count=result.modified_count)


async def _create_indexes() -> None:
    db = get_db()

    await db.persons.create_indexes([
        IndexModel([("name", ASCENDING)], unique=True),
        IndexModel([("category", ASCENDING)]),
        IndexModel([("created_at", DESCENDING)]),
    ])

    await db.cameras.create_indexes([
        IndexModel([("is_active", ASCENDING)]),
    ])

    await db.detections.create_indexes([
        IndexModel([("created_at", DESCENDING)]),
        IndexModel([("person_id", ASCENDING), ("created_at", DESCENDING)]),
        IndexModel([("source_id", ASCENDING)]),
        # TTL: auto-delete detections older than 90 days
        IndexModel([("created_at", ASCENDING)], expireAfterSeconds=DETECTION_TTL_DAYS * 86400, name="detections_ttl"),
    ])

    await db.alerts.create_indexes([
        IndexModel([("detection_id", ASCENDING)]),
        IndexModel([("status", ASCENDING), ("sent_at", DESCENDING)]),
    ])

    await db.media_jobs.create_indexes([
        IndexModel([("status", ASCENDING), ("created_at", DESCENDING)]),
    ])

    log.info("mongodb.indexes_created")
