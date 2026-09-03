import { createOpencode } from "@opencode-ai/sdk"
import { chatConfig } from "./agent"
import { registerRoutes } from "./routes"
import { startUpstream } from "./upstream"

const PORT = Number(process.env.PORT ?? 3000)
const OPENCODE_HOST = process.env.OPENCODE_HOST ?? "127.0.0.1"
const OPENCODE_PORT = Number(process.env.OPENCODE_PORT ?? 4097)

let cliVersion = "unknown"
try {
  const proc = Bun.spawnSync({ cmd: ["opencode", "--version"] })
  cliVersion = proc.stdout.toString().trim() || "unknown"
} catch {
  // ignore
}

const { client, server } = await createOpencode({
  hostname: OPENCODE_HOST,
  port: OPENCODE_PORT,
  config: chatConfig(),
})

console.log(`opencode server listening at ${server.url}`)

startUpstream(server.url)

const app = Bun.serve({
  port: PORT,
  hostname: "127.0.0.1",
  idleTimeout: 255,
  routes: registerRoutes(client, server.url, cliVersion),
  fetch: () => new Response("Not found", { status: 404 }),
})

console.log(`chat api listening at http://localhost:${PORT} (opencode CLI ${cliVersion})`)

const shutdown = () => {
  try {
    app.stop()
  } catch {}
  try {
    server.close()
  } catch {}
  process.exit(0)
}
process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)