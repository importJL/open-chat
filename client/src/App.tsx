import { useMemo, useState } from "react"
import { CssBaseline, ThemeProvider } from "@mui/material"
import hljsLight from "highlight.js/styles/github.css?url"
import hljsDark from "highlight.js/styles/github-dark.css?url"
import { ChatApp } from "./ChatApp"
import { darkTheme, lightTheme, type Mode } from "./theme"

export default function App() {
  const [mode, setMode] = useState<Mode>(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
      return "dark"
    }
    return "light"
  })

  const theme = useMemo(() => (mode === "dark" ? darkTheme : lightTheme), [mode])

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <link rel="stylesheet" href={mode === "dark" ? hljsDark : hljsLight} />
      <ChatApp mode={mode} setMode={setMode} />
    </ThemeProvider>
  )
}