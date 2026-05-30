"""Greedy ground-delay resolver (v1) — explainable, no ILP.

Repeatedly take the worst over-demand (sector, bin) and delay the cheapest
delayable flight that leaves that cell. A flight is delayable only if it has not
yet departed at asked_at (still on the ground "now"); airborne flights can't be
un-flown. Per-flight delay is capped; unrelievable cells are left as honest
residual over-demand. Mutates the engine in place (counts become mitigated).
"""

from __future__ import annotations

import numpy as np

from .constants import DELAY_STEP_MIN, MAX_GROUND_DELAY_MIN
from .engine import OccupancyEngine


def resolve(engine: OccupancyEngine) -> dict:
    asked_ms = engine.flights.asked_at.timestamp() * 1000.0
    take_off_ms = engine.flights.take_off_ms
    fid_to_idx = engine.flights.fid_to_idx

    def delayable(fid: str) -> bool:
        idx = fid_to_idx[fid]
        return take_off_ms[idx] > asked_ms and engine.delays.get(fid, 0) < MAX_GROUND_DELAY_MIN

    blocked = np.zeros((engine.nsectors, engine.nbins), dtype=bool)
    actions: dict[str, dict] = {}
    guard = 0
    guard_max = engine.nsectors * engine.nbins + 200000

    while True:
        guard += 1
        if guard > guard_max:
            break

        over = np.maximum(0, engine.counts - engine.caps_arr[:, None])
        over[blocked] = 0
        flat = int(over.argmax())
        max_over = int(over.flat[flat])
        if max_over <= 0:
            break
        si, b = divmod(flat, engine.nbins)
        name = engine.sector_names[si]

        # Cheapest delayable member that leaves (name, b).
        best = None  # (added_minutes, fid, total_delay)
        for fid in list(engine.members[name][b]):
            if not delayable(fid):
                continue
            idx = fid_to_idx[fid]
            cur = engine.delays.get(fid, 0)
            for d in range(cur + DELAY_STEP_MIN, MAX_GROUND_DELAY_MIN + 1, DELAY_STEP_MIN):
                if engine.sector_at(idx, b, d) != name:
                    added = d - cur
                    if best is None or added < best[0]:
                        best = (added, fid, d)
                    break

        if best is None:
            blocked[si, b] = True
            continue

        _, fid, total = best
        engine.set_delay(fid, total)
        rec = actions.setdefault(fid, {"minutes": 0, "relieves": []})
        rec["minutes"] = total
        if [name, b] not in rec["relieves"]:
            rec["relieves"].append([name, b])

    total_delay = int(sum(r["minutes"] for r in actions.values()))
    action_list = [
        {"fid": fid, "type": "ground_delay", "minutes": r["minutes"], "relieves": r["relieves"]}
        for fid, r in actions.items()
    ]
    return {
        "strategy": "ground_delay_greedy",
        "total_delay_minutes": total_delay,
        "actions": action_list,
    }
