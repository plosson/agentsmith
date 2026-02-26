# Canvas UI Design — Validation Prototype

> **Date:** 2026-02-26
> **Status:** Approved

## Goal

Build the simplest possible web canvas to validate that the AgentSmith event fabric works end-to-end: list rooms, enter a room, see session avatars with per-user visual commonality, and observe events via polling.

---

## Architecture

**Stack:** Hono (server + JSX), HTMX (server communication), Alpine.js (local state), Tailwind CSS (CDN), same fonts/icons as WEB_TECH_GUIDELINES.

**Pattern:** Canvas server proxies all API calls. Browser never talks to the API directly. HTMX requests hit the canvas server, which fetches JSON from the API, renders HTML fragments, and returns them.

```
Browser (HTMX) → Canvas server (Hono) → API server (JSON)
                       ↓
               Renders HTML fragments
                       ↓
               Returns to browser → HTMX swaps DOM
```

**Location:** `packages/canvas` — a new workspace package that depends on `@agentsmith/shared`.

**Auth bypass:** Hardcoded dev token: `base64({"sub":"canvas-dev|1","email":"dev@canvas.local"})`. Used by the canvas server for all API requests.

**Config:** `AGENTSMITH_API_URL` env var (defaults to `http://localhost:3000`).

---

## Pages & Routes

### Full pages

| Route | Description |
|-------|-------------|
| `GET /` | Room list — grid of rooms with name and member count |
| `GET /rooms/:roomId` | Room view — presence grid + event feed |

### HTML fragment partials (HTMX targets)

| Route | Description |
|-------|-------------|
| `GET /partials/rooms` | Room list cards (refreshable) |
| `GET /partials/rooms/:roomId/presence` | Session avatar grid |
| `GET /partials/rooms/:roomId/events?since=T` | Event feed items |

---

## Polling Mechanism

Two independent HTMX polls on the room view page, both at 3-second intervals:

### Presence polling

```html
<div hx-get="/partials/rooms/:id/presence"
     hx-trigger="load, every 3s"
     hx-swap="innerHTML">
</div>
```

Canvas server calls `GET /api/v1/rooms/:roomId/presence`, renders avatar grid fragment.

### Events polling

```html
<div x-data="{ latestTs: 0 }">
  <div hx-get="/partials/rooms/:id/events"
       hx-vals="js:{since: latestTs}"
       hx-trigger="load, every 3s"
       hx-swap="innerHTML"
       @htmx:after-settle="latestTs = parseInt($el.dataset.latestTs) || latestTs">
  </div>
</div>
```

Canvas server calls `GET /api/v1/rooms/:roomId/events?since=T&limit=50`, renders event list fragment. The fragment includes `data-latest-ts` on the container element so Alpine can update the cursor.

---

## Avatar Design

- **Circle** with deterministic background color derived from `user_id` hash
- **Initials** extracted from `display_name` (email → first letter before @, capitalized)
- Same user across multiple sessions shares the **same color + initial**
- Multiple sessions from same user distinguished by a **small index badge** (1, 2, 3...)
- **Signal indicator** — small colored dot:
  - Green: `SessionStarted`, `BuildSucceeded`, `TestsPassed`
  - Red: `BuildFailed`, `TestsFailed`
  - Yellow: `CommandRunning`, `LongRunningCommand`
  - Blue: `WaitingForInput`
  - Gray: `Idle`, `SessionEnded`

---

## File Structure

```
packages/canvas/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts            # Entry point (Bun.serve)
    ├── app.ts              # Hono app setup
    ├── lib/
    │   ├── api-client.ts   # Fetch wrapper for API server (dev token)
    │   ├── avatar.ts       # Deterministic color + initials from user email
    │   └── config.ts       # AGENTSMITH_API_URL, port config
    ├── routes/
    │   ├── pages.tsx        # Full page routes (/, /rooms/:id)
    │   └── partials.tsx     # HTML fragment routes (/partials/*)
    └── components/
        ├── Layout.tsx       # Full HTML shell (head, CDN deps, body)
        ├── RoomList.tsx     # Room cards grid
        ├── RoomView.tsx     # Room page with presence + feed containers
        ├── SessionGrid.tsx  # Avatar circles grid
        ├── Avatar.tsx       # Single avatar circle
        ├── EventFeed.tsx    # Activity feed list
        └── SignalBadge.tsx  # Signal status indicator dot
```

---

## Explicit Non-Goals

- No WebSocket (polling only)
- No room creation from the canvas
- No canvas → plugin interactions
- No localStorage or auth flow
- No dark mode
- No tests (validation prototype)

---

## Success Criteria

1. Open the canvas at `http://localhost:3002`
2. See a list of rooms
3. Click a room to enter
4. See colored avatar circles for active sessions
5. Avatars from the same user share the same color and initial
6. Avatars update as plugin hooks fire (3s polling)
7. Event feed shows recent activity, updating in real time
