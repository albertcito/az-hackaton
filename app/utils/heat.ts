// Congestion heat scale: maps occupancy ratio (count / capacity) to a color.
// Stops mirror the --heat-* CSS custom properties in app/assets/css/main.css.
// Used for both CesiumJS polygon colors and HTML/SVG fills so the globe and
// panels read identically.

export interface RGB { r: number, g: number, b: number }

const STOPS: Array<[number, RGB]> = [
  [0.0, { r: 34, g: 197, b: 94 }],   // green-500  — plenty of room
  [0.6, { r: 132, g: 204, b: 22 }],  // lime-500
  [0.8, { r: 234, g: 179, b: 8 }],   // yellow-500
  [1.0, { r: 245, g: 158, b: 11 }],  // amber-500  — at capacity
  [1.25, { r: 239, g: 68, b: 68 }],  // red-500    — over capacity
  [1.75, { r: 185, g: 28, b: 28 }],  // red-700    — severely over
]

/** Interpolated RGB for an occupancy ratio (>= 0). */
export function heatRgb(ratio: number): RGB {
  if (!Number.isFinite(ratio) || ratio <= STOPS[0]![0]) return STOPS[0]![1]
  const last = STOPS[STOPS.length - 1]!
  if (ratio >= last[0]) return last[1]
  for (let i = 1; i < STOPS.length; i++) {
    const [hi, hiC] = STOPS[i]!
    if (ratio <= hi) {
      const [lo, loC] = STOPS[i - 1]!
      const t = (ratio - lo) / (hi - lo)
      return {
        r: Math.round(loC.r + (hiC.r - loC.r) * t),
        g: Math.round(loC.g + (hiC.g - loC.g) * t),
        b: Math.round(loC.b + (hiC.b - loC.b) * t),
      }
    }
  }
  return last[1]
}

/** CSS rgba() string for an occupancy ratio. */
export function heatCss(ratio: number, alpha = 1): string {
  const { r, g, b } = heatRgb(ratio)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** Whether a ratio represents over-capacity (used to trigger emphasis). */
export function isOver(ratio: number): boolean {
  return ratio > 1.0
}
