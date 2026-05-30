"""Sectors: load geojson, split by band, per-band STRtree, point assignment.

Coordinate-order trap: GeoJSON is [lon, lat]; flight routes are parallel
lats/lons. We always pass (lon, lat) into shapely points here.
"""

from __future__ import annotations

import json

import numpy as np
import shapely
from shapely import STRtree
from shapely import points as shp_points

from .constants import BAND_BREAK_FT


def band_for_alt(alt_ft: float) -> str:
    return "LOW" if alt_ft < BAND_BREAK_FT else "HIGH"


class Sectors:
    def __init__(self, geojson_path: str):
        with open(geojson_path, encoding="utf-8") as fh:
            data = json.load(fh)

        self.names: list[str] = []
        self.capacities: dict[str, int] = {}
        self.bands: dict[str, str] = {}
        self.alt_from: dict[str, int] = {}
        self.alt_to: dict[str, int] = {}

        polys = []
        band_of = []
        for ft in data["features"]:
            p = ft["properties"]
            name = p["name"]
            geom = shapely.geometry.shape(ft["geometry"])
            self.names.append(name)
            self.capacities[name] = int(p["capacity"])
            band = "HIGH" if name.startswith("HIGH") else "LOW"
            self.bands[name] = band
            self.alt_from[name] = int(p["altitude_from_ft"])
            self.alt_to[name] = int(p["altitude_to_ft"])
            polys.append(geom)
            band_of.append(band)

        self._polys = np.array(polys, dtype=object)
        self._names_arr = np.array(self.names, dtype=object)
        band_of = np.array(band_of, dtype=object)

        # One STRtree per band. _band_trees[band] = (tree, global_index_array)
        self._band_trees: dict[str, tuple[STRtree, np.ndarray]] = {}
        for band in ("LOW", "HIGH"):
            idx = np.where(band_of == band)[0]
            tree = STRtree(list(self._polys[idx]))
            self._band_trees[band] = (tree, idx)

    def capacity(self, name: str) -> int:
        return self.capacities.get(name, 0)

    def assign(self, lons, lats, alts) -> np.ndarray:
        """Assign each (lon, lat, alt) to a sector name ('' if none). Bulk, vectorized."""
        lons = np.asarray(lons, dtype=float)
        lats = np.asarray(lats, dtype=float)
        alts = np.asarray(alts, dtype=float)
        n = len(lons)
        out = np.full(n, "", dtype=object)
        if n == 0:
            return out
        pts = shp_points(lons, lats)
        band_arr = np.where(alts < BAND_BREAK_FT, "LOW", "HIGH")
        for band, (tree, idx) in self._band_trees.items():
            sel = np.where(band_arr == band)[0]
            if len(sel) == 0:
                continue
            res = tree.query(pts[sel], predicate="covered_by")
            if res.size == 0:
                continue
            in_idx = res[0]      # index into sel
            tree_idx = res[1]    # index into this band's polygons
            for ii, ti in zip(in_idx.tolist(), tree_idx.tolist()):
                pi = sel[ii]
                if out[pi] == "":
                    out[pi] = self._names_arr[idx[ti]]
        return out

    def assign_one(self, lon: float, lat: float, alt: float) -> str:
        """Assign a single point to a sector name ('' if none)."""
        band = "LOW" if alt < BAND_BREAK_FT else "HIGH"
        tree, idx = self._band_trees[band]
        res = tree.query(shapely.Point(lon, lat), predicate="covered_by")
        if len(res) == 0:
            return ""
        return self._names_arr[idx[int(res[0])]]
