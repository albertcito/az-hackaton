"""Per-flight convective-weather penetration (for the proactive T2 trigger).

For each bin, sample every airborne flight's position and test whether it sits
in a blocked weather cell (refc >= 40 dBZ AND cruise_alt < echo top) — the §3.3
blocking rule, evaluated forward across the whole timeline. The live TS layer
then filters this to "the next penetration in [now, now+horizon]" per flight.
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from .constants import REFC_BLOCK_DBZ
from .geometry import latlon_to_ij
from .weather import strip_for


def compute_penetration(flights, snapshot_dir: str, bins) -> dict[str, list[int]]:
    out: dict[str, list[int]] = defaultdict(list)
    for b, t in enumerate(bins):
        refc = strip_for(snapshot_dir, "refc", t)
        retop = strip_for(snapshot_dir, "retop", t)
        if refc is None or retop is None:
            continue
        lons, lats, alts, fids, _ = flights.positions_at(t)
        if len(fids) == 0:
            continue
        rows, cols = latlon_to_ij(lats, lons)
        cell_refc = refc[rows, cols]
        cell_retop = retop[rows, cols]
        blocked = (cell_refc >= REFC_BLOCK_DBZ) & (alts < cell_retop)
        for i in np.where(blocked)[0]:
            out[fids[int(i)]].append(b)
    return {fid: bs for fid, bs in out.items()}
