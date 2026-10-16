# ==============================================================================
# CareTag Learning Engine — Main Pipeline Orchestrator
# ==============================================================================
# Entry point for running the complete GPS behavioral modeling pipeline.
#
# Usage:
#   python main.py --step all           # Run full pipeline (Steps 1 → 2 → 3)
#   python main.py --step 1             # Run only Stay Point Extraction
#   python main.py --step 2             # Run only LSTM Training (requires Step 1 outputs)
#   python main.py --step 3             # Run Anomaly Scoring demo (requires Steps 1+2)
#   python main.py --step all --users 000 001   # Process specific GeoLife users
#   python main.py --step all --max-files 100   # Limit files for quick testing
# ==============================================================================

import argparse
import sys
import os
import io
import numpy as np
import pandas as pd

# Fix Windows console encoding (cp1252 cannot print Unicode box chars/emojis)
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Ensure project root is on the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import config


def run_step1(user_ids=None, max_files=None):
    """
    Step 1: Load GeoLife data → Extract Stay Points → K-Means Clustering.

    Returns:
        labeled_stay_points (DataFrame), num_clusters (int)
    """
    from step1_stay_point_extraction.data_loader import load_geolife_data
    from step1_stay_point_extraction.stay_point_detector import extract_stay_points
    from step1_stay_point_extraction.clustering import cluster_stay_points

    print("\n" + "+" + "=" * 58 + "+")
    print("|" + "  STEP 1: Stay Point Extraction & Clustering".center(58) + "|")
    print("+" + "=" * 58 + "+\n")

    # 1a. Load raw GPS data
    gps_data = load_geolife_data(user_ids=user_ids, max_files=max_files)

    # 1b. Extract stay points using Li et al. algorithm
    stay_points = extract_stay_points(gps_data)

    if len(stay_points) < 3:
        print("\n  [ERROR] Insufficient stay points for clustering.")
        print("  Try: (1) process more users, (2) lower distance threshold, or")
        print("       (3) reduce time threshold in config.py")
        sys.exit(1)

    # 1c. Cluster stay points with K-Means
    labeled = cluster_stay_points(stay_points)
    num_clusters = labeled["cluster_id"].nunique()

    print(f"\n  [OK] Step 1 complete: {len(labeled)} stay points in {num_clusters} clusters")
    return labeled, num_clusters


def run_step2(labeled_stay_points=None, num_clusters=None):
    """
    Step 2: Build temporal sequences → Train LSTM routine model.

    If no data is passed, loads from Step 1 saved outputs.

    Returns:
        Trained Keras model.
    """
    from step2_routine_modeling.sequence_builder import build_sequences_pipeline
    from step2_routine_modeling.lstm_model import train_lstm_model

    print("\n" + "+" + "=" * 58 + "+")
    print("|" + "  STEP 2: LSTM Routine Sequence Modeling".center(58) + "|")
    print("+" + "=" * 58 + "+\n")

    # Load from saved files if not provided directly
    if labeled_stay_points is None:
        print("  Loading saved stay points from Step 1...")
        if not os.path.exists(config.LABELED_STAY_POINTS_PATH):
            print(f"  [ERROR] Not found: {config.LABELED_STAY_POINTS_PATH}")
            print("  Run Step 1 first: python main.py --step 1")
            sys.exit(1)
        labeled_stay_points = pd.read_csv(config.LABELED_STAY_POINTS_PATH)
        num_clusters = labeled_stay_points["cluster_id"].nunique()

    # 2a. Build temporal training sequences
    X_slots, X_clusters, y, y_onehot = build_sequences_pipeline(
        labeled_stay_points, num_clusters
    )

    # 2b. Train the LSTM model
    model = train_lstm_model(X_slots, X_clusters, y_onehot, num_clusters)

    print(f"\n  [OK] Step 2 complete: LSTM model trained and saved")
    return model


def run_step3():
    """
    Step 3: Run the anomaly scoring demo with sample observations.

    Loads the pre-trained models from Steps 1 and 2.
    """
    from step3_anomaly_scoring.anomaly_scorer import (
        CareTagAnomalyScorer, format_anomaly_report
    )

    print("\n" + "+" + "=" * 58 + "+")
    print("|" + "  STEP 3: Real-Time Anomaly Scoring Demo".center(58) + "|")
    print("+" + "=" * 58 + "+\n")

    # Validate that required model files exist
    for path, name in [
        (config.KMEANS_MODEL_PATH, "K-Means model"),
        (config.LSTM_MODEL_PATH, "LSTM model"),
        (config.CLUSTER_CENTERS_PATH, "Cluster centers"),
    ]:
        if not os.path.exists(path):
            print(f"  [ERROR] {name} not found: {path}")
            print("  Run Steps 1 and 2 first: python main.py --step all")
            sys.exit(1)

    # Initialize the scorer
    scorer = CareTagAnomalyScorer()

    # Load cluster centers to use realistic coordinates for the demo
    centers_df = pd.read_csv(config.CLUSTER_CENTERS_PATH)
    print(f"\n  Loaded {len(centers_df)} cluster centers for demo")
    print(f"  Using Cluster 0 center as 'home' location")

    # Build demo observations using actual cluster center coordinates
    # This creates a realistic scenario based on the trained data
    if len(centers_df) >= 2:
        home = centers_df.iloc[0]
        other = centers_df.iloc[1]
        # Point far from any known cluster (anomaly)
        anomaly_lat = home["center_lat"] + 0.1  # ~11km offset
        anomaly_lon = home["center_lon"] + 0.1
    else:
        home = centers_df.iloc[0]
        other = home
        anomaly_lat = home["center_lat"] + 0.1
        anomaly_lon = home["center_lon"] + 0.1

    demo_observations = [
        # Normal morning at Cluster 0 (e.g., Home)
        {"latitude": home["center_lat"], "longitude": home["center_lon"],
         "timestamp": "2024-03-15 07:00:00"},
        {"latitude": home["center_lat"] + 0.001, "longitude": home["center_lon"],
         "timestamp": "2024-03-15 07:30:00"},
        {"latitude": home["center_lat"], "longitude": home["center_lon"] + 0.001,
         "timestamp": "2024-03-15 08:00:00"},

        # Move to Cluster 1 (e.g., Work/School)
        {"latitude": other["center_lat"], "longitude": other["center_lon"],
         "timestamp": "2024-03-15 08:30:00"},
        {"latitude": other["center_lat"], "longitude": other["center_lon"],
         "timestamp": "2024-03-15 09:00:00"},
        {"latitude": other["center_lat"], "longitude": other["center_lon"],
         "timestamp": "2024-03-15 09:30:00"},
        {"latitude": other["center_lat"], "longitude": other["center_lon"],
         "timestamp": "2024-03-15 10:00:00"},

        # ⚠️ ANOMALY: GPS jumps to unknown location during expected routine
        {"latitude": anomaly_lat, "longitude": anomaly_lon,
         "timestamp": "2024-03-15 10:45:00"},
    ]

    print("\n  Scoring demo observations...\n")
    results = scorer.score_batch(demo_observations)

    anomaly_count = 0
    for result in results:
        print(format_anomaly_report(result))
        if result["is_anomaly"]:
            anomaly_count += 1

    print(f"\n  [OK] Step 3 complete: Scored {len(results)} observations, "
          f"found {anomaly_count} anomalies")


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(
        description="CareTag Learning Engine - GPS Behavioral Modeling Pipeline",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --step all                  Run full pipeline
  python main.py --step 1 --users 000 001    Extract stay points for users 000 & 001
  python main.py --step 2                    Train LSTM (requires Step 1 outputs)
  python main.py --step 3                    Run anomaly scoring demo
  python main.py --step all --max-files 50   Quick test with limited data
        """
    )

    parser.add_argument(
        "--step",
        type=str,
        required=True,
        choices=["1", "2", "3", "all"],
        help="Which pipeline step to run: 1, 2, 3, or 'all'"
    )
    parser.add_argument(
        "--users",
        nargs="+",
        type=str,
        default=None,
        help="GeoLife user IDs to process (e.g., 000 001 010)"
    )
    parser.add_argument(
        "--max-files",
        type=int,
        default=None,
        help="Max .plt files to parse (for quick testing)"
    )

    args = parser.parse_args()

    # Banner
    print("""
    +==============================================================+
    |                                                              |
    |       CCCC   AAA   RRRR   EEEEE  TTTTT   AAA    GGGG        |
    |      C      A   A  R   R  E        T    A   A  G            |
    |      C      AAAAA  RRRR   EEEE     T    AAAAA  G  GG        |
    |      C      A   A  R  R   E        T    A   A  G   G        |
    |       CCCC  A   A  R   R  EEEEE    T    A   A   GGGG        |
    |                                                              |
    |          Learning Engine - GPS Behavioral Modeling            |
    |                                                              |
    +==============================================================+
    """)

    if args.step in ("1", "all"):
        labeled, num_clusters = run_step1(
            user_ids=args.users,
            max_files=args.max_files
        )
    else:
        labeled, num_clusters = None, None

    if args.step in ("2", "all"):
        model = run_step2(labeled, num_clusters)

    if args.step in ("3", "all"):
        run_step3()

    print("\n  >>> Pipeline finished successfully! <<<\n")


if __name__ == "__main__":
    main()
