# open chat

A minimal inference demo: a [Bun](https://bun.sh) server that wraps the
[opencode](https://opencode.ai) [JS SDK](https://opencode.ai/docs/sdk/), plus a
[Vite](https://vite.dev) + React + TypeScript + [Material UI](https://mui.com)
chat frontend that talks to it.

```
Browser (Vite :5173) ── /api/* ──proxy──▶ Bun server (:3000) ── SDK ──▶ opencode serve (:4097)
```

The Bun server spawns an embedded opencode server, so there is just one
command to run. The frontend streams assistant replies token-by-token over
SSE.

## Prerequisites

- [Bun](https://bun.sh) >= 1.3
- The `opencode` CLI on your `PATH` and at least one authenticated provider
  (the SDK pins the npm package `@opencode-ai/sdk@1.4.0` to match the local
  CLI version). Run `opencode auth login` if you have not authenticated yet.

## Run

```bash
bun install
bun run dev
```

- Chat UI: http://localhost:5173
- Health check: `curl localhost:3000/api/health`
- OpenAPI spec of the embedded server: http://localhost:4097/doc

Optionally override with env vars:

- `OPENCODE_HOST` (default `127.0.0.1`) — embedded opencode server host
- `PORT` (default `3000`) — Bun API server port
- `OPENCODE_PORT` (default `4097`) — embedded opencode server port
- `MODEL` (e.g. `opencode-go/deepseek-v4-flash`) — force a default model

## Build for production

Build both deployable outputs from the workspace root:

```bash
bun run build
```

This runs the Vite client build and bundles the Bun server with `bun build`:

- `client/dist/` — static frontend assets for a web server or CDN
- `server/dist/index.js` — bundled Bun API server

Run the bundled API server with:

```bash
bun run start:prod
```

The frontend is not served by the API process. Configure the static host to
forward `/api/*` and `/api/events` to the running Bun server, or use the Vite
proxy during local development.

## Layout

```
server/   Bun + @opencode-ai/sdk — REST + SSE proxy to the embedded server
client/   Vite + React + TS + MUI — chat UI (EventSource client)
```

## Server API

| Method | Path                             | Description                              |
| ------ | -------------------------------- | ---------------------------------------- |
| GET    | `/api/health`                    | Health + opencode CLI version            |
| GET    | `/api/models`                    | Connected providers and their models     |
| POST   | `/api/sessions`                  | Create a session → `{ id }`              |
| GET    | `/api/sessions/:id/messages`     | Full message history for a session       |
| POST   | `/api/sessions/:id/messages`     | Send `{ text, model? }` → `202`          |
| POST   | `/api/sessions/:id/abort`        | Abort the in-flight turn                 |
| GET    | `/api/events?sessionId=…`        | SSE stream (reconnect-safe, replays)     |

The chat agent (`server/src/agent.ts`) runs with every tool disabled and file /
shell permissions set to `deny`, so the model is a plain chat assistant and
cannot read, write, or execute on your machine.

## Notes

- Browser connections use `Last-Event-ID` so a dropped SSE connection replays
  missed deltas from the server's per-session buffer.
- The active session id is kept in `sessionStorage`, so a page reload resumes
  the same opencode session.
- Sessions are persisted by opencode under `~/.local/share/opencode/`.