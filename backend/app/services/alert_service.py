"""
All alert channels are free and run locally / via free APIs.
Runs synchronously — safe to call from Celery workers.
"""
import smtplib
import json
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from pathlib import Path

import httpx
import structlog

log = structlog.get_logger()


def dispatch_all(
    db,
    *,
    detection_id: str,
    person: dict,
    camera: dict | None,
    snapshot_path: str | None,
    settings,
) -> None:
    """Fire all configured alert channels for a match."""
    person_name = person.get("name", "Unknown")
    contact = person.get("alert_contact", {})
    score = None

    # Build message
    location_str = ""
    if camera and camera.get("location"):
        loc = camera["location"]
        location_str = f"\nLocation: {loc.get('lat', '')}, {loc.get('lng', '')} — {loc.get('address', '')}"

    message = (
        f"🚨 ALERT: {person_name} detected!\n"
        f"Category: {person.get('category', 'unknown')}\n"
        f"Time: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}"
        f"{location_str}"
    )

    # 1. Telegram (primary)
    tg_chat = contact.get("telegram_chat_id") or ""
    if tg_chat and settings.telegram_bot_token:
        _send_telegram(settings.telegram_bot_token, tg_chat, message, snapshot_path, db, detection_id, person)

    # 2. Email (secondary)
    email_to = contact.get("email") or ""
    if email_to and settings.smtp_user and settings.smtp_password:
        _send_email(settings, email_to, f"Alert: {person_name} detected", message, snapshot_path, db, detection_id, person)

    # 3. ntfy push notification
    ntfy_topic = contact.get("ntfy_topic") or ""
    if ntfy_topic:
        _send_ntfy(settings.ntfy_base_url, ntfy_topic, message, db, detection_id, person)

    # 4. Police station (live camera only)
    if camera:
        ps = camera.get("police_station", {})
        webhook_url = ps.get("webhook_url") or ""
        ps_tg = ps.get("telegram_chat_id") or ""
        ps_ntfy = ps.get("ntfy_topic") or ""

        payload = {
            "person_name": person_name,
            "category": person.get("category"),
            "detection_id": detection_id,
            "location": camera.get("location"),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if webhook_url:
            _send_webhook(webhook_url, payload, db, detection_id, person)
        if ps_tg and settings.telegram_bot_token:
            _send_telegram(settings.telegram_bot_token, ps_tg, message, snapshot_path, db, detection_id, person)
        if ps_ntfy:
            _send_ntfy(settings.ntfy_base_url, ps_ntfy, message, db, detection_id, person)


# ── channel implementations ───────────────────────────────────────────────────

def _send_telegram(token: str, chat_id: str, text: str, photo_path: str | None, db, detection_id, person):
    status, error = "failed", None
    try:
        url = f"https://api.telegram.org/bot{token}"
        with httpx.Client(timeout=10) as client:
            if photo_path and Path(photo_path).exists():
                with open(photo_path, "rb") as f:
                    r = client.post(f"{url}/sendPhoto", data={"chat_id": chat_id, "caption": text}, files={"photo": f})
            else:
                r = client.post(f"{url}/sendMessage", json={"chat_id": chat_id, "text": text})
        r.raise_for_status()
        status = "sent"
        log.info("alert.telegram.sent", chat_id=chat_id)
    except Exception as e:
        error = str(e)
        log.warning("alert.telegram.failed", error=error)
    _save_alert(db, detection_id, person, "telegram", chat_id, text, status, error)


def _send_email(settings, to: str, subject: str, body: str, photo_path: str | None, db, detection_id, person):
    status, error = "failed", None
    try:
        msg = MIMEMultipart()
        msg["From"] = settings.smtp_user
        msg["To"] = to
        msg["Subject"] = subject
        msg.attach(MIMEText(body, "plain"))
        if photo_path and Path(photo_path).exists():
            with open(photo_path, "rb") as f:
                img = MIMEImage(f.read())
                img.add_header("Content-Disposition", "attachment", filename="detection.jpg")
                msg.attach(img)
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
            smtp.starttls()
            smtp.login(settings.smtp_user, settings.smtp_password)
            smtp.send_message(msg)
        status = "sent"
        log.info("alert.email.sent", to=to)
    except Exception as e:
        error = str(e)
        log.warning("alert.email.failed", error=error)
    _save_alert(db, detection_id, person, "email", to, body, status, error)


def _send_ntfy(base_url: str, topic: str, message: str, db, detection_id, person):
    status, error = "failed", None
    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(f"{base_url}/{topic}", content=message.encode(),
                            headers={"Title": "Surveillance Alert", "Priority": "urgent", "Tags": "rotating_light"})
        r.raise_for_status()
        status = "sent"
        log.info("alert.ntfy.sent", topic=topic)
    except Exception as e:
        error = str(e)
        log.warning("alert.ntfy.failed", error=error)
    _save_alert(db, detection_id, person, "ntfy", topic, message, status, error)


def _send_webhook(url: str, payload: dict, db, detection_id, person):
    status, error = "failed", None
    try:
        with httpx.Client(timeout=5) as client:
            r = client.post(url, json=payload)
        r.raise_for_status()
        status = "sent"
        log.info("alert.webhook.sent", url=url)
    except Exception as e:
        error = str(e)
        log.warning("alert.webhook.failed", error=error)
    _save_alert(db, detection_id, person, "webhook", url, json.dumps(payload), status, error)


def _save_alert(db, detection_id, person, channel, recipient, message, status, error):
    from bson import ObjectId
    now = datetime.now(timezone.utc)
    try:
        db.alerts.insert_one({
            "detection_id": ObjectId(detection_id) if ObjectId.is_valid(str(detection_id)) else detection_id,
            "person_id": person.get("_id"),
            "person_name": person.get("name", ""),
            "channel": channel,
            "recipient": recipient,
            "message": message,
            "status": status,
            "error": error,
            "sent_at": now,
        })
    except Exception as e:
        log.warning("alert.save_failed", error=str(e))
