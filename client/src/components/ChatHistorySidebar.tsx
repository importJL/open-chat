import { useState } from "react"
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemSecondaryAction,
  ListItemText,
  Tooltip,
  Typography,
} from "@mui/material"
import Delete from "@mui/icons-material/Delete"
import AddComment from "@mui/icons-material/AddComment"
import type { SessionInfo } from "../api"

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000))
  if (s < 60) return "just now"
  const m = Math.floor(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d}d ago`
}

export function ChatHistorySidebar({
  open,
  sessions,
  activeId,
  onSelect,
  onDelete,
  onNewChat,
}: {
  open: boolean
  sessions: SessionInfo[]
  activeId?: string
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  onNewChat: () => void
}) {
  const [pendingDelete, setPendingDelete] = useState<SessionInfo | null>(null)

  return (
    <Drawer
      variant="permanent"
      open={open}
      sx={{
        width: open ? 280 : 0,
        flexShrink: 0,
        transition: (theme) => theme.transitions.create("width", {
          easing: theme.transitions.easing.sharp,
          duration: theme.transitions.duration.enteringScreen,
        }),
        "& .MuiDrawer-paper": {
          width: open ? 280 : 0,
          position: "relative",
          boxSizing: "border-box",
          overflowX: "hidden",
          transition: (theme) => theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
          }),
        },
      }}
    >
      <Box
        sx={{
          height: 64,
          display: "flex",
          alignItems: "center",
          px: 1,
          borderBottom: 1,
          borderColor: "divider",
          bgcolor: "background.paper",
        }}
      >
        <Tooltip title="New chat">
          <IconButton onClick={onNewChat}>
            <AddComment />
          </IconButton>
        </Tooltip>
        <Typography variant="subtitle1" sx={{ mx: "auto", fontWeight: 600 }}>
          History
        </Typography>
        <Box sx={{ width: 40 }} />
      </Box>
      {open && (
        <Box sx={{ overflowY: "auto", flex: 1, bgcolor: "background.paper" }}>
          {sessions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center" }}>
              No chat history yet
            </Typography>
          ) : (
            <List dense sx={{ px: 1 }}>
              {sessions.map((s) => {
                const active = s.id === activeId
                return (
                  <ListItem key={s.id} disablePadding sx={{ mb: 0.5 }}>
                    <ListItemButton
                      selected={active}
                      onClick={() => onSelect(s.id)}
                      sx={{ borderRadius: 1, alignItems: "flex-start" }}
                    >
                      <ListItemText
                        primary={
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ color: active ? "primary.main" : "text.primary" }}
                          >
                            {s.title || "Untitled"}
                          </Typography>
                        }
                        secondary={timeAgo(s.time.updated)}
                      />
                    </ListItemButton>
                    <ListItemSecondaryAction sx={{ right: 2 }}>
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPendingDelete(s)
                        }}
                        title="Delete chat"
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                )
              })}
            </List>
          )}
        </Box>
      )}

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
      >
        <DialogTitle>Delete chat?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete “{pendingDelete?.title || "Untitled"}” and its messages.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)}>Cancel</Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingDelete) onDelete(pendingDelete.id)
              setPendingDelete(null)
            }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Drawer>
  )
}