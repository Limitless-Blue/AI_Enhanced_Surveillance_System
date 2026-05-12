# Database Schema

Database: `AI_Enhanced_Service`
Driver: `motor` (async) for FastAPI routes · `pymongo` (sync) inside Celery workers

> **Case sensitivity**: MongoDB enforces case-sensitive database names but rejects new databases whose names differ only by case from an existing one. Always use `AI_Enhanced_Service` (capital S). If a previous session created `AI_Enhanced_service` (lowercase s), drop it before starting:
> `python -c "from pymongo import MongoClient; MongoClient().drop_database('AI_Enhanced_service')"`

---

## Collection: `persons`

Stores the profile and face embedding of every tracked individual.

```json
{
  "_id": "ObjectId",
  "name": "string (unique)",
  "category": "suspect | victim | accused",
  "alert_contact": {
    "telegram_chat_id": "string | null",
    "email": "string | null",
    "ntfy_topic": "string | null"
  },
  "other_details": "string | null",
  "image_path": "string (relative path under uploads/persons/)",
  "image_url": "string (served as /uploads/persons/...)",
  "embedding": [0.012, -0.453, ...],
  "has_embedding": true,
  "num_images": 1,
  "created_at": "ISODate",
  "updated_at": "ISODate"
}
```

**Indexes:**
- `{ name: 1 }` — unique
- `{ category: 1 }`
- `{ created_at: -1 }`

At startup (and after each enrollment/delete), all embeddings are loaded into a
`(N, 512)` numpy matrix in the FastAPI process. Matching is one `matmul` call —
not an N-loop. This handles tens of thousands of persons with sub-millisecond
latency per frame.

---

## Collection: `cameras`

Registered video sources.

```json
{
  "_id": "ObjectId",
  "name": "string",
  "source": "string (RTSP URL | '0' for webcam | file path)",
  "location": {
    "lat": 17.385044,
    "lng": 78.486671,
    "address": "string | null"
  },
  "match_threshold": 0.45,
  "frame_skip": 3,
  "is_active": false,
  "celery_task_id": "string | null",
  "police_station": {
    "webhook_url": "string | null",
    "telegram_chat_id": "string | null",
    "ntfy_topic": "string | null"
  },
  "created_at": "ISODate"
}
```

**Indexes:**
- `{ is_active: 1 }`

On server startup, `_reset_active_cameras()` sets all `is_active → false` because Celery workers do not survive a server restart — their task IDs are no longer valid.

---

## Collection: `detections`

Every matched face detection event.

```json
{
  "_id": "ObjectId",
  "source_type": "camera | video_file | image",
  "source_id": "ObjectId | null",
  "person_id": "ObjectId | null",
  "person_name": "string | null",
  "match_score": 0.73,
  "confidence": "HIGH | REVIEW",
  "bounding_box": { "x1": 120, "y1": 45, "x2": 200, "y2": 145 },
  "snapshot_path": "string (face crop saved to uploads/snapshots/)",
  "snapshot_url": "string (served as /uploads/snapshots/...)",
  "location": {
    "lat": 17.385044,
    "lng": 78.486671
  },
  "created_at": "ISODate"
}
```

**Indexes:**
- `{ created_at: -1 }` — primary query pattern
- `{ person_id: 1, created_at: -1 }`
- `{ source_id: 1 }`
- TTL index: `{ created_at: 1 }` with `expireAfterSeconds: 7776000` (90 days)

---

## Collection: `alerts`

One document per dispatched alert. A single detection produces one alert per configured channel.

```json
{
  "_id": "ObjectId",
  "detection_id": "ObjectId",
  "person_id": "ObjectId",
  "person_name": "string",
  "channel": "telegram | email | ntfy | webhook | in_app",
  "recipient": "string (chat_id | email address | ntfy topic | URL)",
  "message": "string",
  "status": "sent | failed | pending",
  "error": "string | null",
  "sent_at": "ISODate | null"
}
```

**Indexes:**
- `{ detection_id: 1 }`
- `{ status: 1, sent_at: -1 }`

Failed alerts log the full error string — visible in the Alert Log UI.

---

## Collection: `media_jobs`

Tracks async processing of uploaded files.

```json
{
  "_id": "ObjectId",
  "filename": "string",
  "file_path": "string",
  "file_type": "image | video",
  "celery_task_id": "string",
  "status": "queued | processing | done | failed",
  "total_frames": 1200,
  "processed_frames": 847,
  "detections_found": 3,
  "error": "string | null",
  "created_at": "ISODate",
  "completed_at": "ISODate | null"
}
```

**Indexes:**
- `{ status: 1, created_at: -1 }`

---

## Index Summary

```
persons:     name_1 (unique) · category_1 · created_at_-1
cameras:     is_active_1
detections:  created_at_-1 · person_id_1+created_at_-1 · source_id_1 · created_at_1 (TTL 90d)
alerts:      detection_id_1 · status_1+sent_at_-1
media_jobs:  status_1+created_at_-1
```

All indexes are created at server startup via `_create_indexes()` in `database.py`.
