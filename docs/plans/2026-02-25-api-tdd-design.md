# AgentSmith API — TDD Implementation Design

**Date:** 2026-02-25
**Goal:** Implement the full API (rooms, events, presence) using TDD with mock auth, tested via `app.request()` simulating plugin CLI and web UI clients.

---

## Architecture

Approach 1: Routes + inline DB queries. No service layer.

```
packages/api/src/
├── app.ts                    # Hono app, mounts route groups
├── index.ts                  # Bun.serve entry
├── db/
│   ├── client.ts             # existing - getDb/closeDb
│   ├── migrate.ts            # existing - schema
│   ├── users.ts              # upsertUser, getUserById
│   ├── rooms.ts              # createRoom, listRooms, getRoomWithMembers, addMember
│   └── events.ts             # insertEvent, queryEvents, deleteExpired
├── routes/
│   ├── rooms.ts              # GET /rooms, POST /rooms, GET /rooms/:roomId
│   ├── events.ts             # POST /rooms/:roomId/events, GET /rooms/:roomId/events
│   └── presence.ts           # GET /rooms/:roomId/presence
├── middleware/
│   ├── auth.ts               # stub JWT → injects userId into context
│   ├── error.ts              # existing
│   └── logger.ts             # existing
└── lib/
    ├── config.ts             # existing
    ├── errors.ts             # existing
    └── ulid.ts               # existing
```

## Auth Middleware (Stub)

Reads `Authorization: Bearer <token>`. In stub mode, token is base64-encoded JSON `{ sub, email }`. Injects `userId` and `userEmail` into Hono context. Tests create tokens trivially. Swapped for real Auth0 JWKS later without changing route code.

## API Endpoints (all under `/api/v1`)

### Rooms
- `GET /api/v1/rooms` → `{ rooms: [{ id, name, created_by, created_at, member_count }] }`
- `POST /api/v1/rooms` → body `{ name }`, validates `^[a-z0-9-]{2,48}$`, 409 on conflict
- `GET /api/v1/rooms/:roomId` → room with members array, 404 if missing

### Events
- `POST /api/v1/rooms/:roomId/events` → body `{ event_type, payload }`, max 64KB payload, auto-joins room, assigns TTL, returns `{ id, room_id, created_at, expires_at }` (201)
- `GET /api/v1/rooms/:roomId/events?since=T&limit=50` → filters expired, orders by created_at ASC, returns `{ events, latest_ts }`

### Presence
- `GET /api/v1/rooms/:roomId/presence` → latest `session.signal` per session_id within 10 min, returns `{ sessions: [{ user_id, display_name, session_id, signal, updated_at }] }`

## Test Strategy

- Each test file creates an in-memory SQLite DB, runs migrations, builds a fresh Hono app
- Tests use `app.request()` (Hono's built-in test helper)
- Two client personas simulated:
  - **Plugin client** — emits `session.signal` events, polls events
  - **Web UI client** — lists rooms, reads presence, sends interactions
- Coverage: happy paths, validation errors, 404s, 409 conflicts, TTL expiry, auto-join, payload limits

## Build Order (TDD per feature)

1. Auth middleware stub + test helper
2. DB queries: `db/users.ts`, `db/rooms.ts`
3. Room routes + tests
4. DB queries: `db/events.ts`
5. Event routes + tests
6. Presence route + tests
7. Background cleanup (expired events)
