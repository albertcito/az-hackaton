"""Materialize the hackathon data bundle onto a Windows-safe filesystem.

The bundle (committed to git and shipped as hackathon_data_bundle.zip) uses
colons in directory and file names (e.g. ``asked_at_2026-04-08T18:00:00Z`` and
``..._18:00:00_...npz``). Colons are illegal in Windows filenames, so neither a
git checkout nor a plain unzip can materialize the data on Windows.

This script extracts the zip into a gitignored ``data/`` directory, replacing
``:`` with ``-`` in every path component. The same sanitization is applied by
the Node server (``app/utils/snapshotId.ts``) and the Python analytics layer
(``analytics/ids.py``) so a colon-bearing snapshot id always maps to its
on-disk name.

Usage::

    python scripts/materialize_data.py                # all snapshots (zip)
    python scripts/materialize_data.py --snapshot asked_at_2026-04-08T18:00:00Z
    python scripts/materialize_data.py --zip hackathon_data_bundle.zip --out data
    python scripts/materialize_data.py --from-public  # dev: copy public/ -> data/
"""

from __future__ import annotations

import argparse
import shutil
import zipfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
BUNDLE_PREFIX = "hackathon_data_bundle/"


def sanitize(path: str) -> str:
    """Replace characters illegal in Windows paths. Colon -> dash."""
    return path.replace(":", "-")


def materialize(zip_path: Path, out_dir: Path, only_snapshot: str | None) -> None:
    if not zip_path.exists():
        raise SystemExit(f"Zip not found: {zip_path}")

    only = sanitize(only_snapshot) if only_snapshot else None
    out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    skipped = 0
    with zipfile.ZipFile(zip_path) as zf:
        for info in zf.infolist():
            name = info.filename
            rel = name[len(BUNDLE_PREFIX):] if name.startswith(BUNDLE_PREFIX) else name
            if not rel:
                continue

            rel = sanitize(rel)

            # When restricting to one snapshot, keep top-level shared files
            # (e.g. sectors.geojson, documentation/) and the chosen snapshot.
            if only is not None:
                top = rel.split("/", 1)[0]
                if top.startswith("asked_at_") and top != only:
                    skipped += 1
                    continue

            dest = out_dir / rel
            if info.is_dir() or name.endswith("/"):
                dest.mkdir(parents=True, exist_ok=True)
                continue

            dest.parent.mkdir(parents=True, exist_ok=True)
            # Idempotent: skip if already materialized at the same size.
            if dest.exists() and dest.stat().st_size == info.file_size:
                continue
            with zf.open(info) as src, open(dest, "wb") as fh:
                fh.write(src.read())
            written += 1

    # Ensure sectors.geojson is present (fall back to the repo-root copy).
    sectors_dest = out_dir / "sectors.geojson"
    if not sectors_dest.exists():
        repo_sectors = REPO_ROOT / "sectors.geojson"
        if repo_sectors.exists():
            sectors_dest.write_bytes(repo_sectors.read_bytes())
            written += 1

    print(f"Materialized {written} file(s) into {out_dir} "
          f"(skipped {skipped} other-snapshot files).")


def materialize_from_public(public_dir: Path, out_dir: Path, only_snapshot: str | None) -> None:
    """Copy colon-bearing snapshot trees from public/ into colon-free data/."""
    if not public_dir.is_dir():
        raise SystemExit(f"public dir not found: {public_dir}")

    only = sanitize(only_snapshot) if only_snapshot else None
    out_dir.mkdir(parents=True, exist_ok=True)
    written = 0
    skipped = 0

    for entry in sorted(public_dir.iterdir()):
        if not entry.is_dir() or not entry.name.startswith("asked_at_"):
            continue
        dest_top = sanitize(entry.name)
        if only is not None and dest_top != only:
            skipped += 1
            continue
        for src in entry.rglob("*"):
            if src.is_dir():
                continue
            rel = sanitize(str(src.relative_to(entry)))
            dest = out_dir / dest_top / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            if dest.exists() and dest.stat().st_size == src.stat().st_size:
                continue
            shutil.copy2(src, dest)
            written += 1

    sectors_dest = out_dir / "sectors.geojson"
    if not sectors_dest.exists():
        repo_sectors = REPO_ROOT / "sectors.geojson"
        if repo_sectors.exists():
            shutil.copy2(repo_sectors, sectors_dest)
            written += 1

    print(f"Materialized {written} file(s) from {public_dir} into {out_dir} "
          f"(skipped {skipped} other-snapshot dirs).")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--zip", default=str(REPO_ROOT / "hackathon_data_bundle.zip"))
    ap.add_argument("--out", default=str(REPO_ROOT / "data"))
    ap.add_argument("--snapshot", default=None,
                    help="Only extract this snapshot id (colons ok). Omit for all.")
    ap.add_argument("--from-public", action="store_true",
                    help="Copy snapshots from public/ instead of a zip (local dev).")
    ap.add_argument("--public", default=str(REPO_ROOT / "public"),
                    help="Source tree when using --from-public.")
    args = ap.parse_args()
    out = Path(args.out)
    if args.from_public:
        materialize_from_public(Path(args.public), out, args.snapshot)
    else:
        materialize(Path(args.zip), out, args.snapshot)


if __name__ == "__main__":
    main()
