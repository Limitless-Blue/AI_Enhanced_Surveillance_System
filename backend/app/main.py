import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import socketio
import structlog

from app.config import get_settings
from app.database import connect_db, close_db, get_db
from app.utils.logging import setup_logging
from app.ws.events import sio, start_redis_listener

setup_logging()
log = structlog.get_logger()
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("app.starting", env=settings.app_env)

    # Connect MongoDB and create indexes
    await connect_db()

    # Ensure upload dirs exist
    for sub in ("persons", "snapshots", "raw"):
        (settings.uploads_dir / sub).mkdir(parents=True, exist_ok=True)

    # Pre-load face matcher from DB
    try:
        from app.services.person_service import reload_matcher
        await reload_matcher()
    except Exception as e:
        log.warning("app.matcher_preload_failed", error=str(e))

    # Start Socket.IO Redis listener as background task
    listener_task = asyncio.create_task(start_redis_listener())

    yield

    listener_task.cancel()
    try:
        await listener_task
    except asyncio.CancelledError:
        pass

    await close_db()
    log.info("app.stopped")


_fastapi = FastAPI(
    title="AI-Enhanced Surveillance",
    version="0.1.0",
    docs_url="/docs" if settings.is_dev else None,
    redoc_url=None,
    lifespan=lifespan,
)

_fastapi.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings.uploads_dir.mkdir(parents=True, exist_ok=True)
_fastapi.mount(
    "/uploads",
    StaticFiles(directory=str(settings.uploads_dir)),
    name="uploads",
)

# ── Routers ───────────────────────────────────────────────────────────────────
from app.api import persons, cameras, media, detections, alerts

_fastapi.include_router(persons.router,    prefix="/api/persons",    tags=["persons"])
_fastapi.include_router(cameras.router,    prefix="/api/cameras",    tags=["cameras"])
_fastapi.include_router(media.router,      prefix="/api/media",      tags=["media"])
_fastapi.include_router(detections.router, prefix="/api/detections", tags=["detections"])
_fastapi.include_router(alerts.router,     prefix="/api/alerts",     tags=["alerts"])


@_fastapi.get("/api/health", tags=["system"])
async def health():
    db = get_db()
    try:
        await db.command("ping")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    from app.services.person_service import get_matcher
    matcher = get_matcher()

    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "enrolled_persons": matcher.size,
        "env": settings.app_env,
        "version": _fastapi.version,
    }


# ── Wrap FastAPI with Socket.IO ASGI ─────────────────────────────────────────
# Uvicorn must serve `app`, not `_fastapi`
app = socketio.ASGIApp(sio, other_asgi_app=_fastapi)
