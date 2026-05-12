from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class Location(BaseModel):
    lat: float = 0.0
    lng: float = 0.0
    address: str = ""


class PoliceStation(BaseModel):
    webhook_url: str = ""
    telegram_chat_id: str = ""
    ntfy_topic: str = ""


class CameraCreate(BaseModel):
    name: str
    source: str                         # RTSP URL | "0" for webcam | file path
    location: Location = Field(default_factory=Location)
    match_threshold: float = 0.45
    frame_skip: int = 3
    police_station: PoliceStation = Field(default_factory=PoliceStation)


class CameraResponse(BaseModel):
    id: str
    name: str
    source: str
    location: Location
    match_threshold: float
    frame_skip: int
    is_active: bool
    celery_task_id: Optional[str] = None
    police_station: PoliceStation
    created_at: datetime
