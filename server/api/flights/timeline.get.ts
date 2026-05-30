export default defineEventHandler(async (event) => {
  const { airport = '', options = '' } = getQuery(event)

  if (options === '1' || options === 'true') {
    return { airports: await getTimelineAirports() }
  }

  const timeline = await getAirportTimeline(String(airport))
  if (!timeline) {
    throw createError({ statusCode: 400, statusMessage: 'Airport is required' })
  }

  return timeline
})
