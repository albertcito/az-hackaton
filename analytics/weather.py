"""Weather strip loading + blocking mask.

Strip filenames are colon-free on disk: {based}_{from}_{to}.npz where each
timestamp is YYYY-MM-DD_HH-MM-SS. The strip covering time t has valid_from <= t < valid_to.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone

import numpy as np

from .constants import REFC_BLOCK_DBZ

_TS = r"(\d{4}-\d{2}-\d{2})_(\d{2}-\d{2}-\d{2})"
_FILE_RE = re.compile(rf"^{_TS}_{_TS}_{_TS}\.npz$")

# snapshot_dir+kind -> sorted [(valid_from, valid_to, path)]
_strip_index: dict[tuple[str, str], list[tuple[datetime, datetime, str]]] = {}
# path -> matrix (np.ndarray)
_matrix_cache: dict[str, np.ndarray] = {}


def _parse_ts(date: str, time: str) -> datetime:
    return datetime.fromisoformat(f"{date}T{time.replace('-', ':')}+00:00").astimezone(timezone.utc)


def list_strips(snapshot_dir: str, kind: str) -> list[tuple[datetime, datetime, str]]:
    """All strips for a kind ('refc'|'retop'), sorted by valid_from."""
    key = (snapshot_dir, kind)
    cached = _strip_index.get(key)
    if cached is not None:
        return cached
    folder = os.path.join(snapshot_dir, "wx", kind)
    out: list[tuple[datetime, datetime, str]] = []
    if os.path.isdir(folder):
        for fn in os.listdir(folder):
            m = _FILE_RE.match(fn)
            if not m:
                continue
            vfrom = _parse_ts(m.group(3), m.group(4))
            vto = _parse_ts(m.group(5), m.group(6))
            out.append((vfrom, vto, os.path.join(folder, fn)))
    out.sort(key=lambda x: x[0])
    _strip_index[key] = out
    return out


def strip_for(snapshot_dir: str, kind: str, t: datetime) -> np.ndarray | None:
    """The matrix for the strip covering time t (valid_from <= t < valid_to), or None."""
    for vfrom, vto, path in list_strips(snapshot_dir, kind):
        if vfrom <= t < vto:
            mat = _matrix_cache.get(path)
            if mat is None:
                mat = np.load(path)["matrix"]
                _matrix_cache[path] = mat
            return mat
    return None


def blocked_mask(refc: np.ndarray, retop: np.ndarray, alt_ft: float) -> np.ndarray:
    """A cell blocks iff refc >= 40 dBZ AND the flight altitude is below the echo top."""
    return (refc >= REFC_BLOCK_DBZ) & (alt_ft < retop)
