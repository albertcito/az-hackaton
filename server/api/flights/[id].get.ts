export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Flight id required' })
  }

  const flight = await getFlight(decodeURIComponent(id))
  if (!flight) {
    throw createError({ statusCode: 404, statusMessage: 'Flight not found' })
  }

  return flight
})
