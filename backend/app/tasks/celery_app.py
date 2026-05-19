from celery import Celery
from app.config import get_settings

settings = get_settings()

celery_app = Celery(
    "surveillance",
    broker=settings.redis_url,
    backend=settings.redis_url.replace("/0", "/1"),
    include=[
        "app.tasks.analyze_image",
        "app.tasks.analyze_video",
        "app.tasks.stream_worker",
    ],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    result_expires=3600,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    # Windows-safe: use threads pool; switch to prefork on Linux
    worker_pool="threads",
    worker_concurrency=4,
)
