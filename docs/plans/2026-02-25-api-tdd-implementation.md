# AgentSmith API — TDD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement all API routes (rooms, events, presence) using TDD with mock auth, tested via `app.request()` simulating plugin CLI and web UI clients.

**Architecture:** Routes call DB query modules directly (no service layer). Auth middleware stubs inject user identity. Each test creates an in-memory SQLite DB with migrations.

**Tech Stack:** Bun 1.3+, Hono 4.11+, Zod 4+, SQLite (bun:sqlite), @hono/zod-validator

---

### Task 1: Test Helper & Auth Middleware Stub

**Files:**
- Create: `packages/api/src/test-utils.ts`
- Create: `packages/api/src/middleware/auth.ts`
- Test: `packages/api/src/middleware/auth.test.ts`

**Step 1: Create test helper**

Create `packages/api/src/test-utils.ts`. This module creates a fresh in-memory DB, runs migrations, and builds a testable Hono app. Every test file will use this.

```typescript
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrate } from "./db/migrate";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";

export interface TestContext {
  db: Database;
  app: Hono;
}

export function createTestContext(): TestContext {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);

  const app = new Hono();
  app.use("*", cors());
  app.use("/api/*", authMiddleware(db));
  app.onError(errorHandler);
  app.get("/health", (c) => c.json({ status: "ok" }));

  return { db, app };
}

export function makeToken(sub: string, email: string): string {
  return btoa(JSON.stringify({ sub, email }));
}

export function authHeader(sub: string, email: string): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(sub, email)}` };
}
```

**Step 2: Write failing test for auth middleware**

Create `packages/api/src/middleware/auth.test.ts`:

```typescript
import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "../db/migrate";
import { authMiddleware } from "./auth";
import { authHeader } from "../test-utils";

describe("auth middleware", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function createApp() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    const app = new Hono();
    app.use("*", authMiddleware(db));
    app.get("/test", (c) => {
      return c.json({
        userId: c.get("userId"),
        userEmail: c.get("userEmail"),
      });
    });
    return app;
  }

  it("returns 401 when no Authorization header", async () => {
    const app = createApp();
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is not valid base64 JSON", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer notvalidbase64!!!" },
    });
    expect(res.status).toBe(401);
  });

  it("injects userId and userEmail from valid token", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: authHeader("user-1", "alice@test.com"),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ userId: "user-1", userEmail: "alice@test.com" });
  });

  it("upserts user into database on first request", async () => {
    const app = createApp();
    await app.request("/test", {
      headers: authHeader("user-1", "alice@test.com"),
    });
    const row = db.query("SELECT * FROM users WHERE id = ?").get("user-1") as any;
    expect(row).toBeTruthy();
    expect(row.email).toBe("alice@test.com");
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun test packages/api/src/middleware/auth.test.ts`
Expected: FAIL — `authMiddleware` not found

**Step 4: Write auth middleware**

Create `packages/api/src/middleware/auth.ts`:

```typescript
import type { Database } from "bun:sqlite";
import type { MiddlewareHandler } from "hono";
import { UnauthorizedError } from "../lib/errors";

export function authMiddleware(db: Database): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new UnauthorizedError();
    }

    const token = authHeader.slice(7);
    let payload: { sub: string; email: string };

    try {
      payload = JSON.parse(atob(token));
      if (!payload.sub || !payload.email) {
        throw new Error("missing fields");
      }
    } catch {
      throw new UnauthorizedError("Invalid token");
    }

    // Upsert user
    db.query(
      `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
    ).run(payload.sub, payload.email, Date.now());

    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);

    await next();
  };
}
```

**Step 5: Run test to verify it passes**

Run: `bun test packages/api/src/middleware/auth.test.ts`
Expected: PASS — all 4 tests

**Step 6: Commit**

```bash
git add packages/api/src/middleware/auth.ts packages/api/src/middleware/auth.test.ts packages/api/src/test-utils.ts
git commit -m "feat: add auth middleware stub and test helpers"
```

---

### Task 2: DB Query Module — Users & Rooms

**Files:**
- Create: `packages/api/src/db/users.ts`
- Create: `packages/api/src/db/rooms.ts`
- Test: `packages/api/src/db/rooms.test.ts`

**Step 1: Create `packages/api/src/db/users.ts`**

```typescript
import type { Database } from "bun:sqlite";

export function upsertUser(db: Database, id: string, email: string): void {
  db.query(
    `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
  ).run(id, email, Date.now());
}

export function getUserById(db: Database, id: string): { id: string; email: string; display_name: string | null; created_at: number } | null {
  return db.query("SELECT * FROM users WHERE id = ?").get(id) as any;
}
```

**Step 2: Write failing test for rooms DB module**

Create `packages/api/src/db/rooms.test.ts`:

```typescript
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";
import { upsertUser } from "./users";
import { createRoom, listRooms, getRoomWithMembers, addMember } from "./rooms";

describe("rooms db", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function setup() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    upsertUser(db, "user-2", "bob@test.com");
  }

  it("creates a room and returns it", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    expect(room.name).toBe("test-room");
    expect(room.created_by).toBe("user-1");
    expect(room.id).toHaveLength(26);
  });

  it("throws on duplicate room name", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    expect(() => createRoom(db, "test-room", "user-1")).toThrow();
  });

  it("lists rooms with member count", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    addMember(db, room.id, "user-2");
    const rooms = listRooms(db);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].member_count).toBe(2);
  });

  it("gets room with members", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    const result = getRoomWithMembers(db, room.id);
    expect(result).toBeTruthy();
    expect(result!.members).toHaveLength(1);
    expect(result!.members[0].user_id).toBe("user-1");
  });

  it("returns null for non-existent room", () => {
    setup();
    const result = getRoomWithMembers(db, "nonexistent");
    expect(result).toBeNull();
  });

  it("addMember is idempotent", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    addMember(db, room.id, "user-1");
    const result = getRoomWithMembers(db, room.id);
    expect(result!.members).toHaveLength(1);
  });
});
```

**Step 3: Run test to verify it fails**

Run: `bun test packages/api/src/db/rooms.test.ts`
Expected: FAIL — `createRoom` not found

**Step 4: Write rooms DB module**

Create `packages/api/src/db/rooms.ts`:

```typescript
import type { Database } from "bun:sqlite";
import type { Room, RoomListItem, RoomWithMembers, RoomMember } from "@agentsmith/shared";
import { generateUlid } from "../lib/ulid";

export function createRoom(db: Database, name: string, createdBy: string): Room {
  const id = generateUlid();
  const now = Date.now();
  db.query("INSERT INTO rooms (id, name, created_by, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    name,
    createdBy,
    now,
  );
  return { id, name, created_by: createdBy, created_at: now };
}

export function listRooms(db: Database): RoomListItem[] {
  return db
    .query(
      `SELECT r.id, r.name, r.created_by, r.created_at,
              COUNT(rm.user_id) AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
    )
    .all() as RoomListItem[];
}

export function getRoomWithMembers(db: Database, roomId: string): RoomWithMembers | null {
  const room = db.query("SELECT * FROM rooms WHERE id = ?").get(roomId) as Room | null;
  if (!room) return null;

  const members = db
    .query(
      `SELECT rm.user_id, u.email AS display_name, rm.joined_at
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ?
       ORDER BY rm.joined_at ASC`,
    )
    .all(roomId) as RoomMember[];

  return { ...room, members };
}

export function addMember(db: Database, roomId: string, userId: string): void {
  db.query(
    `INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)
     ON CONFLICT(room_id, user_id) DO NOTHING`,
  ).run(roomId, userId, Date.now());
}
```

**Step 5: Run tests**

Run: `bun test packages/api/src/db/rooms.test.ts`
Expected: PASS — all 6 tests

**Step 6: Commit**

```bash
git add packages/api/src/db/users.ts packages/api/src/db/rooms.ts packages/api/src/db/rooms.test.ts
git commit -m "feat: add users and rooms DB query modules"
```

---

### Task 3: Room Routes

**Files:**
- Create: `packages/api/src/routes/rooms.ts`
- Modify: `packages/api/src/app.ts` — mount routes, accept DB param
- Modify: `packages/api/src/index.ts` — pass real DB
- Modify: `packages/api/src/test-utils.ts` — mount routes
- Test: `packages/api/src/routes/rooms.test.ts`
- Modify: `packages/api/src/app.test.ts` — update to use new app factory

**Step 1: Refactor app.ts to accept a DB parameter**

The app currently uses a global singleton DB. We need to pass DB as a parameter so tests can inject in-memory DBs. Modify `packages/api/src/app.ts`:

```typescript
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import { roomRoutes } from "./routes/rooms";

export function createApp(db: Database): Hono {
  const app = new Hono();

  app.use("*", cors());
  app.onError(errorHandler);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.use("/api/*", authMiddleware(db));
  app.route("/api/v1", roomRoutes(db));

  return app;
}
```

**Step 2: Update `packages/api/src/index.ts` to use factory**

```typescript
import { createApp } from "./app";
import { config } from "./lib/config";
import { getDb } from "./db/client";
import { migrate } from "./db/migrate";

const db = getDb();
migrate(db);

const app = createApp(db);

export default {
  port: config.port,
  fetch: app.fetch,
};
```

**Step 3: Update test-utils.ts to use createApp**

Replace `packages/api/src/test-utils.ts`:

```typescript
import { Database } from "bun:sqlite";
import type { Hono } from "hono";
import { migrate } from "./db/migrate";
import { createApp } from "./app";

export interface TestContext {
  db: Database;
  app: Hono;
}

export function createTestContext(): TestContext {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);

  const app = createApp(db);
  return { db, app };
}

export function makeToken(sub: string, email: string): string {
  return btoa(JSON.stringify({ sub, email }));
}

export function authHeader(sub: string, email: string): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(sub, email)}` };
}
```

**Step 4: Update existing `packages/api/src/app.test.ts`**

```typescript
import { describe, expect, it } from "bun:test";
import { createTestContext } from "./test-utils";

describe("Health check", () => {
  it("GET /health returns 200 with status ok", async () => {
    const { app } = createTestContext();
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });
});
```

**Step 5: Run existing tests to verify refactor didn't break anything**

Run: `bun test packages/api/src/app.test.ts`
Expected: PASS

**Step 6: Write failing room route tests**

Create `packages/api/src/routes/rooms.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import { createTestContext, authHeader, type TestContext } from "../test-utils";

describe("Room routes", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  // --- Plugin client: creates a room to use for signaling ---

  describe("POST /api/v1/rooms (plugin creates room)", () => {
    it("creates a room and returns 201", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("plugin-user-1", "alice@test.com"),
        },
        body: JSON.stringify({ name: "my-project" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.name).toBe("my-project");
      expect(json.created_by).toBe("plugin-user-1");
      expect(json.id).toHaveLength(26);
    });

    it("returns 400 for invalid room name", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("plugin-user-1", "alice@test.com"),
        },
        body: JSON.stringify({ name: "INVALID NAME!" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate room name", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...authHeader("plugin-user-1", "alice@test.com"),
      };
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "my-project" }),
      });
      expect(res.status).toBe(409);
    });
  });

  // --- Web UI client: browses rooms ---

  describe("GET /api/v1/rooms (web UI lists rooms)", () => {
    it("returns empty array when no rooms", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ rooms: [] });
    });

    it("returns rooms with member count", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...authHeader("plugin-user-1", "alice@test.com"),
      };
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.rooms).toHaveLength(1);
      expect(json.rooms[0].name).toBe("my-project");
      expect(json.rooms[0].member_count).toBe(0);
    });
  });

  describe("GET /api/v1/rooms/:roomId (web UI views room)", () => {
    it("returns room with members", async () => {
      ctx = createTestContext();
      const createRes = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("plugin-user-1", "alice@test.com"),
        },
        body: JSON.stringify({ name: "my-project" }),
      });
      const room = await createRes.json();
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("my-project");
      expect(json.members).toBeArray();
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent", {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(404);
    });
  });

  // --- Auth required ---

  describe("auth required", () => {
    it("returns 401 when no auth header", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms");
      expect(res.status).toBe(401);
    });
  });
});
```

**Step 7: Run test to verify it fails**

Run: `bun test packages/api/src/routes/rooms.test.ts`
Expected: FAIL — `roomRoutes` not found

**Step 8: Write room routes**

Create `packages/api/src/routes/rooms.ts`:

```typescript
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { createRoomSchema } from "@agentsmith/shared";
import { createRoom, listRooms, getRoomWithMembers } from "../db/rooms";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";

export function roomRoutes(db: Database): Hono {
  const router = new Hono();

  router.get("/rooms", (c) => {
    const rooms = listRooms(db);
    return c.json({ rooms });
  });

  router.post("/rooms", async (c) => {
    const body = await c.req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid room name: must match ^[a-z0-9-]{2,48}$");
    }

    const userId = c.get("userId") as string;

    try {
      const room = createRoom(db, parsed.data.name, userId);
      return c.json(room, 201);
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint")) {
        throw new ConflictError(`Room name '${parsed.data.name}' already exists`);
      }
      throw err;
    }
  });

  router.get("/rooms/:roomId", (c) => {
    const roomId = c.req.param("roomId");
    const room = getRoomWithMembers(db, roomId);
    if (!room) {
      throw new NotFoundError("Room");
    }
    return c.json(room);
  });

  return router;
}
```

**Step 9: Run all tests**

Run: `bun test packages/api`
Expected: PASS — all tests including health check, auth middleware, rooms DB, room routes

**Step 10: Commit**

```bash
git add packages/api/src/app.ts packages/api/src/index.ts packages/api/src/test-utils.ts packages/api/src/app.test.ts packages/api/src/routes/rooms.ts packages/api/src/routes/rooms.test.ts
git commit -m "feat: add room routes with TDD tests"
```

---

### Task 4: DB Query Module — Events

**Files:**
- Create: `packages/api/src/db/events.ts`
- Test: `packages/api/src/db/events.test.ts`

**Step 1: Write failing test**

Create `packages/api/src/db/events.test.ts`:

```typescript
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";
import { upsertUser } from "./users";
import { createRoom } from "./rooms";
import { insertEvent, queryEvents, deleteExpired } from "./events";

describe("events db", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function setup() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    return createRoom(db, "test-room", "user-1");
  }

  it("inserts an event and returns it", () => {
    const room = setup();
    const event = insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "Idle" },
      ttlSeconds: 600,
    });
    expect(event.id).toHaveLength(26);
    expect(event.room_id).toBe(room.id);
    expect(event.event_type).toBe("session.signal");
    expect(event.expires_at).toBe(event.created_at + 600_000);
  });

  it("queries events after a timestamp", () => {
    const room = setup();
    const e1 = insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "Idle" },
      ttlSeconds: 600,
    });
    const e2 = insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "BuildSucceeded" },
      ttlSeconds: 600,
    });

    const result = queryEvents(db, room.id, 0, 50);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].id).toBe(e1.id);
    expect(result.latest_ts).toBeGreaterThan(0);
  });

  it("excludes expired events from queries", () => {
    const room = setup();
    // Insert an event with 0 TTL (already expired)
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("expired-id-000000000000000", room.id, "user-1", "session.signal", "{}", 0, now, now);

    insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "Idle" },
      ttlSeconds: 600,
    });

    const result = queryEvents(db, room.id, 0, 50);
    expect(result.events).toHaveLength(1);
  });

  it("respects limit parameter", () => {
    const room = setup();
    for (let i = 0; i < 5; i++) {
      insertEvent(db, {
        roomId: room.id,
        senderId: "user-1",
        eventType: "session.signal",
        payload: { session_id: "sess-1", signal: "Idle" },
        ttlSeconds: 600,
      });
    }
    const result = queryEvents(db, room.id, 0, 2);
    expect(result.events).toHaveLength(2);
  });

  it("deletes expired events", () => {
    const room = setup();
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("expired-id-000000000000000", room.id, "user-1", "session.signal", "{}", 0, now, now);

    const deleted = deleteExpired(db);
    expect(deleted).toBe(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/api/src/db/events.test.ts`
Expected: FAIL — `insertEvent` not found

**Step 3: Write events DB module**

Create `packages/api/src/db/events.ts`:

```typescript
import type { Database } from "bun:sqlite";
import type { Event } from "@agentsmith/shared";
import { generateUlid } from "../lib/ulid";

export interface InsertEventParams {
  roomId: string;
  senderId: string;
  eventType: string;
  payload: unknown;
  ttlSeconds: number;
}

export interface QueryEventsResult {
  events: Event[];
  latest_ts: number;
}

export function insertEvent(db: Database, params: InsertEventParams): Event {
  const id = generateUlid();
  const now = Date.now();
  const expiresAt = now + params.ttlSeconds * 1000;
  const payloadStr = JSON.stringify(params.payload);

  db.query(
    `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, params.roomId, params.senderId, params.eventType, payloadStr, params.ttlSeconds, now, expiresAt);

  return {
    id,
    room_id: params.roomId,
    sender_id: params.senderId,
    event_type: params.eventType,
    payload: params.payload,
    ttl_seconds: params.ttlSeconds,
    created_at: now,
    expires_at: expiresAt,
  };
}

export function queryEvents(db: Database, roomId: string, since: number, limit: number): QueryEventsResult {
  const now = Date.now();
  const rows = db
    .query(
      `SELECT * FROM events
       WHERE room_id = ? AND created_at > ? AND expires_at > ?
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(roomId, since, now, limit) as (Omit<Event, "payload"> & { payload: string })[];

  const events: Event[] = rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload),
  }));

  const latestTs = events.length > 0 ? events[events.length - 1].created_at : since;

  return { events, latest_ts: latestTs };
}

export function deleteExpired(db: Database): number {
  const now = Date.now();
  const result = db.query("DELETE FROM events WHERE expires_at <= ?").run(now);
  return result.changes;
}
```

**Step 4: Run tests**

Run: `bun test packages/api/src/db/events.test.ts`
Expected: PASS — all 5 tests

**Step 5: Commit**

```bash
git add packages/api/src/db/events.ts packages/api/src/db/events.test.ts
git commit -m "feat: add events DB query module"
```

---

### Task 5: Event Routes

**Files:**
- Create: `packages/api/src/routes/events.ts`
- Modify: `packages/api/src/app.ts` — mount event routes
- Test: `packages/api/src/routes/events.test.ts`

**Step 1: Write failing test**

Create `packages/api/src/routes/events.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import { createTestContext, authHeader, type TestContext } from "../test-utils";

describe("Event routes", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  async function createRoom(name: string, sub: string, email: string) {
    const res = await ctx.app.request("/api/v1/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(sub, email) },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }

  // --- Plugin client emits session signals ---

  describe("POST /api/v1/rooms/:roomId/events (plugin emits signal)", () => {
    it("emits an event and returns 201", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({
          event_type: "session.signal",
          payload: { session_id: "sess-1", signal: "Idle" },
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toHaveLength(26);
      expect(json.room_id).toBe(room.id);
      expect(json.expires_at).toBeGreaterThan(json.created_at);
    });

    it("auto-joins sender to room membership", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({
          event_type: "session.signal",
          payload: { session_id: "sess-1", signal: "Idle" },
        }),
      });
      const detailRes = await ctx.app.request(`/api/v1/rooms/${room.id}`, {
        headers: authHeader("plugin-1", "alice@test.com"),
      });
      const detail = await detailRes.json();
      expect(detail.members).toHaveLength(1);
      expect(detail.members[0].user_id).toBe("plugin-1");
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({ event_type: "session.signal", payload: {} }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid body", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({ event_type: "", payload: {} }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 413 for oversized payload", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const bigPayload = { data: "x".repeat(70_000) };
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({ event_type: "session.signal", payload: bigPayload }),
      });
      expect(res.status).toBe(413);
    });
  });

  // --- Plugin/Web UI polls events ---

  describe("GET /api/v1/rooms/:roomId/events (poll events)", () => {
    it("returns events since a timestamp", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({
          event_type: "session.signal",
          payload: { session_id: "sess-1", signal: "Idle" },
        }),
      });

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events?since=0&limit=50`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(1);
      expect(json.events[0].event_type).toBe("session.signal");
      expect(json.latest_ts).toBeGreaterThan(0);
    });

    it("returns 400 when since param missing", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(400);
    });

    it("returns empty array when no new events", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(
        `/api/v1/rooms/${room.id}/events?since=${Date.now()}&limit=50`,
        { headers: authHeader("web-user-1", "bob@test.com") },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/api/src/routes/events.test.ts`
Expected: FAIL — `eventRoutes` not mounted

**Step 3: Write event routes**

Create `packages/api/src/routes/events.ts`:

```typescript
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { emitEventSchema, pollEventsQuerySchema, TTL_SECONDS, DEFAULT_TTL_SECONDS } from "@agentsmith/shared";
import { insertEvent, queryEvents } from "../db/events";
import { addMember } from "../db/rooms";
import { NotFoundError, PayloadTooLargeError, ValidationError } from "../lib/errors";
import { config } from "../lib/config";

export function eventRoutes(db: Database): Hono {
  const router = new Hono();

  router.post("/rooms/:roomId/events", async (c) => {
    const roomId = c.req.param("roomId");

    // Check room exists
    const room = db.query("SELECT id FROM rooms WHERE id = ?").get(roomId);
    if (!room) {
      throw new NotFoundError("Room");
    }

    const body = await c.req.json();
    const parsed = emitEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid event: event_type is required");
    }

    // Check payload size
    const payloadStr = JSON.stringify(parsed.data.payload);
    if (payloadStr.length > config.payloadMaxBytes) {
      throw new PayloadTooLargeError();
    }

    const userId = c.get("userId") as string;
    const ttlSeconds = TTL_SECONDS[parsed.data.event_type] ?? DEFAULT_TTL_SECONDS;

    // Auto-join room
    addMember(db, roomId, userId);

    const event = insertEvent(db, {
      roomId,
      senderId: userId,
      eventType: parsed.data.event_type,
      payload: parsed.data.payload,
      ttlSeconds,
    });

    return c.json(
      { id: event.id, room_id: event.room_id, created_at: event.created_at, expires_at: event.expires_at },
      201,
    );
  });

  router.get("/rooms/:roomId/events", (c) => {
    const roomId = c.req.param("roomId");
    const query = {
      since: c.req.query("since"),
      limit: c.req.query("limit"),
    };

    const parsed = pollEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query: since (integer) is required");
    }

    const result = queryEvents(db, roomId, parsed.data.since, parsed.data.limit);
    return c.json(result);
  });

  return router;
}
```

**Step 4: Mount event routes in `packages/api/src/app.ts`**

```typescript
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import { roomRoutes } from "./routes/rooms";
import { eventRoutes } from "./routes/events";

export function createApp(db: Database): Hono {
  const app = new Hono();

  app.use("*", cors());
  app.onError(errorHandler);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.use("/api/*", authMiddleware(db));
  app.route("/api/v1", roomRoutes(db));
  app.route("/api/v1", eventRoutes(db));

  return app;
}
```

**Step 5: Run all tests**

Run: `bun test packages/api`
Expected: PASS — all tests

**Step 6: Commit**

```bash
git add packages/api/src/routes/events.ts packages/api/src/routes/events.test.ts packages/api/src/app.ts
git commit -m "feat: add event routes with emit and poll"
```

---

### Task 6: Presence Route

**Files:**
- Create: `packages/api/src/routes/presence.ts`
- Modify: `packages/api/src/app.ts` — mount presence route
- Test: `packages/api/src/routes/presence.test.ts`

**Step 1: Write failing test**

Create `packages/api/src/routes/presence.test.ts`:

```typescript
import { afterEach, describe, expect, it } from "bun:test";
import { createTestContext, authHeader, type TestContext } from "../test-utils";

describe("Presence route", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  async function createRoom(name: string, sub: string, email: string) {
    const res = await ctx.app.request("/api/v1/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(sub, email) },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }

  async function emitSignal(roomId: string, sub: string, email: string, sessionId: string, signal: string) {
    return ctx.app.request(`/api/v1/rooms/${roomId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(sub, email) },
      body: JSON.stringify({
        event_type: "session.signal",
        payload: { session_id: sessionId, signal },
      }),
    });
  }

  // --- Web UI reads presence ---

  describe("GET /api/v1/rooms/:roomId/presence (web UI views avatars)", () => {
    it("returns latest signal per session", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      await emitSignal(room.id, "plugin-1", "alice@test.com", "sess-1", "Idle");
      await emitSignal(room.id, "plugin-1", "alice@test.com", "sess-1", "BuildSucceeded");

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions).toHaveLength(1);
      expect(json.sessions[0].session_id).toBe("sess-1");
      expect(json.sessions[0].signal).toBe("BuildSucceeded");
      expect(json.sessions[0].user_id).toBe("plugin-1");
      expect(json.sessions[0].display_name).toBeTruthy();
    });

    it("returns multiple sessions from different users", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      await emitSignal(room.id, "plugin-1", "alice@test.com", "sess-1", "Idle");
      await emitSignal(room.id, "plugin-2", "bob@test.com", "sess-2", "CommandRunning");

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "viewer@test.com"),
      });
      const json = await res.json();
      expect(json.sessions).toHaveLength(2);
    });

    it("returns empty sessions when no signals", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions).toHaveLength(0);
    });

    it("excludes sessions with expired signals", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Insert an expired signal directly
      const now = Date.now();
      ctx.db
        .query(
          `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "expired-signal-00000000000",
          room.id,
          "plugin-1",
          "session.signal",
          JSON.stringify({ session_id: "sess-old", signal: "Idle" }),
          0,
          now - 700_000,
          now - 100_000,
        );

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      const json = await res.json();
      expect(json.sessions).toHaveLength(0);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/api/src/routes/presence.test.ts`
Expected: FAIL — presence route not mounted

**Step 3: Write presence route**

Create `packages/api/src/routes/presence.ts`:

```typescript
import type { Database } from "bun:sqlite";
import { Hono } from "hono";

interface PresenceSession {
  user_id: string;
  display_name: string;
  session_id: string;
  signal: string;
  updated_at: number;
}

export function presenceRoutes(db: Database): Hono {
  const router = new Hono();

  router.get("/rooms/:roomId/presence", (c) => {
    const roomId = c.req.param("roomId");
    const now = Date.now();
    const tenMinAgo = now - 10 * 60 * 1000;

    // Get latest session.signal per session_id, within last 10 minutes and not expired
    const rows = db
      .query(
        `SELECT e.sender_id AS user_id, u.email AS display_name,
                json_extract(e.payload, '$.session_id') AS session_id,
                json_extract(e.payload, '$.signal') AS signal,
                MAX(e.created_at) AS updated_at
         FROM events e
         JOIN users u ON u.id = e.sender_id
         WHERE e.room_id = ?
           AND e.event_type = 'session.signal'
           AND e.expires_at > ?
           AND e.created_at > ?
         GROUP BY json_extract(e.payload, '$.session_id')
         ORDER BY updated_at DESC`,
      )
      .all(roomId, now, tenMinAgo) as PresenceSession[];

    return c.json({ sessions: rows });
  });

  return router;
}
```

**Step 4: Mount presence routes in `packages/api/src/app.ts`**

```typescript
import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";
import { roomRoutes } from "./routes/rooms";
import { eventRoutes } from "./routes/events";
import { presenceRoutes } from "./routes/presence";

export function createApp(db: Database): Hono {
  const app = new Hono();

  app.use("*", cors());
  app.onError(errorHandler);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.use("/api/*", authMiddleware(db));
  app.route("/api/v1", roomRoutes(db));
  app.route("/api/v1", eventRoutes(db));
  app.route("/api/v1", presenceRoutes(db));

  return app;
}
```

**Step 5: Run all tests**

Run: `bun test packages/api`
Expected: PASS — all tests

**Step 6: Commit**

```bash
git add packages/api/src/routes/presence.ts packages/api/src/routes/presence.test.ts packages/api/src/app.ts
git commit -m "feat: add presence route with computed session view"
```

---

### Task 7: Background Cleanup & Full Integration

**Files:**
- Create: `packages/api/src/lib/cleanup.ts`
- Test: `packages/api/src/lib/cleanup.test.ts`
- Modify: `packages/api/src/index.ts` — start cleanup interval

**Step 1: Write failing test**

Create `packages/api/src/lib/cleanup.test.ts`:

```typescript
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "../db/migrate";
import { upsertUser } from "../db/users";
import { createRoom } from "../db/rooms";
import { startCleanup, stopCleanup } from "./cleanup";

describe("cleanup", () => {
  let db: Database;

  afterEach(() => {
    stopCleanup();
    db?.close();
  });

  it("deletes expired events on interval", async () => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    const room = createRoom(db, "test-room", "user-1");

    // Insert already-expired event
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("expired-cleanup-test-00000", room.id, "user-1", "session.signal", "{}", 0, now, now);

    const countBefore = db.query("SELECT COUNT(*) AS c FROM events").get() as { c: number };
    expect(countBefore.c).toBe(1);

    startCleanup(db, 50); // 50ms interval for test
    await new Promise((r) => setTimeout(r, 150));

    const countAfter = db.query("SELECT COUNT(*) AS c FROM events").get() as { c: number };
    expect(countAfter.c).toBe(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/api/src/lib/cleanup.test.ts`
Expected: FAIL — `startCleanup` not found

**Step 3: Write cleanup module**

Create `packages/api/src/lib/cleanup.ts`:

```typescript
import type { Database } from "bun:sqlite";
import { deleteExpired } from "../db/events";

let timer: ReturnType<typeof setInterval> | null = null;

export function startCleanup(db: Database, intervalMs: number): void {
  stopCleanup();
  timer = setInterval(() => {
    const deleted = deleteExpired(db);
    if (deleted > 0) {
      console.log(`[cleanup] deleted ${deleted} expired events`);
    }
  }, intervalMs);
}

export function stopCleanup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
```

**Step 4: Run test**

Run: `bun test packages/api/src/lib/cleanup.test.ts`
Expected: PASS

**Step 5: Update `packages/api/src/index.ts` to start cleanup**

```typescript
import { createApp } from "./app";
import { config } from "./lib/config";
import { getDb } from "./db/client";
import { migrate } from "./db/migrate";
import { startCleanup } from "./lib/cleanup";

const db = getDb();
migrate(db);
startCleanup(db, config.cleanupIntervalMs);

const app = createApp(db);

export default {
  port: config.port,
  fetch: app.fetch,
};
```

**Step 6: Run full test suite**

Run: `bun test packages/api`
Expected: PASS — all tests

**Step 7: Run typecheck**

Run: `bun run typecheck:api`
Expected: No errors

**Step 8: Run lint and format**

Run: `bun run lint`
If issues: `bunx biome check --write --unsafe .`
Run: `bun run format`

**Step 9: Commit**

```bash
git add packages/api/src/lib/cleanup.ts packages/api/src/lib/cleanup.test.ts packages/api/src/index.ts
git commit -m "feat: add background cleanup for expired events"
```

**Step 10: Final commit if lint/format changed files**

```bash
git add -A
git commit -m "chore: format and fix lint issues"
```
