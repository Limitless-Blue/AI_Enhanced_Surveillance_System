from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class AlertResponse(BaseModel):
    id: str
    detection_id: str
    person_id: str
    person_name: str
    channel: str                        # telegram | email | ntfy | webhook | in_app
    recipient: str
    message: str
    status: str                         # sent | failed | pending
    error: Optional[str] = None
    sent_at: Optional[datetime] = None
