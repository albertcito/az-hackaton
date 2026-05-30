"""OccupancyEngine: per-bin sector occupancy + incremental ground-delay edits.

Builds the baseline occupancy once (the heavy compute), then supports cheap
incremental edits: applying a ground delay only recomputes the affected
flight's cells. This same model is mirrored in TS for the live session (P6).
"""

from __future__ import annotations

from collections import defaultdict

import numpy as np

from .constants import NM_PER_KT_PER_SEC
from .flights import Flights
from .sectors import Sectors


class OccupancyEngine:
    def __init__(self, flights: Flights, sectors: Sectors):
        self.flights = flights
        self.sectors = sectors
        self.bins = flights.bins()
        self.nbins = len(self.bins)
        self._bin_ms = np.array([b.timestamp() * 1000.0 for b in self.bins])

        self.sector_names = sectors.names
        self.sector_index = {n: k for k, n in enumerate(self.sector_names)}
        self.nsectors = len(self.sector_names)
        self.caps_arr = np.array([sectors.capacity(n) for n in self.sector_names])

        # Mutable state.
        self.counts = np.zeros((self.nsectors, self.nbins), dtype=int)
        self.airborne_count = np.zeros(self.nbins, dtype=int)
        self.flight_cells: dict[str, list[tuple[int, str]]] = defaultdict(list)
        self.members: dict[str, dict[int, list[str]]] = defaultdict(lambda: defaultdict(list))
        self.delays: dict[str, int] = {}

        self._build_baseline()

    def _build_baseline(self) -> None:
        for b, t in enumerate(self.bins):
            lons, lats, alts, fids, _ = self.flights.positions_at(t)
            self.airborne_count[b] = len(fids)
            names = self.sectors.assign(lons, lats, alts)
            for fid, name in zip(fids, names.tolist()):
                if name == "":
                    continue
                si = self.sector_index[name]
                self.counts[si, b] += 1
                self.flight_cells[fid].append((b, name))
                self.members[name][b].append(fid)

    # ---- incremental editing -------------------------------------------------

    def _cells_for(self, idx: int, delay_min: int) -> list[tuple[int, str]]:
        """Recompute one flight's (bin, sector) cells under a total ground delay."""
        fl = self.flights
        delay_ms = delay_min * 60000.0
        take = fl.take_off_ms[idx] + delay_ms
        land = fl.land_ms[idx] + delay_ms
        cells: list[tuple[int, str]] = []
        for b in range(self.nbins):
            t_ms = self._bin_ms[b]
            if not (take <= t_ms <= land):
                continue
            elapsed = (t_ms - take) / 1000.0
            target_nm = fl.speed[idx] * elapsed * NM_PER_KT_PER_SEC
            lon, lat = fl._interp(idx, target_nm)
            name = self.sectors.assign_one(lon, lat, float(fl.alt[idx]))
            if name:
                cells.append((b, name))
        return cells

    def sector_at(self, idx: int, b: int, total_delay_min: int) -> str:
        """Which sector flight idx would be in at bin b under a hypothetical delay (no mutation)."""
        pos = self.flights.position_of(idx, self.bins[b], total_delay_min * 60000.0)
        if pos is None:
            return ""
        lon, lat, alt = pos
        return self.sectors.assign_one(lon, lat, alt)

    def set_delay(self, fid: str, total_minutes: int) -> None:
        """Set a flight's absolute ground delay, updating counts/members incrementally."""
        for (b, name) in self.flight_cells.get(fid, []):
            si = self.sector_index[name]
            self.counts[si, b] -= 1
            lst = self.members[name][b]
            if fid in lst:
                lst.remove(fid)
        self.delays[fid] = total_minutes
        idx = self.flights.fid_to_idx[fid]
        cells = self._cells_for(idx, total_minutes)
        for (b, name) in cells:
            si = self.sector_index[name]
            self.counts[si, b] += 1
            self.members[name][b].append(fid)
        self.flight_cells[fid] = cells

    # ---- summaries -----------------------------------------------------------

    def stress(self) -> list[dict]:
        over = np.maximum(0, self.counts - self.caps_arr[:, None])
        out = []
        for b in range(self.nbins):
            out.append({
                "bin_index": b,
                "total_over": int(over[:, b].sum()),
                "n_over_sectors": int((over[:, b] > 0).sum()),
                "total_flights": int(self.airborne_count[b]),
            })
        return out

    def summary(self) -> dict:
        peaks = self.counts.max(axis=1)
        over = np.maximum(0, self.counts - self.caps_arr[:, None])
        return {
            "n_over_sectors": int((peaks > self.caps_arr).sum()),
            "total_over_area": int(over.sum()),
            "peak_stress": int(over.sum(axis=0).max()) if self.nbins else 0,
        }
