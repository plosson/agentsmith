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
      <a href="/" class="text-gray-400 hover:text-gray-600 text-sm">
        &larr; Rooms
      </a>
      <h1 class="text-xl font-semibold font-mono">{roomName}</h1>
    </div>

    <section class="mb-8">
      <h2 class="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">Sessions</h2>
      <div
        id="presence-grid"
        hx-get={`/partials/rooms/${roomId}/presence`}
        hx-trigger="load, every 3s"
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
      >
        <p class="text-sm text-gray-400">Loading events...</p>
      </div>
    </section>

    <script
      dangerouslySetInnerHTML={{
        __html: `
      document.getElementById('event-feed').addEventListener('htmx:afterSettle', function(evt) {
        var ts = evt.target.querySelector('[data-latest-ts]');
        if (ts) {
          var scope = Alpine.$data(evt.target.closest('[x-data]'));
          if (scope) scope.latestTs = parseInt(ts.dataset.latestTs) || scope.latestTs;
        }
      });
    `,
      }}
    />
  </div>
);
