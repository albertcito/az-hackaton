"""Flights: parse routes, precompute cumulative distance, interpolate positions.

positions_at mirrors app/utils/interpolatePosition.ts: walk the waypoint
polyline by cumulative haversine NM until cruise_speed_kt * elapsed_sec / 3600
is reached; clamp before take-off / after scheduled landing; constant altitude.
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta

import numpy as np

from .constants import BIN_MINUTES, NM_PER_KT_PER_SEC
from .geometry import haversine_nm
from .ids import parse_iso


def _ms(dt: datetime) -> float:
    return dt.timestamp() * 1000.0


class Flights:
    def __init__(self, routes_path: str):
        with open(routes_path, encoding="utf-8") as fh:
            data = json.load(fh)

        self.asked_at = parse_iso(data["asked_at"])
        self.window_start = parse_iso(data["window_start"])
        self.window_end = parse_iso(data["window_end"])
        self.flights = data["flights"]
        self.n = len(self.flights)

        self.fids: list[str] = []
        self.take_off_ms = np.empty(self.n)
        self.land_ms = np.empty(self.n)
        self.speed = np.empty(self.n)
        self.alt = np.empty(self.n)
        self._lat: list[np.ndarray] = []
        self._lon: list[np.ndarray] = []
        self._cum: list[np.ndarray] = []
        self._total = np.empty(self.n)

        for i, f in enumerate(self.flights):
            self.fids.append(
                f"{f['flight_number']}|{f['take_off_time']}|{f['origin_airport_icao']}"
            )
            self.take_off_ms[i] = _ms(parse_iso(f["take_off_time"]))
            self.land_ms[i] = _ms(parse_iso(f["scheduled_landing_time"]))
            self.speed[i] = float(f["cruise_speed_kt"])
            self.alt[i] = float(f["cruise_altitude_ft"])
            lat = np.asarray(f["lats"], dtype=float)
            lon = np.asarray(f["lons"], dtype=float)
            self._lat.append(lat)
            self._lon.append(lon)
            if len(lat) > 1:
                seg = haversine_nm(lat[:-1], lon[:-1], lat[1:], lon[1:])
                cum = np.concatenate([[0.0], np.cumsum(seg)])
            else:
                cum = np.array([0.0])
            self._cum.append(cum)
            self._total[i] = cum[-1]

        self.fid_to_idx = {fid: i for i, fid in enumerate(self.fids)}

    def bins(self) -> list[datetime]:
        """Ordered 15-min bin-start times spanning [window_start, window_end] inclusive."""
        out = []
        t = self.window_start
        step = timedelta(minutes=BIN_MINUTES)
        while t <= self.window_end:
            out.append(t)
            t = t + step
        return out

    def _interp(self, i: int, target_nm: float) -> tuple[float, float]:
        """(lon, lat) along flight i's polyline at cumulative distance target_nm."""
        cum = self._cum[i]
        lat = self._lat[i]
        lon = self._lon[i]
        if self._total[i] <= 0.0 or target_nm <= 0.0:
            return float(lon[0]), float(lat[0])
        if target_nm >= self._total[i]:
            return float(lon[-1]), float(lat[-1])
        k = int(np.searchsorted(cum, target_nm, side="right"))
        seg = cum[k] - cum[k - 1]
        tt = 0.0 if seg == 0 else (target_nm - cum[k - 1]) / seg
        return (
            float(lon[k - 1] + (lon[k] - lon[k - 1]) * tt),
            float(lat[k - 1] + (lat[k] - lat[k - 1]) * tt),
        )

    def positions_at(self, t: datetime, delay_ms: np.ndarray | None = None):
        """Return (lons, lats, alts, fids, idxs) for flights airborne at time t.

        delay_ms (optional, per-flight) shifts take-off and landing for the
        incremental/resolver case.
        """
        t_ms = _ms(t)
        take = self.take_off_ms
        land = self.land_ms
        if delay_ms is not None:
            take = take + delay_ms
            land = land + delay_ms
        airborne = np.where((take <= t_ms) & (t_ms <= land))[0]
        lons = np.empty(len(airborne))
        lats = np.empty(len(airborne))
        for j, i in enumerate(airborne.tolist()):
            elapsed = (t_ms - take[i]) / 1000.0
            target_nm = self.speed[i] * elapsed * NM_PER_KT_PER_SEC
            lons[j], lats[j] = self._interp(i, target_nm)
        alts = self.alt[airborne]
        fids = [self.fids[i] for i in airborne.tolist()]
        return lons, lats, alts, fids, airborne

    def position_of(self, idx: int, t: datetime, delay_ms: float = 0.0):
        """(lon, lat, alt) for one flight at time t under an optional delay, or None if not airborne."""
        t_ms = _ms(t)
        take = self.take_off_ms[idx] + delay_ms
        land = self.land_ms[idx] + delay_ms
        if not (take <= t_ms <= land):
            return None
        elapsed = (t_ms - take) / 1000.0
        target_nm = self.speed[idx] * elapsed * NM_PER_KT_PER_SEC
        lon, lat = self._interp(idx, target_nm)
        return lon, lat, float(self.alt[idx])
