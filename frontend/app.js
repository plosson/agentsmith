// ---------------------------------------------------------------------------
// Router + entry point
// ---------------------------------------------------------------------------
import { isLoggedIn } from './auth.js';
import { clearPolling, renderUserInfo, renderLogin, renderLink, renderRoomsList, renderRoomDetail } from './views.js';

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

window.addEventListener('auth-change', navigate);
window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', navigate);
