import type { Alert } from '~/types/alert'

// In-memory per-session state for the assistant. Read-only in P5; the action
// tools in P6 mutate appliedActions + a live occupancy engine; PA2+ add alerts.
export interface AppliedAction {
  id: string
  type: string
  fid: string
  minutes: number
}

export interface OpsSession {
  id: string
  snapshot: string
  messages: any[] // Anthropic MessageParam[]
  appliedActions: AppliedAction[]
  alerts: Alert[]
  alertSeq: number
  createdAt: number
}

const sessions = new Map<string, OpsSession>()

export function createSession(snapshot: string): OpsSession {
  const id = globalThis.crypto?.randomUUID?.() ?? `s_${sessions.size + 1}_${snapshot}`
  const s: OpsSession = {
    id, snapshot, messages: [], appliedActions: [], alerts: [], alertSeq: 0, createdAt: Date.now(),
  }
  sessions.set(id, s)
  return s
}

export function getSession(id: string): OpsSession | undefined {
  return sessions.get(id)
}
