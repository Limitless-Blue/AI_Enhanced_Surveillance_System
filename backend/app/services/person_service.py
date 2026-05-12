"""
Matcher singleton shared across the FastAPI process.
Celery workers maintain their own copy loaded from MongoDB.
"""
from app.ai.matcher import FaceMatcher
import structlog

log = structlog.get_logger()

_matcher: FaceMatcher = FaceMatcher()


def get_matcher() -> FaceMatcher:
    return _matcher


def reload_matcher_sync() -> None:
    """Load all person embeddings from MongoDB into the in-memory matrix.
    Sync — call via asyncio.to_thread() from async contexts."""
    from pymongo import MongoClient
    from app.config import get_settings
    settings = get_settings()
    client = MongoClient(settings.mongo_uri, serverSelectionTimeoutMS=5000)
    db = client[settings.mongo_db_name]
    persons = list(db.persons.find(
        {"embedding": {"$ne": None}},
        {"name": 1, "embedding": 1, "alert_contact": 1, "category": 1},
    ))
    client.close()
    _matcher.load(persons)
    log.info("matcher.reloaded", count=len(persons))


async def reload_matcher() -> None:
    import asyncio
    await asyncio.to_thread(reload_matcher_sync)
