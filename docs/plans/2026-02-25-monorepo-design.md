# AgentSmith Monorepo Design

**Date:** 2026-02-25
**Status:** Approved
**Approach:** Bun Workspaces — Flat `packages/`

---

## Repository Structure

```
agentsmith/
├── package.json                 # Bun workspace root
├── bunfig.toml
├── tsconfig.json                # Base TS config, extended by packages
├── .gitignore
├── .env.example
├── docker/
│   └── Dockerfile               # API server container
├── docs/
│   ├── specs/
│   └── plans/
└── packages/
    ├── api/                     # AgentSmith Server (Bun + Hono + SQLite)
    ├── plugin/                  # Claude Code Plugin + compiled binary
    └── shared/                  # Types, schemas, constants
```

Root workspace config:

```json
{
  "name": "agentsmith",
  "private": true,
  "workspaces": ["packages/*"]
}
```

Base `tsconfig.json` with strict mode, ES2022 target, Bun types. Each package extends it and adds path aliases for `@agentsmith/shared`.

---

## packages/shared

Shared types, enums, and Zod schemas consumed by both API and plugin.

```
packages/shared/
├── package.json                # name: @agentsmith/shared
├── tsconfig.json
└── src/
    ├── index.ts                # Public barrel export
    ├── events.ts               # Event interface, SessionSignalPayload, InteractionPayload
    ├── signals.ts              # SessionSignal union type + enum values
    ├── schemas.ts              # Zod schemas for API request/response validation
    ├── rooms.ts                # Room-related types
    ├── auth.ts                 # Auth-related types (token shapes, user identity)
    ├── errors.ts               # Error code constants and error response types
    └── ttl.ts                  # TTL_SECONDS config map + DEFAULT_TTL_SECONDS
```

No runtime dependencies other than `zod`. Never deployed standalone.

---

## packages/api

Hono server following API_TECH_GUIDELINES patterns.

```
packages/api/
├── package.json                # name: @agentsmith/api
├── tsconfig.json
└── src/
    ├── index.ts                # Entry point (Bun.serve)
    ├── app.ts                  # Hono app setup, global middleware, route mounting
    ├── routes/
    │   ├── auth.ts             # POST /api/v1/auth/device, POST /api/v1/auth/token
    │   ├── rooms.ts            # GET/POST /api/v1/rooms, GET /api/v1/rooms/:roomId
    │   ├── events.ts           # POST/GET /api/v1/rooms/:roomId/events
    │   └── presence.ts         # GET /api/v1/rooms/:roomId/presence
    ├── middleware/
    │   ├── auth.ts             # JWT validation against Auth0 JWKS
    │   ├── error.ts            # Global error handler (AppError hierarchy)
    │   └── logger.ts           # Request logging
    ├── services/
    │   ├── auth.ts             # Auth0 device code proxy, token exchange, JWKS cache
    │   ├── rooms.ts            # Room CRUD, membership management
    │   ├── events.ts           # Event insert, query (since + TTL filtering), cleanup
    │   └── presence.ts         # Derived presence view from recent session.signal events
    ├── db/
    │   ├── client.ts           # bun:sqlite client init, pragma setup
    │   └── migrate.ts          # Schema creation (CREATE TABLE IF NOT EXISTS)
    └── lib/
        ├── config.ts           # Env var loading + validation at startup
        ├── errors.ts           # AppError, NotFoundError, etc.
        └── ulid.ts             # ULID generation for event IDs
```

Dependencies: `hono`, `@hono/zod-validator`, `zod`, `@agentsmith/shared`

Key patterns:
- Routes are thin — delegate to services
- Zod validation on all request inputs
- Consistent error response format (`{ error, message }`)
- `bun:sqlite` for database (no external dep)
- DB migration runs at startup (CREATE TABLE IF NOT EXISTS)
- Background cleanup interval for expired events

---

## packages/plugin

Claude Code plugin: hook subscriber + compiled binary.

```
packages/plugin/
├── package.json                # name: @agentsmith/plugin
├── tsconfig.json
├── plugin.json                 # Claude Code plugin manifest
└── src/
    ├── cli.ts                  # Entry point — parses args
    ├── hooks/
    │   └── handler.ts          # Hook dispatch: classify hook event → signal
    ├── signals/
    │   └── mapper.ts           # Hook-to-signal mapping table
    ├── net/
    │   ├── client.ts           # HTTP client — emit/pull events (fire-and-forget)
    │   └── auth.ts             # Token load, refresh, device code flow
    ├── store/
    │   ├── config.ts           # Read/write ~/.config/agentsmith/config.json
    │   ├── auth.ts             # Read/write ~/.config/agentsmith/auth.json (0600)
    │   └── events.ts           # File-per-event queue: read, write, expire, cleanup
    └── room/
        └── prompt.ts           # Interactive TTY room selection (first-run UX)
```

Build scripts in `package.json`:

```json
{
  "scripts": {
    "build": "bun run build:darwin-arm64 && bun run build:darwin-x64 && bun run build:linux-x64",
    "build:darwin-arm64": "bun build --compile --target=bun-darwin-arm64 --outfile=bin/agentsmith-darwin-arm64 src/cli.ts",
    "build:darwin-x64": "bun build --compile --target=bun-darwin-x64 --outfile=bin/agentsmith-darwin-x64 src/cli.ts",
    "build:linux-x64": "bun build --compile --target=bun-linux-x64 --outfile=bin/agentsmith-linux-x64 src/cli.ts",
    "build:local": "bun build --compile --outfile=bin/agentsmith src/cli.ts"
  }
}
```

Dependencies: `@agentsmith/shared` only. No runtime deps beyond Bun built-ins.

---

## Dev Experience & Root Scripts

```json
{
  "scripts": {
    "dev:api": "bun run --watch packages/api/src/index.ts",
    "build:api": "bun build --target=bun --outdir=packages/api/dist packages/api/src/index.ts",
    "build:plugin": "bun run --filter @agentsmith/plugin build:local",
    "build:plugin:all": "bun run --filter @agentsmith/plugin build",
    "test": "bun test",
    "test:api": "bun test packages/api",
    "test:plugin": "bun test packages/plugin",
    "lint": "bunx biome check .",
    "format": "bunx biome format --write .",
    "typecheck": "bun run typecheck:shared && bun run typecheck:api && bun run typecheck:plugin",
    "typecheck:shared": "tsc --noEmit -p packages/shared",
    "typecheck:api": "tsc --noEmit -p packages/api",
    "typecheck:plugin": "tsc --noEmit -p packages/plugin"
  }
}
```

Tooling:
- **Biome** for linting + formatting
- **bun:test** for all testing
- **tsc --noEmit** for type checking
- **bun --watch** for API dev server with hot reload

---

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Monorepo approach | Flat `packages/` | Simple, 3 packages doesn't warrant apps/packages split |
| Shared code | `@agentsmith/shared` workspace package | Single source of truth for types, schemas, constants |
| UI | Deferred | Not needed for v1 foundations; add as `packages/ui` later |
| Binary builds | Cross-platform via package.json scripts | macOS arm64, macOS x64, Linux x64 |
| Docker | Dockerfile only | No docker-compose; run manually or via scripts |
| Linter/Formatter | Biome | Fast, single tool, Bun-native |
| Test runner | bun:test | Built-in, zero config |
