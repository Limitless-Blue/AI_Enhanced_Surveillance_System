from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class AlertContact(BaseModel):
    telegram_chat_id: str = ""
    email: str = ""
    ntfy_topic: str = ""


class PersonCreate(BaseModel):
    name: str
    category: str = "suspect"          # suspect | victim | accused
    alert_contact: AlertContact = Field(default_factory=AlertContact)
    other_details: str = ""


class PersonResponse(BaseModel):
    id: str
    name: str
    category: str
    alert_contact: AlertContact
    other_details: str
    image_url: Optional[str] = None
    has_embedding: bool = False
    num_images: int = 0
    created_at: datetime
    updated_at: Optional[datetime] = None
