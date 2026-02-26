import type { Database } from "bun:sqlite";
import { Hono } from "hono";

const PRESENCE_WINDOW_MS = 10 * 60 * 1000;

interface PresenceSession {
  user_id: string;
  display_name: string;
  session_id: string;
  signal: string;
  updated_at: number;
}

export function presenceRoutes(db: Database): Hono {
  const router = new Hono();

  router.get("/rooms/:roomId/presence", (c) => {
    const roomId = c.req.param("roomId");
    const now = Date.now();
    const cutoff = now - PRESENCE_WINDOW_MS;

    // MAX(rowid) subquery finds the most recently inserted event per session_id,
    // since SQLite rowid is monotonically increasing with insertion order.
    const rows = db
      .query(
        `SELECT e.sender_user_id AS user_id, e.sender_user_id AS display_name,
                json_extract(e.payload, '$.session_id') AS session_id,
                json_extract(e.payload, '$.signal') AS signal,
                e.created_at AS updated_at
         FROM events e
         WHERE e.room_id = ?
           AND e.event_type = 'session.signal'
           AND e.expires_at > ?
           AND e.created_at > ?
           AND e.rowid IN (
             SELECT MAX(e2.rowid)
             FROM events e2
             WHERE e2.room_id = e.room_id
               AND e2.event_type = 'session.signal'
               AND e2.expires_at > ?
               AND e2.created_at > ?
             GROUP BY json_extract(e2.payload, '$.session_id')
           )
         ORDER BY updated_at DESC`,
      )
      .all(roomId, now, cutoff, now, cutoff) as PresenceSession[];

    return c.json({ sessions: rows });
  });

  return router;
}
