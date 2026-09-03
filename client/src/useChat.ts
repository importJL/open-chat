import { useCallback, useEffect, useReducer, useRef, useState } from "react"
import {
  createSession,
  sendMessage,
  abortSession,
  getMessages,
  type WireEvent,
  type HistoryMessage,
} from "./api"

export type AssistantMessage = {
  kind: "assistant"
  messageId: string
  model?: string
  parts: Array<{ partId: string; text: string }>
  reasonings: Array<{ partId: string; text: string }>
  done?: boolean
  error?: string
}

export type UserMessage = {
  kind: "user"
  localId: string
  text: string
}

export type ChatMessage = UserMessage | AssistantMessage

export type ChatState = {
  messages: ChatMessage[]
  streaming: boolean
  error?: string
}

type Action =
  | { kind: "session_reset" }
  | { kind: "hydrate"; history: HistoryMessage[] }
  | { kind: "user_send"; localId: string; text: string }
  | { kind: "wire"; wire: WireEvent }
  | { kind: "streaming"; value: boolean }
  | { kind: "error"; message: string }
  | { kind: "clear_error" }

const initialState: ChatState = { messages: [], streaming: false }

function applyWire(state: ChatState, wire: WireEvent): ChatState {
  const messages = [...state.messages]

  const findAssistant = (messageId: string): number => {
    const i = messages.findIndex((m) => m.kind === "assistant" && m.messageId === messageId)
    if (i === -1) {
      messages.push({ kind: "assistant", messageId, parts: [], reasonings: [] })
      return messages.length - 1
    }
    return i
  }

  switch (wire.type) {
    case "message_start": {
      const exists = messages.some((m) => m.kind === "assistant" && m.messageId === wire.messageID)
      if (exists) return state
      return {
        ...state,
        messages: [
          ...messages,
          {
            kind: "assistant",
            messageId: wire.messageID,
            model: wire.model,
            parts: [],
            reasonings: [],
          },
        ],
      }
    }
    case "delta": {
      const i = findAssistant(wire.messageID)
      const entry = { ...(messages[i] as AssistantMessage) }
      const isReasoning = wire.partType === "reasoning"
      const list = isReasoning ? [...entry.reasonings] : [...entry.parts]
      const p = list.findIndex((x) => x.partId === wire.partID)
      const part =
        p === -1
          ? { partId: wire.partID, text: wire.delta ?? "" }
          : {
              partId: wire.partID,
              text: wire.delta ? list[p].text + wire.delta : (wire.text ?? list[p].text),
            }
      if (p === -1) list.push(part)
      else list[p] = part
      if (isReasoning) entry.reasonings = list
      else entry.parts = list
      messages[i] = entry
      return { ...state, messages, streaming: true }
    }
    case "part_removed": {
      const i = findAssistant(wire.messageID)
      const entry = { ...(messages[i] as AssistantMessage) }
      entry.parts = entry.parts.filter((p) => p.partId !== wire.partID)
      messages[i] = entry
      return { ...state, messages }
    }
    case "message_removed": {
      const filtered = messages.filter((m) => !(m.kind === "assistant" && m.messageId === wire.messageID))
      return { ...state, messages: filtered }
    }
    case "done": {
      const updated = messages.map((m) =>
        m.kind === "assistant" && !m.done ? { ...m, done: true } : m,
      )
      return { ...state, messages: updated, streaming: false }
    }
    case "status":
      return { ...state, streaming: wire.state === "busy" }
    case "error": {
      const typed: ChatState = { ...state, streaming: false, error: wire.message }
      if (messages.length > 0) {
        const last = messages[messages.length - 1]
        if (last.kind === "assistant" && !last.done && last.parts.length === 0) {
          typed.messages = [...messages.slice(0, -1), { ...last, error: wire.message }]
        }
      }
      return typed
    }
    default:
      return state
  }
}

function reducer(state: ChatState, action: Action): ChatState {
  switch (action.kind) {
    case "session_reset":
      return { ...initialState }
    case "hydrate": {
      const messages: ChatMessage[] = action.history.map((h) =>
        h.role === "user"
          ? {
              kind: "user",
              localId: h.id,
              text: h.parts.map((p) => p.text).join(""),
            }
          : {
              kind: "assistant",
              messageId: h.id,
              model: h.model,
              parts: h.parts
                .filter((p) => p.type === "text")
                .map((p) => ({ partId: p.id, text: p.text })),
              reasonings: h.parts
                .filter((p) => p.type === "reasoning")
                .map((p) => ({ partId: p.id, text: p.text })),
              done: true,
            },
      )
      return { ...state, messages }
    }
    case "user_send": {
      if (state.messages.some((m) => m.kind === "user" && m.localId === action.localId)) return state
      return {
        ...state,
        messages: [...state.messages, { kind: "user", localId: action.localId, text: action.text }],
      }
    }
    case "wire":
      return applyWire(state, action.wire)
    case "streaming":
      return { ...state, streaming: action.value }
    case "error":
      return { ...state, error: action.message, streaming: false }
    case "clear_error":
      return { ...state, error: undefined }
    default:
      return state
  }
}

const STORAGE_KEY = "opencode-chat-session"
let pendingSession: Promise<string> | null = null

const STALL_TIMEOUT_MS = 90_000

export function useChat() {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [model, setModel] = useState<string | undefined>(undefined)
  const sessionIdRef = useRef<string | undefined>(undefined)
  sessionIdRef.current = sessionId
  const lastActivityRef = useRef<number>(Date.now())

  useEffect(() => {
    if (sessionId) return

    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored) {
      setSessionId(stored)
      return
    }

    let cancelled = false
    if (!pendingSession) {
      pendingSession = createSession().catch((err: unknown) => {
        dispatch({ kind: "error", message: (err as Error).message })
        pendingSession = null
        throw err
      })
    }
    pendingSession.then((id) => {
      if (cancelled) return
      sessionStorage.setItem(STORAGE_KEY, id)
      setSessionId(id)
    })

    return () => {
      cancelled = true
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) return
    let disposed = false
    let es: EventSource | null = null

    ;(async () => {
      try {
        const history = await getMessages(sessionId)
        if (!disposed) dispatch({ kind: "hydrate", history })
      } catch {
        // ignore; live events still work
      }
      if (disposed) return
      es = new EventSource(`/api/events?sessionId=${encodeURIComponent(sessionId)}`)
      es.onmessage = (e: MessageEvent<string>) => {
        try {
          lastActivityRef.current = Date.now()
          dispatch({ kind: "wire", wire: JSON.parse(e.data) as WireEvent })
        } catch {
          // ignore malformed events
        }
      }
    })()

    return () => {
      disposed = true
      es?.close()
    }
  }, [sessionId])

  useEffect(() => {
    const timer = setInterval(() => {
      if (!state.streaming) {
        lastActivityRef.current = Date.now()
        return
      }
      if (Date.now() - lastActivityRef.current > STALL_TIMEOUT_MS) {
        dispatch({
          kind: "error",
          message:
            "No response received from the model within 90s. The provider may be misconfigured — check the selected model and try again.",
        })
        dispatch({ kind: "streaming", value: false })
      }
    }, 5000)
    return () => clearInterval(timer)
  }, [state.streaming])

  const send = useCallback(
    async (text: string) => {
      const sid = sessionIdRef.current
      const value = text.trim()
      if (!sid || !value || state.streaming) return
      lastActivityRef.current = Date.now()
      dispatch({ kind: "user_send", localId: crypto.randomUUID(), text: value })
      dispatch({ kind: "streaming", value: true })
      try {
        await sendMessage(sid, value, model)
      } catch (err) {
        dispatch({ kind: "error", message: (err as Error).message })
        dispatch({ kind: "streaming", value: false })
      }
    },
    [state.streaming, model],
  )

  const stop = useCallback(async () => {
    const sid = sessionIdRef.current
    if (sid) await abortSession(sid).catch(() => undefined)
    dispatch({ kind: "streaming", value: false })
  }, [])

  const newChat = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    pendingSession = null
    setSessionId(undefined)
    dispatch({ kind: "session_reset" })
  }, [])

  const clearError = useCallback(() => dispatch({ kind: "clear_error" }), [])

  return {
    ...state,
    sessionId,
    model,
    setModel,
    send,
    stop,
    newChat,
    clearError,
  }
}