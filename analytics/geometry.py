"""Grid mapping + haversine. latlon_to_ij mirrors weatherGrid.ts exactly."""

from __future__ import annotations

import numpy as np

from .constants import (
    EARTH_RADIUS_NM,
    WX_COLS,
    WX_LAT_MAX,
    WX_LAT_MIN,
    WX_LON_MAX,
    WX_LON_MIN,
    WX_ROWS,
)


def latlon_to_ij(lat, lon):
    """Map lat/lon (scalar or array) to (row, col) integer grid indices, clamped."""
    lat = np.asarray(lat, dtype=float)
    lon = np.asarray(lon, dtype=float)
    row = np.floor((WX_LAT_MAX - lat) / (WX_LAT_MAX - WX_LAT_MIN) * WX_ROWS).astype(int)
    col = np.floor((lon - WX_LON_MIN) / (WX_LON_MAX - WX_LON_MIN) * WX_COLS).astype(int)
    row = np.clip(row, 0, WX_ROWS - 1)
    col = np.clip(col, 0, WX_COLS - 1)
    return row, col


def cell_center(row, col):
    """Lat/lon at the center of grid cell (row, col)."""
    row = np.asarray(row, dtype=float)
    col = np.asarray(col, dtype=float)
    lat = WX_LAT_MAX - (row + 0.5) / WX_ROWS * (WX_LAT_MAX - WX_LAT_MIN)
    lon = WX_LON_MIN + (col + 0.5) / WX_COLS * (WX_LON_MAX - WX_LON_MIN)
    return lat, lon


def haversine_nm(lat1, lon1, lat2, lon2):
    """Great-circle distance in nautical miles (vectorized). Matches interpolatePosition.ts."""
    lat1 = np.asarray(lat1, dtype=float)
    lon1 = np.asarray(lon1, dtype=float)
    lat2 = np.asarray(lat2, dtype=float)
    lon2 = np.asarray(lon2, dtype=float)
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    a = (
        np.sin(dlat / 2.0) ** 2
        + np.cos(np.radians(lat1)) * np.cos(np.radians(lat2)) * np.sin(dlon / 2.0) ** 2
    )
    return 2.0 * EARTH_RADIUS_NM * np.arcsin(np.sqrt(a))
