import { Box, keyframes, styled } from "@mui/material"

const bounce = keyframes`
  0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
  40% { transform: scale(1); opacity: 1; }
`

const Dot = styled("span")(({ theme }) => ({
  width: 8,
  height: 8,
  margin: "0 2px",
  borderRadius: "50%",
  background: theme.palette.text.secondary,
  display: "inline-block",
  animation: `${bounce} 1.2s infinite ease-in-out`,
}))

export function TypingDots() {
  return (
    <Box sx={{ display: "flex", justifyContent: "flex-start", pl: 1, pt: 1 }}>
      <Dot style={{ animationDelay: "0s" }} />
      <Dot style={{ animationDelay: "0.16s" }} />
      <Dot style={{ animationDelay: "0.32s" }} />
    </Box>
  )
}