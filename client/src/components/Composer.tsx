import { useState } from "react"
import { Box, IconButton, Stack, TextField } from "@mui/material"
import Send from "@mui/icons-material/Send"
import StopCircle from "@mui/icons-material/StopCircle"

export function Composer({
  onSend,
  onStop,
  streaming,
  disabled,
  placeholder,
}: {
  onSend: (text: string) => void
  onStop: () => void
  streaming: boolean
  disabled: boolean
  placeholder: string
}) {
  const [value, setValue] = useState("")

  const submit = () => {
    const text = value.trim()
    if (!text || streaming || disabled) return
    setValue("")
    onSend(text)
  }

  return (
    <Box
      sx={{
        p: 2,
        borderTop: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
        opacity: disabled ? 0.7 : 1,
      }}
    >
      <Stack direction="row" spacing={1} sx={{ maxWidth: 820, mx: "auto", width: "100%", alignItems: "flex-end" }}>
        <TextField
          fullWidth
          multiline
          minRows={1}
          maxRows={8}
          size="small"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              submit()
            }
          }}
          autoFocus
        />
        {streaming ? (
          <IconButton color="error" onClick={onStop} title="Stop" sx={{ mb: 0.5 }}>
            <StopCircle />
          </IconButton>
        ) : (
          <IconButton
            color="primary"
            onClick={submit}
            disabled={disabled || !value.trim()}
            title="Send"
            sx={{ mb: 0.5 }}
          >
            <Send />
          </IconButton>
        )}
      </Stack>
    </Box>
  )
}