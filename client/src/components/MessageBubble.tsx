import { useState } from "react"
import {
  Box,
  Collapse,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
  useTheme,
} from "@mui/material"
import ExpandLess from "@mui/icons-material/ExpandLess"
import ExpandMore from "@mui/icons-material/ExpandMore"
import type { ChatMessage } from "../useChat"
import { MarkdownAnswer } from "./MarkdownAnswer"

function ThinkingCard({ reasoning }: { reasoning: string }) {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((o) => !o)

  return (
    <Paper
      variant="outlined"
      sx={{
        maxWidth: "85%",
        mb: 0.5,
        px: 1,
        py: 0.5,
        bgcolor: "action.hover",
        color: "text.secondary",
      }}
    >
      <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
        <IconButton
          size="small"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Hide thinking" : "Show thinking"}
          sx={{ p: 0.25, color: "inherit", opacity: 0.7 }}
        >
          {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
        </IconButton>
        <Typography
          variant="caption"
          component="span"
          sx={{ cursor: "pointer", opacity: 0.65, userSelect: "none" }}
          onClick={toggle}
        >
          Thinking
        </Typography>
      </Stack>
      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider sx={{ my: 0.5 }} />
        <Typography
          variant="caption"
          sx={{
            display: "block",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            opacity: 0.8,
          }}
        >
          {reasoning}
        </Typography>
      </Collapse>
    </Paper>
  )
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const theme = useTheme()
  const isUser = message.kind === "user"

  const rawText = isUser ? message.text : message.parts.map((p) => p.text).join("")
  const reasoning = isUser ? "" : message.reasonings.map((p) => p.text).join("")

  if (isUser) {
    return (
      <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
        <Paper
          elevation={2}
          sx={{
            maxWidth: "85%",
            px: 1.75,
            py: 1.25,
            bgcolor:
              theme.palette.mode === "dark"
                ? theme.palette.primary.dark
                : theme.palette.primary.main,
            color: theme.palette.primary.contrastText,
          }}
        >
          <Typography sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {message.text}
          </Typography>
        </Paper>
      </Box>
    )
  }

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", flexDirection: "column", alignItems: "flex-start" }}>
      {reasoning && <ThinkingCard reasoning={reasoning} />}
      <Paper
        elevation={1}
        sx={{
          maxWidth: "85%",
          px: 1.75,
          py: 1.25,
          bgcolor: theme.palette.background.paper,
          color: theme.palette.text.primary,
          border: 1,
          borderColor: "divider",
          "& p:first-of-type": { mt: 0 },
          "& p:last-child": { mb: 0 },
        }}
      >
        <MarkdownAnswer text={rawText} />
        {message.error && (
          <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
            {message.error}
          </Typography>
        )}
        {message.model && (
          <Typography
            variant="caption"
            sx={{ display: "block", mt: 0.75, opacity: 0.55, fontSize: "0.65rem" }}
          >
            {message.model}
          </Typography>
        )}
      </Paper>
    </Box>
  )
}