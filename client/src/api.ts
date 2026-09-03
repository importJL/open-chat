export type WireEvent =
  | { type: "message_start"; sessionID: string; messageID: string; model?: string }
  | {
      type: "delta"
      sessionID: string
      messageID: string
      partID: string
      partType: "text" | "reasoning"
      delta?: string
      text?: string
    }
  | { type: "part_removed"; sessionID: string; messageID: string; partID: string }
  | { type: "message_removed"; sessionID: string; messageID: string }
  | { type: "done"; sessionID: string }
  | { type: "status"; sessionID: string; state: "busy" | "idle" }
  | { type: "error"; sessionID: string; message: string }

export type ModelInfo = {
  id: string
  provider: string
  providerName: string
  model: string
  name: string
}

export type HistoryMessage = {
  id: string
  role: "user" | "assistant"
  time: { created: number }
  model?: string
  parts: Array<{ id: string; type: "text" | "reasoning"; text: string }>
}

export type SessionInfo = {
  id: string
  title: string
  time: { created: number; updated: number }
}

export async function listSessions(): Promise<SessionInfo[]> {
  const res = await fetch("/api/sessions")
  if (!res.ok) throw await parseError(res, `sessions request failed: ${res.status}`)
  return res.json()
}

export async function deleteSession(sessionID: string): Promise<void> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionID)}`, {
    method: "DELETE",
  })
  if (!res.ok) throw await parseError(res, `delete session failed: ${res.status}`)
}

export async function getMessages(sessionID: string): Promise<HistoryMessage[]> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionID)}/messages`)
  if (!res.ok) throw await parseError(res, `history request failed: ${res.status}`)
  return res.json()
}

async function parseError(res: Response, fallback: string): Promise<Error> {
  try {
    const body = await res.json()
    if (body?.error) return new Error(body.error)
  } catch {
    // ignore
  }
  return new Error(fallback)
}

export async function getModels(): Promise<{ models: ModelInfo[]; default: string | null }> {
  const res = await fetch("/api/models")
  if (!res.ok) throw await parseError(res, `models request failed: ${res.status}`)
  return res.json()
}

export async function createSession(): Promise<string> {
  const res = await fetch("/api/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  })
  if (!res.ok) throw await parseError(res, `create session failed: ${res.status}`)
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function sendMessage(sessionID: string, text: string, model?: string): Promise<void> {
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionID)}/messages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text, model: model ?? undefined }),
  })
  if (!res.ok) throw await parseError(res, `send failed: ${res.status}`)
}

export async function abortSession(sessionID: string): Promise<void> {
  await fetch(`/api/sessions/${encodeURIComponent(sessionID)}/abort`, { method: "POST" })
}