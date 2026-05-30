export default defineEventHandler(async (event) => {
  const { q = '' } = getQuery(event)
  return searchFlights(String(q))
})
