"""Weather->congestion attribution (explicit heuristic, label as such in UI).

For each over-demand (sector, bin): a member flight counts as weather-displaced
if a blocked weather cell (refc>=40 & cruise_alt<retop) lies within R nm of the
flight's position at that bin time. weather_displaced = n_weather / n_total.
"""

from __future__ import annotations

import numpy as np

from .constants import (
    ATTRIBUTION_RADIUS_NM,
    REFC_BLOCK_DBZ,
    WX_COLS,
    WX_LAT_MAX,
    WX_LAT_MIN,
    WX_LON_MAX,
    WX_LON_MIN,
    WX_ROWS,
)
from .engine import OccupancyEngine
from .geometry import haversine_nm, latlon_to_ij
from .weather import strip_for

# A ~16-cell window comfortably covers 100 nm at these grid resolutions
# (~8 nm/row, ~9 nm/col at mid-latitude).
_WINDOW = 16


def _weather_within(lat, lon, alt, refc, retop, radius_nm) -> bool:
    row = int(np.clip(np.floor((WX_LAT_MAX - lat) / (WX_LAT_MAX - WX_LAT_MIN) * WX_ROWS), 0, WX_ROWS - 1))
    col = int(np.clip(np.floor((lon - WX_LON_MIN) / (WX_LON_MAX - WX_LON_MIN) * WX_COLS), 0, WX_COLS - 1))
    r0, r1 = max(0, row - _WINDOW), min(WX_ROWS, row + _WINDOW + 1)
    c0, c1 = max(0, col - _WINDOW), min(WX_COLS, col + _WINDOW + 1)
    sub_refc = refc[r0:r1, c0:c1]
    sub_retop = retop[r0:r1, c0:c1]
    blk = (sub_refc >= REFC_BLOCK_DBZ) & (alt < sub_retop)
    if not blk.any():
        return False
    rows = np.arange(r0, r1)
    cols = np.arange(c0, c1)
    clat = WX_LAT_MAX - (rows + 0.5) / WX_ROWS * (WX_LAT_MAX - WX_LAT_MIN)
    clon = WX_LON_MIN + (cols + 0.5) / WX_COLS * (WX_LON_MAX - WX_LON_MIN)
    lat_grid, lon_grid = np.meshgrid(clat, clon, indexing="ij")
    dist = haversine_nm(lat, lon, lat_grid, lon_grid)
    return bool(((dist <= radius_nm) & blk).any())


def compute_attribution(engine: OccupancyEngine, snapshot_dir: str,
                        radius_nm: float = ATTRIBUTION_RADIUS_NM) -> dict:
    fl = engine.flights
    out: dict[str, dict[str, dict]] = {}
    for si, name in enumerate(engine.sector_names):
        cap = int(engine.caps_arr[si])
        for b in range(engine.nbins):
            if engine.counts[si, b] <= cap:
                continue
            t = engine.bins[b]
            fids = engine.members[name][b]
            n_total = len(fids)
            refc = strip_for(snapshot_dir, "refc", t)
            retop = strip_for(snapshot_dir, "retop", t)
            n_weather = 0
            if refc is not None and retop is not None and n_total:
                for fid in fids:
                    pos = fl.position_of(fl.fid_to_idx[fid], t)
                    if pos is None:
                        continue
                    lon, lat, alt = pos
                    if _weather_within(lat, lon, alt, refc, retop, radius_nm):
                        n_weather += 1
            frac = (n_weather / n_total) if n_total else 0.0
            out.setdefault(name, {})[str(b)] = {
                "weather_displaced": round(frac, 3),
                "n_total": n_total,
                "n_weather": n_weather,
            }
    return out
