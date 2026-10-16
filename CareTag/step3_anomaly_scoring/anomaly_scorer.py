# ==============================================================================
# CareTag Learning Engine -- Step 3: Real-Time Anomaly Scoring
# ==============================================================================
# Deployable scoring function that evaluates whether a new GPS coordinate at
# a given timestamp matches the user's expected routine.
#
# Pipeline:
#   1. Convert timestamp -> time slot
#   2. Find nearest cluster center to the GPS coordinate (Haversine)
#   3. Use LSTM to predict the expected cluster for the current time context
#   4. Compute a composite Deviation Score:
#      - Spatial component: normalized distance to the expected cluster center
#      - Temporal component: 1 - P(actual_cluster | time_context) from LSTM
#   5. Flag as anomaly if the score exceeds a threshold
#
# Usage:
#   from step3_anomaly_scoring.anomaly_scorer import CareTagAnomalyScorer
#
#   scorer = CareTagAnomalyScorer()
#   result = scorer.score_deviation(39.98, 116.32, "2024-03-15 10:45:00")
# ==============================================================================

import numpy as np
import pandas as pd
import joblib
from datetime import datetime
from typing import Union, Dict, Optional, List
from collections import deque

import sys, os
import io
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config

# Fix Windows console encoding
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import torch
from step2_routine_modeling.lstm_model import RoutineLSTM


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Haversine distance between two GPS points, returned in kilometers.

    Args:
        lat1, lon1: Point 1 coordinates (decimal degrees).
        lat2, lon2: Point 2 coordinates (decimal degrees).

    Returns:
        Distance in kilometers.
    """
    R = 6371.0  # Earth radius in km

    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)

    a = (np.sin(dphi / 2) ** 2 +
         np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2)
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

    return R * c


class CareTagAnomalyScorer:
    """
    Real-time anomaly scoring engine for CareTag.

    Loads the pre-trained K-Means cluster model and LSTM routine model,
    maintains a rolling context window of recent observations, and scores
    new GPS coordinates against the expected routine.

    Attributes:
        kmeans:          Fitted KMeans model.
        scaler:          StandardScaler used during clustering.
        lstm_model:      Trained PyTorch LSTM model.
        cluster_centers: (K, 2) array of cluster center coordinates [lat, lon].
        num_clusters:    Number of location clusters.
        context_window:  Rolling deque of recent (time_slot, cluster_id) pairs.
    """

    def __init__(
        self,
        kmeans_model_path: str = None,
        lstm_model_path: str = None,
        cluster_centers_path: str = None,
        anomaly_threshold: float = None,
        spatial_weight: float = None,
        temporal_weight: float = None
    ):
        """
        Initialize the scorer by loading pre-trained models and metadata.

        Args:
            kmeans_model_path:    Path to the saved K-Means model (joblib).
            lstm_model_path:      Path to the saved LSTM model (.pth).
            cluster_centers_path: Path to the cluster centers CSV.
            anomaly_threshold:    Score above which a point is flagged as anomaly.
            spatial_weight:       Weight for the spatial distance component.
            temporal_weight:      Weight for the LSTM probability-gap component.
        """
        # Resolve paths
        if kmeans_model_path is None:
            kmeans_model_path = config.KMEANS_MODEL_PATH
        if lstm_model_path is None:
            lstm_model_path = config.LSTM_MODEL_PATH
        if cluster_centers_path is None:
            cluster_centers_path = config.CLUSTER_CENTERS_PATH

        self.anomaly_threshold = anomaly_threshold or config.ANOMALY_THRESHOLD
        self.spatial_weight = spatial_weight or config.SPATIAL_WEIGHT
        self.temporal_weight = temporal_weight or config.TEMPORAL_WEIGHT

        # ---- Load K-Means model + scaler ----
        print("  Loading K-Means model...")
        model_bundle = joblib.load(kmeans_model_path)
        self.kmeans = model_bundle["kmeans"]
        self.scaler = model_bundle["scaler"]
        self.num_clusters = self.kmeans.n_clusters

        # ---- Load cluster centers (original lat/lon scale) ----
        print("  Loading cluster centers...")
        centers_df = pd.read_csv(cluster_centers_path)
        self.cluster_centers = centers_df[["center_lat", "center_lon"]].values
        self.cluster_labels = {
            row["cluster_id"]: f"Cluster_{int(row['cluster_id'])}"
            for _, row in centers_df.iterrows()
        }

        # ---- Load LSTM model (PyTorch) ----
        print("  Loading LSTM routine model (PyTorch)...")
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        checkpoint = torch.load(lstm_model_path, map_location=self.device, weights_only=False)

        self.lstm_model = RoutineLSTM(
            num_clusters=checkpoint["num_clusters"],
            num_time_slots=checkpoint["config"]["num_time_slots"],
            embedding_dim=checkpoint["config"]["embedding_dim"],
            dense_time_units=checkpoint["config"]["dense_time_units"],
            lstm_units=checkpoint["config"]["lstm_units"],
        ).to(self.device)
        self.lstm_model.load_state_dict(checkpoint["model_state_dict"])
        self.lstm_model.eval()

        # ---- Context window: rolling buffer of recent observations ----
        # Stores (time_slot, cluster_id) tuples for the LSTM input
        self.context_window = deque(maxlen=config.SEQUENCE_LENGTH)

        print(f"  Anomaly Scorer initialized:")
        print(f"    Clusters         : {self.num_clusters}")
        print(f"    Context window   : {config.SEQUENCE_LENGTH} slots")
        print(f"    Anomaly threshold: {self.anomaly_threshold}")
        print(f"    Weights (spatial/temporal): {self.spatial_weight}/{self.temporal_weight}")

    def _time_to_slot(self, dt: datetime) -> int:
        """Convert a datetime to a time-slot index."""
        total_minutes = dt.hour * 60 + dt.minute
        return total_minutes // config.TIME_SLOT_DURATION_MIN

    def _find_nearest_cluster(self, lat: float, lon: float) -> tuple:
        """
        Find the nearest cluster center to a GPS coordinate.

        Args:
            lat, lon: GPS coordinates (decimal degrees).

        Returns:
            (cluster_id, distance_km) -- the closest cluster and its distance.
        """
        distances = np.array([
            haversine_km(lat, lon, c[0], c[1])
            for c in self.cluster_centers
        ])
        nearest_id = int(np.argmin(distances))
        nearest_dist = distances[nearest_id]
        return nearest_id, nearest_dist

    def _assign_cluster_via_kmeans(self, lat: float, lon: float) -> int:
        """
        Assign a GPS point to a cluster using the trained K-Means model.

        This uses the same scaler and K-Means model from training to ensure
        consistent cluster assignment.

        Args:
            lat, lon: GPS coordinates (decimal degrees).

        Returns:
            Cluster ID assigned by K-Means.
        """
        point_scaled = self.scaler.transform([[lat, lon]])
        return int(self.kmeans.predict(point_scaled)[0])

    def _predict_expected_cluster(
        self, current_slot: int
    ) -> Optional[np.ndarray]:
        """
        Use the LSTM model to predict the probability distribution over
        clusters for the current time context.

        Args:
            current_slot: The current time-slot index.

        Returns:
            (num_clusters,) probability array, or None if insufficient context.
        """
        if len(self.context_window) < config.SEQUENCE_LENGTH:
            return None

        # Build input tensors from context window
        slots = np.array([s for s, c in self.context_window], dtype=np.int64)
        clusters = np.array([c for s, c in self.context_window], dtype=np.int64)

        # Reshape for batch dimension: (1, seq_len)
        slots_input = torch.LongTensor(slots).unsqueeze(0).to(self.device)
        clusters_input = torch.LongTensor(clusters).unsqueeze(0).to(self.device)

        # Predict
        probs = self.lstm_model.predict_proba(clusters_input, slots_input)

        return probs[0].cpu().numpy()  # shape: (num_clusters,)

    def score_deviation(
        self,
        latitude: float,
        longitude: float,
        timestamp: Union[str, datetime],
        update_context: bool = True
    ) -> Dict:
        """
        +==============================================================+
        |            CORE ANOMALY SCORING FUNCTION                     |
        |                                                              |
        |  Evaluates a single GPS observation against the learned      |
        |  routine and returns a deviation score.                      |
        +==============================================================+

        This is the primary deployable function for real-time monitoring.
        It takes a GPS coordinate and timestamp, compares them to the
        user's historical behavioral model, and returns a score indicating
        how much this observation deviates from the expected routine.

        Args:
            latitude:       GPS latitude (decimal degrees, e.g., 39.98).
            longitude:      GPS longitude (decimal degrees, e.g., 116.32).
            timestamp:      ISO format string or datetime object
                            (e.g., "2024-03-15 10:45:00").
            update_context: If True, appends this observation to the rolling
                            context window for future LSTM predictions.

        Returns:
            Dictionary with:
            {
                "timestamp":         str,
                "input_lat":         float,
                "input_lon":         float,
                "time_slot":         int,
                "actual_cluster":    int,     -- cluster assigned to the input GPS
                "expected_cluster":  int|None,-- LSTM-predicted most-likely cluster
                "distance_to_expected_km": float, -- km to the expected cluster center
                "spatial_score":     float,  -- normalized spatial deviation [0, 1]
                "temporal_score":    float,  -- 1 - P(actual_cluster) from LSTM [0, 1]
                "deviation_score":   float,  -- weighted composite score [0, 1]
                "is_anomaly":        bool,   -- True if score > threshold
                "confidence":        str,    -- "HIGH" / "MEDIUM" / "LOW"
                "cluster_probabilities": dict, -- full LSTM probability distribution
                "context_ready":     bool    -- True if LSTM context window is full
            }
        """
        # ---- Parse timestamp ----
        if isinstance(timestamp, str):
            timestamp_dt = pd.Timestamp(timestamp).to_pydatetime()
        else:
            timestamp_dt = timestamp

        time_slot = self._time_to_slot(timestamp_dt)

        # ---- Assign the input GPS point to a cluster ----
        actual_cluster = self._assign_cluster_via_kmeans(latitude, longitude)
        _, dist_to_actual = self._find_nearest_cluster(latitude, longitude)

        # ---- Get LSTM prediction ----
        predicted_probs = self._predict_expected_cluster(time_slot)
        context_ready = predicted_probs is not None

        if context_ready:
            expected_cluster = int(np.argmax(predicted_probs))
            prob_actual = float(predicted_probs[actual_cluster])

            # Distance from the input point to the EXPECTED cluster center
            expected_center = self.cluster_centers[expected_cluster]
            dist_to_expected = haversine_km(
                latitude, longitude,
                expected_center[0], expected_center[1]
            )

            # ---- Compute component scores ----
            # Spatial score: normalized distance to expected center [0, 1]
            spatial_score = min(
                dist_to_expected / config.MAX_EXPECTED_DISTANCE_KM,
                1.0
            )

            # Temporal score: how unlikely is the actual cluster given time context
            temporal_score = 1.0 - prob_actual

            # ---- Composite deviation score ----
            deviation_score = (
                self.spatial_weight * spatial_score +
                self.temporal_weight * temporal_score
            )

            # Cluster probability distribution
            cluster_probs = {
                int(i): round(float(predicted_probs[i]), 4)
                for i in range(self.num_clusters)
            }

        else:
            # Not enough context for LSTM -- fall back to spatial-only scoring
            expected_cluster = None
            dist_to_expected = dist_to_actual
            spatial_score = min(
                dist_to_actual / config.MAX_EXPECTED_DISTANCE_KM,
                1.0
            )
            temporal_score = 0.0
            deviation_score = spatial_score  # only spatial component
            cluster_probs = {}

        # ---- Anomaly classification ----
        is_anomaly = deviation_score > self.anomaly_threshold

        # Confidence level based on context availability and score magnitude
        if not context_ready:
            confidence = "LOW"
        elif deviation_score > 0.8:
            confidence = "HIGH"
        elif deviation_score > self.anomaly_threshold:
            confidence = "MEDIUM"
        else:
            confidence = "HIGH"  # high confidence it's normal

        # ---- Update rolling context window ----
        if update_context:
            self.context_window.append((time_slot, actual_cluster))

        # ---- Build result dictionary ----
        result = {
            "timestamp": timestamp_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "input_lat": round(latitude, 6),
            "input_lon": round(longitude, 6),
            "time_slot": time_slot,
            "actual_cluster": actual_cluster,
            "expected_cluster": expected_cluster,
            "distance_to_expected_km": round(dist_to_expected, 3),
            "spatial_score": round(spatial_score, 4),
            "temporal_score": round(temporal_score, 4),
            "deviation_score": round(deviation_score, 4),
            "is_anomaly": is_anomaly,
            "confidence": confidence,
            "cluster_probabilities": cluster_probs,
            "context_ready": context_ready,
        }

        return result

    def score_batch(
        self,
        observations: List[Dict]
    ) -> List[Dict]:
        """
        Score a batch of GPS observations sequentially.

        Each observation is processed in order, with each result updating
        the context window for subsequent predictions.

        Args:
            observations: List of dicts with keys:
                          {"latitude": float, "longitude": float, "timestamp": str}

        Returns:
            List of result dicts from score_deviation().
        """
        results = []
        for obs in observations:
            result = self.score_deviation(
                obs["latitude"],
                obs["longitude"],
                obs["timestamp"]
            )
            results.append(result)
        return results

    def reset_context(self):
        """Clear the rolling context window (e.g., at start of a new day)."""
        self.context_window.clear()
        print("  Context window cleared.")


def format_anomaly_report(result: Dict) -> str:
    """
    Pretty-print a single anomaly scoring result.

    Args:
        result: Output dictionary from score_deviation().

    Returns:
        Formatted string report.
    """
    status = "!! ANOMALY DETECTED" if result["is_anomaly"] else "-- NORMAL"
    bar_len = 30
    filled = int(result["deviation_score"] * bar_len)
    bar = "#" * filled + "." * (bar_len - filled)

    report = f"""
+==============================================================+
|  CareTag Anomaly Report                                      |
+--------------------------------------------------------------+
|  Status     : {status:<46}|
|  Timestamp  : {result['timestamp']:<46}|
|  Location   : ({result['input_lat']}, {result['input_lon']}){' ' * max(0, 32 - len(f"({result['input_lat']}, {result['input_lon']})"))}|
|  Time Slot  : {result['time_slot']:<46}|
+--------------------------------------------------------------+
|  Actual Cluster   : {result['actual_cluster']:<40}|
|  Expected Cluster : {str(result['expected_cluster']):<40}|
|  Distance to Expected : {result['distance_to_expected_km']:.3f} km{' ' * max(0, 33 - len(f"{result['distance_to_expected_km']:.3f} km"))}|
+--------------------------------------------------------------+
|  Deviation Score  : [{bar}] {result['deviation_score']:.4f}{' ' * max(0, 6 - len(f"{result['deviation_score']:.4f}"))}|
|    |- Spatial     : {result['spatial_score']:.4f}{' ' * max(0, 40 - len(f"{result['spatial_score']:.4f}"))}|
|    +- Temporal    : {result['temporal_score']:.4f}{' ' * max(0, 40 - len(f"{result['temporal_score']:.4f}"))}|
|  Confidence       : {result['confidence']:<40}|
|  Context Ready    : {str(result['context_ready']):<40}|
+==============================================================+"""

    return report


# ==============================================================================
# Standalone Demo
# ==============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("  CareTag -- Step 3: Anomaly Scorer Demo")
    print("=" * 60)

    # Initialize the scorer (loads all models)
    scorer = CareTagAnomalyScorer()

    # --- Simulate a day of observations ---
    # These would come from the CareTag device in real deployment
    demo_observations = [
        # Morning at home (expected)
        {"latitude": 39.9842, "longitude": 116.3184, "timestamp": "2024-03-15 07:00:00"},
        {"latitude": 39.9843, "longitude": 116.3185, "timestamp": "2024-03-15 07:30:00"},
        {"latitude": 39.9841, "longitude": 116.3183, "timestamp": "2024-03-15 08:00:00"},

        # Commute to school (transition)
        {"latitude": 39.9900, "longitude": 116.3300, "timestamp": "2024-03-15 08:30:00"},

        # At school (expected)
        {"latitude": 39.9950, "longitude": 116.3400, "timestamp": "2024-03-15 09:00:00"},
        {"latitude": 39.9951, "longitude": 116.3401, "timestamp": "2024-03-15 09:30:00"},
        {"latitude": 39.9949, "longitude": 116.3399, "timestamp": "2024-03-15 10:00:00"},

        # ANOMALY: Should be at school but appears at unknown location
        {"latitude": 40.0500, "longitude": 116.4500, "timestamp": "2024-03-15 10:45:00"},
    ]

    print("\n  Scoring observations...\n")
    results = scorer.score_batch(demo_observations)

    for result in results:
        print(format_anomaly_report(result))
