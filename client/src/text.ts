const BLOCK_END = /(?=\n\s*\n|$)/

const OPEN_THINK_TAG = /<think(?::[0-9a-fA-F]+)?\s*\/?>/gi

// "CRITICAL - MAXIMUM STEPS REACHED" heading blocks (opencode max-steps reminder).
const MAXIMUM_STEPS = new RegExp(
  `(?:^|\\n)\\s*CRITICAL\\s*[-–]\\s*MAXIMUM\\s+STEPS\\s+REACHED[\\s\\S]*?${BLOCK_END.source}`,
  "gi",
)

// Model narration like "The maximum steps for this agent have been reached, ...".
const STEPS_NARRATION = new RegExp(
  `(?:^|\\n)\\s*The\\s+maximum\\s+(?:number\\s+of\\s+)?steps?\\s+(?:allowed\\s+for\\s+this\\s+(?:agent|task)|for\\s+this\\s+agent)\\s+(?:has|have)\\s+been\\s+reached[\\s\\S]*?${BLOCK_END.source}`,
  "gi",
)

// Markdown-bulleted recap sections the model appends after answering.
const RECAP_SECTIONS = new RegExp(
  `(?:^|\\n)\\s*\\*\\*\\s*(?:Summary(?:\\s+of\\s+what\\s+(?:was|has(?:\\s+been)?)\\s+accomplished)?|What\\s+has\\s+been\\s+accomplished|Remaining\\s+tasks?|Recommendations?\\s+for\\s+next\\s+steps?|Recommendation)\\s*(?:\\*\\*\\s*[:：]|[:：]\\s*\\*\\*)[\\s\\S]*?${BLOCK_END.source}`,
  "gi",
)

// Narration headings like "Here's a thinking process:" followed by a blank line.
const THINKING_HEADING = new RegExp(
  `(?:^|\\n)\\s*[a-zA-Z',\\s-]*(?:thinking|reasoning|thought|internal|analysis)\\s*(?:process|monologue|analysis|thoughts)?\\s*[:：]?[\\s\\S]*?${BLOCK_END.source}`,
  "gi",
)

// Narration step lines (model outlines its internal process).
const STEP_LINE = /^\s*(?:Analyze|Identify|Formulate|Check|Construct|Consider|Note|Recall|Verify|Evaluate|Assess|Determine|Review)\s+(?:User\s+Input|Core\s+Task|Response|Constraints|Output|Steps|Options|Alternatives|Approach|Strategy|Plan|Thought|Reasoning|Analysis)\b[^\n]*/gim

// Scaffolding fragments left behind by pseudo tool-call leaks.
const STRAY_TAGS = /<\/?(?:parameter|tool_call|tool|thought|internal|reasoning|thinking)\b[^>]*>/gi

// A tag name that semantically signals "this holds the result".
const RESULT_KEYWORD = /(?:answer|response|result|output|content|reply|final|text)/i

// Explicit answer markers; the LAST one wins.
const ANSWER_MARKERS = [
  /\*\*?\s*Answer\s*(?:\*\*\s*[:：]|[:：]\s*\*\*)\s*/i,
  /\bFinal\s+answer\s*[:：]\s*/i,
  /\bThe\s+answer\s+is\s*[:：]?\s*/i,
  /\bAnswer\s*[:：]\s*/i,
  /\bResult\s*[:：]\s*/i,
]

type TagMatch = { name: string; content: string }

function collectNamedResults(text: string): TagMatch[] {
  const re = /<([a-zA-Z_][\w-]*)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/gi
  const out: TagMatch[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (RESULT_KEYWORD.test(m[1])) out.push({ name: m[1], content: m[2] })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

function collectParams(text: string): TagMatch[] {
  const re = /<parameter\s*=\s*["']?([a-zA-Z_][\w-]*)["']?\s*>([\s\S]*?)<\/parameter>/gi
  const out: TagMatch[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push({ name: m[1], content: m[2] })
    if (m[0].length === 0) re.lastIndex++
  }
  return out
}

function cleanResult(s: string): string {
  return s.replace(OPEN_THINK_TAG, "").replace(STRAY_TAGS, "").trim()
}

// Recursively unwrap a content that is fully wrapped in a result container,
// e.g. `<answer><text>1 + 1 = 2</text></answer>` -> `1 + 1 = 2`.
function unwrapResult(s: string): string {
  let out = s.trim()
  for (let i = 0; i < 5; i++) {
    const m = out.match(/^<([a-zA-Z_][\w-]*)\b[^>]*>([\s\S]*?)<\/\1>\s*$/)
    if (!m || !RESULT_KEYWORD.test(m[1])) break
    out = m[2].trim()
  }
  return out
}

// Layer 1: structured result containers (any model syntax).
function extractStructured(text: string): string | null {
  const params = collectParams(text).filter((p) => p.content.trim().length > 0)
  const resultParams = params.filter((p) => RESULT_KEYWORD.test(p.name))
  if (resultParams.length > 0) {
    return unwrapResult(resultParams.map((p) => p.content.trim()).join("\n"))
  }
  const named = collectNamedResults(text).filter((t) => t.content.trim().length > 0)
  if (named.length > 0) {
    return unwrapResult(named.map((t) => t.content.trim()).join("\n"))
  }
  if (params.length > 0) {
    // No obviously-typed parameter; fall back to the last emitted one.
    return unwrapResult(params[params.length - 1].content.trim())
  }
  return null
}

// Mid-stream: an opening result tag is present but its close hasn't arrived yet.
function extractStreamingPartial(text: string): string | null {
  const openRe = /<([a-zA-Z_][\w-]*)(?:\s[^>]*)?>/gi
  let candidate: string | null = null
  let m: RegExpExecArray | null
  while ((m = openRe.exec(text)) !== null) {
    const name = m[1]
    const isResult = RESULT_KEYWORD.test(name) || name === "parameter"
    const after = text.slice(openRe.lastIndex)
    const closeRe = new RegExp(`</${name}\\b`, "i")
    if (isResult && !closeRe.test(after)) {
      candidate = after
    }
    if (m[0].length === 0) openRe.lastIndex++
  }
  return candidate
}

// Layer 2: explicit answer markers — keep everything after the LAST marker.
function lastMarkerEnd(text: string, re: RegExp): number {
  const g = new RegExp(re.source, re.global ? re.flags : `${re.flags}g`)
  let end = -1
  let m: RegExpExecArray | null
  while ((m = g.exec(text)) !== null) {
    end = m.index + m[0].length
    if (m[0].length === 0) g.lastIndex++
  }
  return end
}

function extractAfterMarker(text: string): string | null {
  let best = -1
  for (const re of ANSWER_MARKERS) {
    best = Math.max(best, lastMarkerEnd(text, re))
  }
  if (best === -1 || best >= text.length) return null
  return text.slice(best)
}

// Layer 3: strip narration / scaffolding, keep the narration-removal patterns.
function removeNarration(text: string): string {
  let out = text
  out = out.replace(OPEN_THINK_TAG, "")
  out = out.replace(MAXIMUM_STEPS, "")
  out = out.replace(STEPS_NARRATION, "")
  out = out.replace(RECAP_SECTIONS, "")
  out = out.replace(THINKING_HEADING, "")
  out = out.replace(STEP_LINE, "")
  const close = out.lastIndexOf("</think")
  if (close !== -1) {
    const end = out.indexOf(">", close)
    if (end !== -1) out = out.slice(end + 1)
  }
  return out
}

export function stripThinking(text: string): string {
  if (!text) return text

  const structured = extractStructured(text)
  if (structured) return cleanResult(structured)

  const partial = extractStreamingPartial(text)
  if (partial && partial.trim()) return cleanResult(partial)

  const stripped = removeNarration(text)
  const after = extractAfterMarker(stripped)
  if (after && after.trim()) return cleanResult(after)

  return cleanResult(stripped)
}