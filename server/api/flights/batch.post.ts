// POST /api/flights/batch { fids: string[] } -> compact basics per flight.
// Used by the hotspot drill-down to render member-flight rows in one round trip.
export default defineEventHandler(async (event) => {
  const body = await readBody<{ fids?: unknown }>(event)
  const fids = Array.isArray(body?.fids)
    ? body.fids.slice(0, 300).map(String)
    : []
  return { flights: await getFlightsBasics(fids) }
})
