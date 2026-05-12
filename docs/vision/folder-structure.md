# Folder Structure

Monorepo layout. `backend/` and `frontend/` are independent packages with their
own dependency files. A root `docker-compose.yml` wires them together.

```
AI-Enhanced-Surveillance/
│
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app factory, mounts routers + Socket.IO
│   │   ├── config.py                # Settings via pydantic-settings (env vars)
│   │   ├── database.py              # Motor (async MongoDB) client singleton
│   │   │
│   │   ├── api/                     # HTTP route handlers (thin controllers)
│   │   │   ├── __init__.py
│   │   │   ├── persons.py           # CRUD for suspects/victims/accused
│   │   │   ├── cameras.py           # Register / list / remove camera feeds
│   │   │   ├── media.py             # Upload images / video files for analysis
│   │   │   ├── detections.py        # Query detection history
│   │   │   └── alerts.py            # Query alert log
│   │   │
│   │   ├── ws/                      # WebSocket / Socket.IO
│   │   │   ├── __init__.py
│   │   │   └── events.py            # Socket.IO server + Redis subscriber
│   │   │
│   │   ├── models/                  # Pydantic schemas (request/response shapes)
│   │   │   ├── person.py
│   │   │   ├── camera.py
│   │   │   ├── detection.py
│   │   │   └── alert.py
│   │   │
│   │   ├── services/                # Business logic (called by routes + workers)
│   │   │   ├── person_service.py    # Insert / search persons
│   │   │   ├── camera_service.py    # RTSP stream lifecycle
│   │   │   ├── alert_service.py     # Build + dispatch alerts
│   │   │   └── media_service.py     # Save uploads, extract frames
│   │   │
│   │   ├── ai/                      # AI pipeline (the star of the show)
│   │   │   ├── __init__.py
│   │   │   ├── detector.py          # YOLOv8 person detection wrapper
│   │   │   ├── embedder.py          # InsightFace embedding extraction
│   │   │   ├── matcher.py           # Cosine-similarity search against MongoDB
│   │   │   ├── pipeline.py          # Orchestrates detector → embedder → matcher
│   │   │   └── stream_reader.py     # OpenCV RTSP / webcam frame producer
│   │   │
│   │   ├── tasks/                   # Celery task definitions
│   │   │   ├── __init__.py
│   │   │   ├── celery_app.py        # Celery instance + Redis broker config
│   │   │   ├── analyze_video.py     # Process uploaded video file async
│   │   │   ├── analyze_image.py     # Process single uploaded image async
│   │   │   └── stream_worker.py     # Long-running task: read RTSP stream frames
│   │   │
│   │   └── utils/
│   │       ├── logging.py           # Structured JSON logger (structlog)
│   │       ├── geo.py               # Lat/lng utilities, nearest-station lookup
│   │       └── image.py             # Resize, normalize, base64 helpers
│   │
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_persons_api.py
│   │   ├── test_ai_pipeline.py
│   │   └── test_matcher.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   └── .env.example
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx        # Live detection feed + alert toasts
│   │   │   ├── Persons.tsx          # Add / view suspects/victims/accused
│   │   │   ├── Cameras.tsx          # Register camera feeds, view map
│   │   │   ├── MediaUpload.tsx      # Upload images or video files
│   │   │   └── AlertLog.tsx         # Historical alert timeline
│   │   │
│   │   ├── components/
│   │   │   ├── PersonCard.tsx
│   │   │   ├── DetectionFeed.tsx    # Live scrolling detection events
│   │   │   ├── CameraMap.tsx        # Leaflet map of cameras
│   │   │   ├── AlertToast.tsx
│   │   │   └── UploadZone.tsx
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSocket.ts         # Socket.IO connection hook
│   │   │   └── useDetections.ts     # React Query hook for detection history
│   │   │
│   │   ├── api/                     # Axios wrappers for REST endpoints
│   │   │   ├── persons.ts
│   │   │   ├── cameras.ts
│   │   │   └── media.ts
│   │   │
│   │   └── lib/
│   │       └── socket.ts            # Socket.IO client singleton
│   │
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── docs/
│   └── vision/                      # ← you are here
│
├── docker-compose.yml               # MongoDB + Redis + backend + frontend
├── docker-compose.dev.yml           # Hot-reload overrides
└── README.md
```

## Key Design Principles in This Layout

- **`api/` = thin controllers.** No business logic in route handlers — they
  call `services/`.
- **`services/` = business logic.** Reusable by both HTTP routes and Celery
  tasks, so the same `person_service.add_person()` works from a REST call or
  from a bulk import task.
- **`ai/` = pure inference.** No FastAPI or MongoDB imports here. Each module
  takes numpy arrays in, returns typed results out. This makes unit testing
  trivial and lets you swap models without touching routing code.
- **`tasks/` = async execution boundary.** Anything that takes > 200 ms lives
  here. Routes enqueue tasks and return a job ID immediately.
