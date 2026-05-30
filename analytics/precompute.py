"""CLI: precompute derived JSON for one snapshot or all of them.

    python -m analytics.precompute --snapshot asked_at_2026-04-08T18:00:00Z
    python -m analytics.precompute --all

Writes demand.json, members.json, attribution.json, mitigation.json under
data/derived/<snapshot_id>/ ; --all also writes scorecard.json (see eval.py).
"""

from __future__ import annotations

import argparse
import json
import os
import time

from .attribution import compute_attribution
from .demand import build_demand, build_members
from .engine import OccupancyEngine
from .penetration import compute_penetration
from .flights import Flights
from .ids import sanitize
from .resolver import resolve
from .sectors import Sectors

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_DATA = os.path.join(REPO_ROOT, "data")


def _write_json(path: str, obj) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, separators=(",", ":"))


def precompute_snapshot(data_dir: str, snapshot_id: str, out_dir: str,
                        sectors: Sectors | None = None, verbose: bool = True) -> dict:
    snapshot_id = sanitize(snapshot_id)
    snap_dir = os.path.join(data_dir, snapshot_id)
    t0 = time.time()

    flights = Flights(os.path.join(snap_dir, "routes.json"))
    if sectors is None:
        sectors = Sectors(os.path.join(data_dir, "sectors.geojson"))
    engine = OccupancyEngine(flights, sectors)

    # Baseline artifacts (before any mitigation mutates the engine).
    demand = build_demand(engine, snapshot_id)
    members = build_members(engine)
    attribution = compute_attribution(engine, snap_dir)
    penetration = compute_penetration(flights, snap_dir, engine.bins)
    baseline = engine.summary()

    # Baseline flight -> [(bin, sector)] index, for the live (TS) incremental
    # engine: lets it remove a flight's exact baseline contribution before
    # recomputing its delayed position. Only flights with >=1 cell are emitted.
    flight_cells = {
        fid: [[b, name] for (b, name) in cells]
        for fid, cells in engine.flight_cells.items()
        if cells
    }

    # Mitigation mutates engine.counts -> mitigated occupancy.
    mitigation = resolve(engine)
    mitigated = engine.summary()
    for s in demand["sectors"]:
        s["counts_mitigated"] = engine.counts[engine.sector_index[s["name"]]].tolist()

    mitigation_out = {
        "strategy": mitigation["strategy"],
        "baseline": baseline,
        "mitigated": mitigated,
        "total_delay_minutes": mitigation["total_delay_minutes"],
        "actions": mitigation["actions"],
    }

    snap_out = os.path.join(out_dir, snapshot_id)
    _write_json(os.path.join(snap_out, "demand.json"), demand)
    _write_json(os.path.join(snap_out, "members.json"), members)
    _write_json(os.path.join(snap_out, "attribution.json"), attribution)
    _write_json(os.path.join(snap_out, "mitigation.json"), mitigation_out)
    _write_json(os.path.join(snap_out, "flight_cells.json"), flight_cells)
    _write_json(os.path.join(snap_out, "penetration.json"), penetration)

    row = {
        "snapshot": snapshot_id,
        "flights": flights.n,
        "n_over_sectors": baseline["n_over_sectors"],
        "peak_stress": baseline["peak_stress"],
        "total_over_area": baseline["total_over_area"],
        "mitigated_over_sectors": mitigated["n_over_sectors"],
        "total_delay_minutes": mitigation["total_delay_minutes"],
    }
    if verbose:
        dt = time.time() - t0
        print(f"[{snapshot_id}] {flights.n} flights | over_sectors "
              f"{baseline['n_over_sectors']}->{mitigated['n_over_sectors']} | "
              f"peak_stress {baseline['peak_stress']} | delay "
              f"{mitigation['total_delay_minutes']} min | {dt:.1f}s")
    return row


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", default=DEFAULT_DATA, help="materialized data dir")
    ap.add_argument("--out", default=os.path.join(DEFAULT_DATA, "derived"))
    ap.add_argument("--snapshot", default=None, help="snapshot id (colons ok)")
    ap.add_argument("--all", action="store_true", help="all snapshots + scorecard")
    args = ap.parse_args()

    sectors = Sectors(os.path.join(args.data, "sectors.geojson"))

    if args.all:
        snaps = sorted(
            d for d in os.listdir(args.data)
            if d.startswith("asked_at_") and os.path.isdir(os.path.join(args.data, d))
        )
        rows = [precompute_snapshot(args.data, s, args.out, sectors) for s in snaps]
        from .eval import write_scorecard
        write_scorecard(rows, args.out)
        print(f"Wrote scorecard for {len(rows)} snapshots.")
    elif args.snapshot:
        precompute_snapshot(args.data, args.snapshot, args.out, sectors)
    else:
        ap.error("provide --snapshot <id> or --all")


if __name__ == "__main__":
    main()
