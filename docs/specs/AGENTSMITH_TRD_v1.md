# AgentSmith — Technical Requirements Document (v1 Foundations)

**Status:** Draft  
**Stack:** Bun · Hono · SQLite · Auth0 · Docker  
**Paired with:** AgentSmith PRD v1

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [Technology Stack](#2-technology-stack)
3. [Authentication](#3-authentication)
4. [Database Schema](#4-database-schema)
5. [Server API](#5-server-api)
6. [Claude Code Plugin](#6-claude-code-plugin)
7. [Event Model](#7-event-model)
8. [Local State & Configuration](#8-local-state--configuration)
9. [Privacy Enforcement](#9-privacy-enforcement)
10. [Deployment](#10-deployment)
11. [v1 Constraints & Deferred Work](#11-v1-constraints--deferred-work)

---

## 1. System Architecture

AgentSmith consists of three runtime components:

```
┌────────────────────────────────────────────────────────────────┐
│  Developer Machine                                             │
│                                                                │
│  ┌─────────────────────────────┐                               │
│  │  Claude Code Session        │                               │
│  │  ┌──────────────────────┐   │                               │
│  │  │  AgentSmith Plugin   │   │  HTTP (fire & forget)         │
│  │  │  (Hook Subscriber)   │──────────────────────────────┐   │
│  │  └──────────┬───────────┘   │                          │   │
│  │             │ spawns        │                          │   │
│  │  ┌──────────▼───────────┐   │                          ▼   │
│  │  │  agentsmith binary   │◄──────────────────── AgentSmith  │
│  │  │  (Bun compiled)      │──────────────────────  Server   │
│  │  └──────────────────────┘   │                   (Bun/Hono) │
│  └─────────────────────────────┘                          │   │
│                                                            │   │
│  ┌─────────────────────────────┐                          │   │
│  │  ~/.config/agentsmith/      │                          │   │
│  │  config.json (room mapping) │                          │   │
│  │  queue.json  (event queue)  │                          │   │
│  └─────────────────────────────┘                          │   │
└───────────────────────────────────────────────────────────┼───┘
                                                            │
                                              ┌─────────────▼──┐
                                              │  Web Canvas     │
                                              │  (polling)      │
                                              └─────────────────┘
```

### Component Summary

| Component | Runtime | Role |
|---|---|---|
| AgentSmith Server | Bun + Hono | Event store, auth, room coordination |
| Claude Code Plugin | Claude Code Plugin API | Hook subscriber, binary spawner |
| agentsmith binary | Bun compiled | Event emit, pull, local queue management |
| Web Canvas | Browser | Avatar rendering (separate codebase) |
| SQLite | better-sqlite3 / bun:sqlite | Persistent event store |
| Auth0 | Managed | OAuth broker (Google, GitHub) |

---

## 2. Technology Stack

### Server

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Bun | Single binary, fast startup |
| HTTP Framework | Hono | Lightweight, typed routes |
| Database | SQLite via `bun:sqlite` | File-backed, no external dependency |
| Auth Provider | Auth0 | Brokers Google + GitHub OAuth |
| Token Validation | Auth0 JWT (RS256) | Server validates via JWKS endpoint |
| Containerization | Docker | Single container, SQLite on volume |

### Plugin Binary

| Concern | Choice | Notes |
|---|---|---|
| Language | TypeScript | Same as server |
| Compiler | `bun build --compile` | Single self-contained binary |
| Distribution | Bundled with Claude Code plugin | Checked in, no install step |

---

## 3. Authentication

### 3.1 Flow Overview

AgentSmith uses Auth0 as its identity broker. Auth0 is configured with two social connections: **Google** and **GitHub**.

The Claude Code plugin uses **OAuth Device Authorization Grant** (RFC 8628) — no browser redirect, no localhost server.

The Web Canvas uses the standard **OAuth Authorization Code + PKCE** flow via Auth0.

### 3.2 Device Code Flow (Claude Code Plugin)

```
1. Binary calls POST /api/v1/auth/device
   → Server proxies to Auth0 device authorization endpoint
   → Returns { device_code, user_code, verification_uri, expires_in, interval }

2. Binary prints to stdout:
   "Visit https://agentsmith.dev/activate and enter: XXXX-YYYY"

3. Binary polls POST /api/v1/auth/token every `interval` seconds
   → Server proxies token poll to Auth0
   → On success: returns { access_token, refresh_token, expires_in }

4. Binary stores tokens in ~/.config/agentsmith/auth.json
```

### 3.3 Token Storage

Tokens are persisted locally at:

- **macOS/Linux:** `~/.config/agentsmith/auth.json`
- **Windows:** `%APPDATA%\agentsmith\auth.json`

File permissions must be `0600`.

### 3.4 Token Refresh

On every binary invocation, if `expires_at - now < 5 minutes`, the binary silently refreshes using the stored `refresh_token` before performing any operation.

### 3.5 Server-Side Validation

Every API request must include:

```
Authorization: Bearer <auth0_access_token>
```

The server validates the JWT against Auth0's JWKS endpoint (`https://<tenant>.auth0.com/.well-known/jwks.json`). JWKS keys are cached in memory with a 1-hour TTL.

The server extracts `sub` (Auth0 user ID) and `email` from the verified token claims.

---

## 4. Database Schema

SQLite database path: `/data/agentsmith.db` (Docker volume mount).

### 4.1 Tables

```sql
-- Users
CREATE TABLE users (
  id          TEXT PRIMARY KEY,  -- Auth0 sub (e.g. "github|12345")
  email       TEXT NOT NULL,
  display_name TEXT,
  created_at  INTEGER NOT NULL   -- Unix timestamp ms
);

-- Rooms
CREATE TABLE rooms (
  id          TEXT PRIMARY KEY,  -- ULID
  name        TEXT NOT NULL UNIQUE,
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  INTEGER NOT NULL
);

-- Room membership (implicit on first event; explicit on room selection)
CREATE TABLE room_members (
  room_id     TEXT NOT NULL REFERENCES rooms(id),
  user_id     TEXT NOT NULL REFERENCES users(id),
  joined_at   INTEGER NOT NULL,
  PRIMARY KEY (room_id, user_id)
);

-- Events
CREATE TABLE events (
  id          TEXT PRIMARY KEY,   -- ULID (lexicographically sortable, used as cursor)
  room_id     TEXT NOT NULL REFERENCES rooms(id),
  sender_id   TEXT NOT NULL REFERENCES users(id),
  event_type  TEXT NOT NULL,      -- e.g. "session.signal"
  payload     TEXT NOT NULL,      -- JSON blob (opaque to server)
  ttl_seconds INTEGER NOT NULL,   -- server-defined per event_type
  created_at  INTEGER NOT NULL,   -- Unix timestamp ms, used for ordering
  expires_at  INTEGER NOT NULL    -- created_at + ttl_seconds * 1000
);

CREATE INDEX idx_events_room_created ON events(room_id, created_at);
CREATE INDEX idx_events_expires      ON events(expires_at);
```

### 4.2 Ordering & Cursors

Events are ordered by `created_at` (Unix ms). Clients poll using `since` (a timestamp cursor) and receive all events where `created_at > since` and `expires_at > now`.

ULIDs are used as event IDs — they are time-prefixed and lexicographically sortable, providing a convenient secondary ordering guarantee if two events share an identical millisecond timestamp.

### 4.3 TTL Enforcement

Expired events (`expires_at < now`) are excluded from all query results. A background cleanup task runs every 5 minutes to DELETE expired rows:

```sql
DELETE FROM events WHERE expires_at < unixepoch() * 1000
```

---

## 5. Server API

Base path: `/api/v1`

All endpoints require `Authorization: Bearer <token>` unless marked public.

---

### 5.1 Auth Endpoints

#### `POST /api/v1/auth/device`

Initiate device code flow.

**Response 200:**
```json
{
  "device_code": "...",
  "user_code": "ABCD-1234",
  "verification_uri": "https://agentsmith.dev/activate",
  "expires_in": 300,
  "interval": 5
}
```

---

#### `POST /api/v1/auth/token`

Poll for device authorization result.

**Request:**
```json
{ "device_code": "..." }
```

**Response 200 (authorized):**
```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_in": 3600
}
```

**Response 202 (pending):**
```json
{ "status": "authorization_pending" }
```

**Response 400 (expired/denied):**
```json
{ "error": "expired_token" | "access_denied" }
```

---

### 5.2 Room Endpoints

#### `GET /api/v1/rooms`

List all rooms the authenticated user has access to (v1: all rooms).

**Response 200:**
```json
{
  "rooms": [
    {
      "id": "01J...",
      "name": "backend-team",
      "created_by": "github|12345",
      "created_at": 1700000000000,
      "member_count": 4
    }
  ]
}
```

---

#### `POST /api/v1/rooms`

Create a new room.

**Request:**
```json
{ "name": "backend-team" }
```

**Validation:** `name` must match `^[a-z0-9-]{2,48}$`

**Response 201:**
```json
{
  "id": "01J...",
  "name": "backend-team",
  "created_by": "github|12345",
  "created_at": 1700000000000
}
```

**Response 409:** Room name already taken.

---

#### `GET /api/v1/rooms/:roomId`

Get room details.

**Response 200:**
```json
{
  "id": "01J...",
  "name": "backend-team",
  "created_by": "github|12345",
  "created_at": 1700000000000,
  "members": [
    { "user_id": "github|12345", "display_name": "alice", "joined_at": 1700000000000 }
  ]
}
```

---

### 5.3 Event Endpoints

#### `POST /api/v1/rooms/:roomId/events`

Emit an event to a room.

**Request:**
```json
{
  "event_type": "session.signal",
  "payload": { ... }
}
```

**Server behavior:**
- Validates JWT, validates room membership (joins implicitly if first event)
- Assigns `seq`, `ttl_seconds` (from event_type config), `expires_at`
- Inserts into SQLite
- Enforces payload size limit: **64KB**

**Response 201:**
```json
{
  "id": "01J...",
  "room_id": "01J...",
  "created_at": 1700000000000,
  "expires_at": 1700000300000
}
```

**Response 413:** Payload exceeds 64KB.
**Response 429:** Rate limit exceeded (stub in v1 — returns 201 always).

---

#### `GET /api/v1/rooms/:roomId/events?since=T`

Pull events with `created_at > T`. Omits expired events.

**Query params:**
- `since` (required): Unix timestamp ms. Use `0` for initial pull.
- `limit` (optional): max events to return, default 50, max 200.

**Response 200:**
```json
{
  "events": [
    {
      "id": "01J...",
      "room_id": "01J...",
      "sender_id": "github|12345",
      "event_type": "session.signal",
      "payload": { ... },
      "ttl_seconds": 300,
      "created_at": 1700000000000,
      "expires_at": 1700000300000
    }
  ],
  "latest_ts": 1700000000000
}
```

**Notes:**
- Clients store `latest_ts` and use it as `since` on next poll.
- If no new events: returns `{ "events": [], "latest_ts": T }`.
- Events are returned ordered by `created_at` ascending.
- Expired events are excluded even if `created_at > since`.

---

### 5.4 Session / Avatar State Endpoint (for Web Canvas)

#### `GET /api/v1/rooms/:roomId/presence`

Returns the latest coarse state signal per active session in the room. "Active" means a `session.signal` event with `event_type = session.signal` received within the last 10 minutes.

**Response 200:**
```json
{
  "sessions": [
    {
      "user_id": "github|12345",
      "display_name": "alice",
      "session_id": "sess_abc123",
      "signal": "BuildFailed",
      "updated_at": 1700000000000
    }
  ]
}
```

This endpoint is a computed view — the server derives it from recent events in SQLite. It is not a separate data model.

---

### 5.5 Error Format

All errors return:

```json
{
  "error": "short_code",
  "message": "Human readable description"
}
```

Standard HTTP status codes apply: `400`, `401`, `403`, `404`, `409`, `413`, `429`, `500`.

---

### 5.6 TTL Configuration (Server-Side)

TTL values are defined in server configuration per event type. In v1 this is a static map:

```typescript
const TTL_SECONDS: Record<string, number> = {
  "session.signal": 600,   // 10 minutes
  "session.started": 86400, // 1 day
  "session.ended": 300,
  "interaction": 120,
};
const DEFAULT_TTL_SECONDS = 300;
```

---

## 6. Claude Code Plugin

### 6.1 Plugin Structure

The AgentSmith Claude Code plugin is packaged per the Claude Code Plugin API. It registers hooks and declares a compiled binary as its executor.

```
agentsmith-plugin/
├── plugin.json          # Plugin manifest
├── bin/
│   └── agentsmith       # Bun-compiled binary (platform-specific)
└── README.md
```

### 6.2 Plugin Manifest (`plugin.json`)

```json
{
  "name": "agentsmith",
  "version": "1.0.0",
  "hooks": {
    "PreToolUse":    { "command": "bin/agentsmith hook --event PreToolUse" },
    "PostToolUse":   { "command": "bin/agentsmith hook --event PostToolUse" },
    "Stop":          { "command": "bin/agentsmith hook --event Stop" },
    "Notification":  { "command": "bin/agentsmith hook --event Notification" }
  }
}
```

### 6.3 Binary Behavior on Hook Invocation

On every hook call the binary executes the following steps sequentially. Total wall time must remain under **200ms** to avoid affecting Claude's responsiveness.

```
1. Load config (~/.config/agentsmith/config.json)
2. Resolve room for current working directory
   → If no room mapped: prompt user (interactive TTY only), then save mapping
3. Validate / refresh auth token if needed
4. Scan events/{room_id}/ — delete expired files, collect pending outbound/inbound
5. Classify hook event → derive coarse signal (may be nil)
6. If signal derived: write new outbound event file to events/{room_id}/{ts}.json
7. Attempt to emit all outbound files to server (fire-and-forget); delete on success
8. Pull new events from server (since last_seen_ts in config.json)
   → Write each pulled event as an inbound file to events/{room_id}/{ts}.json
   → Update last_seen_ts in config.json
9. Apply all inbound files locally; delete each on success
10. Exit 0
```

Network calls (steps 5b and 6) are non-blocking: the binary does not wait for a response before exiting. They are fire-and-forget via async Bun APIs flushed before exit.

### 6.4 Hook-to-Signal Mapping

| Hook | Condition | Signal Emitted |
|---|---|---|
| `PreToolUse` | tool = `run_command` | `CommandRunning` |
| `PostToolUse` | tool = `run_command`, exit_code = 0 | `BuildSucceeded` or `TestsPassed` (heuristic on command) |
| `PostToolUse` | tool = `run_command`, exit_code != 0 | `BuildFailed` or `TestsFailed` |
| `PostToolUse` | token usage > 80% of context | `HighTokenUsage` |
| `PostToolUse` | token usage < 20% of context | `LowTokenUsage` |
| `Stop` | reason = `idle` | `Idle` |
| `Stop` | reason = `end_of_session` | `SessionEnded` |
| `Notification` | type = `session_start` | `SessionStarted` |
| `Notification` | type = `waiting_for_input` | `WaitingForInput` |
| Any | command runtime > 30s | `LongRunningCommand` |

If no condition matches, no signal is emitted. The hook call is a no-op.

### 6.5 Room Prompt (First-Run UX)

When the binary detects no room mapping for the current working directory and is running in an interactive TTY:

```
AgentSmith: No room linked to this project.

  [1] backend-team
  [2] frontend-squad
  [3] + Create new room

Select: _
```

The user selects a room or types a new name. The mapping is persisted immediately to `config.json`. On non-interactive invocations (CI, piped), the binary exits silently without prompting.

---

## 7. Event Model

### 7.1 Event Schema (Wire Format)

All events follow this envelope. The `payload` is opaque to the server.

```typescript
interface Event {
  id: string;          // ULID assigned by server (lexicographically sortable)
  room_id: string;
  sender_id: string;   // Auth0 sub
  event_type: string;  // Namespaced: "session.signal", "interaction", etc.
  payload: unknown;    // JSON object, max 64KB, server does not inspect
  ttl_seconds: number; // Assigned by server based on event_type
  created_at: number;  // Unix ms — primary ordering key
  expires_at: number;  // created_at + ttl_seconds * 1000
}
```

### 7.2 Session Signal Payload

```typescript
interface SessionSignalPayload {
  session_id: string;   // Opaque client-generated ID, stable per CC session
  signal: SessionSignal;
}

type SessionSignal =
  | "SessionStarted"
  | "SessionEnded"
  | "Idle"
  | "CommandRunning"
  | "LongRunningCommand"
  | "WaitingForInput"
  | "BuildSucceeded"
  | "BuildFailed"
  | "TestsPassed"
  | "TestsFailed"
  | "HighTokenUsage"
  | "LowTokenUsage";
```

### 7.3 Interaction Payload (Web → Plugin)

```typescript
interface InteractionPayload {
  target_session_id?: string;  // Optional: directed at specific session
  interaction_type: string;    // e.g. "ping", "nudge" — client-defined semantics
  data?: unknown;              // Interaction-specific data
}
```

### 7.4 Extensibility

New `event_type` values are added to the server TTL config and consumed by clients without server redesign. The server never inspects `payload` content.

---

## 8. Local State & Configuration

### 8.1 Directory Conventions

| OS | Path |
|---|---|
| macOS / Linux | `~/.config/agentsmith/` |
| Windows | `%APPDATA%\agentsmith\` |

### 8.2 `config.json`

```json
{
  "version": 1,
  "server_url": "https://api.agentsmith.dev",
  "projects": {
    "/Users/alice/work/backend": {
      "room_id": "01J...",
      "room_name": "backend-team"
    }
  }
}
```

### 8.3 `auth.json`

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "expires_at": 1700003600000
}
```

File mode: `0600`. Never logged, never emitted.

### 8.4 Event Store (File-per-Event)

Instead of a queue file, each event is stored as an individual JSON file on disk. The filesystem is the queue.

**Directory layout:**

```
~/.config/agentsmith/
  events/
    {room_id}/
      {created_at_ms}.json     -- e.g. 1700000000123.json
```

Each file contains a single event envelope:

```json
{
  "id": "01J...",
  "room_id": "01J...",
  "sender_id": "github|12345",
  "event_type": "session.signal",
  "payload": { "session_id": "sess_abc", "signal": "BuildFailed" },
  "ttl_seconds": 600,
  "created_at": 1700000000123,
  "expires_at": 1700000600123,
  "direction": "inbound" | "outbound"
}
```

The `direction` field distinguishes events pending emit (`outbound`) from events pulled from the server and pending local application (`inbound`).

**Binary behavior on each hook invocation:**

1. Read all files in `events/{room_id}/`, sorted by filename (= timestamp order)
2. Discard any file where `expires_at < now` (delete the file)
3. Process `outbound` files: attempt to emit to server, delete file on success
4. Process `inbound` files: apply locally, delete file on success
5. Write new outbound event file if a signal was derived
6. Write new inbound event files from server pull response
7. Update `last_seen_ts` in `config.json`

**Collision handling:** If two events share the same millisecond timestamp, append a counter suffix: `1700000000123_1.json`, `1700000000123_2.json`.

**No capacity limit** — the filesystem is the bound. Old expired files are cleaned up on every invocation.

---

## 9. Privacy Enforcement

### 9.1 Binary Enforcement

The binary is the only code that observes the local Claude session. It must enforce:

- No file paths in any emitted payload
- No code content, diffs, or error text
- No Claude message content
- No prompt content
- No stack traces
- Signals are coarse state only (enum values from the allowed set)

### 9.2 Server Enforcement

The server enforces payload size (64KB max) but does not inspect payload semantics. Privacy enforcement is solely the plugin's responsibility.

### 9.3 Audit

In v1, there is no server-side audit of payload content. This is a known v1 limitation. Future versions may introduce schema validation per event type.

---

## 10. Deployment

### 10.1 Dockerfile

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun build --target=bun --outdir=dist src/server.ts

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

VOLUME /data
EXPOSE 3000

ENV DATABASE_PATH=/data/agentsmith.db
ENV AUTH0_DOMAIN=
ENV AUTH0_AUDIENCE=
ENV PORT=3000

CMD ["bun", "run", "dist/server.js"]
```

### 10.2 Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_PATH` | Yes | SQLite file path (should be on a volume) |
| `AUTH0_DOMAIN` | Yes | e.g. `agentsmith.us.auth0.com` |
| `AUTH0_AUDIENCE` | Yes | API identifier registered in Auth0 |
| `AUTH0_CLIENT_ID` | Yes | For device code flow proxy |
| `AUTH0_CLIENT_SECRET` | Yes | For device code flow proxy |
| `PORT` | No | Default `3000` |
| `PAYLOAD_MAX_BYTES` | No | Default `65536` (64KB) |
| `CLEANUP_INTERVAL_MS` | No | Default `300000` (5 min) |

### 10.3 Volume

Mount `/data` as a persistent Docker volume. The SQLite database file must survive container restarts.

### 10.4 Health Check

```
GET /health → 200 { "status": "ok", "db": "connected" }
```

---

## 11. v1 Constraints & Deferred Work

| Area | v1 Behavior | Future |
|---|---|---|
| Transport | HTTP polling only | SSE / WebSocket |
| Rate limiting | Stub (always 201) | Per-user + per-room limits |
| ACKs | Not implemented | Full lifecycle ACK model |
| Permission model | All authenticated users see all rooms | RBAC, invite model |
| Payload validation | Size only (64KB) | Schema validation per event type |
| Plugin binary | Bun compiled | Port to Go for startup perf |
| Event local store | File-per-event on disk (`events/{room_id}/{ts}.json`) | — |
| Presence granularity | Last signal per session | Richer avatar state machine |
| Multiple rooms per project | One room per directory | Multi-room support |

---

*AgentSmith TRD v1 — generated from 20-question design session*
