import type { Database } from "bun:sqlite";
import { Hono } from "hono";

const PRESENCE_WINDOW_MS = 10 * 60 * 1000;

interface PresenceRow {
  user_id: string;
  session_id: string;
  type: string;
  updated_at: number;
}

interface PresenceSession {
  user_id: string;
  display_name: string;
  session_id: string;
  signal: string;
  updated_at: number;
}

function signalFromEventType(type: string): string {
  switch (type) {
    case "hook.SessionStart":
      return "SessionStarted";
    case "hook.Stop":
      return "Idle";
    default:
      return "Active";
  }
}

export function presenceRoutes(db: Database): Hono {
  const router = new Hono();

  router.get("/rooms/:roomId/presence", (c) => {
    const roomId = c.req.param("roomId");
    const now = Date.now();
    const cutoff = now - PRESENCE_WINDOW_MS;

    const rows = db
      .query(
        `SELECT e.sender_user_id AS user_id,
                e.sender_session_id AS session_id,
                e.type,
                e.created_at AS updated_at
         FROM events e
         WHERE e.room_id = ?
           AND e.sender_session_id IS NOT NULL
           AND e.type != 'hook.SessionEnd'
           AND e.expires_at > ?
           AND e.created_at > ?
           AND e.rowid IN (
             SELECT MAX(e2.rowid)
             FROM events e2
             WHERE e2.room_id = e.room_id
               AND e2.sender_session_id IS NOT NULL
               AND e2.type != 'hook.SessionEnd'
               AND e2.expires_at > ?
               AND e2.created_at > ?
             GROUP BY e2.sender_session_id
           )
         ORDER BY updated_at DESC`,
      )
      .all(roomId, now, cutoff, now, cutoff) as PresenceRow[];

    const sessions: PresenceSession[] = rows.map((row) => ({
      user_id: row.user_id,
      display_name: row.user_id,
      session_id: row.session_id,
      signal: signalFromEventType(row.type),
      updated_at: row.updated_at,
    }));

    return c.json({ sessions });
  });

  return router;
}
