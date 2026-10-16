# ==============================================================================
# CareTag Learning Engine — Central Configuration
# ==============================================================================
# All tunable constants, file paths, and hyperparameters live here.
# Modify these values to adapt the pipeline to different datasets or behaviors.
# ==============================================================================

import os

# --- Project Root ---
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))

# --- GeoLife Dataset ---
# After downloading, extract the dataset and point this to the "Data" folder.
# Expected structure: GEOLIFE_ROOT / <user_id> / Trajectory / *.plt
GEOLIFE_ROOT = os.path.join(PROJECT_ROOT, "Geolife Trajectories 1.3", "Data")

# List of user IDs to process (e.g., ["000", "001"]).
# Set to None to process ALL users found in the dataset folder.
TARGET_USERS = None  # or ["000", "001", "010"]

# --- Output Directories ---
OUTPUTS_DIR = os.path.join(PROJECT_ROOT, "outputs")
MODELS_DIR = os.path.join(OUTPUTS_DIR, "models")
PLOTS_DIR = os.path.join(OUTPUTS_DIR, "plots")
DATA_DIR = os.path.join(OUTPUTS_DIR, "data")

# Create output directories if they don't exist
for _dir in [OUTPUTS_DIR, MODELS_DIR, PLOTS_DIR, DATA_DIR]:
    os.makedirs(_dir, exist_ok=True)

# ==============================================================================
# Step 1 — Stay Point Extraction
# ==============================================================================

# Li et al. stay-point detection thresholds
STAY_DISTANCE_THRESHOLD_M = 200    # meters — max radius to count as "staying"
STAY_TIME_THRESHOLD_MIN = 20       # minutes — min duration to qualify as a stay

# K-Means clustering
KMEANS_MAX_K = 10                  # maximum number of clusters to evaluate
KMEANS_RANDOM_STATE = 42           # reproducibility seed
KMEANS_N_INIT = 10                 # number of K-Means initializations per K

# ==============================================================================
# Step 2 — Routine Sequence Modeling (LSTM)
# ==============================================================================

# Temporal discretization
TIME_SLOT_DURATION_MIN = 30        # minutes per time slot (48 slots/day for 30 min)
NUM_TIME_SLOTS = (24 * 60) // TIME_SLOT_DURATION_MIN  # 48 slots for 30-min

# LSTM sequence parameters
SEQUENCE_LENGTH = 6                # number of past time slots as context window
LSTM_UNITS = 128                   # hidden units in the LSTM layer
EMBEDDING_DIM = 16                 # dimensionality of cluster-ID embeddings
DENSE_TIME_UNITS = 16              # units in the time-slot dense branch

# Training hyperparameters
BATCH_SIZE = 32
EPOCHS = 50
VALIDATION_SPLIT = 0.2
LEARNING_RATE = 0.001
EARLY_STOPPING_PATIENCE = 5

# Model save paths
LSTM_MODEL_PATH = os.path.join(MODELS_DIR, "lstm_routine_model.pth")
KMEANS_MODEL_PATH = os.path.join(MODELS_DIR, "kmeans_model.joblib")
CLUSTER_CENTERS_PATH = os.path.join(DATA_DIR, "cluster_centers.csv")
LABELED_STAY_POINTS_PATH = os.path.join(DATA_DIR, "labeled_stay_points.csv")
TRAINING_SEQUENCES_PATH = os.path.join(DATA_DIR, "training_sequences.npz")

# ==============================================================================
# Step 3 — Anomaly Scoring
# ==============================================================================

# Deviation score weights (must sum to 1.0)
SPATIAL_WEIGHT = 0.5               # weight for geographic distance component
TEMPORAL_WEIGHT = 0.5              # weight for LSTM probability-gap component

# Anomaly threshold — scores above this are flagged
ANOMALY_THRESHOLD = 0.6

# Spatial normalization — distances beyond this (km) are capped at score = 1.0
MAX_EXPECTED_DISTANCE_KM = 10.0
