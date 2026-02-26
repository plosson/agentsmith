import type { Database } from "bun:sqlite";
import type { Event } from "@agentsmith/shared";
import { generateUlid } from "../lib/ulid";

export interface InsertEventParams {
  roomId: string;
  type: string;
  format: string;
  senderUserId: string;
  senderSessionId?: string;
  payload: unknown;
  ttlSeconds: number;
  targetUserId?: string;
  targetSessionId?: string;
}

export interface QueryEventsResult {
  events: Event[];
  latest_ts: number;
}

type EventRow = {
  id: string;
  room_id: string;
  type: string;
  format: string;
  sender_user_id: string;
  sender_session_id: string | null;
  target_user_id: string | null;
  target_session_id: string | null;
  payload: string;
  ttl_seconds: number;
  created_at: number;
  expires_at: number;
};

function buildTarget(
  userId: string | null | undefined,
  sessionId: string | null | undefined,
): Event["target"] {
  if (!userId) return null;
  return { user_id: userId, session_id: sessionId ?? null };
}

function rowToEvent(row: EventRow): Event {
  return {
    id: row.id,
    room_id: row.room_id,
    type: row.type,
    format: row.format,
    sender: {
      user_id: row.sender_user_id,
      session_id: row.sender_session_id,
    },
    target: buildTarget(row.target_user_id, row.target_session_id),
    payload: JSON.parse(row.payload),
    ttl_seconds: row.ttl_seconds,
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export function insertEvent(db: Database, params: InsertEventParams): Event {
  const id = generateUlid();
  const now = Date.now();
  const expiresAt = now + params.ttlSeconds * 1000;
  const payloadStr = JSON.stringify(params.payload);

  db.query(
    `INSERT INTO events (id, room_id, type, format, sender_user_id, sender_session_id, payload, ttl_seconds, created_at, expires_at, target_user_id, target_session_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.roomId,
    params.type,
    params.format,
    params.senderUserId,
    params.senderSessionId ?? null,
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
    type: params.type,
    format: params.format,
    sender: {
      user_id: params.senderUserId,
      session_id: params.senderSessionId ?? null,
    },
    target: buildTarget(params.targetUserId, params.targetSessionId),
    payload: params.payload,
    ttl_seconds: params.ttlSeconds,
    created_at: now,
    expires_at: expiresAt,
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

  const events = rows.map(rowToEvent);
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

  return rows.map(rowToEvent);
}

export function deleteExpired(db: Database): number {
  const now = Date.now();
  const result = db.query("DELETE FROM events WHERE expires_at <= ?").run(now);
  return result.changes;
}
