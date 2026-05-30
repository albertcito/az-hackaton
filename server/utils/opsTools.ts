import { binFromIso, getDerived, hotspotsAt, sectorByName } from './opsData'
import { getFlight, getFlightsBasics } from './routesCache'
import { getEngine } from './opsEngine'
import type { OpsSession } from './opsSession'

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

// ---- Action tools (mutate the live session via the incremental engine) ------

export const ACTION_TOOLS = [
  {
    name: 'suggest_resolution',
    description: 'Preview (WITHOUT applying) the ground-delay actions that would relieve a sector, or the whole network if sector is omitted. Returns counts of actions and total delay minutes.',
    input_schema: {
      type: 'object',
      properties: { sector: { type: 'string', description: 'Sector to relieve. Optional (whole network).' } },
    },
  },
  {
    name: 'apply_resolution',
    description: 'Apply the greedy ground-delay resolution for a sector, or the whole network if sector is omitted. Mutates the live state; the map re-renders. Reports before/after.',
    input_schema: {
      type: 'object',
      properties: { sector: { type: 'string', description: 'Sector to clear. Optional (whole network).' } },
    },
  },
  {
    name: 'apply_ground_delay',
    description: 'Ground-delay specific flights (fids) or all delayable flights in a sector at a time, by a number of minutes (<=60). Only flights not yet airborne at asked_at can be delayed.',
    input_schema: {
      type: 'object',
      properties: {
        fids: { type: 'array', items: { type: 'string' }, description: 'Flight ids to delay. Optional.' },
        sector: { type: 'string', description: 'Delay delayable flights in this sector. Optional.' },
        bin_iso: { type: 'string', description: 'Time for the sector (defaults to its peak).' },
        minutes: { type: 'number', description: 'Minutes to delay (1-60). Default 15.' },
      },
    },
  },
  {
    name: 'reset',
    description: 'Discard all applied actions and return the network to its baseline state.',
    input_schema: { type: 'object', properties: {} },
  },
]

const READ_TOOL_NAMES = new Set(READ_TOOLS.map(t => t.name))
export const ALL_TOOLS = [...READ_TOOLS, ...ACTION_TOOLS]

async function executeActionTool(session: OpsSession, name: string, input: any): Promise<{ result: any, delta?: any }> {
  const engine = await getEngine(session)
  const derived = await getDerived(session.snapshot)
  const demand = derived.demand

  switch (name) {
    case 'reset': {
      engine.reset()
      return { result: { reset: true, n_over_sectors: engine.nOverSectors() }, delta: engine.delta() }
    }

    case 'suggest_resolution': {
      const sector = input?.sector
      let acts = engine.snap.mitigationActions
      if (sector) {
        if (!sectorByName(demand, sector)) return { result: { error: `unknown sector ${sector}` } }
        acts = acts.filter(a => a.relieves.some(r => r[0] === sector))
      }
      const total = acts.reduce((s, a) => s + a.minutes, 0)
      return {
        result: {
          scope: sector || 'network',
          n_actions: acts.length,
          total_delay_minutes: total,
          sample: acts.slice(0, 8).map(a => ({ flight: a.fid.split('|')[0], minutes: a.minutes })),
        },
      }
    }

    case 'apply_resolution': {
      const sector = input?.sector
      const before = engine.nOverSectors()
      if (sector) {
        const s = sectorByName(demand, sector)
        if (!s) return { result: { error: `unknown sector ${sector}` } }
        const n = await engine.applyResolutionSector(sector)
        const si = engine.snap.sectorIndex.get(sector)!
        const peakNow = Math.max(...engine.counts[si]!)
        return {
          result: {
            sector,
            actions_applied: n,
            sector_peak_now: peakNow,
            capacity: s.capacity,
            still_over: peakNow > s.capacity,
            total_delay_minutes: engine.totalDelay(),
            n_over_sectors_now: engine.nOverSectors(),
          },
          delta: engine.delta(),
        }
      }
      engine.applyResolutionAll()
      return {
        result: {
          scope: 'network',
          n_over_sectors_before: before,
          n_over_sectors_now: engine.nOverSectors(),
          total_delay_minutes: engine.totalDelay(),
          actions: engine.actions.length,
        },
        delta: engine.delta(),
      }
    }

    case 'apply_ground_delay': {
      const minutes = Math.max(1, Math.min(60, Math.round(Number(input?.minutes ?? 15))))
      let fids: string[] = []
      if (Array.isArray(input?.fids) && input.fids.length) {
        fids = input.fids.map(String)
      } else if (input?.sector) {
        const s = sectorByName(demand, input.sector)
        if (!s) return { result: { error: `unknown sector ${input.sector}` } }
        const { index } = binFromIso(demand, input?.bin_iso ?? demand.bins[s.peak_bin_index])
        const members = derived.members?.[input.sector]?.[String(index)] ?? []
        fids = members.filter((fid) => new Date(fid.split('|')[1] ?? '').getTime() > engine.snap.askedMs)
      } else {
        return { result: { error: 'provide fids, or a sector to delay its delayable flights' } }
      }
      if (!fids.length) return { result: { error: 'no delayable flights (already airborne at asked_at)' } }
      await engine.addGroundDelay(fids, minutes)
      return {
        result: {
          delayed_flights: fids.length,
          minutes_each: minutes,
          total_delay_minutes: engine.totalDelay(),
          n_over_sectors_now: engine.nOverSectors(),
        },
        delta: engine.delta(),
      }
    }

    default:
      return { result: { error: `unknown action ${name}` } }
  }
}

/** Unified dispatch: read tools return {result}; action tools also return {delta}. */
export async function executeTool(session: OpsSession, name: string, input: any): Promise<{ result: any, delta?: any }> {
  if (READ_TOOL_NAMES.has(name)) {
    return { result: await executeReadTool(session.snapshot, name, input) }
  }
  return executeActionTool(session, name, input)
}
