# CareTag Learning Engine

**Intelligent GPS-based behavioral monitoring system** that learns routine location patterns from historical GPS data and detects real-time deviations.

Built on the **Microsoft GeoLife GPS Trajectory Dataset**.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    CareTag Learning Engine                       │
├──────────────┬──────────────────────┬──────────────────────────┤
│   Step 1     │       Step 2         │        Step 3            │
│              │                      │                          │
│  GeoLife PLT │  Temporal Sequence   │  Real-Time Anomaly       │
│  Data Loader │  Builder             │  Scorer                  │
│      ↓       │      ↓               │      ↓                  │
│  Stay Point  │  LSTM Routine        │  Deviation Score         │
│  Detector    │  Model (PyTorch)     │  Calculator              │
│      ↓       │                      │      ↓                  │
│  K-Means     │                      │  Anomaly Flag            │
│  Clustering  │                      │                          │
└──────────────┴──────────────────────┴──────────────────────────┘
```

---

## Quick Start

### 1. Install Dependencies

```bash
cd CareTag
pip install -r requirements.txt
```

### 2. Download & Place the GeoLife Dataset

1. Download from: https://www.microsoft.com/en-us/download/details.aspx?id=52367
2. Extract the archive
3. Extract and place the dataset so the **`Data`** folder is at:

```
CareTag/
├── Geolife Trajectories 1.3/
│   └── Data/
│       ├── 000/
│       │   └── Trajectory/
│       │       ├── 20081023025304.plt
│       │       ├── 20081024020959.plt
│       │       └── ...
│       ├── 001/
│       │   └── Trajectory/
│       │       └── ...
│       └── ...
├── config.py
├── main.py
└── ...
```

> **Tip:** If your dataset is elsewhere, update `GEOLIFE_ROOT` in `config.py`.

### 3. Run the Pipeline

```bash
# Full pipeline (all 3 steps)
python main.py --step all

# Quick test with limited data
python main.py --step all --users 000 --max-files 50

# Run individual steps
python main.py --step 1 --users 000 001 010
python main.py --step 2
python main.py --step 3
```

---

## GeoLife PLT File Format

Each `.plt` file contains GPS trajectory points. The first 6 lines are headers (skipped automatically). Data lines (line 7 onwards):

| Column | Description                    | Example           |
|--------|--------------------------------|--------------------|
| 1      | Latitude (decimal degrees)     | `39.906631`        |
| 2      | Longitude (decimal degrees)    | `116.385564`       |
| 3      | Unused (always 0)              | `0`                |
| 4      | Altitude (feet, -777 = invalid)| `492`              |
| 5      | Date as days since 12/30/1899  | `40097.5864583333` |
| 6      | Date (YYYY-MM-DD)             | `2009-10-11`       |
| 7      | Time (HH:MM:SS)               | `14:04:30`         |

**Example raw line:**
```
39.906631,116.385564,0,492,40097.5864583333,2009-10-11,14:04:30
```

---

## Pipeline Details

### Step 1: Stay Point Extraction & Clustering

- **Data Loading:** Parses `.plt` files → pandas DataFrame with `[lat, lon, datetime, user_id]`
- **Stay Point Detection:** Li et al. algorithm — identifies locations where the user lingered (≥200m radius, ≥20 min)
- **K-Means Clustering:** Groups stay points into location clusters (Home, Work, School, etc.). Optimal K selected via Silhouette Score.
- **Outputs:** `outputs/data/labeled_stay_points.csv`, `outputs/models/kmeans_model.joblib`, `outputs/plots/cluster_analysis.png`

### Step 2: LSTM Routine Modeling

- **Sequence Building:** Discretizes time into 30-min slots, builds daily sequences of cluster visits
- **LSTM Architecture:** Dual-input PyTorch model (cluster embeddings + time features) → LSTM(128) → softmax prediction of next cluster
- **Training:** CrossEntropyLoss, Adam optimizer, early stopping, ReduceLROnPlateau
- **Outputs:** `outputs/models/lstm_routine_model.pth`, `outputs/plots/lstm_training_history.png`

### Step 3: Real-Time Anomaly Scoring

- **Input:** Single GPS coordinate + timestamp
- **Process:** Assigns to nearest cluster → LSTM predicts expected cluster → composite deviation score
- **Score Components:**
  - *Spatial:* Normalized distance to expected cluster center
  - *Temporal:* `1 − P(actual_cluster)` from LSTM softmax
- **Output:** Deviation score [0, 1] + anomaly flag

---

## Configuration

All tunable parameters are in [`config.py`](config.py):

| Parameter | Default | Description |
|-----------|---------|-------------|
| `STAY_DISTANCE_THRESHOLD_M` | 200 | Stay detection radius (meters) |
| `STAY_TIME_THRESHOLD_MIN` | 20 | Minimum stay duration (minutes) |
| `KMEANS_MAX_K` | 10 | Max clusters to evaluate |
| `TIME_SLOT_DURATION_MIN` | 30 | Time discretization (minutes) |
| `SEQUENCE_LENGTH` | 6 | LSTM context window size |
| `LSTM_UNITS` | 128 | LSTM hidden units |
| `ANOMALY_THRESHOLD` | 0.6 | Score threshold for anomaly flag |

---

## Using the Anomaly Scorer in Your Code

```python
from step3_anomaly_scoring.anomaly_scorer import CareTagAnomalyScorer

# Initialize (loads pre-trained models)
scorer = CareTagAnomalyScorer()

# Score a single observation
result = scorer.score_deviation(
    latitude=39.98,
    longitude=116.32,
    timestamp="2024-03-15 10:45:00"
)

print(result["deviation_score"])  # 0.0 (normal) → 1.0 (extreme deviation)
print(result["is_anomaly"])       # True / False
print(result["expected_cluster"]) # The cluster the LSTM expected
```

---

## Project Structure

```
CareTag/
├── config.py                          # Central configuration
├── main.py                            # CLI pipeline orchestrator
├── requirements.txt                   # Python dependencies
├── README.md                          # This file
│
├── step1_stay_point_extraction/
│   ├── data_loader.py                 # GeoLife PLT parser
│   ├── stay_point_detector.py         # Li et al. stay-point algorithm
│   └── clustering.py                  # K-Means clustering
│
├── step2_routine_modeling/
│   ├── sequence_builder.py            # Temporal sequence encoder
│   └── lstm_model.py                  # LSTM model (PyTorch)
│
├── step3_anomaly_scoring/
│   └── anomaly_scorer.py              # Real-time deviation scoring
│
├── Geolife Trajectories 1.3/          # ← GeoLife dataset location
│   └── Data/
│       ├── 000/Trajectory/*.plt
│       └── ...
│
└── outputs/                           # Auto-created pipeline outputs
    ├── models/                        # Saved K-Means & LSTM models
    ├── plots/                         # Visualization charts
    └── data/                          # Intermediate CSVs
```
