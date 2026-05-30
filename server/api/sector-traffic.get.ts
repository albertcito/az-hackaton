export default defineEventHandler(async (event) => {
  const { id = '', time = '' } = getQuery(event)

  if (!id) throw createError({ statusCode: 400, statusMessage: 'Flight id required' })
  if (!time) throw createError({ statusCode: 400, statusMessage: 'Time required' })

  return getSectorTraffic(String(id), String(time))
})
