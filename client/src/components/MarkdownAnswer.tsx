import { Box, Link, Typography } from "@mui/material"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import type { Components } from "react-markdown"
import { stripThinking } from "../text"

const Code = ({ className, children }: { className?: string; children?: React.ReactNode }) => {
  const isBlock = className?.includes("language-")
  if (isBlock) {
    return (
      <code className={`hljs ${className ?? ""}`} style={{ display: "block" }}>
        {children}
      </code>
    )
  }
  return <code className={className}>{children}</code>
}

const components: Components = {
  h1: ({ children }) => (
    <Typography variant="h6" component="h1" sx={{ mt: 1.5, mb: 0.5, fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  h2: ({ children }) => (
    <Typography variant="h6" component="h2" sx={{ mt: 1.5, mb: 0.5, fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  h3: ({ children }) => (
    <Typography variant="subtitle1" component="h3" sx={{ mt: 1.25, mb: 0.5, fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  h4: ({ children }) => (
    <Typography variant="subtitle2" component="h4" sx={{ mt: 1, mb: 0.5, fontWeight: 700 }}>
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography component="p" variant="body1" sx={{ my: 0.75, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
      {children}
    </Typography>
  ),
  a: ({ href, children }) => (
    <Link href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  ),
  code: (props) => {
    const { className, children } = props as { className?: string; children?: React.ReactNode }
    return <Code className={className}>{children}</Code>
  },
  pre: ({ children }) => (
    <Box
      component="pre"
      sx={{
        my: 1,
        p: 1.25,
        borderRadius: 1,
        bgcolor: "background.default",
        border: 1,
        borderColor: "divider",
        overflowX: "auto",
        fontSize: "0.8rem",
        lineHeight: 1.5,
        "& code": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
      }}
    >
      {children}
    </Box>
  ),
  blockquote: ({ children }) => (
    <Box
      component="blockquote"
      sx={{
        my: 1,
        pl: 1.5,
        borderLeft: 3,
        borderColor: "divider",
        color: "text.secondary",
        fontStyle: "italic",
      }}
    >
      {children}
    </Box>
  ),
  ul: ({ children }) => (
    <Typography component="ul" sx={{ my: 0.75, pl: 3 }}>
      {children}
    </Typography>
  ),
  ol: ({ children }) => (
    <Typography component="ol" sx={{ my: 0.75, pl: 3 }}>
      {children}
    </Typography>
  ),
  li: ({ children }) => (
    <Typography component="li" sx={{ my: 0.25 }}>
      {children}
    </Typography>
  ),
  table: ({ children }) => (
    <Box component="table" sx={{ my: 1, borderCollapse: "collapse", width: "100%", fontSize: "0.85rem" }}>
      {children}
    </Box>
  ),
  td: ({ children }) => (
    <Box component="td" sx={{ px: 1, py: 0.5, border: 1, borderColor: "divider" }}>
      {children}
    </Box>
  ),
  th: ({ children }) => (
    <Box component="th" sx={{ px: 1, py: 0.5, border: 1, borderColor: "divider", fontWeight: 700 }}>
      {children}
    </Box>
  ),
  hr: () => <Box component="hr" sx={{ my: 1.5, border: 0, borderTop: 1, borderColor: "divider" }} />,
  strong: ({ children }) => <strong>{children}</strong>,
  em: ({ children }) => <em>{children}</em>,
  input: (props) => <input {...(props as Record<string, unknown>)} />,
}

export function MarkdownAnswer({ text }: { text: string }) {
  const content = stripThinking(text)
  if (!content) return null
  return (
    <Box
      sx={{
        color: "inherit",
        "& .hljs": { background: "transparent" },
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypeHighlight, { detect: true, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  )
}