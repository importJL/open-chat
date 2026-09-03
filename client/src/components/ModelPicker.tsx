import { useEffect, useMemo, useState } from "react"
import {
  Autocomplete,
  Box,
  CircularProgress,
  TextField,
  Tooltip,
  Typography,
  createFilterOptions,
} from "@mui/material"
import { getModels, type ModelInfo } from "../api"

const filter = createFilterOptions<ModelInfo>({
  matchFrom: "any",
  stringify: (m) => `${m.name} ${m.model} ${m.providerName} ${m.provider}`,
  limit: 200,
})

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

  const selected = useMemo(
    () => models.find((m) => m.id === value) ?? null,
    [models, value],
  )

  const renderValue = useMemo(
    () => (selected ? selected.name || selected.model : undefined),
    [selected],
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
    <Autocomplete
      size="small"
      options={models}
      value={selected}
      onChange={(_e, newValue) => onChange(newValue?.id)}
      groupBy={(m) => m.providerName}
      getOptionLabel={(m) => m.name || m.model}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      filterOptions={models.length > 60 ? filter : undefined}
      disablePortal
      noOptionsText={models.length === 0 ? "No connected models" : "No matches"}
      renderOption={(props, m) => (
        <li {...props}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" noWrap>
              {m.name || m.model}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {m.providerName} · {m.id}
            </Typography>
          </Box>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          placeholder="Search model…"
          sx={{
            minWidth: 220,
            "& .MuiInputBase-root": { color: "inherit" },
            "& .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.35)" },
            "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "rgba(255,255,255,0.6)" },
            "& .MuiSvgIcon-root": { color: "inherit" },
            "& .MuiAutocomplete-input": { color: "inherit" },
            "& .MuiInputBase-input::placeholder": { color: "inherit", opacity: 0.7 },
          }}
        />
      )}
      slotProps={{
        paper: { sx: { maxHeight: 420, width: 320 } },
        popper: { sx: { zIndex: 1400 } },
      }}
      sx={{ color: "inherit" }}
      title={selected ? selected.id : "Select model"}
    />
  )
}