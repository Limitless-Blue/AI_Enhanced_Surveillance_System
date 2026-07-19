# Phase-wise Implementation Plan

**Status: All 12 phases complete.**

---

## Overview

```
Phase 1  ✅ Project Foundation & Dev Environment
Phase 2  ✅ Core AI Pipeline (offline, no server)
Phase 3  ✅ Backend API (FastAPI + MongoDB)
Phase 4  ✅ Person Enrollment & Search via API
Phase 5  ✅ Async Task Processing (Celery + Redis)
Phase 6  ✅ Video File & Image Analysis
Phase 7  ✅ Live Camera / RTSP Stream Processing
Phase 8  ✅ Real-Time Event Layer (Socket.IO)
Phase 9  ✅ Alert System (Telegram + Email + ntfy)
Phase 10 ✅ Frontend Dashboard (React)
Phase 11 ✅ Advanced AI Accuracy Upgrades
Phase 12 ✅ Production Hardening
```

---

## Post-Phase Refinements

Work completed after the 12-phase plan, during demo preparation:

- **UI redesign** — full "Matrix" dark theme (neon-green on near-black), Tailwind v4
  `@theme` tokens, reusable `matrix/` component library, liquid-glass chrome
  (top bar, logo tile, stat tiles, toasts, upload drop zone), radar-eye logo +
  favicon, rebranded to **AI SURVEILLANCE**.
- **AI correctness fixes** (see [ai-pipeline.md](ai-pipeline.md)):
  - `FaceMatcher` now L2-normalizes every embedding on input. Previously raw
    ArcFace vectors were treated as unit-length, inflating all scores ~500× and
    making every face match as HIGH.
  - `_handle_match` no longer dead-returns on a non-existent `match.person`
    attribute — image/video/stream analysis now actually persists detections
    and dispatches alerts.
- **API consistency** — health endpoint moved from `/health` to `/api/health`
  so it sits under the same prefix as every other route (and the frontend proxy).

---

## Phase 1 ✅ — Project Foundation & Dev Environment

**Goal:** Monorepo scaffolded, all tools installed, services running locally.

### Delivered
- Monorepo: `backend/` + `frontend/` + `docker-compose.yml`
- `backend/app/config.py` — pydantic-settings with `.env` support
- `docker-compose.yml` — MongoDB 7 + Redis 7-alpine with health checks
- `backend/.env.example` — all config keys documented
- `.gitignore` — excludes uploads/, .insightface/, node_modules, .env
- FastAPI `/api/health` endpoint returning system status

### Notes
- Windows: native MongoDB service may conflict with Docker on port 27017.
  Either stop the native service (Admin PowerShell: `Stop-Service MongoDB`) or
  use `docker compose stop mongo` and connect to the native instance.
- If you see `DatabaseDifferCase` (code 13297), a previous session created the DB
  with wrong casing. Fix: `python -c "from pymongo import MongoClient; MongoClient().drop_database('AI_Enhanced_service')"`

---

## Phase 2 ✅ — Core AI Pipeline (Standalone)

**Goal:** Prove the AI works correctly before wiring it to any API.

### Delivered
- `backend/app/ai/embedder.py` — `FaceEmbedder` wrapping `FaceAnalysis(name="buffalo_l")`
- `backend/app/ai/quality.py` — `is_quality_face()`: min 60px, sharpness ≥ 80, det_score ≥ 0.85
- `backend/app/ai/matcher.py` — `FaceMatcher` with numpy matmul batch cosine similarity
- `backend/app/ai/stream_reader.py` — motion-gated frame producer (RTSP/webcam/file)
- `backend/app/ai/pipeline.py` — orchestrates quality → embed → match → result

### Notes
- `buffalo_l` auto-downloads to `~/.insightface/` on first run (~180 MB total)
- Windows: if `cv2` import fails, run:
  `pip uninstall opencv-python opencv-python-headless -y && pip install opencv-python==4.10.0.84`
- InsightFace requires Visual C++ Build Tools on Windows

---

## Phase 3 ✅ — Backend API Skeleton (FastAPI + MongoDB)

**Goal:** RESTful API running with database connection.

### Delivered
- `backend/app/database.py` — Motor async client, index creation on startup, `_reset_active_cameras()` on startup
- `backend/app/main.py` — FastAPI wrapped in `socketio.ASGIApp`, 5 routers, lifespan events
- `backend/app/models/common.py` — `doc()` / `docs()` ObjectId → string conversion
- Full Pydantic schemas: person, camera, detection, alert, media_job
- All MongoDB indexes created at startup including 90-day TTL on detections
- Serves `/uploads` as static files

---

## Phase 4 ✅ — Person Enrollment with AI

**Goal:** `POST /api/persons` accepts an image, extracts embedding, stores in MongoDB.

### Delivered
- `backend/app/api/persons.py` — multipart enrollment, image add, search, delete
- `backend/app/services/person_service.py` — `FaceMatcher` singleton with hot-reload after enrollment
- Enrollment runs in `asyncio.to_thread()` to avoid blocking the async server
- Multiple enrollment images: embeddings averaged for better accuracy
- `POST /api/persons/search` — query image returns match with name, score, confidence

---

## Phase 5 ✅ — Async Task Queue (Celery + Redis)

**Goal:** Heavy AI work runs in background workers, not in the HTTP thread.

### Delivered
- `backend/app/tasks/celery_app.py` — Celery configured with `worker_pool="threads"` (Windows-safe)
- `backend/app/tasks/_helpers.py` — shared: load persons, build matcher, handle match + save detection
- `backend/app/api/media.py` — `POST /api/media/upload` returns job_id in < 100 ms
- `GET /api/media/jobs` — lists all jobs with progress

### Notes
- Windows must use `--pool=threads --concurrency=4` (no `fork()`)
- macOS/Linux can use the default prefork pool

---

## Phase 6 ✅ — Video & Image Analysis (End-to-End)

**Goal:** Upload a video/image, pipeline runs in background, detections saved.

### Delivered
- `backend/app/tasks/analyze_image.py` — reads image → pipeline → saves HIGH detections
- `backend/app/tasks/analyze_video.py` — StreamReader with frame_skip=5, per-person dedup, progress updates every 50 frames
- `backend/app/services/detection_service.py` — saves face crop snapshots, inserts detection documents
- Detections include: person_id, match_score, confidence, snapshot_url, source_type, created_at

---

## Phase 7 ✅ — Live Camera / RTSP Stream Processing

**Goal:** Register a camera, start it, detections flow in real-time.

### Delivered
- `backend/app/tasks/stream_worker.py` — long-running Celery task: StreamReader → quality filter → tracker → matcher → 60s cooldown → Redis publish
- `backend/app/api/cameras.py` — start/stop via Celery revoke; register/delete cameras
- Camera marked inactive on worker exit (including abnormal exit)
- `_reset_active_cameras()` marks all cameras inactive on server startup (workers don't survive restart)
- Reloads enrolled persons every 100 frames to pick up new enrollments without restart

---

## Phase 8 ✅ — Real-Time Event Layer (Socket.IO)

**Goal:** Detection events reach the browser instantly without polling.

### Delivered
- `backend/app/ws/events.py` — `socketio.AsyncServer` + `start_redis_listener()` background coroutine
- Redis Pub/Sub: workers publish to `"detections"` channel → FastAPI subscribes → Socket.IO broadcasts
- `src/lib/socket.ts` — Socket.IO client singleton
- `src/hooks/useSocket.ts` — `useDetectionSocket(callback)` React hook

---

## Phase 9 ✅ — Alert System (100% Free)

**Goal:** Every HIGH-confidence match triggers configured alert channels.

### Delivered
- `backend/app/services/alert_service.py` — `dispatch_all()` fires all channels async
- **Telegram**: `httpx` POST to `api.telegram.org/sendPhoto` with face crop
- **Email**: `smtplib` STARTTLS + `email.mime` (stdlib only, zero extra deps)
- **ntfy.sh**: `httpx` POST with `Priority: urgent` header
- **Webhook**: `httpx` POST JSON with full detection payload
- Every dispatch attempt saved to `alerts` collection with status + error details
- 60-second name-based cooldown per camera stream prevents alert spam

---

## Phase 10 ✅ — Frontend Dashboard (React)

**Goal:** Complete web UI — all features accessible from the browser.

### Delivered
- `src/pages/Dashboard.tsx` — live Socket.IO feed, toast alerts, stat cards, recent detections
- `src/pages/Persons.tsx` — person cards, Add Person form (multipart), image search
- `src/pages/Cameras.tsx` — camera list, start/stop, register form with GPS fields
- `src/pages/MediaUpload.tsx` — drag-drop zone, progress bar, job list
- `src/pages/AlertLog.tsx` — alert timeline with channel icons, status badges
- `src/pages/ReviewQueue.tsx` — REVIEW detections grid with score bars
- `src/components/Layout.tsx` — sidebar navigation
- `src/lib/api.ts` — axios instance + all TypeScript interfaces
- Vite dev proxy: `/api` → `http://localhost:8000`, `/uploads` → `http://localhost:8000`
- Production build: `npm run build` passes with 0 TypeScript errors

---

## Phase 11 ✅ — Advanced AI Accuracy Upgrades

**Goal:** Push real-world accuracy beyond the base pipeline.

### Delivered
- `backend/app/ai/tracker.py` — `PersonTracker` wrapping DeepSORT with graceful fallback
  - `EMBED_BUFFER_SIZE=5` — averages last 5 frame embeddings per track
  - `mark_alerted(track_id)` — prevents re-alerting the same track
- DeepSORT integrated into `stream_worker.py` — one alert per person per visit
- Multiple enrollment images per person (averaged embeddings)
- Quality filter (size + sharpness + det_score) eliminates ~30% of false positives

### Planned but not yet integrated
- Anti-spoofing (Silent-Face / MiniFASNet) — reduces photo/screen attack risk
- AdaFace IR-50 — may improve low-light CCTV accuracy over ArcFace
- Per-person threshold overrides stored in MongoDB

---

## Phase 12 ✅ — Production Hardening

**Goal:** Stable, observable, maintainable system.

### Delivered
- `structlog` JSON structured logging throughout — every detection logged with duration_ms
- Alert failures saved with error details in `alerts` collection (status: "failed")
- MongoDB TTL index: detections auto-expire after 90 days
- FastAPI lifespan: graceful DB + Redis disconnect on shutdown
- `_reset_active_cameras()` on startup — clean state after server restart
- `docker-compose.yml` with health checks on both MongoDB and Redis
- Complete `README.md` and docs
- Frontend build verified: 0 TypeScript errors, 380 KB production bundle

---

## Phase Summary

| Phase | Focus | Status |
|---|---|---|
| 1 | Foundation | ✅ Docker + FastAPI + pydantic-settings |
| 2 | AI core | ✅ InsightFace buffalo_l — enrollment + matching proven |
| 3 | API skeleton | ✅ All REST routes + MongoDB wired |
| 4 | Enrollment API | ✅ Face embedding stored + hot-reload matcher |
| 5 | Async tasks | ✅ Celery + Redis — file upload → background job |
| 6 | File analysis | ✅ Image/video → detections saved end-to-end |
| 7 | Live cameras | ✅ RTSP stream → real-time detections |
| 8 | Real-time events | ✅ Socket.IO — detections reach browser instantly |
| 9 | Alerts | ✅ Telegram + Email + ntfy + Webhook |
| 10 | Frontend | ✅ Full React dashboard — all features in browser |
| 11 | Accuracy | ✅ DeepSORT tracking + embedding averaging |
| 12 | Hardening | ✅ Logging + TTL + graceful shutdown + README |
