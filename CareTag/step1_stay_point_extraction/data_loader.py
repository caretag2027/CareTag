# ==============================================================================
# CareTag Learning Engine — Step 1: GeoLife Data Loader
# ==============================================================================
# Parses Microsoft GeoLife GPS Trajectory Dataset (.plt files) into a clean
# pandas DataFrame. Handles the 6-line header, extracts lat/lon/datetime,
# and supports filtering by user ID.
#
# PLT Format (line 7 onwards):
#   Latitude, Longitude, 0, Altitude(ft), DateDays, Date, Time
#   Example: 39.906631,116.385564,0,492,40097.5864583333,2009-10-11,14:04:30
# ==============================================================================

import os
import glob
import pandas as pd
import numpy as np
from typing import List, Optional

import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config


def parse_plt_file(filepath: str) -> pd.DataFrame:
    """
    Parse a single GeoLife .plt file into a DataFrame.

    Args:
        filepath: Absolute path to the .plt file.

    Returns:
        DataFrame with columns: [latitude, longitude, altitude_ft, datetime]
    """
    try:
        # Read the file, skipping the 6-line header
        df = pd.read_csv(
            filepath,
            skiprows=6,
            header=None,
            names=[
                "latitude", "longitude", "zero",
                "altitude_ft", "date_days", "date", "time"
            ],
            dtype={
                "latitude": np.float64,
                "longitude": np.float64,
                "altitude_ft": np.float64,
            },
            on_bad_lines="skip"  # gracefully skip malformed lines
        )

        # Combine date + time into a single datetime column
        df["datetime"] = pd.to_datetime(
            df["date"] + " " + df["time"],
            format="%Y-%m-%d %H:%M:%S",
            errors="coerce"
        )

        # Drop rows where datetime parsing failed
        df.dropna(subset=["datetime"], inplace=True)

        # Keep only the columns we need
        df = df[["latitude", "longitude", "altitude_ft", "datetime"]].copy()

        # Basic sanity filters: valid GPS coordinate ranges
        df = df[
            (df["latitude"].between(-90, 90)) &
            (df["longitude"].between(-180, 180))
        ]

        return df

    except Exception as e:
        print(f"  [WARNING] Failed to parse {filepath}: {e}")
        return pd.DataFrame(columns=["latitude", "longitude", "altitude_ft", "datetime"])


def discover_plt_files(
    geolife_root: str,
    user_ids: Optional[List[str]] = None
) -> List[str]:
    """
    Discover all .plt files under the GeoLife dataset root directory.

    Args:
        geolife_root: Path to the GeoLife 'Data' folder.
        user_ids:     Optional list of user folder names to filter (e.g., ["000", "010"]).
                      If None, all users are included.

    Returns:
        Sorted list of absolute paths to .plt files.
    """
    if not os.path.isdir(geolife_root):
        raise FileNotFoundError(
            f"GeoLife dataset root not found: {geolife_root}\n"
            f"Please download the dataset from:\n"
            f"  https://www.microsoft.com/en-us/download/details.aspx?id=52367\n"
            f"and extract it so that the 'Data' folder is at:\n"
            f"  {geolife_root}"
        )

    plt_files = []

    if user_ids is not None:
        # Only scan specified user directories
        for uid in user_ids:
            pattern = os.path.join(geolife_root, uid, "Trajectory", "*.plt")
            plt_files.extend(glob.glob(pattern))
    else:
        # Scan all user directories
        pattern = os.path.join(geolife_root, "*", "Trajectory", "*.plt")
        plt_files.extend(glob.glob(pattern))

    plt_files.sort()
    return plt_files


def load_geolife_data(
    geolife_root: Optional[str] = None,
    user_ids: Optional[List[str]] = None,
    max_files: Optional[int] = None
) -> pd.DataFrame:
    """
    Load and concatenate GPS trajectory data from the GeoLife dataset.

    This is the main entry point for data loading. It discovers all relevant
    .plt files, parses them, and returns a single unified DataFrame.

    Args:
        geolife_root: Path to the GeoLife 'Data' folder. Defaults to config.GEOLIFE_ROOT.
        user_ids:     Optional list of user IDs to include. Defaults to config.TARGET_USERS.
        max_files:    Optional cap on the number of files to parse (useful for testing).

    Returns:
        DataFrame with columns: [latitude, longitude, altitude_ft, datetime, user_id]
        sorted by datetime.
    """
    if geolife_root is None:
        geolife_root = config.GEOLIFE_ROOT
    if user_ids is None:
        user_ids = config.TARGET_USERS

    print("=" * 60)
    print("  CareTag — Step 1a: Loading GeoLife GPS Data")
    print("=" * 60)
    print(f"  Dataset root : {geolife_root}")
    print(f"  Target users : {user_ids if user_ids else 'ALL'}")

    # Discover .plt files
    plt_files = discover_plt_files(geolife_root, user_ids)
    total_files = len(plt_files)

    if total_files == 0:
        raise FileNotFoundError(
            f"No .plt files found under {geolife_root}. "
            f"Check the dataset structure."
        )

    if max_files is not None:
        plt_files = plt_files[:max_files]

    print(f"  Found {total_files} .plt files (processing {len(plt_files)})")
    print("-" * 60)

    # Parse all files
    all_dfs = []
    for i, fpath in enumerate(plt_files, 1):
        # Extract user ID from the path  (…/Data/<user_id>/Trajectory/…)
        parts = fpath.replace("\\", "/").split("/")
        try:
            traj_idx = parts.index("Trajectory")
            user_id = parts[traj_idx - 1]
        except ValueError:
            user_id = "unknown"

        df = parse_plt_file(fpath)
        if not df.empty:
            df["user_id"] = user_id
            all_dfs.append(df)

        # Progress indicator every 50 files
        if i % 50 == 0 or i == len(plt_files):
            print(f"  Parsed {i}/{len(plt_files)} files...")

    if not all_dfs:
        raise ValueError("All .plt files were empty or unparseable.")

    # Concatenate and sort
    combined = pd.concat(all_dfs, ignore_index=True)
    combined.sort_values("datetime", inplace=True)
    combined.reset_index(drop=True, inplace=True)

    print("-" * 60)
    print(f"  Total GPS points loaded : {len(combined):,}")
    print(f"  Date range              : {combined['datetime'].min()} → {combined['datetime'].max()}")
    print(f"  Unique users            : {combined['user_id'].nunique()}")
    print("=" * 60)

    return combined


# ==============================================================================
# Quick standalone test
# ==============================================================================
if __name__ == "__main__":
    df = load_geolife_data()
    print("\nSample rows:")
    print(df.head(10).to_string(index=False))
