from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MediaJobResponse(BaseModel):
    id: str
    filename: str
    file_path: str
    file_type: str                      # image | video
    celery_task_id: Optional[str] = None
    status: str                         # queued | processing | done | failed
    total_frames: int = 0
    processed_frames: int = 0
    detections_found: int = 0
    error: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None
