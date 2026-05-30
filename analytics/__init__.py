"""Airspace over-demand analytics (offline precompute).

Reads the materialized data bundle (data/<snapshot>/) and emits the derived
JSON contracts the Nuxt server serves to the frontend. numpy + shapely only.
"""
