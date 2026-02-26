import type { Database } from "bun:sqlite";
import type { Event } from "@agentsmith/shared";
import { generateUlid } from "../lib/ulid";

export interface InsertEventParams {
  roomId: string;
  senderUserId: string;
  senderSessionId?: string;
  eventType: string;
  payload: unknown;
  ttlSeconds: number;
  targetUserId?: string;
  targetSessionId?: string;
}

export interface QueryEventsResult {
  events: Event[];
  latest_ts: number;
}

type EventRow = Omit<Event, "payload"> & { payload: string };

function parseEventRows(rows: EventRow[]): Event[] {
  return rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload),
  }));
}

export function insertEvent(db: Database, params: InsertEventParams): Event {
  const id = generateUlid();
  const now = Date.now();
  const expiresAt = now + params.ttlSeconds * 1000;
  const payloadStr = JSON.stringify(params.payload);

  db.query(
    `INSERT INTO events (id, room_id, sender_user_id, sender_session_id, event_type, payload, ttl_seconds, created_at, expires_at, target_user_id, target_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.roomId,
    params.senderUserId,
    params.senderSessionId ?? null,
    params.eventType,
    payloadStr,
    params.ttlSeconds,
    now,
    expiresAt,
    params.targetUserId ?? null,
    params.targetSessionId ?? null,
  );

  return {
    id,
    room_id: params.roomId,
    sender_user_id: params.senderUserId,
    sender_session_id: params.senderSessionId ?? null,
    event_type: params.eventType,
    payload: params.payload,
    ttl_seconds: params.ttlSeconds,
    created_at: now,
    expires_at: expiresAt,
    target_user_id: params.targetUserId ?? null,
    target_session_id: params.targetSessionId ?? null,
  };
}

export function queryEvents(
  db: Database,
  roomId: string,
  since: number,
  limit: number,
): QueryEventsResult {
  const now = Date.now();
  const rows = db
    .query(
      `SELECT * FROM events
       WHERE room_id = ? AND created_at > ? AND expires_at > ?
         AND target_user_id IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(roomId, since, now, limit) as EventRow[];

  const events = parseEventRows(rows);
  const latestTs = events.length > 0 ? events[events.length - 1].created_at : since;

  return { events, latest_ts: latestTs };
}

export function consumeTargetedEvents(
  db: Database,
  roomId: string,
  userId: string,
  sessionId?: string,
): Event[] {
  const now = Date.now();
  const rows = db
    .query(
      `SELECT * FROM events
       WHERE room_id = ? AND target_user_id = ? AND expires_at > ?
         AND (target_session_id IS NULL OR target_session_id = ?)
       ORDER BY created_at ASC`,
    )
    .all(roomId, userId, now, sessionId ?? null) as EventRow[];

  if (rows.length > 0) {
    const ids = rows.map((r) => r.id);
    const placeholders = ids.map(() => "?").join(",");
    db.query(`DELETE FROM events WHERE id IN (${placeholders})`).run(...ids);
  }

  return parseEventRows(rows);
}

export function deleteExpired(db: Database): number {
  const now = Date.now();
  const result = db.query("DELETE FROM events WHERE expires_at <= ?").run(now);
  return result.changes;
}
