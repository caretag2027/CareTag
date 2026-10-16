# ==============================================================================
# CareTag Learning Engine — Step 2: Temporal Sequence Builder
# ==============================================================================
# Converts labeled stay points into temporal sequences suitable for LSTM
# training. Each day is discretized into fixed time slots, and the cluster
# ID present during each slot is recorded, forming a daily routine sequence.
#
# Example (30-min slots):
#   Slot 0  (00:00-00:30): Cluster 0 (Home)
#   Slot 1  (00:30-01:00): Cluster 0 (Home)
#   ...
#   Slot 18 (09:00-09:30): Cluster 2 (School)
#   ...
#
# These daily sequences are then sliced into overlapping windows of length
# SEQUENCE_LENGTH to create (input, target) pairs for the LSTM.
# ==============================================================================

import numpy as np
import pandas as pd
from typing import Tuple

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def time_to_slot(dt: pd.Timestamp) -> int:
    """
    Convert a timestamp to a discrete time-slot index.

    Args:
        dt: A pandas Timestamp.

    Returns:
        Integer slot index (0-based). For 30-min slots: 0..47.
    """
    total_minutes = dt.hour * 60 + dt.minute
    return total_minutes // config.TIME_SLOT_DURATION_MIN


def build_daily_sequences(labeled_stay_points: pd.DataFrame) -> pd.DataFrame:
    """
    Build a table mapping (date, time_slot) → cluster_id for each user.

    For each stay point, we fill all time slots between its arrival and
    departure with the corresponding cluster_id.

    Args:
        labeled_stay_points: DataFrame with columns:
            [latitude, longitude, arrival_time, departure_time,
             duration_min, user_id, cluster_id]

    Returns:
        DataFrame with columns: [user_id, date, time_slot, cluster_id]
        One row per occupied slot.
    """
    print("  Building daily time-slot sequences...")

    records = []

    for _, row in labeled_stay_points.iterrows():
        arrival = pd.Timestamp(row["arrival_time"])
        departure = pd.Timestamp(row["departure_time"])
        cluster_id = int(row["cluster_id"])
        user_id = row["user_id"]

        # Iterate through each time slot covered by this stay
        current = arrival
        while current <= departure:
            date_str = current.strftime("%Y-%m-%d")
            slot = time_to_slot(current)

            records.append({
                "user_id": user_id,
                "date": date_str,
                "time_slot": slot,
                "cluster_id": cluster_id
            })

            # Advance by one slot
            current += pd.Timedelta(minutes=config.TIME_SLOT_DURATION_MIN)

    if not records:
        raise ValueError("No time-slot records could be generated from stay points.")

    slot_df = pd.DataFrame(records)

    # Remove duplicates (a slot can only have one cluster; keep first if overlap)
    slot_df.drop_duplicates(subset=["user_id", "date", "time_slot"], keep="first", inplace=True)
    slot_df.sort_values(["user_id", "date", "time_slot"], inplace=True)
    slot_df.reset_index(drop=True, inplace=True)

    print(f"  Generated {len(slot_df):,} time-slot records across "
          f"{slot_df['date'].nunique()} unique days")

    return slot_df


def create_training_sequences(
    slot_df: pd.DataFrame,
    num_clusters: int,
    sequence_length: int = None
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Create sliding-window sequences for LSTM training.

    For each user-day, we extract the sequence of (time_slot, cluster_id)
    entries and create overlapping windows:
        Input:  [(slot_t, cluster_t), (slot_t+1, cluster_t+1), ..., (slot_t+L-1, cluster_t+L-1)]
        Target: cluster_t+L  (the next cluster in the sequence)

    Args:
        slot_df:         DataFrame from build_daily_sequences().
        num_clusters:    Total number of clusters (for one-hot encoding of target).
        sequence_length: Number of past steps as input context.

    Returns:
        Tuple of:
            - X_slots:   (N, seq_len) array of time-slot indices
            - X_clusters: (N, seq_len) array of cluster IDs
            - y:         (N,) array of target cluster IDs
            - y_onehot:  (N, num_clusters) one-hot encoded targets
    """
    if sequence_length is None:
        sequence_length = config.SEQUENCE_LENGTH

    print(f"  Creating training sequences (window={sequence_length})...")

    all_X_slots = []
    all_X_clusters = []
    all_y = []

    # Group by user and date to form daily sequences
    grouped = slot_df.groupby(["user_id", "date"])

    for (user_id, date), group in grouped:
        group = group.sort_values("time_slot")
        slots = group["time_slot"].values
        clusters = group["cluster_id"].values

        # Need at least (sequence_length + 1) points to make one sample
        if len(slots) <= sequence_length:
            continue

        # Sliding window
        for i in range(len(slots) - sequence_length):
            X_s = slots[i: i + sequence_length]
            X_c = clusters[i: i + sequence_length]
            target = clusters[i + sequence_length]

            all_X_slots.append(X_s)
            all_X_clusters.append(X_c)
            all_y.append(target)

    if not all_y:
        raise ValueError(
            "No training sequences could be generated. "
            "Ensure enough stay points span multiple time slots per day."
        )

    X_slots = np.array(all_X_slots, dtype=np.int32)
    X_clusters = np.array(all_X_clusters, dtype=np.int32)
    y = np.array(all_y, dtype=np.int32)

    # One-hot encode the target
    y_onehot = np.zeros((len(y), num_clusters), dtype=np.float32)
    y_onehot[np.arange(len(y)), y] = 1.0

    print(f"  Total training samples : {len(y):,}")
    print(f"  Input shape (slots)    : {X_slots.shape}")
    print(f"  Input shape (clusters) : {X_clusters.shape}")
    print(f"  Target distribution    :")
    for c in range(num_clusters):
        count = (y == c).sum()
        pct = count / len(y) * 100
        print(f"    Cluster {c}: {count:6d} samples ({pct:5.1f}%)")

    return X_slots, X_clusters, y, y_onehot


def build_sequences_pipeline(
    labeled_stay_points: pd.DataFrame,
    num_clusters: int
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Full sequence-building pipeline: daily sequences → training windows.

    Args:
        labeled_stay_points: Output from Step 1 clustering.
        num_clusters:        Number of location clusters.

    Returns:
        (X_slots, X_clusters, y, y_onehot) — ready for LSTM training.
    """
    print("=" * 60)
    print("  CareTag — Step 2a: Sequence Building")
    print("=" * 60)
    print(f"  Input stay points : {len(labeled_stay_points):,}")
    print(f"  Num clusters      : {num_clusters}")
    print(f"  Time slot size    : {config.TIME_SLOT_DURATION_MIN} min")
    print(f"  Slots per day     : {config.NUM_TIME_SLOTS}")
    print("-" * 60)

    # Step A: Build daily slot sequences
    slot_df = build_daily_sequences(labeled_stay_points)

    # Step B: Create sliding-window training samples
    X_slots, X_clusters, y, y_onehot = create_training_sequences(
        slot_df, num_clusters
    )

    # Save sequences for reproducibility
    np.savez(
        config.TRAINING_SEQUENCES_PATH,
        X_slots=X_slots,
        X_clusters=X_clusters,
        y=y,
        y_onehot=y_onehot
    )
    print(f"\n  Saved training data → {config.TRAINING_SEQUENCES_PATH}")
    print("=" * 60)

    return X_slots, X_clusters, y, y_onehot


# ==============================================================================
# Quick standalone test
# ==============================================================================
if __name__ == "__main__":
    # Load pre-saved labeled stay points
    labeled = pd.read_csv(config.LABELED_STAY_POINTS_PATH)
    num_clusters = labeled["cluster_id"].nunique()
    X_s, X_c, y, y_oh = build_sequences_pipeline(labeled, num_clusters)
    print(f"\nReady for LSTM: {X_s.shape[0]} training samples")
