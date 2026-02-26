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
