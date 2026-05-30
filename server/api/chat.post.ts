import Anthropic from '@anthropic-ai/sdk'
import { READ_TOOLS, executeReadTool } from '../utils/opsTools'

const MAX_TOOL_ITERATIONS = 6

function buildSystemPrompt(snapshot: string, derived: any): string {
  const d = derived.demand
  let peakBin = 0
  let peakOver = -1
  for (const s of d.stress) if (s.total_over > peakOver) { peakOver = s.total_over; peakBin = s.bin_index }
  const peakIso = d.bins[peakBin]
  const peakTime = (() => {
    const dt = new Date(peakIso)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}Z`
  })()
  const nOver = d.sectors.filter((s: any) => s.over_demand).length

  return [
    `You are an air traffic flow management assistant for one snapshot of US airspace.`,
    `Snapshot asked_at ${d.asked_at}; ${d.sectors.length} sectors; ${d.bins.length} fifteen-minute bins from ${d.bins[0]} to ${d.bins[d.bins.length - 1]}.`,
    `Sector capacity is 20 unless a tool says otherwise. Bands: LOW < 35000 ft, HIGH >= 35000 ft.`,
    `At the most-stressed moment (${peakTime}), ${d.stress[peakBin].n_over_sectors} sectors are over capacity; across the window ${nOver} sectors peak over capacity.`,
    `Answer questions about sectors, flights, weather and demand USING THE TOOLS. Never invent sector names, flight ids, counts, or percentages — if you need a value, call a tool first.`,
    `Weather attribution is an explicit heuristic (a flight is "weather-displaced" if blocking weather — refc >= 40 dBZ above the flight's altitude — is within 100 nm); say "heuristic" when you cite it.`,
    `Be specific and terse. Round numbers. Refer to sectors like LOW_096 and times like 19:45Z. When asked "why" a sector is over capacity, give load vs capacity, the weather-displaced share, and a few top flights.`,
  ].join('\n')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody<{ session_id?: string, message?: string }>(event)
  const session = getSession(String(body?.session_id ?? ''))
  if (!session) throw createError({ statusCode: 404, statusMessage: 'session not found' })
  const userMsg = String(body?.message ?? '').trim().slice(0, 2000)
  if (!userMsg) throw createError({ statusCode: 400, statusMessage: 'empty message' })
  if (!config.anthropicApiKey) throw createError({ statusCode: 500, statusMessage: 'ANTHROPIC_API_KEY not configured' })

  // authToken: null prevents the SDK from also sending a Bearer header from a
  // stray ANTHROPIC_AUTH_TOKEN in the environment (we authenticate via x-api-key).
  const client = new Anthropic({ apiKey: config.anthropicApiKey, authToken: null })
  const derived = await getDerived(session.snapshot)
  const system = buildSystemPrompt(session.snapshot, derived)

  session.messages.push({ role: 'user', content: userMsg })

  const eventStream = createEventStream(event)
  const send = (obj: any) => eventStream.push(JSON.stringify(obj))

  ;(async () => {
    try {
      for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
        const stream = client.messages.stream({
          model: config.assistantModel,
          max_tokens: 1024,
          system,
          tools: READ_TOOLS as any,
          messages: session.messages,
        })
        stream.on('text', (t: string) => send({ type: 'text', text: t }))
        const final = await stream.finalMessage()
        session.messages.push({ role: 'assistant', content: final.content })

        const toolUses = final.content.filter((c: any) => c.type === 'tool_use')
        if (toolUses.length === 0) break

        const results: any[] = []
        for (const tu of toolUses as any[]) {
          send({ type: 'tool', name: tu.name, input: tu.input })
          let result: any
          try {
            result = await executeReadTool(session.snapshot, tu.name, tu.input)
          } catch (e: any) {
            result = { error: e?.message ?? String(e) }
          }
          results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
        }
        session.messages.push({ role: 'user', content: results })
      }
      send({ type: 'done' })
    } catch (e: any) {
      send({ type: 'error', error: e?.message ?? String(e) })
    } finally {
      await eventStream.close()
    }
  })()

  return eventStream.send()
})
