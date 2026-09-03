import { publish, type UpstreamEvent } from "./broker"

async function readSSE(body: ReadableStream<Uint8Array>, onEvent: (e: UpstreamEvent) => void): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let data: string | undefined

  const dispatch = () => {
    if (data !== undefined) {
      try {
        onEvent(JSON.parse(data) as UpstreamEvent)
      } catch (err) {
        console.error("failed to parse event:", err)
      }
    }
    data = undefined
  }

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    let idx: number
    while ((idx = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, idx).replace(/\r$/, "")
      buffer = buffer.slice(idx + 1)
      if (line === "") {
        dispatch()
        continue
      }
      if (line.startsWith("data:")) {
        const v = line.slice(5).trimStart()
        data = data === undefined ? v : `${data}\n${v}`
      }
    }
  }
  dispatch()
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function startUpstream(baseUrl: string, signal?: AbortSignal): Promise<void> {
  while (!signal?.aborted) {
    try {
      const res = await fetch(`${baseUrl}/event`, { signal })
      if (!res.ok || !res.body) throw new Error(`event stream responded ${res.status}`)
      await readSSE(res.body, publish)
      throw new Error("event stream ended")
    } catch (err) {
      if (signal?.aborted) break
      console.error("opencode event stream dropped, reconnecting:", (err as Error).message)
      await sleep(1000)
    }
  }
}