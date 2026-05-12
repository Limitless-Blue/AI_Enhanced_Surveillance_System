# AI-Enhanced Surveillance — Vision & Architecture

This directory contains the architectural vision and implementation reference for the system.

**Status: All 12 phases implemented and verified.**

| Document | Contents |
|---|---|
| [phases.md](phases.md) | Phase-wise implementation plan with completion status |
| [architecture.md](architecture.md) | Tech stack, system diagram, service boundaries |
| [ai-pipeline.md](ai-pipeline.md) | Face detection, recognition, tracking, alert flow |
| [database-schema.md](database-schema.md) | MongoDB collections, indexes, TTL strategy |
| [realtime-strategy.md](realtime-strategy.md) | WebSocket, Redis Pub/Sub, Celery task queue |
| [folder-structure.md](folder-structure.md) | Monorepo layout |

## System Summary

A FastAPI + React web platform that ingests images, videos, and live RTSP camera streams, runs an async AI face-recognition pipeline (InsightFace ArcFace R100 + DeepSORT tracking), matches detections against a MongoDB person database, and fires real-time alerts (Telegram, Email, ntfy.sh, Webhooks) to assigned personnel and police stations — all at **zero cost**.

## Running the System

See the root [README.md](../../README.md) for setup instructions.

**Quick start (all services running):**

```
Terminal 1: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
Terminal 2: celery -A app.tasks.celery_app worker --loglevel=info --pool=threads --concurrency=4
Terminal 3: cd frontend && npm run dev
```

Open http://localhost:5173
