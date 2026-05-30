"""Build scorecard.json across all snapshots."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

from .ids import snapshot_id_to_asked_at


def write_scorecard(rows: list[dict], out_dir: str) -> dict:
    for r in rows:
        r.setdefault("asked_at", snapshot_id_to_asked_at(r["snapshot"]))
    rows = sorted(rows, key=lambda r: r["asked_at"])
    scorecard = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "rows": rows,
    }
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "scorecard.json"), "w", encoding="utf-8") as fh:
        json.dump(scorecard, fh, separators=(",", ":"))
    return scorecard
