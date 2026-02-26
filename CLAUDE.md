# AgentSmith

Room-scoped event fabric connecting local Claude Code sessions with a shared web canvas.
Enables ambient presence between developers and bidirectional interactions while enforcing strict privacy (no code/messages/context leakage).

## Project Structure

```
agentsmith/                      # Bun monorepo (workspaces in packages/*)
├── packages/
│   ├── api/                     # REST API server (Hono + SQLite)
│   │   ├── Dockerfile           # Multi-stage build for server deployment
│   │   └── src/
│   │       ├── index.ts         # Entry point (Bun server)
│   │       ├── app.ts           # Hono app factory + middleware + routes
│   │       ├── db/              # SQLite queries (events, rooms, users, migrate)
│   │       ├── lib/             # Config, errors, cleanup, ULID utils
│   │       ├── middleware/      # Auth (Auth0 JWT), error handler, logger
│   │       └── routes/          # events, rooms, presence
│   └── shared/                  # Shared types & utilities
│       └── src/                 # Zod schemas, event/room/auth types, TTL utils
├── plugin/                      # Claude Code plugin (pure shell, no build step)
│   ├── .claude-plugin/          # Plugin manifest (plugin.json)
│   └── hooks/
│       ├── hooks.json           # Hook definitions (SessionStart, PreToolUse, etc.)
│       ├── scripts/
│       │   ├── init.sh          # SessionStart: start proxy + load config → $CLAUDE_ENV_FILE
│       │   └── emit.sh          # All other hooks: curl POST to local proxy
│       └── proxy/
│           └── proxy.ts         # Local proxy server (Bun), started by init.sh
├── docs/
│   ├── specs/                   # PRD, TRD, API guidelines, plugin specs
│   └── plans/                   # Implementation plans
└── .dockerignore
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

```bash
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
- **In-memory SQLite** for test isolation (see `packages/api/src/test-utils.ts`)
- **Biome** for formatting (2-space indent, 100-char lines) and linting — run `bun run format` before committing
- **Error handling** — use `AppError` subclasses from `packages/api/src/lib/errors.ts`
- **Privacy first** — never transmit code, messages, or context through the event fabric
- **Zero broken windows** — if you encounter pre-existing errors (typecheck, lint, test failures), fix them; never leave them for later

## Plugin Development

The plugin lives in `plugin/` (top-level) and follows the Claude Code plugin specification. Hooks are shell scripts; the local proxy (`proxy.ts`) is a Bun server started in the background by `init.sh`.

**Before working on the plugin, read:** `docs/specs/plugin-specs.md`

Key concepts:
- The plugin manifest is at `plugin/.claude-plugin/plugin.json`
- Hooks are defined in `plugin/hooks/hooks.json`
- `SessionStart` runs `init.sh` which starts `proxy.ts` in the background (if not running) and loads `~/.config/agentsmith/config` into `$CLAUDE_ENV_FILE`
- All other hooks run `emit.sh` which wraps the stdin JSON payload and POSTs it to the local proxy via `curl`
- Hooks use `"async": true` so they never block Claude Code
- Test locally by running Claude with the plugin loaded:

```bash
claude --plugin-dir ./plugin
```
