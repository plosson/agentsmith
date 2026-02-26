# AgentSmith

Room-scoped event fabric connecting local Claude Code sessions with a shared web frontend.
Enables ambient presence between developers and bidirectional interactions while enforcing strict privacy (no code/messages/context leakage).

## Project Structure

```
agentsmith/
├── backend/                     # Bun monorepo (workspaces in packages/*)
│   ├── package.json             # Workspace root
│   ├── tsconfig.json            # Base TypeScript config
│   ├── biome.json               # Linter/formatter config
│   ├── packages/
│   │   ├── api/                 # REST API server (Hono + SQLite)
│   │   │   ├── Dockerfile       # Multi-stage build for server deployment
│   │   │   └── src/
│   │   │       ├── index.ts     # Entry point (Bun server)
│   │   │       ├── app.ts       # Hono app factory + middleware + routes
│   │   │       ├── db/          # SQLite queries (events, rooms, users, migrate)
│   │   │       ├── lib/         # Config, errors, cleanup, ULID utils, transform
│   │   │       ├── middleware/  # Auth (Auth0 JWT), error handler, logger
│   │   │       └── routes/      # events, rooms, presence
│   │   └── shared/              # Shared types & utilities
│   │       └── src/             # Zod schemas, event/room/auth types, TTL utils
│   └── .dockerignore
├── frontend/                    # Pure SPA (HTML + JS + Tailwind)
├── plugin/                      # Claude Code plugin (pure shell, no build step)
│   ├── .claude-plugin/          # Plugin manifest (plugin.json)
│   └── hooks/
│       ├── hooks.json           # Hook definitions (SessionStart, PreToolUse, etc.)
│       ├── scripts/
│       │   ├── init.sh          # SessionStart: start proxy + load config → $CLAUDE_ENV_FILE
│       │   └── emit.sh          # All other hooks: curl POST to local proxy
│       └── proxy/
│           └── proxy.ts         # Local proxy server (Bun), started by init.sh
└── docs/
    ├── specs/                   # PRD, TRD, API guidelines, plugin specs
    └── plans/                   # Implementation plans
```

## Architecture

```
plugin (emit.sh) → proxy (local, started by init.sh) → API server (remote)
```

- `init.sh` starts `proxy.ts` in the background on `SessionStart` (if not already running)
- The **plugin** sends hook events to `AGENTSMITH_CLIENT_URL` (local proxy)
- The **proxy** receives events, transforms them, and forwards to `AGENTSMITH_SERVER_URL` (remote API)
- Config lives at `~/.config/agentsmith/config` (shell KEY=VALUE format)

Key config variables:
- `AGENTSMITH_SERVER_URL` — remote API server URL (required)
- `AGENTSMITH_CLIENT_URL` — local proxy URL (written by proxy on startup)
- `AGENTSMITH_KEY` — auth token
- `AGENTSMITH_ROOM` — target room name
- `AGENTSMITH_USER` — user email (used as `sender.user_id` in event envelope)
- `AGENTSMITH_SERVER_MODE` — `remote` (default) or `local` (disk queue, no server)
- `AGENTSMITH_DEBUG` — set to `true` to write debug JSON files to `~/.config/agentsmith/debug/`

## Event Envelope

Events use a nested envelope format. The **proxy owns the envelope** (stamps `room_id`, `type`, `format`, `sender`), the **server owns identity + timing** (`id`, `created_at`, `ttl_seconds`, `expires_at`). Raw payloads are stored as-is; consumers request a desired format via `?format=` and the server transforms on read.

```typescript
// Inbound (POST body from proxy or frontend)
{
  room_id: "room-1",
  type: "hook.UserPromptSubmit",       // CC hook name or "interaction"
  format: "claude_code_v27",           // source format identifier
  sender: { user_id: "alice@co", session_id?: "sess-xxx" },
  target?: { user_id: "bob@co", session_id?: "sess-yyy" },
  payload: { /* opaque, raw */ }
}

// Stored & served (server adds these)
{
  id: "01ARZ...",           // ULID
  created_at: 1709...,     // Unix ms
  ttl_seconds: 300,
  expires_at: 1709...,
  // + all inbound fields (sender/target nested in response)
}
```

Key design decisions:
- `sender.user_id` is trusted from the request body (no auth-derived identity yet)
- TTL is looked up by `type` (see `backend/packages/shared/src/ttl.ts`)
- Transform-on-read: `backend/packages/api/src/lib/transform.ts` holds a registry of `from:to` format transformers (passthrough when no transformer registered)
- DB stores flat columns (`sender_user_id`, `sender_session_id`, etc.) but `rowToEvent()` in `backend/packages/api/src/db/events.ts` marshals to the nested `Event` shape

## Tech Stack

- **Runtime:** Bun (package manager, runtime, test runner, binary compiler)
- **Language:** TypeScript (strict mode, ESM)
- **API:** Hono 4.x
- **Database:** SQLite via `bun:sqlite` (WAL mode, no ORM)
- **Validation:** Zod 4.x + `@hono/zod-validator`
- **IDs:** ULID
- **Auth:** Auth0 (OAuth with JWT)
- **Linter/Formatter:** Biome
- **Container:** Docker

## Commands

All Bun commands run from `backend/`:

```bash
cd backend
bun test                      # Run all tests
bun test packages/api         # Test API only
bun run dev:api               # Dev API server with watch
bun run lint                  # Biome check
bun run format                # Biome format
bun run typecheck             # TypeScript check (all packages)
```

## Coding Guidelines

- **Always use Bun** — never npm/yarn/node
- **ESM only** — `import`/`export`, never `require()`
- **Strict TypeScript** — no `any`, no `as` casts unless unavoidable
- **Zod schemas** are the single source of truth for types — infer TS types from them
- **No ORM** — use raw SQLite prepared statements
- **ULID for IDs** — sortable, distributed-friendly
- **Co-located tests** — `*.test.ts` next to source files, using `bun:test`
- **In-memory SQLite** for test isolation (see `backend/packages/api/src/test-utils.ts`)
- **Biome** for formatting (2-space indent, 100-char lines) and linting — run `bun run format` before committing
- **Error handling** — use `AppError` subclasses from `backend/packages/api/src/lib/errors.ts`
- **Privacy first** — never transmit code, messages, or context through the event fabric
- **Zero broken windows** — if you encounter pre-existing errors (typecheck, lint, test failures), fix them; never leave them for later

## Plugin Development

The plugin lives in `plugin/` (top-level) and follows the Claude Code plugin specification. Hooks are shell scripts; the local proxy (`proxy.ts`) is a Bun server started in the background by `init.sh`.

**Before working on the plugin, read:** `docs/specs/plugin-specs.md`

Key concepts:
- The plugin manifest is at `plugin/.claude-plugin/plugin.json`
- Hooks are defined in `plugin/hooks/hooks.json`
- `SessionStart` runs `init.sh` which starts `proxy.ts` in the background (if not running), loads `~/.config/agentsmith/config` into `$CLAUDE_ENV_FILE`, and calls `GET /health` on the proxy to display session info
- All other hooks run `emit.sh` which constructs the event envelope (`room_id`, `type`, `format`, `sender`, `payload`) and POSTs it to the local proxy via `curl`
- Hooks use `"async": true` so they never block Claude Code
- Test locally by running Claude with the plugin loaded:

```bash
claude --plugin-dir ./plugin
```
