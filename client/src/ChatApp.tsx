import { useCallback, useState } from "react"
import {
  Alert,
  AppBar,
  Box,
  Chip,
  IconButton,
  Snackbar,
  Toolbar,
  Typography,
} from "@mui/material"
import AddComment from "@mui/icons-material/AddComment"
import DarkMode from "@mui/icons-material/DarkMode"
import LightMode from "@mui/icons-material/LightMode"
import MenuIcon from "@mui/icons-material/Menu"
import { ChatWindow } from "./components/ChatWindow"
import { Composer } from "./components/Composer"
import { ModelPicker } from "./components/ModelPicker"
import { ChatHistorySidebar } from "./components/ChatHistorySidebar"
import { useChat } from "./useChat"
import { useSessionHistory } from "./hooks/useSessionHistory"
import type { Mode } from "./theme"

export function ChatApp({
  mode,
  setMode,
}: {
  mode: Mode
  setMode: (mode: Mode) => void
}) {
  const chat = useChat()
  const history = useSessionHistory()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  const onSelectSession = useCallback(
    (id: string) => {
      chat.switchSession(id)
      void history.refresh()
    },
    [chat, history],
  )

  const onDeleteSession = useCallback(
    (id: string) => {
      void history.remove(id)
      if (id === chat.sessionId) chat.newChat()
    },
    [history, chat],
  )

  const onNewChat = useCallback(() => {
    chat.newChat()
    void history.refresh()
  }, [chat, history])

  const onSend = useCallback(
    async (text: string) => {
      await chat.send(text)
      void history.refresh()
    },
    [chat, history],
  )

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        bgcolor: "background.default",
      }}
    >
      <AppBar position="static" color="primary" elevation={0}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setSidebarOpen((o) => !o)}
            title={sidebarOpen ? "Hide history" : "Show history"}
          >
            <MenuIcon />
          </IconButton>
          <IconButton edge="start" color="inherit" onClick={onNewChat} title="New chat">
            <AddComment />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>
            opencode chat
          </Typography>
          <ModelPicker value={chat.model} onChange={chat.setModel} />
          <IconButton
            color="inherit"
            onClick={() => setMode(mode === "dark" ? "light" : "dark")}
            title="Toggle theme"
          >
            {mode === "dark" ? <LightMode /> : <DarkMode />}
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ChatHistorySidebar
          open={sidebarOpen}
          sessions={history.sessions}
          activeId={chat.sessionId}
          onSelect={onSelectSession}
          onDelete={onDeleteSession}
          onNewChat={onNewChat}
        />
        <Box sx={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
          <ChatWindow messages={chat.messages} streaming={chat.streaming} />
          <Box
            sx={{
              borderTop: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 1,
              px: 2,
              py: 1,
            }}
          >
            {chat.model && !chat.streaming && (
              <Chip size="small" label={chat.model} variant="outlined" />
            )}
          </Box>
          <Composer
            onSend={(t) => void onSend(t)}
            onStop={chat.stop}
            streaming={chat.streaming}
            disabled={!chat.sessionId}
            placeholder={
              !chat.sessionId
                ? "Connecting…"
                : "Message opencode (Enter to send, Shift+Enter for newline)"
            }
          />
        </Box>
      </Box>

      <Snackbar
        open={Boolean(chat.error)}
        autoHideDuration={null}
        disableWindowBlurListener
        onClose={chat.clearError}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert severity="error" variant="filled" onClose={chat.clearError} sx={{ maxWidth: 600 }}>
          {chat.error}
        </Alert>
      </Snackbar>
    </Box>
  )
}