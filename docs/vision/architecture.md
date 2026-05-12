# System Architecture

## Tech Stack (As Built)

### Frontend — React + Vite + TailwindCSS

| Choice | Reason |
|---|---|
| React 18 + Vite | Fast DX, component model maps cleanly to dashboard panels |
| TailwindCSS | Polished dark UI with minimal custom CSS |
| TanStack Query (React Query) | Server-state caching, auto-refetch for detection/alert feeds |
| Socket.IO client | Real-time detection events pushed from backend — zero polling |
| Axios | HTTP client with base URL + interceptors |

### Backend — FastAPI (Python)

| Choice | Reason |
|---|---|
| FastAPI | Native async, auto OpenAPI docs at `/docs`, Pydantic validation |
| python-socketio + `socketio.ASGIApp` | Embeds Socket.IO server into FastAPI — single process, single port |
| Celery + Redis | Offloads all AI inference to background workers; HTTP server stays responsive |
| Motor (async) | MongoDB driver for FastAPI async routes |
| pymongo (sync) | MongoDB driver for Celery workers (no async loop in worker context) |
| structlog | JSON structured logging — every event queryable by field |
| httpx | Async HTTP for Telegram Bot API and ntfy.sh alerts |

### AI / ML (All Free, All Local)

| Library | Role |
|---|---|
| **InsightFace `buffalo_l`** (ArcFace R100) | Face detection (RetinaFace) + 512-d embedding. 99.77% LFW accuracy |
| **RetinaFace** (bundled in InsightFace) | Best open-source face detector — handles occlusion, small faces, crowds |
| **DeepSORT** (`deep-sort-realtime`) | Multi-object tracking — one alert per person per camera visit |
| **OpenCV** | Frame capture (RTSP, webcam, video file), motion detection, preprocessing |
| **ONNX Runtime** | CPU inference engine for InsightFace ONNX models |
| numpy | Batch cosine matching — single `matmul` across all enrolled persons |

### Database — MongoDB (local)

```
mongodb://localhost:27017/AI_Enhanced_Service
```

Fully local — no Atlas, no cloud. Motor for async FastAPI routes; pymongo for Celery workers.

### Real-time Layer — Redis + Socket.IO

```
Celery workers  →  Redis PUB "detections"  →  FastAPI background coroutine  →  Socket.IO → Browser
```

Both Redis and MongoDB run locally. No cloud subscription required.

---

## Alerting — 100% Free

| Channel | Service | Cost | Best for |
|---|---|---|---|
| Dashboard toast | Socket.IO (self-hosted) | Free | Operators watching the dashboard |
| Push notification | ntfy.sh | Free | Personnel on the move |
| Photo + message | Telegram Bot API | Free | Primary alert channel |
| Email with snapshot | Gmail SMTP (stdlib smtplib) | Free | Audit trail |
| HTTP webhook | Any URL | Free | Police station integration |

### Why Telegram over WhatsApp
- Official Bot API — no browser automation, no account bans
- Supports photo messages (sends the face crop snapshot)
- Group chats for alerting all personnel simultaneously
- Free, instant, works on any device
- Setup: 2 minutes via `@BotFather`

---

## System Diagram

```
Browser (React)
    │  REST /api/*               WebSocket /socket.io
    ▼                                    ▲
┌────────────────────────────────────────────┐
│             FastAPI + Socket.IO            │
│  (socketio.ASGIApp wraps FastAPI)          │
│  /api/persons    /api/cameras              │
│  /api/alerts     /api/detections           │
│  /api/media      /health                   │
│  Socket.IO server (async Redis subscriber) │
└───────┬────────────────────────────────────┘
        │ enqueue tasks (Redis broker)
        ▼
┌─────────────────────────┐
│     Redis               │
│  • Celery broker        │
│  • Celery result backend│
│  • Pub/Sub "detections" │
└───────┬─────────────────┘
        │
┌───────┴────────────┐
│  Celery Workers    │
│  (--pool=threads   │  ← Windows-compatible
│   on Windows)      │
│                    │
│  analyze_image     │  ← short-lived (< 1s)
│  analyze_video     │  ← medium (seconds-minutes)
│  stream_worker     │  ← long-running (indefinite)
│                    │
│  InsightFace       │
│  DeepSORT          │
│  OpenCV RTSP       │
└───────┬────────────┘
        │ publish match events
        ▼
    Redis "detections" channel
        │
        ▼ (FastAPI background coroutine subscribes)
    Socket.IO → all connected browsers
        │
        ▼
    Alert Dispatcher
    • Telegram Bot (httpx → api.telegram.org)
    • Gmail SMTP (smtplib stdlib)
    • ntfy.sh (httpx POST)
    • Webhook (httpx POST JSON)
```

---

## Windows-specific Notes

| Issue | Solution |
|---|---|
| Celery `fork()` not available | `--pool=threads --concurrency=4` |
| Native MongoDB service conflict | Stop native service or use `docker compose stop mongo` |
| OpenCV `.pyd` missing | `pip install opencv-python==4.10.0.84` (pin to avoid headless conflict) |
| InsightFace build fails | Install Visual C++ Build Tools first |

---

## Non-Goals (MVP)

- Auth / JWT — add later as FastAPI middleware, zero refactor needed
- GPU inference — CPU InsightFace handles ≤4 simultaneous streams adequately
- Multi-tenancy
- Kubernetes — docker-compose is sufficient for this deployment scale
