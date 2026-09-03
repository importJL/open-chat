import { useCallback, useRef, useState } from "react"
import { IconButton, Tooltip } from "@mui/material"
import Check from "@mui/icons-material/Check"
import ContentCopy from "@mui/icons-material/ContentCopy"

export function CopyButton({
  text,
  label = "Copy",
  size = "small",
}: {
  text: string
  label?: string
  size?: "small" | "medium"
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const copy = useCallback(async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [text])

  return (
    <Tooltip title={copied ? "Copied!" : label}>
      <IconButton
        size={size}
        onClick={(e) => {
          e.stopPropagation()
          void copy()
        }}
        aria-label={copied ? "Copied" : label}
        color={copied ? "success" : "inherit"}
        sx={{ p: 0.5, opacity: copied ? 1 : 0.7, "&:hover": { opacity: 1 } }}
      >
        {copied ? <Check fontSize="inherit" /> : <ContentCopy fontSize="inherit" />}
      </IconButton>
    </Tooltip>
  )
}