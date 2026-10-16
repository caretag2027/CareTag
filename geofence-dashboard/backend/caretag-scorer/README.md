CareTag scorer service

This tiny FastAPI service exposes POST /score to compute a deviation score and motion_state for an incoming packet.

Usage (local with models mounted):

1. Build image from `backend` folder:

```bash
cd backend
docker build -t caretag-scorer:local -f caretag-scorer/Dockerfile caretag-scorer
```

2. Run with models mounted:

```bash
docker run -p 8000:8000 -v /path/to/CareTag/outputs/models:/app/models caretag-scorer:local
```

The service will attempt to load `kmeans_model.joblib` and optionally `lstm_routine_model.pth`. When models are missing it uses a simple speed-based heuristic.
