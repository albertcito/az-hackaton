import { binFromIso, getDerived, hotspotsAt, sectorByName } from './opsData'
import { getFlight, getFlightsBasics } from './routesCache'

// Read-only tools for the assistant. Every number the model reports must come
// from one of these — the system prompt forbids inventing values.
export const READ_TOOLS = [
  {
    name: 'list_hotspots',
    description: 'List the over-demand sectors (count > capacity) at a given time, ranked by how far over capacity they are. Omit bin_iso to use the most-stressed moment.',
    input_schema: {
      type: 'object',
      properties: {
        bin_iso: { type: 'string', description: 'ISO time, e.g. 2025-08-21T19:45:00+00:00. Optional.' },
      },
    },
  },
  {
    name: 'get_demand',
    description: 'Get demand vs capacity for a sector (peak and at a specific time), or a network summary at a time if sector is omitted.',
    input_schema: {
      type: 'object',
      properties: {
        sector: { type: 'string', description: 'Sector name like LOW_096 or HIGH_345. Optional.' },
        bin_iso: { type: 'string', description: 'ISO time. Optional (defaults to peak stress).' },
      },
    },
  },
  {
    name: 'get_sector_members',
    description: 'List the flights occupying a sector at a given time (flight ids + origin/destination/altitude).',
    input_schema: {
      type: 'object',
      properties: {
        sector: { type: 'string' },
        bin_iso: { type: 'string', description: 'ISO time. Optional (defaults to the sector peak).' },
      },
      required: ['sector'],
    },
  },
  {
    name: 'get_attribution',
    description: 'Get the weather-displaced fraction (heuristic) for an over-demand sector at a time: what share of its flights have blocking weather nearby.',
    input_schema: {
      type: 'object',
      properties: {
        sector: { type: 'string' },
        bin_iso: { type: 'string', description: 'ISO time. Optional (defaults to the sector peak).' },
      },
      required: ['sector'],
    },
  },
  {
    name: 'get_flight',
    description: 'Get a flight by id: route endpoints, cruise altitude/speed, times, and which over-demand sector-bins it is part of.',
    input_schema: {
      type: 'object',
      properties: {
        fid: { type: 'string', description: 'Flight id like UAL1372|2025-08-21T19:30:00+00:00|KSFO' },
      },
      required: ['fid'],
    },
  },
]

function fmt(iso: string) {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}Z`
}

export async function executeReadTool(snapshot: string, name: string, input: any): Promise<any> {
  const derived = await getDerived(snapshot)
  if (!derived.demand) return { error: 'snapshot not precomputed' }
  const demand = derived.demand

  switch (name) {
    case 'list_hotspots': {
      const { index, iso } = binFromIso(demand, input?.bin_iso)
      return {
        bin_iso: iso,
        time: fmt(iso),
        n_over_sectors: hotspotsAt(derived, index).length,
        hotspots: hotspotsAt(derived, index).slice(0, 15),
      }
    }

    case 'get_demand': {
      const { index, iso } = binFromIso(demand, input?.bin_iso)
      if (input?.sector) {
        const s = sectorByName(demand, input.sector)
        if (!s) return { error: `unknown sector ${input.sector}` }
        return {
          sector: s.name,
          band: s.band,
          capacity: s.capacity,
          peak_count: s.peak_count,
          peak_bin_iso: demand.bins[s.peak_bin_index],
          peak_time: fmt(demand.bins[s.peak_bin_index]),
          over_by: s.over_by,
          over_demand: s.over_demand,
          count_at: s.counts[index] ?? 0,
          at_iso: iso,
          at_time: fmt(iso),
        }
      }
      const st = demand.stress[index]
      return {
        bin_iso: iso,
        time: fmt(iso),
        n_over_sectors: st?.n_over_sectors ?? 0,
        total_over: st?.total_over ?? 0,
        total_flights_airborne: st?.total_flights ?? 0,
      }
    }

    case 'get_sector_members': {
      const s = sectorByName(demand, input?.sector)
      if (!s) return { error: `unknown sector ${input?.sector}` }
      const { index, iso } = binFromIso(demand, input?.bin_iso ?? demand.bins[s.peak_bin_index])
      const fids = derived.members?.[s.name]?.[String(index)] ?? []
      const basics = await getFlightsBasics(fids.slice(0, 30))
      return {
        sector: s.name,
        bin_iso: iso,
        time: fmt(iso),
        count: s.counts[index] ?? 0,
        capacity: s.capacity,
        flights: basics.map(b => ({
          fid: b.id,
          flight_number: b.flight_number,
          origin: b.origin_airport_icao,
          destination: b.destination_airport_icao,
          altitude_ft: b.cruise_altitude_ft,
        })),
      }
    }

    case 'get_attribution': {
      const s = sectorByName(demand, input?.sector)
      if (!s) return { error: `unknown sector ${input?.sector}` }
      const { index, iso } = binFromIso(demand, input?.bin_iso ?? demand.bins[s.peak_bin_index])
      const a = derived.attribution?.[s.name]?.[String(index)]
      if (!a) return { sector: s.name, bin_iso: iso, note: 'not an over-demand sector-bin (no attribution computed)', weather_displaced: 0 }
      return {
        sector: s.name,
        bin_iso: iso,
        time: fmt(iso),
        weather_displaced: a.weather_displaced,
        weather_displaced_pct: Math.round(a.weather_displaced * 100),
        n_total: a.n_total,
        n_weather: a.n_weather,
      }
    }

    case 'get_flight': {
      const fid = String(input?.fid ?? '')
      const f = await getFlight(fid)
      if (!f) return { error: `unknown flight ${fid}` }
      // Over-demand sector-bins this flight is part of.
      const memberships: { sector: string, bin_iso: string }[] = []
      for (const [sector, binsMap] of Object.entries(derived.members ?? {})) {
        for (const [binStr, fids] of Object.entries(binsMap)) {
          if (fids.includes(fid)) memberships.push({ sector, bin_iso: demand.bins[Number(binStr)] })
          if (memberships.length >= 12) break
        }
        if (memberships.length >= 12) break
      }
      return {
        fid,
        flight_number: f.flight_number,
        origin: f.origin_airport_icao,
        destination: f.destination_airport_icao,
        cruise_altitude_ft: f.cruise_altitude_ft,
        cruise_speed_kt: f.cruise_speed_kt,
        take_off_time: f.take_off_time,
        scheduled_landing_time: f.scheduled_landing_time,
        band: f.cruise_altitude_ft < 35000 ? 'LOW' : 'HIGH',
        over_demand_memberships: memberships,
      }
    }

    default:
      return { error: `unknown tool ${name}` }
  }
}
