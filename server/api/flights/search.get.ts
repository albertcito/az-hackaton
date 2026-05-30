export default defineEventHandler(async (event) => {
  const { q = '', origin = '', destination = '', options = '' } = getQuery(event)

  if (options === '1' || options === 'true') {
    return getFlightFilterOptions({
      origin: String(origin),
      destination: String(destination),
      q: String(q)
    })
  }

  return searchFlights(String(q), {
    origin: String(origin),
    destination: String(destination)
  })
})
