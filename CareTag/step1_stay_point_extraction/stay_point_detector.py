# ==============================================================================
# CareTag Learning Engine — Step 1: Stay Point Detection
# ==============================================================================
# Implements the Li et al. (2008) stay-point extraction algorithm.
#
# A "Stay Point" is identified when a user remains within a small geographic
# radius (STAY_DISTANCE_THRESHOLD_M) for a minimum duration
# (STAY_TIME_THRESHOLD_MIN). This filters out transient movement and retains
# only meaningful locations where the user actually spent time.
#
# Reference:
#   Li, Q., et al. "Mining User Similarity Based on Location History." (2008)
# ==============================================================================

import numpy as np
import pandas as pd
from typing import Tuple

import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def haversine_distance(
    lat1: float, lon1: float,
    lat2: float, lon2: float
) -> float:
    """
    Calculate the great-circle distance between two GPS points using the
    Haversine formula.

    Args:
        lat1, lon1: Coordinates of point 1 (decimal degrees).
        lat2, lon2: Coordinates of point 2 (decimal degrees).

    Returns:
        Distance in meters.
    """
    R = 6_371_000  # Earth's radius in meters

    # Convert to radians
    phi1, phi2 = np.radians(lat1), np.radians(lat2)
    dphi = np.radians(lat2 - lat1)
    dlambda = np.radians(lon2 - lon1)

    # Haversine formula
    a = (np.sin(dphi / 2) ** 2 +
         np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2)
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

    return R * c


def haversine_vectorized(
    lats1: np.ndarray, lons1: np.ndarray,
    lat2: float, lon2: float
) -> np.ndarray:
    """
    Vectorized Haversine: distance from arrays of points to a single reference.

    Args:
        lats1, lons1: Arrays of latitudes/longitudes (decimal degrees).
        lat2, lon2:   Single reference point (decimal degrees).

    Returns:
        Array of distances in meters.
    """
    R = 6_371_000

    phi1 = np.radians(lats1)
    phi2 = np.radians(lat2)
    dphi = np.radians(lat2 - lats1)
    dlambda = np.radians(lon2 - lons1)

    a = (np.sin(dphi / 2) ** 2 +
         np.cos(phi1) * np.cos(phi2) * np.sin(dlambda / 2) ** 2)
    c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))

    return R * c


def extract_stay_points(
    gps_data: pd.DataFrame,
    distance_threshold_m: float = None,
    time_threshold_min: float = None
) -> pd.DataFrame:
    """
    Extract stay points from raw GPS trajectory data using the Li et al. algorithm.

    Algorithm:
        For each GPS point i, scan forward to find the farthest consecutive
        point j such that all points between i and j are within
        `distance_threshold_m` of point i. If the time span (t_j - t_i)
        exceeds `time_threshold_min`, the centroid of points i..j is recorded
        as a stay point. Then skip to j+1 and repeat.

    Args:
        gps_data:             DataFrame with columns [latitude, longitude, datetime, user_id].
                              Must be sorted by datetime within each user.
        distance_threshold_m: Max radius in meters (default from config).
        time_threshold_min:   Min duration in minutes (default from config).

    Returns:
        DataFrame of stay points with columns:
        [latitude, longitude, arrival_time, departure_time, duration_min, user_id]
    """
    if distance_threshold_m is None:
        distance_threshold_m = config.STAY_DISTANCE_THRESHOLD_M
    if time_threshold_min is None:
        time_threshold_min = config.STAY_TIME_THRESHOLD_MIN

    print("=" * 60)
    print("  CareTag — Step 1b: Stay Point Extraction")
    print("=" * 60)
    print(f"  Distance threshold : {distance_threshold_m} m")
    print(f"  Time threshold     : {time_threshold_min} min")
    print(f"  Input GPS points   : {len(gps_data):,}")
    print("-" * 60)

    stay_points = []
    users = gps_data["user_id"].unique()

    for user_id in users:
        user_data = gps_data[gps_data["user_id"] == user_id].copy()
        user_data.sort_values("datetime", inplace=True)
        user_data.reset_index(drop=True, inplace=True)

        n = len(user_data)
        if n < 2:
            continue

        lats = user_data["latitude"].values
        lons = user_data["longitude"].values
        times = user_data["datetime"].values

        i = 0
        while i < n:
            j = i + 1

            # Scan forward: find the last consecutive point within distance threshold
            while j < n:
                dist = haversine_distance(lats[i], lons[i], lats[j], lons[j])
                if dist > distance_threshold_m:
                    break
                j += 1

            # Check if the time span meets the minimum duration
            # j is now the first point OUTSIDE the threshold, so the stay is i..(j-1)
            if j > i + 1:
                time_span = (
                    pd.Timestamp(times[j - 1]) - pd.Timestamp(times[i])
                ).total_seconds() / 60.0

                if time_span >= time_threshold_min:
                    # Compute centroid of all points in the stay region
                    centroid_lat = np.mean(lats[i:j])
                    centroid_lon = np.mean(lons[i:j])

                    stay_points.append({
                        "latitude": centroid_lat,
                        "longitude": centroid_lon,
                        "arrival_time": pd.Timestamp(times[i]),
                        "departure_time": pd.Timestamp(times[j - 1]),
                        "duration_min": time_span,
                        "user_id": user_id,
                        "num_points": j - i  # GPS points contributing to this stay
                    })

                    # Jump past this stay region
                    i = j
                    continue

            # No stay detected at i; advance by one
            i += 1

        print(f"  User {user_id}: {len([s for s in stay_points if s['user_id'] == user_id])} stay points found")

    # Build the result DataFrame
    if not stay_points:
        print("\n  [WARNING] No stay points detected. Consider relaxing thresholds.")
        return pd.DataFrame(columns=[
            "latitude", "longitude", "arrival_time",
            "departure_time", "duration_min", "user_id", "num_points"
        ])

    result = pd.DataFrame(stay_points)
    result.sort_values("arrival_time", inplace=True)
    result.reset_index(drop=True, inplace=True)

    print("-" * 60)
    print(f"  Total stay points extracted : {len(result):,}")
    print(f"  Avg duration per stay       : {result['duration_min'].mean():.1f} min")
    print(f"  Max duration                : {result['duration_min'].max():.1f} min")
    print("=" * 60)

    return result


# ==============================================================================
# Quick standalone test
# ==============================================================================
if __name__ == "__main__":
    from data_loader import load_geolife_data

    gps = load_geolife_data(max_files=50)
    stays = extract_stay_points(gps)
    print("\nSample stay points:")
    print(stays.head(10).to_string(index=False))
