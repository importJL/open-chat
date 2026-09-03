import { createTheme } from "@mui/material/styles"

export type Mode = "light" | "dark"

export const lightTheme = createTheme({
  palette: { mode: "light" },
  shape: { borderRadius: 10 },
})

export const darkTheme = createTheme({
  palette: { mode: "dark" },
  shape: { borderRadius: 10 },
})