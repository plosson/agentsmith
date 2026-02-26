# API Flows

Sequence diagrams for the AgentSmith event fabric.

## Actors

```
Plugin    = Claude Code plugin (emit.sh)
Proxy     = Local Bun proxy (proxy.ts), started by init.sh
Server    = Remote API server (Hono + SQLite)
Canvas    = Web canvas (browser UI)
```

---

## 1. Session Startup

Plugin boots, proxy starts, config is loaded.

```
  Plugin (init.sh)              Proxy                     Server
  ===============              =====                     ======
       |                         |                         |
       |--- start proxy.ts ----->|                         |
       |                         |-- bind localhost:PORT -->|
       |<-- write CLIENT_URL ----|                         |
       |                         |                         |
       |-- load config ----------|                         |
       |   ~/.config/agentsmith/ |                         |
       |   .claude/agentsmith/   |                         |
       |                         |                         |
       |-- export env vars ----->|                         |
       |   AGENTSMITH_CLIENT_URL |                         |
       |   AGENTSMITH_KEY        |                         |
       |   AGENTSMITH_ROOM       |                         |
       |   AGENTSMITH_USER       |                         |
       |                         |                         |
       |-- GET /health --------->|                         |
       |<-- {systemMessage} -----|                         |
       |   (mode, url, room)     |                         |
       |                         |                         |
```

---

## 2. Plugin Emits Event (Broadcast)

Plugin hook fires, event flows to server, no targeted messages waiting.

```
  Plugin (emit.sh)              Proxy                     Server
  ===============              =====                     ======
       |                         |                         |
       |-- extract session_id    |                         |
       |   from hook JSON        |                         |
       |                         |                         |
       |-- POST /rooms/R/events  |                         |
       |   {                     |                         |
       |     room_id, type,      |                         |
       |     format,             |                         |
       |     sender: {user_id,   |                         |
       |       session_id},      |                         |
       |     payload             |                         |
       |   }                     |                         |
       |------------------------>|                         |
       |                         |-- POST /rooms/R/events  |
       |                         |   + Bearer token        |
       |                         |------------------------>|
       |                         |                         |
       |                         |                         |-- validate token
       |                         |                         |-- upsert user
       |                         |                         |-- check room exists
       |                         |                         |-- validate room_id match
       |                         |                         |-- validate payload size
       |                         |                         |-- auto-join room
       |                         |                         |-- insert event
       |                         |                         |-- consume targeted → []
       |                         |                         |
       |                         |<-- 201 -----------------|
       |                         |   {                     |
       |                         |     id, room_id,        |
       |                         |     created_at,         |
       |                         |     expires_at,         |
       |                         |     messages: []        |
       |                         |   }                     |
       |<-- 201 -----------------|                         |
       |                         |                         |
```

---

## 3. Targeted Message Delivery (Full Round-Trip)

Canvas sends a message to a specific plugin session. On the plugin's
next event emit, the server returns the message in the response.

```
  Canvas                        Server                    Proxy              Plugin
  ======                        ======                    =====              ======
     |                            |                         |                  |
     |-- POST /rooms/R/events --->|                         |                  |
     |   {                        |                         |                  |
     |     room_id, type,         |                         |                  |
     |     format: "canvas_v1",   |                         |                  |
     |     sender: {user_id:      |                         |                  |
     |       "bob@test.com"},     |                         |                  |
     |     target: {user_id:      |                         |                  |
     |       "alice@test.com",    |                         |                  |
     |       session_id:          |                         |                  |
     |       "sess-1" (optional)  |                         |                  |
     |     },                     |                         |                  |
     |     payload: {action:"go"} |                         |                  |
     |   }                        |                         |                  |
     |                            |-- insert event -------->|                  |
     |                            |   (target_user_id set)  |                  |
     |<-- 201 messages:[] --------|                         |                  |
     |                            |                         |                  |
     :   ... time passes ...      :                         :                  :
     |                            |                         |                  |
     |                            |                         |<-- hook fires ----|
     |                            |                         |                  |
     |                            |<-- POST /rooms/R/events |                  |
     |                            |   {                     |                  |
     |                            |     room_id, type:      |                  |
     |                            |       "hook.Stop",      |                  |
     |                            |     format:             |                  |
     |                            |       "claude_code_v27",|                  |
     |                            |     sender: {user_id:   |                  |
     |                            |       "alice@test.com", |                  |
     |                            |       session_id:       |                  |
     |                            |       "sess-1"},        |                  |
     |                            |     payload: {...}      |                  |
     |                            |   }                     |                  |
     |                            |                         |                  |
     |                            |-- insert broadcast      |                  |
     |                            |-- consume targeted:     |                  |
     |                            |   WHERE target_user_id  |                  |
     |                            |     = sender.user_id    |                  |
     |                            |   AND (target_session   |                  |
     |                            |     IS NULL OR          |                  |
     |                            |     = sender.session_id)|                  |
     |                            |-- DELETE consumed rows  |                  |
     |                            |                         |                  |
     |                            |-- 201 ----------------->|                  |
     |                            |   {                     |                  |
     |                            |     id, room_id, ...,   |                  |
     |                            |     messages: [         |                  |
     |                            |       {action: "go"}    |                  |
     |                            |     ]                   |                  |
     |                            |   }                     |                  |
     |                            |                         |-- enqueue msg -->|
     |                            |                         |   to disk queue  |
     |                            |                         |                  |
```

---

## 4. Targeting Modes

```
  +--------------------------+----------------------------+-------------------+
  | Mode                     | Fields Set                 | Who Receives      |
  +--------------------------+----------------------------+-------------------+
  | Room broadcast           | no target                  | All via GET poll  |
  | User broadcast           | target.user_id             | Any session of    |
  |                          |                            | that user         |
  | Session-specific         | target.user_id +           | Only that session |
  |                          | target.session_id          |                   |
  +--------------------------+----------------------------+-------------------+
```

Targeted events are **consumed on read** (deleted after delivery) and
**excluded from GET polling** (only broadcast events appear in polls).

---

## 5. Web Canvas Polls Events

Canvas polls for broadcast events to render presence and activity.

```
  Canvas                        Server
  ======                        ======
     |                            |
     |-- GET /rooms/R/events ---->|
     |   ?since=1234&limit=50    |
     |   &format=canvas_v1       |  (optional transform)
     |                            |
     |                            |-- SELECT * FROM events
     |                            |   WHERE room_id = R
     |                            |     AND created_at > since
     |                            |     AND expires_at > now
     |                            |     AND target_user_id IS NULL
     |                            |   ORDER BY created_at ASC
     |                            |   LIMIT 50
     |                            |-- transform each event
     |                            |   if ?format specified
     |                            |
     |<-- 200 -------------------|
     |   {                        |
     |     events: [              |
     |       { id, room_id,       |
     |         type, format,      |
     |         sender: {user_id,  |
     |           session_id},     |
     |         target,            |
     |         payload,           |
     |         created_at, ... }  |
     |     ],                     |
     |     latest_ts: 1234567890  |
     |   }                        |
     |                            |
```

---

## 6. Presence Query

Canvas fetches which sessions are currently active.

```
  Canvas                        Server
  ======                        ======
     |                            |
     |-- GET /rooms/R/presence -->|
     |                            |
     |                            |-- SELECT latest event
     |                            |   per sender_session_id
     |                            |   WHERE not expired
     |                            |     AND created < 10 min ago
     |                            |     AND type != SessionEnd
     |                            |   GROUP BY sender_session_id
     |                            |   (MAX rowid per group)
     |                            |-- derive signal from type
     |                            |   (Stop→Idle, etc.)
     |                            |
     |<-- 200 -------------------|
     |   {                        |
     |     sessions: [            |
     |       { user_id,           |
     |         display_name,      |
     |         session_id,        |
     |         signal,            |
     |         updated_at }       |
     |     ]                      |
     |   }                        |
     |                            |
```

---

## 7. Room Management

```
  Client                        Server
  ======                        ======
     |                            |
     |-- POST /rooms ----------->|   Create room
     |   { name: "my-room" }     |   (name must match ^[a-z0-9-]{2,48}$)
     |<-- 201 { id, name, ... }  |
     |                            |
     |-- GET /rooms ------------>|   List rooms
     |<-- 200 { rooms: [...] }   |
     |                            |
     |-- GET /rooms/:id -------->|   Get room + members
     |<-- 200 { id, members }    |
     |                            |
```

---

## 8. Auth Flow

All `/api/*` routes require a Bearer token.

```
  Client                        Server (auth middleware)
  ======                        =======================
     |                            |
     |-- Authorization: Bearer -->|
     |   base64({sub, email})     |
     |                            |-- decode base64
     |                            |-- parse JSON
     |                            |-- validate sub + email
     |                            |-- upsert users table
     |                            |     (id=sub, email=email)
     |                            |-- set context:
     |                            |     userId  = sub
     |                            |     userEmail = email
     |                            |
     |                            |-- continue to route --->
     |                            |
```

---

## Identity Model

```
  +------------------+---------------------+---------------------------+
  | Concept          | Identifier          | Source                    |
  +------------------+---------------------+---------------------------+
  | User (internal)  | sub (Auth0)         | Token "sub" claim → PK   |
  | User (on events) | email               | sender.user_id in body    |
  | Session          | sender.session_id   | Extracted from hook JSON  |
  | Room             | ULID                | URL path parameter        |
  +------------------+---------------------+---------------------------+
```

Events use **email** as `sender.user_id` and `target.user_id` — stable,
human-readable, and decoupled from auth provider internals. Currently
`sender.user_id` is trusted from the request body (no auth-derived identity
yet). The `users` table uses Auth0 `sub` as its primary key for internal lookups.
