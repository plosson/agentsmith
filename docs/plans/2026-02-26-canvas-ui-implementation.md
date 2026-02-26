# Canvas UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a minimal web canvas that lists rooms, displays session avatars with per-user visual commonality, and polls for presence and events via HTMX.

**Architecture:** A new `packages/canvas` Hono server proxies the API (JSON), renders HTML fragments (JSX), and serves them to the browser via HTMX. Alpine.js manages client-side state (event polling cursor). Tailwind CSS and fonts loaded from CDN.

**Tech Stack:** Bun, Hono 4.x (JSX), HTMX 2.x, Alpine.js 3.x, Tailwind CSS 4.x (CDN)

**Design Doc:** `docs/plans/2026-02-26-canvas-ui-design.md`

---

### Task 1: Scaffold the canvas package

**Files:**
- Create: `packages/canvas/package.json`
- Create: `packages/canvas/tsconfig.json`
- Create: `packages/canvas/src/index.ts`
- Create: `packages/canvas/src/app.ts`
- Create: `packages/canvas/src/lib/config.ts`
- Modify: `package.json` (root — add `dev:canvas` script)

**Step 1: Create `packages/canvas/package.json`**

```json
{
  "name": "@agentsmith/canvas",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": {
    "@agentsmith/shared": "workspace:*",
    "hono": "^4.11.4"
  }
}
```

**Step 2: Create `packages/canvas/tsconfig.json`**

Follow the same pattern as `packages/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "jsx": "react-jsx",
    "jsxImportSource": "hono"
  },
  "include": ["src"]
}
```

**Step 3: Create `packages/canvas/src/lib/config.ts`**

```typescript
export const config = {
  port: Number.parseInt(process.env.CANVAS_PORT || "3002", 10),
  apiUrl: process.env.AGENTSMITH_API_URL || "http://localhost:3000",
};
```

**Step 4: Create `packages/canvas/src/app.ts`**

Minimal Hono app with no routes yet:

```typescript
import { Hono } from "hono";

export function createApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  return app;
}
```

**Step 5: Create `packages/canvas/src/index.ts`**

Follow the pattern from `packages/api/src/index.ts`:

```typescript
import { createApp } from "./app";
import { config } from "./lib/config";

const app = createApp();

export default {
  port: config.port,
  fetch: app.fetch,
};
```

**Step 6: Add root script**

In root `package.json`, add to `scripts`:

```json
"dev:canvas": "bun run --watch packages/canvas/src/index.ts",
"typecheck:canvas": "tsc --noEmit -p packages/canvas"
```

Also update `typecheck` script to include canvas:

```json
"typecheck": "bun run typecheck:shared && bun run typecheck:api && bun run typecheck:canvas"
```

**Step 7: Install dependencies**

Run: `bun install`

**Step 8: Verify**

Run: `bun run dev:canvas`

Expected: Server starts on port 3002, `curl http://localhost:3002/health` returns `{"status":"ok"}`.

**Step 9: Commit**

```bash
git add packages/canvas/ package.json bun.lock
git commit -m "feat(canvas): scaffold canvas package"
```

---

### Task 2: API client with dev token

**Files:**
- Create: `packages/canvas/src/lib/api-client.ts`

The canvas server needs to fetch JSON from the API. Build a thin wrapper around `fetch` that injects the hardcoded dev Bearer token.

**Step 1: Create `packages/canvas/src/lib/api-client.ts`**

```typescript
import { config } from "./config";

const DEV_TOKEN = btoa(JSON.stringify({ sub: "canvas-dev|1", email: "dev@canvas.local" }));

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${config.apiUrl}/api/v1${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEV_TOKEN}`,
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  listRooms() {
    return apiFetch<{ rooms: Array<{ id: string; name: string; created_by: string; created_at: number; member_count: number }> }>("/rooms");
  },

  getRoomPresence(roomId: string) {
    return apiFetch<{
      sessions: Array<{
        user_id: string;
        display_name: string;
        session_id: string;
        signal: string;
        updated_at: number;
      }>;
    }>(`/rooms/${roomId}/presence`);
  },

  getEvents(roomId: string, since: number, limit = 50) {
    return apiFetch<{
      events: Array<{
        id: string;
        room_id: string;
        sender_user_id: string;
        sender_session_id: string | null;
        event_type: string;
        payload: unknown;
        created_at: number;
        expires_at: number;
      }>;
      latest_ts: number;
    }>(`/rooms/${roomId}/events?since=${since}&limit=${limit}`);
  },
};
```

**Step 2: Verify typecheck**

Run: `bun run typecheck:canvas`

Expected: No errors.

**Step 3: Commit**

```bash
git add packages/canvas/src/lib/api-client.ts
git commit -m "feat(canvas): add API client with dev token"
```

---

### Task 3: Avatar helpers (color + initials)

**Files:**
- Create: `packages/canvas/src/lib/avatar.ts`

Deterministic color and initials from user email. Multiple sessions from the same user share the same color.

**Step 1: Create `packages/canvas/src/lib/avatar.ts`**

```typescript
const AVATAR_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6",
  "#1abc9c", "#e67e22", "#34495e", "#16a085", "#c0392b",
  "#2980b9", "#8e44ad", "#27ae60", "#d35400", "#7f8c8d",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getAvatarColor(userId: string): string {
  return AVATAR_COLORS[hashString(userId) % AVATAR_COLORS.length];
}

export function getInitials(displayName: string): string {
  const name = displayName.split("@")[0];
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case "SessionStarted":
    case "BuildSucceeded":
    case "TestsPassed":
      return "#2ecc71"; // green
    case "BuildFailed":
    case "TestsFailed":
      return "#e74c3c"; // red
    case "CommandRunning":
    case "LongRunningCommand":
      return "#f39c12"; // yellow
    case "WaitingForInput":
      return "#3498db"; // blue
    case "HighTokenUsage":
      return "#e67e22"; // orange
    case "SessionEnded":
    case "Idle":
    case "LowTokenUsage":
    default:
      return "#95a5a6"; // gray
  }
}
```

**Step 2: Verify typecheck**

Run: `bun run typecheck:canvas`

Expected: No errors.

**Step 3: Commit**

```bash
git add packages/canvas/src/lib/avatar.ts
git commit -m "feat(canvas): add avatar color/initials helpers"
```

---

### Task 4: Layout component

**Files:**
- Create: `packages/canvas/src/components/Layout.tsx`

Full HTML shell with CDN deps (Tailwind, HTMX, Alpine, fonts, icons) per WEB_TECH_GUIDELINES.

**Step 1: Create `packages/canvas/src/components/Layout.tsx`**

```tsx
import type { FC, PropsWithChildren } from "hono/jsx";

type LayoutProps = PropsWithChildren<{
  title: string;
}>;

export const Layout: FC<LayoutProps> = ({ title, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} — AgentSmith</title>

      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Fira+Mono:wght@400;500&display=swap"
        rel="stylesheet"
      />

      <script src="https://cdn.tailwindcss.com"></script>
      <script
        dangerouslySetInnerHTML={{
          __html: `
            tailwind.config = {
              theme: {
                extend: {
                  fontFamily: {
                    sans: ['Geist', 'system-ui', 'sans-serif'],
                    mono: ['Fira Mono', 'monospace'],
                  }
                }
              }
            }
          `,
        }}
      />

      <script src="https://unpkg.com/htmx.org@2.0.8"></script>
      <script defer src="https://unpkg.com/alpinejs@3.15.3/dist/cdn.min.js"></script>
    </head>
    <body class="font-sans bg-gray-50 text-gray-900 min-h-screen">
      <header class="border-b border-gray-200 bg-white px-6 py-4">
        <div class="flex items-center gap-3">
          <a href="/" class="text-lg font-semibold tracking-tight">AgentSmith</a>
          <span class="text-sm text-gray-400">Canvas</span>
        </div>
      </header>
      <main class="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </body>
  </html>
);
```

**Step 2: Verify typecheck**

Run: `bun run typecheck:canvas`

Expected: No errors.

**Step 3: Commit**

```bash
git add packages/canvas/src/components/Layout.tsx
git commit -m "feat(canvas): add Layout component with CDN deps"
```

---

### Task 5: Room list page and partial

**Files:**
- Create: `packages/canvas/src/components/RoomList.tsx`
- Create: `packages/canvas/src/routes/pages.tsx`
- Create: `packages/canvas/src/routes/partials.tsx`
- Modify: `packages/canvas/src/app.ts`

**Step 1: Create `packages/canvas/src/components/RoomList.tsx`**

```tsx
import type { FC } from "hono/jsx";

type RoomItem = {
  id: string;
  name: string;
  member_count: number;
};

export const RoomList: FC<{ rooms: RoomItem[] }> = ({ rooms }) => {
  if (rooms.length === 0) {
    return (
      <div class="text-center py-16 text-gray-400">
        <p class="text-lg">No rooms yet</p>
        <p class="text-sm mt-1">Create a room via the API to get started.</p>
      </div>
    );
  }

  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => (
        <a
          href={`/rooms/${room.id}`}
          class="block bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-400 hover:shadow-sm transition-all"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-gray-900 font-mono text-sm">{room.name}</h3>
            <span class="text-xs text-gray-400">
              {room.member_count} {room.member_count === 1 ? "member" : "members"}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
};
```

**Step 2: Create `packages/canvas/src/routes/pages.tsx`**

```tsx
import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { RoomList } from "../components/RoomList";
import { api } from "../lib/api-client";

export const pages = new Hono();

pages.get("/", async (c) => {
  const { rooms } = await api.listRooms();
  return c.html(
    <Layout title="Rooms">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-semibold">Rooms</h1>
        <button
          hx-get="/partials/rooms"
          hx-target="#room-list"
          hx-swap="innerHTML"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Refresh
        </button>
      </div>
      <div id="room-list">
        <RoomList rooms={rooms} />
      </div>
    </Layout>,
  );
});
```

**Step 3: Create `packages/canvas/src/routes/partials.tsx`**

Start with just the room list partial — presence and events will be added in later tasks:

```tsx
import { Hono } from "hono";
import { RoomList } from "../components/RoomList";
import { api } from "../lib/api-client";

export const partials = new Hono();

partials.get("/rooms", async (c) => {
  const { rooms } = await api.listRooms();
  return c.html(<RoomList rooms={rooms} />);
});
```

**Step 4: Wire routes into `packages/canvas/src/app.ts`**

Replace the minimal app with:

```typescript
import { Hono } from "hono";
import { pages } from "./routes/pages";
import { partials } from "./routes/partials";

export function createApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/", pages);
  app.route("/partials", partials);

  return app;
}
```

**Step 5: Verify typecheck**

Run: `bun run typecheck:canvas`

Expected: No errors.

**Step 6: Manual verification**

1. Start the API server: `bun run dev:api` (needs a room to exist)
2. Start the canvas: `bun run dev:canvas`
3. Open `http://localhost:3002/`
4. Should see "Rooms" heading with the room list (or empty state)

**Step 7: Commit**

```bash
git add packages/canvas/src/components/RoomList.tsx packages/canvas/src/routes/pages.tsx packages/canvas/src/routes/partials.tsx packages/canvas/src/app.ts
git commit -m "feat(canvas): add room list page and partial"
```

---

### Task 6: Room view page with presence polling

**Files:**
- Create: `packages/canvas/src/components/Avatar.tsx`
- Create: `packages/canvas/src/components/SignalBadge.tsx`
- Create: `packages/canvas/src/components/SessionGrid.tsx`
- Create: `packages/canvas/src/components/RoomView.tsx`
- Modify: `packages/canvas/src/routes/pages.tsx`
- Modify: `packages/canvas/src/routes/partials.tsx`

**Step 1: Create `packages/canvas/src/components/SignalBadge.tsx`**

```tsx
import type { FC } from "hono/jsx";
import { getSignalColor } from "../lib/avatar";

export const SignalBadge: FC<{ signal: string }> = ({ signal }) => {
  const color = getSignalColor(signal);
  const label = signal.replace(/([A-Z])/g, " $1").trim();

  return (
    <div class="flex items-center gap-1.5">
      <span
        class="inline-block w-2 h-2 rounded-full"
        style={`background-color: ${color}`}
      />
      <span class="text-xs text-gray-500">{label}</span>
    </div>
  );
};
```

**Step 2: Create `packages/canvas/src/components/Avatar.tsx`**

```tsx
import type { FC } from "hono/jsx";
import { getAvatarColor, getInitials } from "../lib/avatar";
import { SignalBadge } from "./SignalBadge";

type AvatarProps = {
  userId: string;
  displayName: string;
  sessionId: string;
  signal: string;
  sessionIndex?: number;
};

export const Avatar: FC<AvatarProps> = ({ userId, displayName, sessionId, signal, sessionIndex }) => {
  const color = getAvatarColor(userId);
  const initials = getInitials(displayName);

  return (
    <div class="flex flex-col items-center gap-2 p-3" title={`${displayName}\n${sessionId}`}>
      <div class="relative">
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg"
          style={`background-color: ${color}`}
        >
          {initials}
        </div>
        {sessionIndex !== undefined && sessionIndex > 0 && (
          <span
            class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-300 text-[10px] font-medium flex items-center justify-center text-gray-600"
          >
            {sessionIndex + 1}
          </span>
        )}
      </div>
      <SignalBadge signal={signal} />
    </div>
  );
};
```

**Step 3: Create `packages/canvas/src/components/SessionGrid.tsx`**

```tsx
import type { FC } from "hono/jsx";
import { Avatar } from "./Avatar";

type Session = {
  user_id: string;
  display_name: string;
  session_id: string;
  signal: string;
  updated_at: number;
};

export const SessionGrid: FC<{ sessions: Session[] }> = ({ sessions }) => {
  if (sessions.length === 0) {
    return (
      <div class="text-center py-10 text-gray-400">
        <p class="text-sm">No active sessions</p>
      </div>
    );
  }

  // Compute per-user session index for the badge
  const userSessionCount: Record<string, number> = {};
  const sessionsWithIndex = sessions.map((s) => {
    const count = userSessionCount[s.user_id] ?? 0;
    userSessionCount[s.user_id] = count + 1;
    return { ...s, sessionIndex: count };
  });

  // Only show badges if a user has multiple sessions
  const usersWithMultiple = new Set(
    Object.entries(userSessionCount)
      .filter(([, count]) => count > 1)
      .map(([userId]) => userId),
  );

  return (
    <div class="flex flex-wrap gap-2">
      {sessionsWithIndex.map((s) => (
        <Avatar
          userId={s.user_id}
          displayName={s.display_name}
          sessionId={s.session_id}
          signal={s.signal}
          sessionIndex={usersWithMultiple.has(s.user_id) ? s.sessionIndex : undefined}
        />
      ))}
    </div>
  );
};
```

**Step 4: Create `packages/canvas/src/components/RoomView.tsx`**

This is the full-page content for a room. Contains HTMX polling containers.

```tsx
import type { FC } from "hono/jsx";
import { SessionGrid } from "./SessionGrid";

type Session = {
  user_id: string;
  display_name: string;
  session_id: string;
  signal: string;
  updated_at: number;
};

type RoomViewProps = {
  roomId: string;
  roomName: string;
  sessions: Session[];
};

export const RoomView: FC<RoomViewProps> = ({ roomId, roomName, sessions }) => (
  <div>
    <div class="flex items-center gap-3 mb-6">
      <a href="/" class="text-gray-400 hover:text-gray-600 text-sm">&larr; Rooms</a>
      <h1 class="text-xl font-semibold font-mono">{roomName}</h1>
    </div>

    <section class="mb-8">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Sessions</h2>
      <div
        id="presence-grid"
        hx-get={`/partials/rooms/${roomId}/presence`}
        hx-trigger="every 3s"
        hx-swap="innerHTML"
      >
        <SessionGrid sessions={sessions} />
      </div>
    </section>

    <section x-data="{ latestTs: 0 }">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Activity</h2>
      <div
        id="event-feed"
        hx-get={`/partials/rooms/${roomId}/events`}
        hx-vals="js:{since: latestTs}"
        hx-trigger="load, every 3s"
        hx-swap="innerHTML"
        {...{ "@htmx:after-settle": "latestTs = parseInt($el.dataset.latestTs) || latestTs" }}
      >
        <p class="text-sm text-gray-400">Loading events...</p>
      </div>
    </section>
  </div>
);
```

Note on the `@htmx:after-settle` attribute: Hono JSX doesn't support `@` attributes natively. We use the spread syntax to add it.

**Step 5: Add room view page route**

Add to `packages/canvas/src/routes/pages.tsx`:

```tsx
import { RoomView } from "../components/RoomView";

pages.get("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const { sessions } = await api.getRoomPresence(roomId);

  // Fetch room name (we need it for display)
  // The presence endpoint doesn't return it, so we get it from rooms list
  const { rooms } = await api.listRooms();
  const room = rooms.find((r) => r.id === roomId);
  const roomName = room?.name ?? roomId;

  return c.html(
    <Layout title={roomName}>
      <RoomView roomId={roomId} roomName={roomName} sessions={sessions} />
    </Layout>,
  );
});
```

**Step 6: Add presence partial**

Add to `packages/canvas/src/routes/partials.tsx`:

```tsx
import { SessionGrid } from "../components/SessionGrid";

partials.get("/rooms/:roomId/presence", async (c) => {
  const roomId = c.req.param("roomId");
  const { sessions } = await api.getRoomPresence(roomId);
  return c.html(<SessionGrid sessions={sessions} />);
});
```

**Step 7: Verify typecheck**

Run: `bun run typecheck:canvas`

Expected: No errors.

**Step 8: Manual verification**

1. Both servers running (`dev:api` on 3000, `dev:canvas` on 3002)
2. Open `http://localhost:3002/`
3. Click a room
4. Should see "Sessions" section (empty or with avatars if plugin is running)
5. HTMX should poll every 3s (visible in Network tab)

**Step 9: Commit**

```bash
git add packages/canvas/src/components/Avatar.tsx packages/canvas/src/components/SignalBadge.tsx packages/canvas/src/components/SessionGrid.tsx packages/canvas/src/components/RoomView.tsx packages/canvas/src/routes/pages.tsx packages/canvas/src/routes/partials.tsx
git commit -m "feat(canvas): add room view with presence polling"
```

---

### Task 7: Event feed partial with cursor tracking

**Files:**
- Create: `packages/canvas/src/components/EventFeed.tsx`
- Modify: `packages/canvas/src/routes/partials.tsx`

**Step 1: Create `packages/canvas/src/components/EventFeed.tsx`**

```tsx
import type { FC } from "hono/jsx";
import { getAvatarColor, getInitials } from "../lib/avatar";

type EventItem = {
  id: string;
  sender_user_id: string;
  sender_session_id: string | null;
  event_type: string;
  payload: unknown;
  created_at: number;
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function describeEvent(event: EventItem): string {
  if (event.event_type === "session.signal") {
    const payload = event.payload as { signal?: string } | null;
    return payload?.signal ?? "signal";
  }
  return event.event_type;
}

export const EventFeed: FC<{ events: EventItem[]; latestTs: number }> = ({ events, latestTs }) => (
  <div data-latest-ts={String(latestTs)}>
    {events.length === 0 ? (
      <p class="text-sm text-gray-400">No recent events</p>
    ) : (
      <div class="space-y-1">
        {events.map((event) => {
          const color = getAvatarColor(event.sender_user_id);
          const initial = getInitials(event.sender_user_id);
          return (
            <div class="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-100 text-sm">
              <span class="text-xs text-gray-400 font-mono w-16 shrink-0">
                {formatTime(event.created_at)}
              </span>
              <span
                class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0"
                style={`background-color: ${color}`}
              >
                {initial}
              </span>
              <span class="text-gray-600 truncate">{describeEvent(event)}</span>
            </div>
          );
        })}
      </div>
    )}
  </div>
);
```

**Step 2: Add events partial**

Add to `packages/canvas/src/routes/partials.tsx`:

```tsx
import { EventFeed } from "../components/EventFeed";

partials.get("/rooms/:roomId/events", async (c) => {
  const roomId = c.req.param("roomId");
  const since = Number(c.req.query("since") ?? "0");
  const { events, latest_ts } = await api.getEvents(roomId, since);
  return c.html(<EventFeed events={events} latestTs={latest_ts} />);
});
```

**Step 3: Verify typecheck**

Run: `bun run typecheck:canvas`

Expected: No errors.

**Step 4: Manual verification**

1. Both servers running
2. Navigate to a room in the canvas
3. Activity section should show events (or "No recent events")
4. HTMX polls every 3s, `data-latest-ts` updates via Alpine
5. New events should appear as plugin hooks fire

**Step 5: Commit**

```bash
git add packages/canvas/src/components/EventFeed.tsx packages/canvas/src/routes/partials.tsx
git commit -m "feat(canvas): add event feed partial with cursor tracking"
```

---

### Task 8: End-to-end smoke test

No new files — this is a manual integration verification.

**Step 1: Start the API server**

Run: `bun run dev:api`

**Step 2: Create a test room via curl**

```bash
TOKEN=$(echo -n '{"sub":"canvas-dev|1","email":"dev@canvas.local"}' | base64)
curl -s -X POST http://localhost:3000/api/v1/rooms \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"test-room"}' | jq .
```

Note the room `id`.

**Step 3: Start the canvas**

Run: `bun run dev:canvas`

**Step 4: Verify room list**

Open `http://localhost:3002/`. Expect to see "test-room" card.

**Step 5: Emit a session.signal to simulate a plugin**

```bash
ROOM_ID=<id from step 2>
curl -s -X POST "http://localhost:3000/api/v1/rooms/$ROOM_ID/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "session.signal",
    "sender_session_id": "sess-test-1",
    "payload": {"session_id": "sess-test-1", "signal": "BuildSucceeded"}
  }' | jq .
```

**Step 6: Verify room view**

Click "test-room" in the canvas. Within 3 seconds, should see:

- A colored avatar circle with "D" initial (from "dev@canvas.local")
- Green signal dot with "Build Succeeded" label
- Activity feed showing the signal event

**Step 7: Emit a second session from a different "user"**

```bash
TOKEN2=$(echo -n '{"sub":"canvas-dev|2","email":"alice@test.com"}' | base64)
curl -s -X POST "http://localhost:3000/api/v1/rooms/$ROOM_ID/events" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "session.signal",
    "sender_session_id": "sess-alice-1",
    "payload": {"session_id": "sess-alice-1", "signal": "TestsFailed"}
  }' | jq .
```

**Step 8: Verify multi-user display**

Within 3 seconds, canvas should show two avatars:
- "D" circle (dev@canvas.local) — green dot
- "A" circle (alice@test.com) — red dot, **different color** from D

**Step 9: Test same-user multiple sessions**

```bash
curl -s -X POST "http://localhost:3000/api/v1/rooms/$ROOM_ID/events" \
  -H "Authorization: Bearer $TOKEN2" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "session.signal",
    "sender_session_id": "sess-alice-2",
    "payload": {"session_id": "sess-alice-2", "signal": "Idle"}
  }' | jq .
```

Within 3 seconds, Alice should have two avatar circles:
- Both same color, same "A" initial
- One with red dot (TestsFailed), one with gray dot (Idle)
- Index badges "1" and "2" on Alice's avatars

**Step 10: Commit (if any fixes were needed)**

```bash
git add -u
git commit -m "fix(canvas): smoke test fixes"
```

---

## Summary

| Task | Description | Key Output |
|------|-------------|------------|
| 1 | Scaffold canvas package | `packages/canvas/` with Hono server on :3002 |
| 2 | API client with dev token | `api-client.ts` fetches JSON from API |
| 3 | Avatar helpers | Deterministic color/initials from user email |
| 4 | Layout component | Full HTML shell with CDN deps |
| 5 | Room list page + partial | `/` page, `/partials/rooms` fragment |
| 6 | Room view + presence polling | `/rooms/:id` page, 3s HTMX presence poll |
| 7 | Event feed partial | Event list with `latestTs` cursor tracking |
| 8 | End-to-end smoke test | Manual verification with curl |
