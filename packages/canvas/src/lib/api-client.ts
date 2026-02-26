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
    return apiFetch<{
      rooms: Array<{
        id: string;
        name: string;
        created_by: string;
        created_at: number;
        member_count: number;
      }>;
    }>("/rooms");
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
