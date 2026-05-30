export interface ChatTool {
  name: string
  input: any
}

export interface ChatChip {
  label: string
  prompt: string
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  text: string
  tools: ChatTool[]
  chips?: ChatChip[]
  error?: boolean
}

// Drives the assistant chat: one session per snapshot, streamed responses over
// SSE from /api/chat. State is shared (useState) so the thread survives panel
// collapse/expand.
export function useAssistant() {
  const store = useOpsStore()
  const sessionId = store.sessionId // shared session (alerts + assistant)
  const messages = useState<ChatMessage[]>('assistant:messages', () => [])
  const sending = useState<boolean>('assistant:sending', () => false)
  const available = useState<boolean>('assistant:available', () => true)

  async function ensureSession() {
    await store.ensureSession()
  }

  async function send(text: string) {
    const msg = text.trim()
    if (!msg || sending.value) return
    sending.value = true
    try {
      await ensureSession()
      messages.value.push({ role: 'user', text: msg, tools: [] })
      const asst = reactive<ChatMessage>({ role: 'assistant', text: '', tools: [] })
      messages.value.push(asst)

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId.value, message: msg }),
      })
      if (!res.ok || !res.body) {
        asst.text = 'The assistant is unavailable (no API key configured?).'
        asst.error = true
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.split('\n').find(l => l.startsWith('data:'))
          if (!line) continue
          const payload = line.slice(5).trim()
          if (!payload) continue
          let ev: any
          try { ev = JSON.parse(payload) } catch { continue }
          if (ev.type === 'text') asst.text += ev.text
          else if (ev.type === 'tool') asst.tools.push({ name: ev.name, input: ev.input })
          else if (ev.type === 'state') store.applyStateDelta?.(ev.state)
          else if (ev.type === 'alerts') store.applyAlertsDelta?.(ev.alerts)
          else if (ev.type === 'error') { asst.text += `\n_(error: ${ev.error})_`; asst.error = true }
        }
      }
    } catch {
      const last = messages.value[messages.value.length - 1]
      if (last && last.role === 'assistant') { last.text += '\n_(connection error)_'; last.error = true }
    } finally {
      sending.value = false
    }
  }

  function reset() {
    messages.value = []
  }

  // Proactive surfacing: drop a system note + action chips when a new alert arrives.
  const announced = useState<string[]>('assistant:announced', () => [])
  function announceAlert(alert: any) {
    if (!alert || announced.value.includes(alert.id)) return
    announced.value = [...announced.value, alert.id]
    const region = alert.region?.ref ?? 'the area'
    const chips: ChatChip[] = [{ label: 'Draft advisory', prompt: `Draft an advisory for alert ${alert.id}.` }]
    chips.push({ label: 'Divert them', prompt: `Divert the flights in alert ${alert.id} to clear it.` })
    messages.value.push({ role: 'system', text: alert.message, tools: [], chips })
  }

  async function resetServer() {
    if (!sessionId.value) return
    try {
      await $fetch(`/api/session/${sessionId.value}/reset`, { method: 'POST' })
    } catch { /* ignore */ }
  }

  return { sessionId, messages, sending, available, send, reset, ensureSession, resetServer, announceAlert }
}
