export interface WeatherSample {
  refcDbz: number | null
  echoTopFt: number | null
  loading: boolean
  error: string | null
}

export type WeatherImpactColor = 'success' | 'warning' | 'error' | 'neutral'

export interface WeatherImpact {
  label: string
  color: WeatherImpactColor
}
