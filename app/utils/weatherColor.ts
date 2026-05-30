// Composite-reflectivity (dBZ) -> RGBA, NWS-style radar ramp. Cells below ~15 dBZ
// and nodata (<= -50) render transparent so only meaningful precip shows.

type RGB = [number, number, number]

const STOPS: Array<[number, RGB]> = [
  [15, [22, 120, 60]],    // light green
  [25, [54, 200, 80]],    // green
  [33, [220, 220, 60]],   // yellow
  [42, [240, 150, 40]],   // orange
  [50, [230, 60, 50]],    // red
  [58, [200, 30, 90]],    // crimson
  [66, [220, 60, 200]],   // magenta (severe)
]

export function refcToRgba(dbz: number): [number, number, number, number] {
  if (!Number.isFinite(dbz) || dbz <= -50 || dbz < STOPS[0]![0]) return [0, 0, 0, 0]
  const last = STOPS[STOPS.length - 1]!
  let rgb: RGB = last[1]
  if (dbz < last[0]) {
    for (let i = 1; i < STOPS.length; i++) {
      const [hi, hiC] = STOPS[i]!
      if (dbz <= hi) {
        const [lo, loC] = STOPS[i - 1]!
        const t = (dbz - lo) / (hi - lo)
        rgb = [
          Math.round(loC[0] + (hiC[0] - loC[0]) * t),
          Math.round(loC[1] + (hiC[1] - loC[1]) * t),
          Math.round(loC[2] + (hiC[2] - loC[2]) * t),
        ]
        break
      }
    }
  }
  // Heavier precip is more opaque; cap so the globe still reads through.
  const a = Math.min(0.78, 0.28 + ((dbz - 15) / 55) * 0.5)
  return [rgb[0], rgb[1], rgb[2], Math.round(a * 255)]
}
