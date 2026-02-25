# AgentSmith Monorepo Scaffold — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold a Bun monorepo with three workspace packages (shared, api, plugin), tooling, and Docker support.

**Architecture:** Flat Bun workspaces under `packages/`. Shared types package consumed by both API and plugin at build time. API runs Hono on Bun. Plugin compiles to standalone binary via `bun build --compile`.

**Tech Stack:** Bun 1.3+, Hono 4.11+, Zod 4+, SQLite (bun:sqlite), Biome, TypeScript

---

### Task 1: Root Workspace Setup

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bunfig.toml`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `biome.json`

**Step 1: Create root `package.json`**

```json
{
  "name": "agentsmith",
  "private": true,
  "workspaces": ["packages/*"],
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
  },
  "devDependencies": {
    "@biomejs/biome": "latest",
    "@types/bun": "latest",
    "typescript": "latest"
  }
}
```

**Step 2: Create root `tsconfig.json`**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "types": ["bun-types"]
  },
  "exclude": ["node_modules", "dist", "bin"]
}
```

**Step 3: Create `bunfig.toml`**

```toml
[install]
peer = false
```

**Step 4: Create `.gitignore`**

```
node_modules/
dist/
bin/
*.db
.env
.DS_Store
```

**Step 5: Create `.env.example`**

```env
# API Server
PORT=3000
DATABASE_PATH=./data/agentsmith.db

# Auth0
AUTH0_DOMAIN=
AUTH0_AUDIENCE=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=

# Optional
PAYLOAD_MAX_BYTES=65536
CLEANUP_INTERVAL_MS=300000
```

**Step 6: Create `biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "files": {
    "ignore": ["node_modules", "dist", "bin"]
  }
}
```

**Step 7: Install root dependencies**

Run: `bun install`
Expected: `bun.lockb` created, `node_modules/` populated

**Step 8: Verify lint runs**

Run: `bunx biome check .`
Expected: No errors (no source files yet)

**Step 9: Commit**

```bash
git add package.json tsconfig.json bunfig.toml .gitignore .env.example biome.json bun.lockb
git commit -m "chore: scaffold root workspace with tooling"
```

---

### Task 2: Shared Package — Types & Schemas

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/signals.ts`
- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/src/rooms.ts`
- Create: `packages/shared/src/auth.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/ttl.ts`
- Create: `packages/shared/src/schemas.ts`
- Create: `packages/shared/src/index.ts`

**Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@agentsmith/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "dependencies": {
    "zod": "^4.3.5"
  }
}
```

**Step 2: Create `packages/shared/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/shared/src/signals.ts`**

```typescript
export const SESSION_SIGNALS = [
  "SessionStarted",
  "SessionEnded",
  "Idle",
  "CommandRunning",
  "LongRunningCommand",
  "WaitingForInput",
  "BuildSucceeded",
  "BuildFailed",
  "TestsPassed",
  "TestsFailed",
  "HighTokenUsage",
  "LowTokenUsage",
] as const;

export type SessionSignal = (typeof SESSION_SIGNALS)[number];
```

**Step 4: Create `packages/shared/src/events.ts`**

```typescript
import type { SessionSignal } from "./signals";

export interface Event {
  id: string;
  room_id: string;
  sender_id: string;
  event_type: string;
  payload: unknown;
  ttl_seconds: number;
  created_at: number;
  expires_at: number;
}

export interface SessionSignalPayload {
  session_id: string;
  signal: SessionSignal;
}

export interface InteractionPayload {
  target_session_id?: string;
  interaction_type: string;
  data?: unknown;
}
```

**Step 5: Create `packages/shared/src/rooms.ts`**

```typescript
export interface Room {
  id: string;
  name: string;
  created_by: string;
  created_at: number;
}

export interface RoomMember {
  user_id: string;
  display_name: string;
  joined_at: number;
}

export interface RoomWithMembers extends Room {
  members: RoomMember[];
}

export interface RoomListItem extends Room {
  member_count: number;
}
```

**Step 6: Create `packages/shared/src/auth.ts`**

```typescript
export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface TokenStore {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface UserIdentity {
  sub: string;
  email: string;
}
```

**Step 7: Create `packages/shared/src/errors.ts`**

```typescript
export const ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION_ERROR: "VALIDATION_ERROR",
  CONFLICT: "CONFLICT",
  PAYLOAD_TOO_LARGE: "PAYLOAD_TOO_LARGE",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ErrorResponse {
  error: string;
  message: string;
}
```

**Step 8: Create `packages/shared/src/ttl.ts`**

```typescript
export const TTL_SECONDS: Record<string, number> = {
  "session.signal": 600,
  "session.started": 86400,
  "session.ended": 300,
  interaction: 120,
};

export const DEFAULT_TTL_SECONDS = 300;
```

**Step 9: Create `packages/shared/src/schemas.ts`**

```typescript
import { z } from "zod/v4";

export const roomNameSchema = z.string().regex(/^[a-z0-9-]{2,48}$/);

export const createRoomSchema = z.object({
  name: roomNameSchema,
});

export const emitEventSchema = z.object({
  event_type: z.string().min(1),
  payload: z.unknown(),
});

export const pollEventsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const deviceTokenSchema = z.object({
  device_code: z.string().min(1),
});
```

**Step 10: Create `packages/shared/src/index.ts`**

```typescript
export * from "./signals";
export * from "./events";
export * from "./rooms";
export * from "./auth";
export * from "./errors";
export * from "./ttl";
export * from "./schemas";
```

**Step 11: Install shared dependencies**

Run: `bun install`
Expected: `zod` installed, workspace links resolved

**Step 12: Verify typecheck passes**

Run: `bun run typecheck:shared`
Expected: No errors

**Step 13: Commit**

```bash
git add packages/shared/
git commit -m "feat: add @agentsmith/shared package with types and schemas"
```

---

### Task 3: API Package — Skeleton with Health Check

**Files:**
- Create: `packages/api/package.json`
- Create: `packages/api/tsconfig.json`
- Create: `packages/api/src/app.ts`
- Create: `packages/api/src/index.ts`
- Create: `packages/api/src/lib/config.ts`
- Create: `packages/api/src/lib/errors.ts`
- Create: `packages/api/src/middleware/error.ts`
- Create: `packages/api/src/middleware/logger.ts`
- Test: `packages/api/src/app.test.ts`

**Step 1: Create `packages/api/package.json`**

```json
{
  "name": "@agentsmith/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@agentsmith/shared": "workspace:*",
    "@hono/zod-validator": "^0.7.6",
    "hono": "^4.11.4"
  }
}
```

Note: `zod` comes transitively from `@agentsmith/shared`.

**Step 2: Create `packages/api/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/api/src/lib/config.ts`**

```typescript
export const config = {
  port: parseInt(process.env.PORT || "3000"),
  databasePath: process.env.DATABASE_PATH || "./data/agentsmith.db",
  auth0: {
    domain: process.env.AUTH0_DOMAIN || "",
    audience: process.env.AUTH0_AUDIENCE || "",
    clientId: process.env.AUTH0_CLIENT_ID || "",
    clientSecret: process.env.AUTH0_CLIENT_SECRET || "",
  },
  payloadMaxBytes: parseInt(process.env.PAYLOAD_MAX_BYTES || "65536"),
  cleanupIntervalMs: parseInt(process.env.CLEANUP_INTERVAL_MS || "300000"),
};
```

**Step 4: Create `packages/api/src/lib/errors.ts`**

```typescript
import { ERROR_CODES, type ErrorCode } from "@agentsmith/shared";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public statusCode: number = 500,
  ) {
    super(message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(ERROR_CODES.VALIDATION_ERROR, message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(ERROR_CODES.UNAUTHORIZED, message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(ERROR_CODES.CONFLICT, message, 409);
  }
}

export class PayloadTooLargeError extends AppError {
  constructor() {
    super(ERROR_CODES.PAYLOAD_TOO_LARGE, "Payload exceeds maximum size", 413);
  }
}
```

**Step 5: Create `packages/api/src/middleware/error.ts`**

```typescript
import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message }, err.statusCode as any);
  }

  console.error("Unhandled error:", err);
  return c.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" }, 500);
};
```

**Step 6: Create `packages/api/src/middleware/logger.ts`**

```typescript
import { logger } from "hono/logger";

export const requestLogger = logger();
```

**Step 7: Create `packages/api/src/app.ts`**

```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";
import { requestLogger } from "./middleware/logger";
import { errorHandler } from "./middleware/error";

const app = new Hono();

app.use("*", requestLogger);
app.use("*", cors());
app.onError(errorHandler);

app.get("/health", (c) => c.json({ status: "ok" }));

export default app;
```

**Step 8: Create `packages/api/src/index.ts`**

```typescript
import app from "./app";
import { config } from "./lib/config";

export default {
  port: config.port,
  fetch: app.fetch,
};
```

**Step 9: Write failing test**

Create `packages/api/src/app.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import app from "./app";

describe("Health check", () => {
  it("GET /health returns 200 with status ok", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toEqual({ status: "ok" });
  });
});
```

**Step 10: Install API dependencies**

Run: `bun install`

**Step 11: Run test**

Run: `bun test packages/api`
Expected: PASS — health check returns 200

**Step 12: Run typecheck**

Run: `bun run typecheck:api`
Expected: No errors

**Step 13: Verify dev server starts**

Run: `bun run packages/api/src/index.ts`
Expected: Server starts on port 3000, `curl http://localhost:3000/health` returns `{"status":"ok"}`
Stop the server.

**Step 14: Commit**

```bash
git add packages/api/
git commit -m "feat: add @agentsmith/api skeleton with health check"
```

---

### Task 4: API — Database Client & Migration

**Files:**
- Create: `packages/api/src/db/client.ts`
- Create: `packages/api/src/db/migrate.ts`
- Test: `packages/api/src/db/migrate.test.ts`

**Step 1: Create `packages/api/src/db/client.ts`**

```typescript
import { Database } from "bun:sqlite";
import { config } from "../lib/config";

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(config.databasePath, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**Step 2: Create `packages/api/src/db/migrate.ts`**

```typescript
import type { Database } from "bun:sqlite";

export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      display_name TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id     TEXT NOT NULL REFERENCES rooms(id),
      user_id     TEXT NOT NULL REFERENCES users(id),
      joined_at   INTEGER NOT NULL,
      PRIMARY KEY (room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id          TEXT PRIMARY KEY,
      room_id     TEXT NOT NULL REFERENCES rooms(id),
      sender_id   TEXT NOT NULL REFERENCES users(id),
      event_type  TEXT NOT NULL,
      payload     TEXT NOT NULL,
      ttl_seconds INTEGER NOT NULL,
      created_at  INTEGER NOT NULL,
      expires_at  INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_room_created ON events(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_events_expires ON events(expires_at);
  `);
}
```

**Step 3: Write failing test**

Create `packages/api/src/db/migrate.test.ts`:

```typescript
import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";

describe("migrate", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("creates all tables", () => {
    db = new Database(":memory:");
    migrate(db);

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("rooms");
    expect(tableNames).toContain("room_members");
    expect(tableNames).toContain("events");
  });

  it("is idempotent", () => {
    db = new Database(":memory:");
    migrate(db);
    migrate(db);

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    expect(tables.length).toBeGreaterThanOrEqual(4);
  });
});
```

**Step 4: Run test**

Run: `bun test packages/api/src/db/migrate.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/db/
git commit -m "feat: add database client and migration"
```

---

### Task 5: API — ULID Utility

**Files:**
- Create: `packages/api/src/lib/ulid.ts`
- Test: `packages/api/src/lib/ulid.test.ts`

**Step 1: Write failing test**

Create `packages/api/src/lib/ulid.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";
import { generateUlid } from "./ulid";

describe("generateUlid", () => {
  it("returns a 26-character string", () => {
    const id = generateUlid();
    expect(id).toHaveLength(26);
  });

  it("generates unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateUlid()));
    expect(ids.size).toBe(100);
  });

  it("is lexicographically sortable by time", () => {
    const id1 = generateUlid();
    const id2 = generateUlid();
    expect(id2 >= id1).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `bun test packages/api/src/lib/ulid.test.ts`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `packages/api/src/lib/ulid.ts`:

```typescript
const ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

let lastTime = 0;
let lastRandom = new Uint8Array(10);

export function generateUlid(): string {
  let now = Date.now();

  if (now === lastTime) {
    // Increment random part to ensure uniqueness within same ms
    for (let i = 9; i >= 0; i--) {
      if (lastRandom[i] < 255) {
        lastRandom[i]++;
        break;
      }
      lastRandom[i] = 0;
    }
  } else {
    lastTime = now;
    crypto.getRandomValues(lastRandom);
  }

  let str = "";

  // Encode 48-bit timestamp (6 bytes → 10 chars)
  for (let i = 9; i >= 0; i--) {
    str = ENCODING[now & 0x1f] + str;
    now = Math.floor(now / 32);
  }

  // Encode 80-bit randomness (10 bytes → 16 chars)
  const random = new Uint8Array(lastRandom);
  for (let i = 0; i < 10; i++) {
    const byte = random[i];
    str += ENCODING[(byte >> 3) & 0x1f];
    if (i < 9) {
      str += ENCODING[((byte & 0x07) << 2) | (random[i + 1] >> 6)];
      i++;
      str += ENCODING[(random[i] >> 1) & 0x1f];
      if (i < 9) {
        str += ENCODING[((random[i] & 0x01) << 4) | (random[i + 1] >> 4)];
      }
    }
  }

  return str.slice(0, 26);
}
```

> Note: If this hand-rolled ULID implementation proves fragile during testing, replace with the `ulid` npm package. The implementation above avoids an external dependency but correctness matters more.

**Step 4: Run test**

Run: `bun test packages/api/src/lib/ulid.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/lib/ulid.ts packages/api/src/lib/ulid.test.ts
git commit -m "feat: add ULID generation utility"
```

---

### Task 6: Plugin Package — Skeleton with CLI Entry

**Files:**
- Create: `packages/plugin/package.json`
- Create: `packages/plugin/tsconfig.json`
- Create: `packages/plugin/plugin.json`
- Create: `packages/plugin/src/cli.ts`
- Test: `packages/plugin/src/cli.test.ts`

**Step 1: Create `packages/plugin/package.json`**

```json
{
  "name": "@agentsmith/plugin",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/cli.ts",
  "scripts": {
    "build": "bun run build:darwin-arm64 && bun run build:darwin-x64 && bun run build:linux-x64",
    "build:darwin-arm64": "bun build --compile --target=bun-darwin-arm64 --outfile=bin/agentsmith-darwin-arm64 src/cli.ts",
    "build:darwin-x64": "bun build --compile --target=bun-darwin-x64 --outfile=bin/agentsmith-darwin-x64 src/cli.ts",
    "build:linux-x64": "bun build --compile --target=bun-linux-x64 --outfile=bin/agentsmith-linux-x64 src/cli.ts",
    "build:local": "bun build --compile --outfile=bin/agentsmith src/cli.ts"
  },
  "dependencies": {
    "@agentsmith/shared": "workspace:*"
  }
}
```

**Step 2: Create `packages/plugin/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/plugin/plugin.json`**

```json
{
  "name": "agentsmith",
  "version": "0.1.0",
  "hooks": {
    "PreToolUse":   { "command": "bin/agentsmith hook --event PreToolUse" },
    "PostToolUse":  { "command": "bin/agentsmith hook --event PostToolUse" },
    "Stop":         { "command": "bin/agentsmith hook --event Stop" },
    "Notification": { "command": "bin/agentsmith hook --event Notification" }
  }
}
```

**Step 4: Create `packages/plugin/src/cli.ts`**

```typescript
const args = process.argv.slice(2);
const command = args[0];

if (command === "hook") {
  const eventIdx = args.indexOf("--event");
  const eventType = eventIdx !== -1 ? args[eventIdx + 1] : undefined;

  if (!eventType) {
    console.error("Missing --event argument");
    process.exit(1);
  }

  // TODO: implement hook handler
  console.log(`[agentsmith] hook: ${eventType}`);
  process.exit(0);
}

if (command === "auth") {
  // TODO: implement auth flow
  console.log("[agentsmith] auth: not yet implemented");
  process.exit(0);
}

if (command === "version") {
  console.log("agentsmith 0.1.0");
  process.exit(0);
}

console.error(`Unknown command: ${command}`);
console.error("Usage: agentsmith <hook|auth|version> [options]");
process.exit(1);
```

**Step 5: Write test**

Create `packages/plugin/src/cli.test.ts`:

```typescript
import { describe, expect, it } from "bun:test";

describe("CLI", () => {
  it("prints version", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "version"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toBe("agentsmith 0.1.0");
    expect(proc.exitCode).toBe(0);
  });

  it("exits 1 on unknown command", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "bogus"], {
      cwd: import.meta.dir + "/..",
      stderr: "pipe",
    });
    await proc.exited;
    expect(proc.exitCode).toBe(1);
  });

  it("handles hook command with --event", async () => {
    const proc = Bun.spawn(["bun", "run", "src/cli.ts", "hook", "--event", "PreToolUse"], {
      cwd: import.meta.dir + "/..",
      stdout: "pipe",
    });
    const output = await new Response(proc.stdout).text();
    expect(output.trim()).toContain("hook: PreToolUse");
    expect(proc.exitCode).toBe(0);
  });
});
```

**Step 6: Install plugin dependencies**

Run: `bun install`

**Step 7: Run test**

Run: `bun test packages/plugin`
Expected: PASS

**Step 8: Verify local binary build**

Run: `cd packages/plugin && bun run build:local && cd ../..`
Expected: `packages/plugin/bin/agentsmith` binary created

Run: `packages/plugin/bin/agentsmith version`
Expected: `agentsmith 0.1.0`

**Step 9: Commit**

```bash
git add packages/plugin/
git commit -m "feat: add @agentsmith/plugin skeleton with CLI entry"
```

---

### Task 7: Dockerfile

**Files:**
- Create: `docker/Dockerfile`

**Step 1: Create `docker/Dockerfile`**

```dockerfile
FROM oven/bun:1 AS builder
WORKDIR /app
COPY package.json bun.lockb ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN bun install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/

FROM oven/bun:1-slim
WORKDIR /app
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/packages/api ./packages/api
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

VOLUME /data
EXPOSE 3000

ENV DATABASE_PATH=/data/agentsmith.db
ENV AUTH0_DOMAIN=
ENV AUTH0_AUDIENCE=
ENV AUTH0_CLIENT_ID=
ENV AUTH0_CLIENT_SECRET=
ENV PORT=3000

CMD ["bun", "run", "packages/api/src/index.ts"]
```

**Step 2: Verify Docker build (optional — requires Docker running)**

Run: `docker build -f docker/Dockerfile -t agentsmith-api .`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add docker/Dockerfile
git commit -m "chore: add API server Dockerfile"
```

---

### Task 8: Full Integration Verification

**Step 1: Run all tests**

Run: `bun test`
Expected: All tests pass across api and plugin packages

**Step 2: Run typecheck on all packages**

Run: `bun run typecheck`
Expected: No type errors

**Step 3: Run lint**

Run: `bun run lint`
Expected: No lint errors (fix any if found)

**Step 4: Run format**

Run: `bun run format`
Expected: All files formatted

**Step 5: Verify dev server**

Run: `bun run dev:api`
Expected: Server starts on port 3000
Test: `curl http://localhost:3000/health` → `{"status":"ok"}`
Stop the server.

**Step 6: Final commit (if any formatting changes)**

```bash
git add -A
git commit -m "chore: format and verify full monorepo integration"
```
