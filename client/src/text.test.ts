import { describe, expect, test } from "bun:test"
import { stripThinking } from "./text"

describe("stripThinking", () => {
  test("extracts the answer from the user's pseudo tool-call leak", () => {
    const input = `Here's a thinking process:

Analyze User Input: The user asks "what is 1+1"
Identify Core Task: Simple arithmetic calculation
Formulate Response: 1 + 1 = 2
Check Constraints:
Answer directly
Stop after answering
Construct Output: Just the answer
The user's query is extremely straightforward. I'll just answer directly - the user's question is just 1 + 1 = 2

</parameter>
<parameter=text>
1 + 1 = 2
</parameter>
</tool_call>`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("extracts from a named result tag", () => {
    const input = `<final_answer>1 + 1 = 2</final_answer>`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("extracts from a response tag", () => {
    const input = `<response>1 + 1 = 2</response>`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("extracts from an explicit answer marker after narration", () => {
    const input = `Here's a thinking process:

Analyze User Input: arithmetic
Construct Output: concise answer

**Answer:** 1 + 1 = 2`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("returns the streaming tail when a result tag is open", () => {
    const partial = `<parameter=text>1 + 1 =`
    expect(stripThinking(partial)).toBe("1 + 1 =")
  })

  test("removes narration when there are no tags but an answer line remains", () => {
    const input = `Here's a thinking process:

Analyze User Input: The user asks "what is 1+1"
Identify Core Task: Simple arithmetic
Construct Output: concise
1 + 1 = 2`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("keeps the answer from a MAXIMUM STEPS block", () => {
    const input = `CRITICAL - MAXIMUM STEPS REACHED

The maximum number of steps allowed for this agent has been reached. Respond with text only.

**Answer:** 2 × 2 = 4.`
    expect(stripThinking(input)).toBe("2 × 2 = 4.")
  })

  test("preserves markdown in the extracted answer", () => {
    const input = `<answer>**bold** and \`code\`</answer>`
    expect(stripThinking(input)).toBe("**bold** and `code`")
  })

  test("joins multiple text parameters in order", () => {
    const input = `<parameter=text>1 + 1 = 2</parameter>\n<parameter=text>2 + 2 = 4</parameter>`
    expect(stripThinking(input)).toBe("1 + 1 = 2\n2 + 2 = 4")
  })

  test("strips stray scaffolding after a plain answer", () => {
    const input = `1 + 1 = 2\n</parameter>\n</tool_call>`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("leaves plain text untouched", () => {
    expect(stripThinking("1 + 1 = 2")).toBe("1 + 1 = 2")
  })

  test("removes think-tag overflow", () => {
    const input = `</think:6124c78e>The maximum steps for this agent have been reached.

**Answer:** 1 + 1 = 2.`
    expect(stripThinking(input)).toBe("1 + 1 = 2.")
  })

  test("removes recap sections after the answer", () => {
    const input = `<parameter=text>1 + 1 = 2</parameter>

**Summary of what was accomplished:**
- answered

**Remaining tasks:**
none`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })

  test("unwraps nested result containers", () => {
    const input = `<answer><text>1 + 1 = 2</text></answer>`
    expect(stripThinking(input)).toBe("1 + 1 = 2")
  })
})