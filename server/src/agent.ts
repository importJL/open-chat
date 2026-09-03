import type { Config } from "@opencode-ai/sdk"

export const CHAT_AGENT = "chat"

export const DENIED_TOOLS: Record<string, boolean> = {
  read: false,
  write: false,
  edit: false,
  apply_patch: false,
  glob: false,
  grep: false,
  shell: false,
  webfetch: false,
  websearch: false,
  task: false,
  todo: false,
  skill: false,
  plan: false,
  question: false,
  lsp: false,
  "external-directory": false,
}

export function chatConfig(): Config {
  const config: Config = {
    agent: {
      [CHAT_AGENT]: {
        mode: "primary",
        description: "Chat-only assistant with no file or shell access",
        prompt:
          "You are a chat assistant. Answer the user's question directly and stop. " +
          "Do not narrate your reasoning, internal thoughts, agent state, or tool availability. " +
          "Never mention steps, step limits, summaries, tasks, or recommendations. " +
          "Format answers with Markdown when helpful.",
        // Note: v1.4.0 uses `steps`, not `maxSteps`. No step limit is set
        // deliberately: with every tool denied the loop exits after one turn,
        // and a limit would inject opencode's MAX_STEPS reminder, which
        // coding-tuned models echo back as text. Chat-only safety is enforced
        // by `tools` + `permission` below.
        tools: { ...DENIED_TOOLS },
        permission: {
          edit: "deny",
          bash: "deny",
          webfetch: "deny",
          doom_loop: "deny",
          external_directory: "deny",
        },
      },
    },
    // Per-turn latency: skip everything the chat agent doesn't need. These are
    // opencode-level options only; provider model/token limits are untouched.
    lsp: false,
    formatter: false,
    snapshot: false,
    share: "disabled",
    autoupdate: false,
    watcher: { ignore: ["**"] },
  }
  if (process.env.MODEL) config.model = process.env.MODEL
  return config
}