def stop_camera_sync(task_id: str) -> None:
    from app.tasks.celery_app import celery_app
    celery_app.control.revoke(task_id, terminate=True, signal="SIGTERM")
