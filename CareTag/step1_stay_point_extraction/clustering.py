# ==============================================================================
# CareTag Learning Engine — Step 1: K-Means Clustering of Stay Points
# ==============================================================================
# Clusters extracted stay points into meaningful locations (Home, Work, School,
# etc.) using K-Means. Automatically selects the optimal number of clusters
# via the Elbow Method combined with Silhouette Score analysis.
#
# Outputs:
#   - Labeled stay-points CSV
#   - Saved K-Means model (joblib)
#   - Cluster-center metadata CSV
#   - Elbow + Silhouette visualization plot
# ==============================================================================

import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")  # non-interactive backend for headless environments
import matplotlib.pyplot as plt
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import silhouette_score
import joblib

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def find_optimal_k(
    coordinates: np.ndarray,
    max_k: int = None,
    random_state: int = None
) -> dict:
    """
    Evaluate K-Means for K=2..max_k and return inertia + silhouette scores.

    Uses the Elbow Method (inertia curve) and Silhouette Score to help
    determine the best number of clusters.

    Args:
        coordinates:  (N, 2) array of [latitude, longitude] (standardized).
        max_k:        Maximum K to evaluate.
        random_state: Random seed for reproducibility.

    Returns:
        dict with keys:
            - "k_values":          list of K values tested
            - "inertias":          list of inertia (within-cluster sum of squares)
            - "silhouette_scores": list of silhouette scores
            - "best_k":           K with the highest silhouette score
    """
    if max_k is None:
        max_k = config.KMEANS_MAX_K
    if random_state is None:
        random_state = config.KMEANS_RANDOM_STATE

    # Ensure max_k doesn't exceed the number of samples
    max_k = min(max_k, len(coordinates) - 1)

    k_values = list(range(2, max_k + 1))
    inertias = []
    silhouette_scores_list = []

    print("  Evaluating K-Means for K = 2..{}".format(max_k))

    for k in k_values:
        km = KMeans(
            n_clusters=k,
            n_init=config.KMEANS_N_INIT,
            random_state=random_state,
            max_iter=300
        )
        labels = km.fit_predict(coordinates)

        inertias.append(km.inertia_)
        sil = silhouette_score(coordinates, labels)
        silhouette_scores_list.append(sil)

        print(f"    K={k:2d}  |  Inertia={km.inertia_:10.2f}  |  Silhouette={sil:.4f}")

    best_k = k_values[np.argmax(silhouette_scores_list)]
    print(f"  → Best K by Silhouette Score: {best_k}")

    return {
        "k_values": k_values,
        "inertias": inertias,
        "silhouette_scores": silhouette_scores_list,
        "best_k": best_k
    }


def plot_cluster_analysis(
    eval_results: dict,
    stay_points: pd.DataFrame,
    labels: np.ndarray,
    centers: np.ndarray,
    save_dir: str = None
):
    """
    Generate and save diagnostic plots:
      1. Elbow curve (inertia vs. K)
      2. Silhouette score vs. K
      3. Geographic scatter plot of clustered stay points

    Args:
        eval_results: Output from find_optimal_k().
        stay_points:  DataFrame with latitude/longitude columns.
        labels:       Cluster labels assigned by K-Means.
        centers:      (K, 2) array of cluster centers (original lat/lon scale).
        save_dir:     Directory to save plots. Defaults to config.PLOTS_DIR.
    """
    if save_dir is None:
        save_dir = config.PLOTS_DIR

    fig, axes = plt.subplots(1, 3, figsize=(20, 6))
    fig.suptitle("CareTag — Stay Point Cluster Analysis", fontsize=16, fontweight="bold")

    # --- Plot 1: Elbow Curve ---
    ax1 = axes[0]
    ax1.plot(eval_results["k_values"], eval_results["inertias"],
             "bo-", linewidth=2, markersize=8)
    ax1.axvline(x=eval_results["best_k"], color="red", linestyle="--",
                label=f"Selected K={eval_results['best_k']}")
    ax1.set_xlabel("Number of Clusters (K)", fontsize=12)
    ax1.set_ylabel("Inertia (WCSS)", fontsize=12)
    ax1.set_title("Elbow Method", fontsize=14)
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # --- Plot 2: Silhouette Score ---
    ax2 = axes[1]
    ax2.plot(eval_results["k_values"], eval_results["silhouette_scores"],
             "gs-", linewidth=2, markersize=8)
    ax2.axvline(x=eval_results["best_k"], color="red", linestyle="--",
                label=f"Best K={eval_results['best_k']}")
    ax2.set_xlabel("Number of Clusters (K)", fontsize=12)
    ax2.set_ylabel("Silhouette Score", fontsize=12)
    ax2.set_title("Silhouette Analysis", fontsize=14)
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    # --- Plot 3: Geographic Scatter ---
    ax3 = axes[2]
    scatter = ax3.scatter(
        stay_points["longitude"], stay_points["latitude"],
        c=labels, cmap="tab10", alpha=0.6, s=30, edgecolors="k", linewidths=0.3
    )
    # Plot cluster centers as large red stars
    ax3.scatter(
        centers[:, 1], centers[:, 0],
        c="red", marker="*", s=300, edgecolors="black",
        linewidths=1.5, zorder=5, label="Cluster Centers"
    )
    ax3.set_xlabel("Longitude", fontsize=12)
    ax3.set_ylabel("Latitude", fontsize=12)
    ax3.set_title("Clustered Stay Points (Geographic)", fontsize=14)
    ax3.legend()
    ax3.grid(True, alpha=0.3)
    plt.colorbar(scatter, ax=ax3, label="Cluster ID")

    plt.tight_layout()
    plot_path = os.path.join(save_dir, "cluster_analysis.png")
    plt.savefig(plot_path, dpi=150, bbox_inches="tight")
    plt.close()
    print(f"  Plot saved: {plot_path}")


def cluster_stay_points(stay_points: pd.DataFrame) -> pd.DataFrame:
    """
    Main clustering pipeline: evaluates K, fits K-Means, labels stay points,
    saves all artifacts.

    Args:
        stay_points: DataFrame from stay_point_detector with at least
                     [latitude, longitude] columns.

    Returns:
        DataFrame with an added 'cluster_id' column.
    """
    print("=" * 60)
    print("  CareTag — Step 1c: K-Means Clustering")
    print("=" * 60)
    print(f"  Input stay points : {len(stay_points):,}")
    print("-" * 60)

    if len(stay_points) < 3:
        raise ValueError(
            f"Too few stay points ({len(stay_points)}) to cluster. "
            f"Need at least 3. Try relaxing detection thresholds."
        )

    # ---- Prepare coordinate matrix ----
    coords_raw = stay_points[["latitude", "longitude"]].values

    # Standardize for K-Means (lat/lon have different scales near poles)
    scaler = StandardScaler()
    coords_scaled = scaler.fit_transform(coords_raw)

    # ---- Find optimal K ----
    eval_results = find_optimal_k(coords_scaled)
    best_k = eval_results["best_k"]

    # ---- Fit final K-Means with the best K ----
    print(f"\n  Fitting final K-Means with K={best_k}...")
    kmeans = KMeans(
        n_clusters=best_k,
        n_init=config.KMEANS_N_INIT,
        random_state=config.KMEANS_RANDOM_STATE,
        max_iter=300
    )
    labels = kmeans.fit_predict(coords_scaled)

    # ---- Compute cluster centers in original lat/lon scale ----
    centers_scaled = kmeans.cluster_centers_
    centers_original = scaler.inverse_transform(centers_scaled)

    # ---- Assign labels to the DataFrame ----
    stay_points = stay_points.copy()
    stay_points["cluster_id"] = labels

    # ---- Generate human-readable cluster summaries ----
    print(f"\n  Cluster Summary:")
    print(f"  {'ID':>4}  {'Center Lat':>12}  {'Center Lon':>12}  {'# Points':>10}  {'Avg Stay (min)':>15}")
    print(f"  {'-'*4}  {'-'*12}  {'-'*12}  {'-'*10}  {'-'*15}")

    cluster_meta = []
    for cid in range(best_k):
        mask = stay_points["cluster_id"] == cid
        count = mask.sum()
        avg_dur = stay_points.loc[mask, "duration_min"].mean() if "duration_min" in stay_points.columns else 0

        cluster_meta.append({
            "cluster_id": cid,
            "center_lat": centers_original[cid, 0],
            "center_lon": centers_original[cid, 1],
            "num_points": count,
            "avg_duration_min": round(avg_dur, 1)
        })

        print(f"  {cid:4d}  {centers_original[cid, 0]:12.6f}  {centers_original[cid, 1]:12.6f}  {count:10d}  {avg_dur:15.1f}")

    # ---- Save artifacts ----
    # 1. Labeled stay points
    stay_points.to_csv(config.LABELED_STAY_POINTS_PATH, index=False)
    print(f"\n  Saved labeled stay points → {config.LABELED_STAY_POINTS_PATH}")

    # 2. K-Means model + scaler
    model_bundle = {"kmeans": kmeans, "scaler": scaler}
    joblib.dump(model_bundle, config.KMEANS_MODEL_PATH)
    print(f"  Saved K-Means model       → {config.KMEANS_MODEL_PATH}")

    # 3. Cluster centers metadata
    centers_df = pd.DataFrame(cluster_meta)
    centers_df.to_csv(config.CLUSTER_CENTERS_PATH, index=False)
    print(f"  Saved cluster centers     → {config.CLUSTER_CENTERS_PATH}")

    # 4. Visualization
    plot_cluster_analysis(eval_results, stay_points, labels, centers_original)

    print("=" * 60)
    return stay_points


# ==============================================================================
# Quick standalone test
# ==============================================================================
if __name__ == "__main__":
    from data_loader import load_geolife_data
    from stay_point_detector import extract_stay_points

    gps = load_geolife_data(max_files=100)
    stays = extract_stay_points(gps)
    labeled = cluster_stay_points(stays)
    print("\nSample labeled stay points:")
    print(labeled.head(10).to_string(index=False))
