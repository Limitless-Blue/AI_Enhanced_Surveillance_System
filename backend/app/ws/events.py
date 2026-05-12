import asyncio
import json
import structlog
import socketio

log = structlog.get_logger()

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    logger=False,
    engineio_logger=False,
)


@sio.event
async def connect(sid, environ):
    log.info("ws.client_connected", sid=sid)


@sio.event
async def disconnect(sid):
    log.info("ws.client_disconnected", sid=sid)


async def start_redis_listener() -> None:
    """Subscribe to Redis 'detections' channel and broadcast to Socket.IO clients."""
    from app.config import get_settings
    settings = get_settings()

    try:
        import redis.asyncio as aioredis
        redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = redis.pubsub()
        await pubsub.subscribe("detections")
        log.info("ws.redis_listener_started")

        async for message in pubsub.listen():
            if message["type"] == "message":
                try:
                    data = json.loads(message["data"])
                    await sio.emit("detection", data)
                except Exception as e:
                    log.warning("ws.emit_failed", error=str(e))

    except Exception as e:
        log.error("ws.redis_listener_failed", error=str(e))
