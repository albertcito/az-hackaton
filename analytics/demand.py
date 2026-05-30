"""Build demand.json (counts + stress) and members.json (over-demand only)."""

from __future__ import annotations

import numpy as np

from .constants import BIN_MINUTES
from .engine import OccupancyEngine


def build_demand(engine: OccupancyEngine, snapshot_id: str) -> dict:
    """Baseline demand.json (without counts_mitigated; precompute attaches that)."""
    fl = engine.flights
    sectors_out = []
    for si, name in enumerate(engine.sector_names):
        counts = engine.counts[si].tolist()
        cap = int(engine.caps_arr[si])
        peak = int(engine.counts[si].max())
        peak_bin = int(engine.counts[si].argmax())
        sectors_out.append({
            "name": name,
            "band": engine.sectors.bands[name],
            "capacity": cap,
            "peak_count": peak,
            "peak_bin_index": peak_bin,
            "over_by": peak - cap,
            "over_demand": peak > cap,
            "counts": counts,
        })
    return {
        "snapshot": snapshot_id,
        "asked_at": fl.asked_at.isoformat(),
        "bin_minutes": BIN_MINUTES,
        "bins": [b.isoformat() for b in engine.bins],
        "sectors": sectors_out,
        "stress": engine.stress(),
    }


def build_members(engine: OccupancyEngine) -> dict:
    """Membership for over-demand (sector, bin) and their +/-1 neighbor bins."""
    out: dict[str, dict[str, list[str]]] = {}
    for si, name in enumerate(engine.sector_names):
        cap = int(engine.caps_arr[si])
        over_bins = [b for b in range(engine.nbins) if engine.counts[si, b] > cap]
        if not over_bins:
            continue
        emit: set[int] = set()
        for b in over_bins:
            for bb in (b - 1, b, b + 1):
                if 0 <= bb < engine.nbins:
                    emit.add(bb)
        sect: dict[str, list[str]] = {}
        for b in sorted(emit):
            fids = engine.members[name].get(b, [])
            if fids:
                sect[str(b)] = list(fids)
        if sect:
            out[name] = sect
    return out
