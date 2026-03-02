// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------
import { GOOGLE_CLIENT_ID, API_BASE, API_ORIGIN, POLL_INTERVAL } from './config.js';
import { isLoggedIn, getCurrentUser, getAuthToken, handleGoogleCredential } from './auth.js';
import { apiFetch, api } from './api.js';
import { esc, avatarHtml, eventItemHtml, visibilityBadgeHtml, memberRowHtml } from './helpers.js';

// ---------------------------------------------------------------------------
// Polling state — managed here, cleanup exported for router
// ---------------------------------------------------------------------------
let pollTimers = [];
let activeEventSource = null;

export function clearPolling() {
  pollTimers.forEach(clearInterval);
  pollTimers = [];
  if (activeEventSource) {
    activeEventSource.abort();
    activeEventSource = null;
  }
}

function addPollTimer(fn, ms) {
  pollTimers.push(setInterval(fn, ms));
}

// ---------------------------------------------------------------------------
// User info in header
// ---------------------------------------------------------------------------
export function renderUserInfo() {
  const el = document.getElementById('user-info');
  if (!el) return;
  const user = getCurrentUser();
  if (!isLoggedIn() || !user) {
    el.innerHTML = '';
    return;
  }
  const name = user.email;
  const adminBadge = user.is_admin
    ? ' <span class="text-[10px] font-medium text-amber-400 border border-amber-400/30 rounded px-1.5 py-0.5 uppercase tracking-wider">Admin</span>'
    : '';
  el.innerHTML = `
    <a href="#/link" class="text-sm text-gray-400 hover:text-gray-200">Link</a>
    <span class="text-sm text-gray-400">${esc(name)}</span>${adminBadge}
    <button onclick="clearAuth()" class="text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-1">
      Sign out
    </button>`;
}

// ---------------------------------------------------------------------------
// Login view
// ---------------------------------------------------------------------------
export function renderLogin(app) {
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
// Link / setup token view
// ---------------------------------------------------------------------------
export async function renderLink(app) {
  app.innerHTML = '<p class="text-gray-400">Generating setup token...</p>';
  try {
    const user = getCurrentUser();
    const { key } = await apiFetch('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name: 'plugin' }),
    });

    const payload = { server_url: API_ORIGIN, web_url: location.origin, email: user.email, api_key: key };
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
          <p><span class="text-gray-500">Web:</span> ${esc(location.origin)}</p>
          <p><span class="text-gray-500">Email:</span> ${esc(user.email)}</p>
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

// ---------------------------------------------------------------------------
// Rooms list view
// ---------------------------------------------------------------------------
export async function renderRoomsList(app) {
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

// ---------------------------------------------------------------------------
// Room detail view
// ---------------------------------------------------------------------------
export async function renderRoomDetail(app, roomId) {
  app.innerHTML = '<p class="text-gray-400">Loading room...</p>';
  let latestTs = 0;

  // --- Client-side presence from SSE events ---
  const sessionsMap = new Map();
  const PRESENCE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  function updatePresenceFromEvent(event) {
    const sid = event.sender?.session_id;
    if (!sid) return;
    if (event.type === 'hook.SessionEnd') {
      sessionsMap.delete(sid);
      return;
    }
    let signal = 'Active';
    if (event.type === 'hook.SessionStart') signal = 'SessionStarted';
    else if (event.type === 'hook.Stop') signal = 'Idle';
    sessionsMap.set(sid, {
      user_id: event.sender.user_id,
      display_name: event.sender.display_name || event.sender.user_id,
      session_id: sid,
      signal,
      updated_at: event.created_at || Date.now(),
    });
  }

  function refreshPresenceGrid() {
    const now = Date.now();
    for (const [sid, info] of sessionsMap) {
      if (now - info.updated_at > PRESENCE_TTL_MS) sessionsMap.delete(sid);
    }
    renderSessions([...sessionsMap.values()]);
  }

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
    const url = `${API_BASE}/rooms/${encodeURIComponent(room)}/events/stream?since=${since}`;
    const controller = new AbortController();
    activeEventSource = controller;
    stopEventPolling();

    (async () => {
      try {
        const res = await fetch(url, {
          headers: { 'Authorization': `Bearer ${getAuthToken()}` },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) throw new Error(`SSE ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const blocks = buf.split('\n\n');
          buf = blocks.pop();
          for (const block of blocks) {
            let eventType = '', data = '';
            for (const line of block.split('\n')) {
              if (line.startsWith('event: ')) eventType = line.slice(7);
              else if (line.startsWith('data: ')) data += line.slice(6);
            }
            if (eventType === 'event' && data) {
              try {
                const event = JSON.parse(data);
                appendEvent(event);
                updatePresenceFromEvent(event);
                refreshPresenceGrid();
                if (event.created_at > latestTs) latestTs = event.created_at;
              } catch (_) { /* ignore parse errors */ }
            }
          }
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.error('[SSE] connection failed:', err);
      }
      // Disconnected — fall back to polling and retry
      if (activeEventSource === controller) activeEventSource = null;
      startEventPolling();
      sseRetryTimeout = setTimeout(() => {
        sseRetryTimeout = null;
        if (activeEventSource) return;
        connectEventStream(room, latestTs);
      }, 5000);
    })();
  }

  function renderMembers(members, isAdmin) {
    const el = document.getElementById('members-list');
    if (!el) return;
    if (members.length === 0) {
      el.innerHTML = '<p class="text-sm text-gray-500">No members</p>';
      return;
    }
    el.innerHTML = members.map((m) => memberRowHtml(m, isAdmin, roomId)).join('');
  }

  try {
    const room = await api.getRoom(roomId);
    const user = getCurrentUser();
    const isAdmin = !!user?.is_admin;
    const roomName = room.id;

    const visibilityToggle = isAdmin
      ? `<button id="visibility-toggle" onclick="toggleVisibility()" class="cursor-pointer hover:opacity-80">${visibilityBadgeHtml(room.is_public)}</button>`
      : visibilityBadgeHtml(room.is_public);

    const membersSection = `
      <section class="mb-8">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Members</h2>
        ${isAdmin ? `
        <div class="flex items-center gap-2 mb-3">
          <input id="add-member-email" type="email" placeholder="email@example.com"
                 class="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-gray-500 flex-1 max-w-xs" />
          <button onclick="addMember()" class="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded px-3 py-1.5">Add</button>
        </div>` : ''}
        <div id="members-list"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>`;

    app.innerHTML = `
      <div class="flex items-center gap-3 mb-6">
        <a href="#/" class="text-gray-500 hover:text-gray-300 text-sm">&larr; Rooms</a>
        <h1 class="text-xl font-semibold font-mono">${esc(roomName)}</h1>
        ${visibilityToggle}
      </div>
      <section class="mb-8">
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Sessions</h2>
        <div id="presence-grid"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>
      ${membersSection}
      <section>
        <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Activity</h2>
        <div id="event-feed"><p class="text-sm text-gray-500">Loading...</p></div>
      </section>`;

    renderMembers(room.members || [], isAdmin);

    window.toggleVisibility = async () => {
      try {
        const updated = await api.updateRoom(roomId, { is_public: !room.is_public });
        room.is_public = updated.is_public;
        const btn = document.getElementById('visibility-toggle');
        if (btn) btn.innerHTML = visibilityBadgeHtml(room.is_public);
      } catch (err) {
        alert(`Failed to update visibility: ${err.message}`);
      }
    };

    window.addMember = async () => {
      const input = document.getElementById('add-member-email');
      const email = input?.value?.trim();
      if (!email) return;
      try {
        await api.addMember(roomId, email);
        input.value = '';
        const updated = await api.getRoom(roomId);
        renderMembers(updated.members || [], isAdmin);
      } catch (err) {
        alert(`Failed to add member: ${err.message}`);
      }
    };

    window.removeMember = async (rid, email) => {
      try {
        await api.removeMember(rid, email);
        const updated = await api.getRoom(roomId);
        renderMembers(updated.members || [], isAdmin);
      } catch (err) {
        alert(`Failed to remove member: ${err.message}`);
      }
    };

    connectEventStream(roomId, latestTs);

    addPollTimer(() => refreshPresenceGrid(), 60_000);
  } catch (err) {
    app.innerHTML = `<p class="text-red-400">Failed to load room: ${esc(err.message)}</p>`;
  }
}
