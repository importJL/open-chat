import type { UpstreamEvent } from "./broker"

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

type Props = Record<string, any>

const userMessageIDs = new Map<string, Set<string>>()

function isUserMessage(sessionID: string, messageID: string): boolean {
  return userMessageIDs.get(sessionID)?.has(messageID) ?? false
}

function markUserMessage(sessionID: string, messageID: string): void {
  let set = userMessageIDs.get(sessionID)
  if (!set) {
    set = new Set()
    userMessageIDs.set(sessionID, set)
  }
  set.add(messageID)
}

function sid(p: Props): string | undefined {
  return (p?.sessionID ?? p?.part?.sessionID ?? p?.info?.sessionID) as string | undefined
}

function messageText(error: unknown): string {
  if (!error) return "Unknown error"
  const e = error as { name?: string; message?: string; data?: { message?: string } }
  return e.data?.message ?? e.message ?? e.name ?? "Unknown error"
}

export function toWire(event: UpstreamEvent): WireEvent | null {
  const p = event.properties as Props
  const sessionID = sid(p)
  if (!sessionID) {
    if (event.type === "session.error") return { type: "error", sessionID: "", message: messageText(p.error) }
    return null
  }

  switch (event.type) {
    case "message.part.updated": {
      const part = p.part as { type?: string; messageID?: string; id?: string; text?: string }
      if (part?.type !== "text" && part?.type !== "reasoning") return null
      if (isUserMessage(sessionID, part.messageID!)) return null
      return {
        type: "delta",
        sessionID,
        messageID: part.messageID!,
        partID: part.id!,
        partType: part.type,
        delta: p.delta as string | undefined,
        text: part.text,
      }
    }
    case "message.part.removed": {
      if (isUserMessage(sessionID, p.messageID as string)) return null
      return {
        type: "part_removed",
        sessionID,
        messageID: p.messageID as string,
        partID: p.partID as string,
      }
    }
    case "message.updated": {
      const info = p.info as { role?: string; id?: string; modelID?: string; providerID?: string }
      if (!info?.role || !info?.id) return null
      if (info.role === "user") {
        markUserMessage(sessionID, info.id)
        return null
      }
      return {
        type: "message_start",
        sessionID,
        messageID: info.id!,
        model: info.modelID ? `${info.providerID}/${info.modelID}` : undefined,
      }
    }
    case "message.removed": {
      userMessageIDs.get(sessionID)?.delete(p.messageID as string)
      return {
        type: "message_removed",
        sessionID,
        messageID: p.messageID as string,
      }
    }
    case "session.idle":
      return { type: "done", sessionID }
    case "session.status": {
      const type = (p.status as { type?: string })?.type
      if (type === "busy" || type === "retry") return { type: "status", sessionID, state: "busy" }
      return { type: "status", sessionID, state: "idle" }
    }
    case "session.error": {
      const name = (p.error as { name?: string } | undefined)?.name
      if (name === "MessageAbortedError") return { type: "status", sessionID, state: "idle" }
      return { type: "error", sessionID, message: messageText(p.error) }
    }
    default:
      return null
  }
}