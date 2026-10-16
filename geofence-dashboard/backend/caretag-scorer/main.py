from fastapi import FastAPI
from pydantic import BaseModel
import os
import joblib
import numpy as np

app = FastAPI(title="CareTag Scorer")

class ScoreRequest(BaseModel):
    latitude: float
    longitude: float
    timestamp: str | None = None
    speed: float | None = None
    deviceKey: str | None = None

class ScoreResponse(BaseModel):
    deviation_score: float
    motion_state: str | None = None

# Try to load models from /app/models if present
KMEANS_PATH = "/app/models/kmeans_model.joblib"
LSTM_PATH = "/app/models/lstm_routine_model.pth"

kmeans = None
lstm = None
try:
    if os.path.exists(KMEANS_PATH):
        kmeans = joblib.load(KMEANS_PATH)
except Exception:
    kmeans = None

# LSTM is optional; import torch only if file exists
try:
    if os.path.exists(LSTM_PATH):
        import torch
        lstm = torch.load(LSTM_PATH, map_location='cpu')
except Exception:
    lstm = None

@app.post("/score", response_model=ScoreResponse)
async def score(req: ScoreRequest):
    # If models are available, run model inference (simple placeholders here)
    if kmeans is not None:
        try:
            # simple proxy: predict cluster distance as anomaly proxy
            coords = np.array([[req.latitude, req.longitude]])
            cluster = kmeans.predict(coords)
            centers = kmeans.cluster_centers_[cluster[0]]
            dist = np.linalg.norm(coords - centers)
            score = float(min(1.0, dist / 1000.0))
            motion = 'moving' if (req.speed or 0) > 1.0 else 'stationary'
            return {"deviation_score": score, "motion_state": motion}
        except Exception:
            pass

    # Fallback heuristic when models are not present
    speed = req.speed or 0
    if speed > 15:
        score = 0.9
        motion = 'moving'
    elif speed > 3:
        score = 0.6
        motion = 'moving'
    else:
        score = 0.05
        motion = 'stationary'

    return {"deviation_score": score, "motion_state": motion}
