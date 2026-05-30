"""Authoritative constants. Mirrors app/utils/weatherGrid.ts and the wx docs."""

# Weather grid (equirectangular). Shape (rows, cols) = (256, 358).
WX_ROWS = 256
WX_COLS = 358
WX_LAT_MIN = 21.943
WX_LAT_MAX = 55.7765
WX_LON_MIN = -135.0
WX_LON_MAX = -67.5

# Nodata sentinels and the blocking threshold.
REFC_NODATA = -50.0   # refc <= -50 is nodata
RETOP_NODATA = 0.0    # retop < 0 is nodata
REFC_BLOCK_DBZ = 40.0  # a cell blocks iff refc >= 40 dBZ and cruise_alt < retop

# Altitude bands. LOW = [0, 35000) ft, HIGH = [35000, 60000) ft.
BAND_BREAK_FT = 35000
BAND_MAX_FT = 60000

# Demand binning.
BIN_MINUTES = 15

# Attribution + resolver tunables.
ATTRIBUTION_RADIUS_NM = 100.0
MAX_GROUND_DELAY_MIN = 60
DELAY_STEP_MIN = 5

# Geodesy (matches interpolatePosition.ts).
EARTH_RADIUS_NM = 3440.065
NM_PER_KT_PER_SEC = 1.0 / 3600.0
