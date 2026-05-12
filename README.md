# AI-Enhanced Surveillance System

A production-ready, zero-cost AI surveillance platform with real-time face recognition, live RTSP stream processing, and multi-channel alert dispatch.

## Stack

| Layer | Technology |
|---|---|
| Face Recognition | InsightFace `buffalo_l` — ArcFace R100 (99.77% LFW) |
| Face Detection | RetinaFace (bundled in InsightFace) |
| Multi-object Tracking | DeepSORT (`deep-sort-realtime`) |
| Backend API | FastAPI + python-socketio (single ASGI process) |
| Task Queue | Celery + Redis |
| Database | MongoDB 7 — Motor (async) + pymongo (sync) |
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| Real-time Events | Socket.IO over Redis Pub/Sub |
| Alert Channels | Telegram Bot API, Gmail SMTP, ntfy.sh, HTTP Webhooks |

---

## Prerequisites

- **Docker Desktop** — provides Redis (and optionally MongoDB)
- **Python 3.10+**
- **Node.js 18+**

> **Windows users**: if you have a native MongoDB service installed, read the [MongoDB setup section](#mongodb-setup-windows) below before proceeding.

---

## Quick Start

### 1. Clone & configure

```bash
git clone <repo-url>
cd AI-Enhanced-Surveillance
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
MONGO_URI=mongodb://localhost:27017/
MONGO_DB_NAME=AI_Enhanced_Service
REDIS_URL=redis://localhost:6379/0

# Alert channels (all optional — configure only what you use)
TELEGRAM_BOT_TOKEN=
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM=you@gmail.com
NTFY_BASE_URL=https://ntfy.sh
```

### 2. Start infrastructure (Redis + MongoDB)

```bash
docker compose up -d
```

### 3. Backend

```bash
cd backend
python -m venv .venv

# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

> First run downloads the InsightFace `buffalo_l` model (~180 MB) to `~/.insightface/`.

> **Windows — Visual C++ Build Tools required** for InsightFace. Download from:
> https://visualstudio.microsoft.com/visual-cpp-build-tools/

### 4. Celery worker (second terminal)

```bash
cd backend
.venv\Scripts\activate   # or source .venv/bin/activate

# Windows — must use threads pool (no fork()):
celery -A app.tasks.celery_app worker --loglevel=info --pool=threads --concurrency=4

# macOS/Linux:
celery -A app.tasks.celery_app worker --loglevel=info
```

### 5. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**

---

## MongoDB Setup (Windows)

Windows often ships with a native MongoDB service that conflicts with the Docker container — both try to bind `localhost:27017`. The symptom is a `DatabaseDifferCase` error on startup.

**Check if the native service is running:**

```powershell
Get-Service -Name "*mongo*"
```

**Option A — Use Docker MongoDB (recommended for this project)**

Run in an **Administrator** PowerShell:

```powershell
Stop-Service MongoDB
Set-Service MongoDB -StartupType Manual
```

Then start Docker containers normally:

```bash
docker compose up -d
```

**Option B — Keep using the native MongoDB**

Stop the Docker MongoDB container so it doesn't conflict, keep Redis in Docker:

```powershell
docker compose stop mongo
```

Either way, if you see `DatabaseDifferCase` (`code 13297`), it means a database named `AI_Enhanced_service` (lowercase `s`) was created in a previous session. Drop it:

```python
# Run once from backend/ with .venv activated:
python -c "from pymongo import MongoClient; MongoClient().drop_database('AI_Enhanced_service')"
```

---

## Features

### Person Enrollment
- Enroll suspects, victims, or accused persons with a face photo
- Add multiple images per person — embeddings are averaged for higher accuracy
- Quick image search to identify a person from any uploaded photo

### Live Camera Streams
- Register RTSP cameras, IP cameras, or webcam (source `0`)
- Start/stop streams from the UI — each stream runs as an isolated Celery task
- Per-camera configuration: match threshold, frame skip, GPS coordinates
- Per-camera police station alert routing: webhook + Telegram + ntfy

### Media Analysis
- Upload images or videos for offline face matching
- Video jobs run in background with per-frame progress tracking

### Detection & Alerting

| Score | Level | Action |
|---|---|---|
| ≥ 0.60 | HIGH | Auto-alert dispatched to all configured channels |
| 0.45–0.59 | REVIEW | Saved to Review Queue for operator confirmation |
| < 0.45 | — | Not recorded |

- Per-person channels: Telegram, Email, ntfy.sh
- Per-camera police station channels: Webhook, Telegram, ntfy.sh
- 60-second cooldown per person per camera (no alert spam)

### Dashboard
- Live detection feed via Socket.IO (zero polling)
- Red toast notifications for HIGH-confidence matches
- Stats: enrolled persons · detections today · high-confidence count

---

## Architecture

```
Browser (React)
    │  REST /api/*               WebSocket /socket.io
    ▼                                    ▲
FastAPI (uvicorn) ◄──── Redis Pub/Sub ────► Celery Workers
    │                                            │
    ▼                                            ▼
MongoDB (Motor async)              InsightFace + DeepSORT
                                   MongoDB (pymongo sync)
```

**Key design decisions:**
- `socketio.ASGIApp` wraps FastAPI — single process, single port 8000
- Workers publish detection events to Redis channel `"detections"`; a FastAPI background coroutine subscribes and re-emits via Socket.IO to all browser clients
- All enrolled embeddings are loaded into a `(N, 512)` numpy matrix at startup — matching is one `matmul` call, O(1) regardless of enrolled persons count
- DeepSORT tracks identities across frames and averages embeddings over a 5-frame buffer — reduces false positives from motion blur and partial occlusion
- Windows Celery must use `--pool=threads` (no `fork()` on Windows)

---

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | System health + enrolled person count |
| GET | `/api/persons` | List enrolled persons |
| POST | `/api/persons` | Enroll person (multipart: `name`, `category`, `image`) |
| POST | `/api/persons/{id}/images` | Add enrollment image |
| DELETE | `/api/persons/{id}` | Delete person + embeddings |
| POST | `/api/persons/search` | Search by photo |
| GET | `/api/cameras` | List cameras |
| POST | `/api/cameras` | Register camera |
| POST | `/api/cameras/{id}/start` | Start stream worker |
| POST | `/api/cameras/{id}/stop` | Stop stream worker |
| DELETE | `/api/cameras/{id}` | Delete camera |
| POST | `/api/media/upload` | Upload image or video for analysis |
| GET | `/api/media/jobs` | List media processing jobs |
| GET | `/api/detections` | Detections (params: `limit`, `confidence`) |
| GET | `/api/alerts` | Alert dispatch history |

Interactive docs: **http://localhost:8000/docs**

---

## Free Alert Setup

### Telegram
1. Message `@BotFather` → `/newbot` → copy the token
2. Start a DM with the bot or add it to a group, then fetch the chat ID:
   `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Set `TELEGRAM_BOT_TOKEN` in `.env`; enter the chat ID per-person or per-camera in the UI

### Gmail
1. Enable 2-Step Verification on your Google account
2. Google Account → Security → App Passwords → create one for "Mail"
3. Use the 16-character app password as `SMTP_PASS`

### ntfy.sh
1. No account needed — pick any unique topic name
2. Subscribe at `https://ntfy.sh/<your-topic>` or the ntfy mobile app
3. Enter the topic name per-person or per-camera in the UI

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | `mongodb://localhost:27017/` | MongoDB connection string |
| `MONGO_DB_NAME` | `AI_Enhanced_Service` | Database name (case-sensitive) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `UPLOADS_DIR` | `uploads` | Directory for face crop snapshots |
| `TELEGRAM_BOT_TOKEN` | — | From `@BotFather` |
| `SMTP_HOST` | `smtp.gmail.com` | SMTP server |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS) |
| `SMTP_USER` | — | SMTP login email |
| `SMTP_PASS` | — | SMTP password / Gmail App Password |
| `NTFY_BASE_URL` | `https://ntfy.sh` | ntfy server URL |

---

## Troubleshooting

**`DatabaseDifferCase` error on startup**
A database with a different case (`AI_Enhanced_service`) already exists. Drop it:
```python
python -c "from pymongo import MongoClient; MongoClient().drop_database('AI_Enhanced_service')"
```

**`Celery` not processing tasks on Windows**
Must use `--pool=threads`. The default `prefork` pool requires `fork()` which is unavailable on Windows.

**InsightFace install fails**
Install Visual C++ Build Tools first: https://visualstudio.microsoft.com/visual-cpp-build-tools/

**`cv2` import error / missing .pyd**
Conflicting OpenCV versions. Fix:
```bash
pip uninstall opencv-python opencv-python-headless -y
pip install opencv-python==4.10.0.84
```

**Port 27017 conflict**
A native Windows MongoDB service holds the port. Either stop it (Admin PowerShell: `Stop-Service MongoDB`) or run `docker compose stop mongo` and use the native service.

---

## License

Apache License
