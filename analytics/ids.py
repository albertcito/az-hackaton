"""Snapshot id <-> on-disk name helpers. Mirrors app/utils/snapshotId.ts."""

from __future__ import annotations

from datetime import datetime, timezone


def sanitize(s: str) -> str:
    """':' -> '-' so a snapshot id / filename is Windows-safe."""
    return s.replace(":", "-")


def snapshot_id_to_asked_at(snapshot_id: str) -> str:
    """`asked_at_2026-04-08T18-00-00Z` -> `2026-04-08T18:00:00Z`."""
    body = snapshot_id
    if body.startswith("asked_at_"):
        body = body[len("asked_at_"):]
    if "T" not in body:
        return body
    date, _, time = body.partition("T")
    return f"{date}T{time.replace('-', ':')}"


def parse_iso(s: str) -> datetime:
    """Parse an ISO timestamp (with +00:00 or Z) into a tz-aware UTC datetime."""
    s = s.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
