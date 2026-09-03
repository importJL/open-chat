export type UpstreamEvent = {
  id?: string
  type: string
  properties: Record<string, unknown>
}

type Buffered = { seq: number; event: UpstreamEvent }

const BUFFER_CAP = 500

let counter = 0
const listeners = new Map<string, Set<(event: UpstreamEvent, seq: number) => void>>()
const buffers = new Map<string, Buffered[]>()

function sessionIDOf(event: UpstreamEvent): string | undefined {
  const p = event.properties
  const part = p?.part as { sessionID?: string } | undefined
  const info = p?.info as { sessionID?: string } | undefined
  return (p?.sessionID as string | undefined) ?? part?.sessionID ?? info?.sessionID
}

export function publish(event: UpstreamEvent): void {
  const sid = sessionIDOf(event)
  if (!sid) {
    if (event.type === "session.error") {
      const seq = ++counter
      for (const set of listeners.values()) {
        for (const fn of set) fn(event, seq)
      }
    }
    return
  }
  let buf = buffers.get(sid)
  if (!buf) {
    buf = []
    buffers.set(sid, buf)
  }
  const seq = ++counter
  buf.push({ seq, event })
  if (buf.length > BUFFER_CAP) buf.splice(0, buf.length - BUFFER_CAP)
  const set = listeners.get(sid)
  if (set) {
    for (const fn of set) fn(event, seq)
  }
}

export function subscribe(
  sid: string,
  fn: (event: UpstreamEvent, seq: number) => void,
): { unsubscribe: () => void; subscribeSeq: number } {
  let set = listeners.get(sid)
  if (!set) {
    set = new Set()
    listeners.set(sid, set)
  }
  set.add(fn)
  return {
    subscribeSeq: counter,
    unsubscribe: () => {
      set!.delete(fn)
      if (set!.size === 0) listeners.delete(sid)
    },
  }
}

export function replay(sid: string, afterSeq: number): Buffered[] {
  const buf = buffers.get(sid)
  if (!buf) return []
  return buf.filter((b) => b.seq > afterSeq)
}

export function clearSession(sid: string): void {
  buffers.delete(sid)
  listeners.delete(sid)
}