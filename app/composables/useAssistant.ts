export interface ChatTool {
  name: string
  input: any
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  text: string
  tools: ChatTool[]
  error?: boolean
}

// Drives the assistant chat: one session per snapshot, streamed responses over
// SSE from /api/chat. State is shared (useState) so the thread survives panel
// collapse/expand.
export function useAssistant() {
  const store = useOpsStore()
  const sessionId = useState<string | null>('assistant:sid', () => null)
  const messages = useState<ChatMessage[]>('assistant:messages', () => [])
  const sending = useState<boolean>('assistant:sending', () => false)
  const available = useState<boolean>('assistant:available', () => true)

  async function ensureSession() {
    if (sessionId.value) return
    const res = await $fetch<{ session_id: string, has_assistant: boolean }>('/api/session', {
      method: 'POST',
      body: { snapshot: store.snapshotId.value },
    })
    sessionId.value = res.session_id
    available.value = res.has_assistant
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

  async function resetServer() {
    if (!sessionId.value) return
    try {
      await $fetch(`/api/session/${sessionId.value}/reset`, { method: 'POST' })
    } catch { /* ignore */ }
  }

  return { sessionId, messages, sending, available, send, reset, ensureSession, resetServer }
}
