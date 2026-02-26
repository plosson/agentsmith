// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const API_BASE = 'https://agentsmith-api.axel.siteio.me/api/v1';
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
// Helpers
// ---------------------------------------------------------------------------
function esc(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

// ---------------------------------------------------------------------------
// Components (pure functions → HTML strings)
// ---------------------------------------------------------------------------
function signalBadgeHtml(signal) {
  const color = signalColor(signal);
  const label = signalLabel(signal);
  return `
    <div class="flex items-center gap-1.5">
      <span class="inline-block w-2 h-2 rounded-full" style="background-color: ${color}"></span>
      <span class="text-xs text-gray-500">${esc(label)}</span>
    </div>`;
}

function sessionBadgeHtml(sessionId, size = 'lg') {
  if (!sessionId) return '';
  const tag = sessionId.slice(-4);
  if (size === 'lg') {
    return `<span class="absolute -top-1 -right-2 px-1 py-0.5 rounded-full bg-gray-700 border border-gray-600 text-[9px] font-mono font-medium text-gray-300 leading-none">${esc(tag)}</span>`;
  }
  return `<span class="absolute -top-0.5 -right-1.5 px-0.5 rounded-full bg-gray-700 border border-gray-600 text-[7px] font-mono font-medium text-gray-300 leading-none">${esc(tag)}</span>`;
}

function avatarHtml(session) {
  const color = avatarColor(session.user_id);
  const letter = initials(session.display_name);
  return `
    <div class="flex flex-col items-center gap-2 p-3" title="${esc(session.display_name)}\n${esc(session.session_id)}">
      <div class="relative">
        <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg"
             style="background-color: ${color}">${letter}</div>
        ${sessionBadgeHtml(session.session_id, 'lg')}
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
      <div class="relative shrink-0">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
              style="background-color: ${color}">${letter}</span>
        ${sessionBadgeHtml(event.sender.session_id, 'sm')}
      </div>
      <span class="text-gray-400 truncate">${esc(describeEvent(event))}</span>
    </div>`;
}

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
// Views
// ---------------------------------------------------------------------------
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
              <h3 class="font-medium text-gray-100 font-mono text-sm">${esc(room.id)}</h3>
              <span class="text-xs text-gray-500">
                ${room.member_count} ${room.member_count === 1 ? 'member' : 'members'}
              </span>
            </div>
          </a>`).join('')}
      </div>`;
  } catch (err) {
    app.innerHTML = `<p class="text-red-400">Failed to load rooms: ${esc(err.message)}</p>`;
  }
}

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
    el.innerHTML = `<div class="flex flex-wrap gap-2">${sessions.map((s) => avatarHtml(s)).join('')}</div>`;
  }

  function renderEvents(events) {
    const el = document.getElementById('event-feed');
    if (!el) return;
    if (events.length === 0 && latestTs === 0) {
      el.innerHTML = '<p class="text-sm text-gray-500">No recent events</p>';
      return;
    }
    // Reverse so newest events appear at the top
    const reversed = [...events].reverse();
    if (latestTs === 0) {
      el.innerHTML = `<div class="space-y-1">${reversed.map(eventItemHtml).join('')}</div>`;
    } else if (events.length > 0) {
      const container = el.querySelector('.space-y-1');
      if (container) {
        container.insertAdjacentHTML('afterbegin', reversed.map(eventItemHtml).join(''));
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
    const { rooms } = await api.listRooms();
    const room = rooms.find((r) => r.id === roomId);
    const roomName = room?.id ?? roomId;

    app.innerHTML = `
      <div class="flex items-center gap-3 mb-6">
        <a href="#/" class="text-gray-500 hover:text-gray-300 text-sm">&larr; Rooms</a>
        <h1 class="text-xl font-semibold font-mono">${esc(roomName)}</h1>
      </div>
      <section class="mb-8">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Sessions</h2>
        <div id="presence-grid"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>
      <section>
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Activity</h2>
        <div id="event-feed"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>`;

    await Promise.all([pollPresence(), pollEvents()]);

    addPollTimer(pollPresence, POLL_INTERVAL);
    addPollTimer(pollEvents, POLL_INTERVAL);
  } catch (err) {
    app.innerHTML = `<p class="text-red-400">Failed to load room: ${esc(err.message)}</p>`;
  }
}
