// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_ORIGIN = IS_LOCAL ? `http://${location.hostname}:6001` : 'https://agentsmith-api.axel.siteio.me';
const API_BASE = `${API_ORIGIN}/api/v1`;
const AUTH_BASE = API_ORIGIN;
const GOOGLE_CLIENT_ID = '981559040299-kvtuldub9dklomij0se0fgr5ba6f8cpg.apps.googleusercontent.com';
const POLL_INTERVAL = 3000;

// ---------------------------------------------------------------------------
// Auth state
// ---------------------------------------------------------------------------
let authToken = localStorage.getItem('agentsmith_token');
let currentUser = JSON.parse(localStorage.getItem('agentsmith_user') || 'null');

function setAuth(token, user) {
  authToken = token;
  currentUser = user;
  localStorage.setItem('agentsmith_token', token);
  localStorage.setItem('agentsmith_user', JSON.stringify(user));
  renderUserInfo();
}

function clearAuth() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem('agentsmith_token');
  localStorage.removeItem('agentsmith_user');
  renderUserInfo();
  navigate();
}

function isLoggedIn() {
  return !!authToken;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------
async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      ...(options.headers || {}),
    },
  });
  if (res.status === 401) {
    clearAuth();
    throw new Error('Session expired');
  }
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
// Google Sign-In callback
// ---------------------------------------------------------------------------
async function handleGoogleCredential(response) {
  try {
    const res = await fetch(`${AUTH_BASE}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential }),
    });
    if (!res.ok) throw new Error('Authentication failed');
    const { token, user } = await res.json();
    setAuth(token, user);
    navigate();
  } catch (err) {
    const app = document.getElementById('app');
    app.innerHTML = `<p class="text-red-400">Sign-in failed: ${esc(err.message)}</p>`;
  }
}

// Make it available globally for Google callback
window.handleGoogleCredential = handleGoogleCredential;

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

function timeAgo(ts) {
  const seconds = Math.floor((Date.now() - ts) / 1000);
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}

function describeEvent(event) {
  if (event.type === 'session.signal') {
    return event.payload?.signal ?? 'signal';
  }
  return event.type;
}

function displayName(userId) {
  const name = userId.split('@')[0];
  return name || userId;
}

// ---------------------------------------------------------------------------
// Components (pure functions -> HTML strings)
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
  const name = displayName(session.display_name);
  return `
    <div class="flex flex-col items-center gap-2 p-3" title="${esc(session.display_name)}\n${esc(session.session_id)}">
      <div class="relative">
        <div class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg"
             style="background-color: ${color}">${letter}</div>
        ${sessionBadgeHtml(session.session_id, 'lg')}
      </div>
      <span class="text-xs text-gray-300 truncate max-w-[5rem] text-center">${esc(name)}</span>
      <span class="text-[10px] text-gray-500">${timeAgo(session.updated_at)}</span>
      ${signalBadgeHtml(session.signal)}
    </div>`;
}

function eventItemHtml(event) {
  const color = avatarColor(event.sender.user_id);
  const letter = initials(event.sender.user_id);
  const name = displayName(event.sender.user_id);
  return `
    <div class="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-gray-800 text-sm">
      <span class="text-xs text-gray-500 font-mono w-16 shrink-0">${formatTime(event.created_at)}</span>
      <div class="relative shrink-0">
        <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-medium"
              style="background-color: ${color}">${letter}</span>
        ${sessionBadgeHtml(event.sender.session_id, 'sm')}
      </div>
      <span class="text-gray-300 shrink-0 text-xs font-medium">${esc(name)}</span>
      <span class="text-gray-500 truncate">${esc(describeEvent(event))}</span>
    </div>`;
}

// ---------------------------------------------------------------------------
// User info in header
// ---------------------------------------------------------------------------
function renderUserInfo() {
  const el = document.getElementById('user-info');
  if (!el) return;
  if (!isLoggedIn() || !currentUser) {
    el.innerHTML = '';
    return;
  }
  const name = currentUser.name || currentUser.email;
  el.innerHTML = `
    <span class="text-sm text-gray-400">${esc(name)}</span>
    <button onclick="clearAuth()" class="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1">
      Sign out
    </button>`;
}

// ---------------------------------------------------------------------------
// Login view
// ---------------------------------------------------------------------------
function renderLogin(app) {
  app.innerHTML = `
    <div class="flex flex-col items-center justify-center py-24">
      <h2 class="text-xl font-semibold mb-2">Welcome to AgentSmith</h2>
      <p class="text-gray-400 mb-8">Sign in with your Google account to continue.</p>
      <div id="g_id_onload"
           data-client_id="${GOOGLE_CLIENT_ID}"
           data-callback="handleGoogleCredential"
           data-auto_prompt="false">
      </div>
      <div class="g_id_signin"
           data-type="standard"
           data-size="large"
           data-theme="filled_black"
           data-text="sign_in_with"
           data-shape="rectangular"
           data-logo_alignment="left">
      </div>
    </div>`;

  // Re-initialize Google button if the GSI library is already loaded
  if (window.google?.accounts?.id) {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    const btnContainer = app.querySelector('.g_id_signin');
    if (btnContainer) {
      google.accounts.id.renderButton(btnContainer, {
        type: 'standard',
        size: 'large',
        theme: 'filled_black',
        text: 'sign_in_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
let pollTimers = [];
let activeEventSource = null;

function clearPolling() {
  pollTimers.forEach(clearInterval);
  pollTimers = [];
  if (activeEventSource) {
    activeEventSource.close();
    activeEventSource = null;
  }
}

function addPollTimer(fn, ms) {
  pollTimers.push(setInterval(fn, ms));
}

function navigate() {
  clearPolling();
  const hash = location.hash || '#/';
  const app = document.getElementById('app');

  // #/link works both logged-in and not (shows sign-in first if needed)
  if (hash === '#/link') {
    if (!isLoggedIn()) {
      renderLogin(app);
      return;
    }
    renderUserInfo();
    renderLink(app);
    return;
  }

  if (!isLoggedIn()) {
    renderLogin(app);
    return;
  }

  renderUserInfo();

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
async function renderLink(app) {
  app.innerHTML = '<p class="text-gray-400">Generating setup token...</p>';
  try {
    const { key } = await apiFetch('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'plugin' }),
    });

    const payload = { server_url: API_ORIGIN, email: currentUser.email, api_key: key };
    const token = 'asm_' + btoa(JSON.stringify(payload));
    const masked = key.substring(0, 8) + '...';

    app.innerHTML = `
      <div class="max-w-lg mx-auto py-12">
        <h1 class="text-2xl font-bold mb-2 text-center">Setup Token</h1>
        <p class="text-gray-400 mb-8 text-center">Paste this token in your terminal to link AgentSmith.</p>

        <div class="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-4">
          <code id="token-display" class="text-green-400 text-sm break-all select-all">${esc(token)}</code>
        </div>

        <div class="flex justify-center mb-8">
          <button id="copy-token-btn" onclick="copyToken()" class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
            Copy to clipboard
          </button>
        </div>
        <p id="copy-token-feedback" class="text-green-400 text-sm text-center hidden mb-6">Copied!</p>

        <div class="border-t border-gray-700 pt-6 space-y-2 text-sm text-gray-400">
          <p><span class="text-gray-500">Server:</span> ${esc(API_ORIGIN)}</p>
          <p><span class="text-gray-500">Email:</span> ${esc(currentUser.email)}</p>
          <p><span class="text-gray-500">API key:</span> ${esc(masked)}</p>
        </div>
      </div>`;
  } catch (err) {
    app.innerHTML = `<p class="text-red-400 text-center py-12">Failed to generate token: ${esc(err.message)}</p>`;
  }
}

function copyToken() {
  const tokenEl = document.getElementById('token-display');
  if (!tokenEl) return;
  navigator.clipboard.writeText(tokenEl.textContent).then(() => {
    const fb = document.getElementById('copy-token-feedback');
    if (fb) {
      fb.classList.remove('hidden');
      setTimeout(() => fb.classList.add('hidden'), 2000);
    }
  });
}
window.copyToken = copyToken;

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

  function appendEvent(event) {
    const el = document.getElementById('event-feed');
    if (!el) return;
    let container = el.querySelector('.space-y-1');
    if (!container) {
      el.innerHTML = '<div class="space-y-1"></div>';
      container = el.querySelector('.space-y-1');
    }
    container.insertAdjacentHTML('afterbegin', eventItemHtml(event));
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

  let eventPollTimer = null;
  let sseRetryTimeout = null;

  function stopEventPolling() {
    if (eventPollTimer) {
      clearInterval(eventPollTimer);
      eventPollTimer = null;
    }
    if (sseRetryTimeout) {
      clearTimeout(sseRetryTimeout);
      sseRetryTimeout = null;
    }
  }

  function startEventPolling() {
    if (!eventPollTimer) {
      eventPollTimer = setInterval(pollEvents, POLL_INTERVAL);
      pollTimers.push(eventPollTimer);
    }
  }

  function connectEventStream(room, since) {
    const url = `${API_BASE}/rooms/${encodeURIComponent(room)}/events/stream?since=${since}&token=${authToken}`;
    const es = new EventSource(url);
    activeEventSource = es;
    stopEventPolling();

    es.addEventListener('event', (e) => {
      try {
        const event = JSON.parse(e.data);
        appendEvent(event);
        if (event.created_at > latestTs) latestTs = event.created_at;
      } catch (_) { /* ignore parse errors */ }
    });

    es.onerror = () => {
      es.close();
      if (activeEventSource === es) activeEventSource = null;
      startEventPolling();
      sseRetryTimeout = setTimeout(() => {
        sseRetryTimeout = null;
        if (activeEventSource) return;
        connectEventStream(room, latestTs);
      }, 5000);
    };
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

    await pollPresence();
    connectEventStream(roomId, latestTs);

    addPollTimer(pollPresence, POLL_INTERVAL);
  } catch (err) {
    app.innerHTML = `<p class="text-red-400">Failed to load room: ${esc(err.message)}</p>`;
  }
}
