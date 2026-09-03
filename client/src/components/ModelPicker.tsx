import { useEffect, useMemo, useState } from "react"
import { Box, CircularProgress, MenuItem, TextField, Tooltip, Typography } from "@mui/material"
import { getModels, type ModelInfo } from "../api"

export function ModelPicker({
  value,
  onChange,
}: {
  value?: string
  onChange: (value?: string) => void
}) {
  const [models, setModels] = useState<ModelInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    getModels()
      .then(({ models, default: def }) => {
        if (cancelled) return
        setModels(models)
        setFailed(undefined)
        if (!value && models.length > 0) onChange(def ?? models[0].id)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setFailed((err as Error).message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [onChange, value])

  const summary = useMemo(
    () => (value ? models.find((m) => m.id === value)?.name ?? value : undefined),
    [value, models],
  )

  if (loading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", height: 40, color: "inherit" }}>
        <CircularProgress size={18} color="inherit" />
      </Box>
    )
  }

  if (failed) {
    return (
      <Tooltip title={`Could not load models: ${failed}`}>
        <Typography variant="caption" color="inherit" sx={{ opacity: 0.8 }}>
          models unavailable
        </Typography>
      </Tooltip>
    )
  }

  return (
    <TextField
      select
      size="small"
      value={value ?? ""}
      onChange={(e) => onChange(e.target.value || undefined)}
      slotProps={{
        select: { displayEmpty: true, renderValue: () => value ?? summary ?? "Select model" },
      }}
      sx={{
        minWidth: 180,
        "& .MuiInputBase-root": { color: "inherit" },
        "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.4)" },
        "& .MuiSvgIcon-root": { color: "inherit" },
      }}
    >
      {models.length === 0 && <MenuItem value="">No connected models</MenuItem>}
      {models.map((m) => (
        <MenuItem key={m.id} value={m.id}>
          {m.providerName} · {m.name || m.model}
        </MenuItem>
      ))}
    </TextField>
  )
}