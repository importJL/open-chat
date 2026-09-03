import { useCallback, useEffect, useState } from "react"
import { listSessions, deleteSession, type SessionInfo } from "../api"

const HISTORY_KEY = "opencode-chat-sessions"

function loadCache(): SessionInfo[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SessionInfo[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function useSessionHistory() {
  const [sessions, setSessions] = useState<SessionInfo[]>(loadCache)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | undefined>(undefined)

  const persist = useCallback((next: SessionInfo[]) => {
    setSessions(next)
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    } catch {
      // ignore quota errors
    }
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const list = await listSessions()
      list.sort((a, b) => b.time.updated - a.time.updated)
      persist(list)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [persist])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const remove = useCallback(
    async (id: string) => {
      try {
        await deleteSession(id)
      } catch (err) {
        setError((err as Error).message)
      }
      persist(sessions.filter((s) => s.id !== id))
    },
    [sessions, persist],
  )

  return { sessions, loading, error, refresh, remove }
}