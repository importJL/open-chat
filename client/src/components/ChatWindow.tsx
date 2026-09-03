import { useEffect, useRef } from "react"
import { Box, Stack } from "@mui/material"
import type { ChatMessage } from "../useChat"
import { MessageBubble } from "./MessageBubble"
import { TypingDots } from "./TypingDots"

export function ChatWindow({
  messages,
  streaming,
}: {
  messages: ChatMessage[]
  streaming: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages, streaming])

  const last = messages[messages.length - 1]
  const showDots = streaming && (!last || (last.kind === "assistant" && last.parts.length === 0))

  return (
    <Box ref={ref} sx={{ flex: 1, overflowY: "auto", px: 2, py: 2 }}>
      <Stack spacing={1.5} sx={{ maxWidth: 820, mx: "auto" }}>
        {messages.map((m) => (
          <MessageBubble key={m.kind === "user" ? `u-${m.localId}` : `a-${m.messageId}`} message={m} />
        ))}
        {showDots && <TypingDots />}
      </Stack>
    </Box>
  )
}