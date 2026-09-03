import type { OpencodeClient } from "@opencode-ai/sdk"
import { CHAT_AGENT, DENIED_TOOLS } from "./agent"
import { subscribe, replay, clearSession } from "./broker"
import { SSEStream, sseResponse } from "./sse"
import { toWire } from "./wire"

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status })
}

function fail(message: string, status: number): Response {
  return json({ error: message }, status)
}

function responseError(res: { response?: { status?: number }; error?: unknown }): Response {
  const status = res.response?.status ?? 500
  const err = res.error as { name?: string; message?: string; data?: { message?: string } } | undefined
  const message = err?.data?.message ?? err?.message ?? err?.name ?? "Unknown error"
  return fail(message, status)
}

function parseModel(value: unknown): { providerID: string; modelID: string } | undefined {
  if (typeof value !== "string") return undefined
  const i = value.indexOf("/")
  if (i === -1) return undefined
  const providerID = value.slice(0, i)
  const modelID = value.slice(i + 1)
  if (!providerID || !modelID) return undefined
  return { providerID, modelID }
}

type RouteRequest = Request & { params: Record<string, string> }

type Result = {
  response?: { status?: number }
  data?: unknown
  error?: unknown
}

function data(res: Result): any {
  return res.data
}

async function bodyOf(req: Request): Promise<{ value: unknown; error?: string }> {
  try {
    return { value: await req.json() }
  } catch {
    return { value: null, error: "Invalid JSON body" }
  }
}

export function registerRoutes(client: OpencodeClient, baseUrl: string, cliVersion: string) {
  return {
    "/api/health": {
      GET: async (): Promise<Response> => {
        let version = cliVersion
        try {
          const res = await fetch(`${baseUrl}/global/health`, { signal: AbortSignal.timeout(2000) })
          if (res.ok) {
            const body = (await res.json()) as { version?: string }
            if (body.version) version = body.version
          }
        } catch {
          // older servers don't expose /global/health
        }
        return json({ healthy: true, version })
      },
    },

    "/api/models": {
      GET: async (): Promise<Response> => {
        try {
          const [prov, cfg] = await Promise.all([
            client.provider.list(),
            client.config.providers(),
          ])
          const connected: string[] = data(prov)?.connected ?? []
          const providers: Array<{ id: string; name: string; models: Record<string, { id: string; name: string }> }> =
            data(cfg)?.providers ?? []
          const defaults: Record<string, string> = data(cfg)?.default ?? {}
          const connectedSet = new Set(connected)
          const byID = new Map(providers.map((p) => [p.id, p]))
          const models: Array<{
            id: string
            provider: string
            providerName: string
            model: string
            name: string
          }> = []
          for (const id of connected) {
            const p = byID.get(id)
            if (!p) continue
            for (const m of Object.values(p.models ?? {})) {
              models.push({
                id: `${p.id}/${m.id}`,
                provider: p.id,
                providerName: p.name,
                model: m.id,
                name: m.name,
              })
            }
          }
          // Prefer opencode-go (the provider this install actually
          // authenticates) so the picker resolves to a working model; fall
          // back to the first connected provider's default.
          const preferred = connectedSet.has("opencode-go")
            ? "opencode-go"
            : (Object.keys(defaults) as string[]).find((p) => connectedSet.has(p))
          models.sort((a, b) => {
            if (a.provider === preferred) return b.provider === preferred ? a.id.localeCompare(b.id) : -1
            if (b.provider === preferred) return 1
            return a.id.localeCompare(b.id)
          })
          const chosenDefault = preferred && defaults[preferred] ? `${preferred}/${defaults[preferred]}` : null
          const def = chosenDefault ?? (models[0] ? models[0].id : null)
          return json({ models, default: def })
        } catch (err) {
          return json({ models: [], default: null, error: String((err as Error).message) })
        }
      },
    },

    "/api/sessions": {
      POST: async (req: RouteRequest): Promise<Response> => {
        const { value } = await bodyOf(req)
        const title = (value as { title?: string })?.title
        const res = await client.session.create({ body: { title: title || "New chat" } })
        if (res.error) return responseError(res)
        return json({ id: (res.data as { id: string }).id }, 201)
      },
      GET: async (): Promise<Response> => {
        const res = await client.session.list()
        if (res.error) return responseError(res)
        const sessions = (res.data ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          time: { created: s.time.created, updated: s.time.updated },
        }))
        return json(sessions)
      },
    },

    "/api/sessions/:id": {
      DELETE: async (req: RouteRequest): Promise<Response> => {
        const id = req.params.id
        const res = await client.session.delete({ path: { id } })
        if (res.error) return responseError(res)
        clearSession(id)
        return json({ ok: true })
      },
    },

    "/api/sessions/:id/messages": {
      GET: async (req: RouteRequest): Promise<Response> => {
        const id = req.params.id
        const res = await client.session.messages({ path: { id } })
        if (res.error) return responseError(res)
        const messages = (res.data ?? []).map((m) => ({
          id: m.info.id,
          role: m.info.role,
          time: m.info.time,
          model:
            m.info.role === "assistant"
              ? `${(m.info as { providerID: string }).providerID}/${(m.info as { modelID: string }).modelID}`
              : undefined,
          parts: m.parts
            .filter((part) => part.type === "text" || part.type === "reasoning")
            .map((part) => ({ id: part.id, type: part.type, text: part.text })),
        }))
        return json(messages)
      },
      POST: async (req: RouteRequest): Promise<Response> => {
        const id = req.params.id
        const { value, error } = await bodyOf(req)
        if (error) return fail(error, 400)
        const text = (value as { text?: string })?.text
        if (typeof text !== "string" || !text.trim()) return fail("body.text is required", 400)
        const model = parseModel((value as { model?: string })?.model)
        const res = await client.session.promptAsync({
          path: { id },
          body: {
            agent: CHAT_AGENT,
            ...(model ? { model } : {}),
            tools: DENIED_TOOLS,
            parts: [{ type: "text", text }],
          },
        })
        if (res.error) return responseError(res)
        return json({ ok: true, sessionID: id }, 202)
      },
    },

    "/api/sessions/:id/abort": {
      POST: async (req: RouteRequest): Promise<Response> => {
        const id = req.params.id
        await client.session.abort({ path: { id } })
        return json({ ok: true })
      },
    },

    "/api/events": {
      GET: (req: RouteRequest): Response => {
        const url = new URL(req.url)
        const sessionID = url.searchParams.get("sessionId")
        if (!sessionID) return fail("Missing sessionId query param", 400)

        const rawLast = Number(req.headers.get("Last-Event-ID") ?? "0")
        const lastSeq = Number.isFinite(rawLast) && rawLast > 0 ? rawLast : 0

        let heartbeat: ReturnType<typeof setInterval> | null = null
        const { unsubscribe, subscribeSeq } = subscribe(sessionID, (event, seq) => {
          if (seq <= subscribeSeq) return
          const wire = toWire(event)
          if (wire) stream.send(seq, wire)
        })
        const stream = new SSEStream(() => {
          if (heartbeat) clearInterval(heartbeat)
          unsubscribe()
        })

        // Fresh connections hydrate history via GET /messages instead of
        // replaying (avoids double-applying deltas). Reconnects carry
        // `Last-Event-ID` and replay from there.
        if (lastSeq > 0) {
          for (const buffered of replay(sessionID, lastSeq)) {
            if (buffered.seq > subscribeSeq) continue
            const wire = toWire(buffered.event)
            if (wire) stream.send(buffered.seq, wire)
          }
        }

        heartbeat = setInterval(() => stream.sendComment("ping"), 5000)
        req.signal?.addEventListener("abort", () => stream.close(), { once: true })

        return sseResponse(stream.build())
      },
    },
  }
}