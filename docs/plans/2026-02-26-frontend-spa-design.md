# Frontend SPA Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the server-rendered canvas with a pure SPA (single HTML + single JS file) in `frontend/` that talks directly to the API server.

**Architecture:** Vanilla JS with template literals, hash-based routing, `setInterval` polling. Two views (rooms list, room detail with presence + activity feed). No build step, no framework.

**Tech Stack:** Vanilla JS, Tailwind CDN, Google Fonts (Geist + Fira Mono)

---

### Task 1: Create `index.html` shell

**Files:**
- Create: `frontend/index.html`

**Step 1: Write the HTML file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentSmith Canvas</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Fira+Mono:wght@400;500&display=swap" rel="stylesheet">

  <script src="https://cdn.tailwindcss.com"></script>
  <script>
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
  </script>
</head>
<body class="font-sans bg-gray-900 text-gray-100 min-h-screen">
  <header class="border-b border-gray-800 bg-gray-900 px-6 py-4">
    <div class="flex items-center gap-3">
      <a href="#/" class="text-lg font-semibold tracking-tight text-gray-100">AgentSmith</a>
      <span class="text-sm text-gray-500">Canvas</span>
    </div>
  </header>
  <main id="app" class="max-w-5xl mx-auto px-6 py-8"></main>
  <script src="app.js"></script>
</body>
</html>
```

**Step 2: Verify it loads**

Open `frontend/index.html` in a browser (or `python3 -m http.server 8080` from `frontend/`). Should show header with "AgentSmith Canvas" on a dark background, empty main area.

**Step 3: Commit**

```bash
git add frontend/index.html
git commit -m "feat(frontend): add SPA HTML shell with Tailwind + fonts"
```

---

### Task 2: Create `app.js` — config + API client + router skeleton

**Files:**
- Create: `frontend/app.js`

**Step 1: Write the file with config, API client, and router**

```js
// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = 'http://localhost:3000/api/v1';
const POLL_INTERVAL = 3000;

const DEV_TOKEN = btoa(JSON.stringify({ sub: 'canvas-dev|1', email: 'dev@canvas.local' }));

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DEV_TOKEN}`,
    },
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  return res.json();
}

const api = {
  listRooms: () => apiFetch('/rooms'),
  getPresence: (roomId) => apiFetch(`/rooms/${roomId}/presence`),
  getEvents: (roomId, since, limit = 50) =>
    apiFetch(`/rooms/${roomId}/events?since=${since}&limit=${limit}`),
};

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
let pollTimers = [];

function clearPolling() {
  pollTimers.forEach(clearInterval);
  pollTimers = [];
}

function addPollTimer(fn, ms) {
  pollTimers.push(setInterval(fn, ms));
}

function navigate() {
  clearPolling();
  const hash = location.hash || '#/';
  const app = document.getElementById('app');

  const roomMatch = hash.match(/^#\/rooms\/(.+)$/);
  if (roomMatch) {
    renderRoomDetail(app, roomMatch[1]);
  } else {
    renderRoomsList(app);
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);

// ---------------------------------------------------------------------------
// Views (placeholder — implemented in next tasks)
// ---------------------------------------------------------------------------
function renderRoomsList(app) {
  app.innerHTML = '<p class="text-gray-400">Loading rooms...</p>';
}

function renderRoomDetail(app, roomId) {
  app.innerHTML = `<p class="text-gray-400">Loading room ${roomId}...</p>`;
}
```

**Step 2: Verify routing works**

Open in browser. Should show "Loading rooms...". Navigate to `#/rooms/test` — should show "Loading room test...". Back button returns to rooms list.

**Step 3: Commit**

```bash
git add frontend/app.js
git commit -m "feat(frontend): add API client, router, and view stubs"
```

---

### Task 3: Implement helper functions (avatar colors, signal colors, time formatting)

**Files:**
- Modify: `frontend/app.js` — add helpers section between API client and Router sections

**Step 1: Add the helper functions**

Insert after the `api` object and before the `// Router` section:

```js
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const AVATAR_COLORS = [
  '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
  '#1abc9c', '#e67e22', '#34495e', '#16a085', '#c0392b',
  '#2980b9', '#8e44ad', '#27ae60', '#d35400', '#7f8c8d',
];

function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

function avatarColor(userId) {
  return AVATAR_COLORS[hashString(userId) % AVATAR_COLORS.length];
}

function initials(displayName) {
  const name = displayName.split('@')[0];
  return name ? name.charAt(0).toUpperCase() : '?';
}

function signalColor(signal) {
  switch (signal) {
    case 'SessionStarted': case 'BuildSucceeded': case 'TestsPassed': return '#2ecc71';
    case 'BuildFailed': case 'TestsFailed': return '#e74c3c';
    case 'CommandRunning': case 'LongRunningCommand': return '#f39c12';
    case 'WaitingForInput': return '#3498db';
    case 'HighTokenUsage': return '#e67e22';
    default: return '#95a5a6';
  }
}

function signalLabel(signal) {
  return signal.replace(/([A-Z])/g, ' $1').trim();
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function describeEvent(event) {
  if (event.type === 'session.signal') {
    return event.payload?.signal ?? 'signal';
  }
  return event.type;
}
```

**Step 2: Commit**

```bash
git add frontend/app.js
git commit -m "feat(frontend): add avatar, signal, and time helper functions"
```

---

### Task 4: Implement component functions (avatar, signalBadge, eventItem)

**Files:**
- Modify: `frontend/app.js` — add components section after helpers, before router

**Step 1: Add the component functions**

Insert after the helpers section and before the `// Router` section:

```js
// ---------------------------------------------------------------------------
// Components (pure functions → HTML strings)
// ---------------------------------------------------------------------------
function signalBadgeHtml(signal) {
  const color = signalColor(signal);
  const label = signalLabel(signal);
  return `
    <div class="flex items-center gap-1.5">
      <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${color}"></span>
      <span class="text-xs text-gray-500">${label}</span>
    </div>`;
}

function avatarHtml(session, sessionIndex) {
  const color = avatarColor(session.user_id);
  const letter = initials(session.display_name);
  const badge = sessionIndex !== undefined
    ? `<span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gray-700 border border-gray-600 text-[10px] font-medium flex items-center justify-center text-gray-300">${sessionIndex + 1}</span>`
    : '';
  return `
    <div class="flex flex-col items-center gap-2 p-3" title="${session.display_name}\n${session.session_id}">
      <div class="relative">
        <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg"
             style="background-color: ${color}">${letter}</div>
        ${badge}
      </div>
      ${signalBadgeHtml(session.signal)}
    </div>`;
}

function eventItemHtml(event) {
  const color = avatarColor(event.sender.user_id);
  const letter = initials(event.sender.user_id);
  return `
    <div class="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-800 text-sm">
      <span class="text-xs text-gray-500 font-mono w-16 shrink-0">${formatTime(event.created_at)}</span>
      <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium shrink-0"
            style="background-color: ${color}">${letter}</span>
      <span class="text-gray-400 truncate">${describeEvent(event)}</span>
    </div>`;
}
```

**Step 2: Commit**

```bash
git add frontend/app.js
git commit -m "feat(frontend): add avatar, signalBadge, eventItem component functions"
```

---

### Task 5: Implement rooms list view

**Files:**
- Modify: `frontend/app.js` — replace placeholder `renderRoomsList`

**Step 1: Replace the renderRoomsList function**

```js
async function renderRoomsList(app) {
  app.innerHTML = '<p class="text-gray-400">Loading rooms...</p>';
  try {
    const { rooms } = await api.listRooms();
    if (rooms.length === 0) {
      app.innerHTML = `
        <div class="text-center py-16 text-gray-500">
          <p class="text-lg">No rooms yet</p>
          <p class="text-sm mt-1">Create a room via the API to get started.</p>
        </div>`;
      return;
    }
    app.innerHTML = `
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-semibold">Rooms</h1>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        ${rooms.map((room) => `
          <a href="#/rooms/${room.id}"
             class="block bg-gray-800 rounded-lg border border-gray-700 p-5 hover:border-gray-500 hover:shadow-sm transition-all">
            <div class="flex items-center justify-between">
              <h3 class="font-medium text-gray-100 font-mono text-sm">${room.name}</h3>
              <span class="text-xs text-gray-500">
                ${room.member_count} ${room.member_count === 1 ? 'member' : 'members'}
              </span>
            </div>
          </a>`).join('')}
      </div>`;
  } catch (err) {
    app.innerHTML = `<p class="text-red-400">Failed to load rooms: ${err.message}</p>`;
  }
}
```

**Step 2: Test with the API running**

Start the API server: `cd backend && bun run dev:api`
Open `frontend/index.html` — should show rooms grid (or empty state if no rooms exist).

**Step 3: Commit**

```bash
git add frontend/app.js
git commit -m "feat(frontend): implement rooms list view"
```

---

### Task 6: Implement room detail view with presence + activity feed + polling

**Files:**
- Modify: `frontend/app.js` — replace placeholder `renderRoomDetail`

**Step 1: Replace the renderRoomDetail function**

```js
async function renderRoomDetail(app, roomId) {
  app.innerHTML = '<p class="text-gray-400">Loading room...</p>';
  let latestTs = 0;

  function renderSessions(sessions) {
    const el = document.getElementById('presence-grid');
    if (!el) return;
    if (sessions.length === 0) {
      el.innerHTML = '<div class="text-center py-10 text-gray-500"><p class="text-sm">No active sessions</p></div>';
      return;
    }
    // Compute per-user session index
    const counts = {};
    const indexed = sessions.map((s) => {
      const idx = counts[s.user_id] ?? 0;
      counts[s.user_id] = idx + 1;
      return { ...s, idx };
    });
    const multi = new Set(Object.entries(counts).filter(([, c]) => c > 1).map(([id]) => id));
    el.innerHTML = `<div class="flex flex-wrap gap-2">${indexed.map((s) => avatarHtml(s, multi.has(s.user_id) ? s.idx : undefined)).join('')}</div>`;
  }

  function renderEvents(events) {
    const el = document.getElementById('event-feed');
    if (!el) return;
    if (events.length === 0 && latestTs === 0) {
      el.innerHTML = '<p class="text-sm text-gray-500">No recent events</p>';
      return;
    }
    // Append new events (or set initial)
    if (latestTs === 0) {
      el.innerHTML = `<div class="space-y-1">${events.map(eventItemHtml).join('')}</div>`;
    } else if (events.length > 0) {
      const container = el.querySelector('.space-y-1');
      if (container) {
        container.insertAdjacentHTML('beforeend', events.map(eventItemHtml).join(''));
      }
    }
  }

  async function pollPresence() {
    try {
      const { sessions } = await api.getPresence(roomId);
      renderSessions(sessions);
    } catch (_) { /* silently retry next cycle */ }
  }

  async function pollEvents() {
    try {
      const { events, latest_ts } = await api.getEvents(roomId, latestTs);
      renderEvents(events);
      if (latest_ts > latestTs) latestTs = latest_ts;
    } catch (_) { /* silently retry next cycle */ }
  }

  try {
    // Get room name from rooms list
    const { rooms } = await api.listRooms();
    const room = rooms.find((r) => r.id === roomId);
    const roomName = room?.name ?? roomId;

    app.innerHTML = `
      <div class="flex items-center gap-3 mb-6">
        <a href="#/" class="text-gray-500 hover:text-gray-300 text-sm">&larr; Rooms</a>
        <h1 class="text-xl font-semibold font-mono">${roomName}</h1>
      </div>
      <section class="mb-8">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Sessions</h2>
        <div id="presence-grid"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>
      <section>
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Activity</h2>
        <div id="event-feed"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>`;

    // Initial fetch
    await Promise.all([pollPresence(), pollEvents()]);

    // Start polling
    addPollTimer(pollPresence, POLL_INTERVAL);
    addPollTimer(pollEvents, POLL_INTERVAL);
  } catch (err) {
    app.innerHTML = `<p class="text-red-400">Failed to load room: ${err.message}</p>`;
  }
}
```

**Step 2: Test with the API running**

Navigate to a room (`#/rooms/<id>`). Should see session avatars with signal badges, activity feed with timestamps. Presence and events should refresh every 3s. Back link returns to rooms list. Polling should stop when navigating away.

**Step 3: Commit**

```bash
git add frontend/app.js
git commit -m "feat(frontend): implement room detail view with presence + activity polling"
```

---

### Task 7: Manual integration test

**Step 1: Start the API server**

```bash
cd backend && bun run dev:api
```

**Step 2: Serve the frontend**

```bash
cd frontend && python3 -m http.server 8080
```

**Step 3: Test all flows**

1. Open `http://localhost:8080` — rooms list loads
2. Click a room — room detail loads with sessions + events
3. Wait 3s — presence and events refresh (check network tab)
4. Click "← Rooms" — returns to rooms list, polling stops (verify in network tab)
5. Use browser back/forward — routing works correctly
6. If no rooms exist, the empty state displays correctly

**Step 4: Final commit if any tweaks needed**
