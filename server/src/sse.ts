const encoder = new TextEncoder()

export function sseEvent(seq: number, data: unknown): Uint8Array {
  return encoder.encode(`id: ${seq}\ndata: ${JSON.stringify(data)}\n\n`)
}

export function sseComment(text: string): Uint8Array {
  return encoder.encode(`: ${text}\n\n`)
}

export function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

export class SSEStream {
  private controller: ReadableStreamDefaultController<Uint8Array> | null = null
  private pending: Uint8Array[] = []
  private closed = false

  constructor(private readonly onClose?: () => void) {}

  build(): ReadableStream<Uint8Array> {
    return new ReadableStream<Uint8Array>({
      start: (controller) => {
        this.controller = controller
        this.sendComment("connected")
        for (const chunk of this.pending) this.enqueue(chunk)
        this.pending = []
      },
      cancel: () => this.finish(),
    })
  }

  private enqueue(chunk: Uint8Array): void {
    if (this.closed) return
    if (!this.controller) {
      this.pending.push(chunk)
      return
    }
    try {
      this.controller.enqueue(chunk)
    } catch {
      this.finish()
    }
  }

  send(seq: number, data: unknown): void {
    this.enqueue(sseEvent(seq, data))
  }

  sendComment(text: string): void {
    this.enqueue(sseComment(text))
  }

  private finish(): void {
    if (this.closed) return
    this.closed = true
    this.onClose?.()
    try {
      this.controller?.close()
    } catch {}
  }

  close(): void {
    this.finish()
  }
}