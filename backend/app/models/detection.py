from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class BBox(BaseModel):
    x1: int
    y1: int
    x2: int
    y2: int


class DetectionResponse(BaseModel):
    id: str
    source_type: str                    # camera | video_file | image
    source_id: Optional[str] = None
    frame_timestamp: datetime
    bounding_box: Optional[BBox] = None
    snapshot_url: Optional[str] = None
    person_id: Optional[str] = None
    person_name: Optional[str] = None
    match_score: Optional[float] = None
    confidence: Optional[str] = None    # HIGH | REVIEW
    location: Optional[dict] = None
    created_at: datetime
