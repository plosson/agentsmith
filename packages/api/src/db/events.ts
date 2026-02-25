import type { Database } from "bun:sqlite";
import type { Event } from "@agentsmith/shared";
import { generateUlid } from "../lib/ulid";

export interface InsertEventParams {
  roomId: string;
  senderId: string;
  eventType: string;
  payload: unknown;
  ttlSeconds: number;
}

export interface QueryEventsResult {
  events: Event[];
  latest_ts: number;
}

export function insertEvent(db: Database, params: InsertEventParams): Event {
  const id = generateUlid();
  const now = Date.now();
  const expiresAt = now + params.ttlSeconds * 1000;
  const payloadStr = JSON.stringify(params.payload);

  db.query(
    `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, params.roomId, params.senderId, params.eventType, payloadStr, params.ttlSeconds, now, expiresAt);

  return {
    id,
    room_id: params.roomId,
    sender_id: params.senderId,
    event_type: params.eventType,
    payload: params.payload,
    ttl_seconds: params.ttlSeconds,
    created_at: now,
    expires_at: expiresAt,
  };
}

export function queryEvents(db: Database, roomId: string, since: number, limit: number): QueryEventsResult {
  const now = Date.now();
  const rows = db
    .query(
      `SELECT * FROM events
       WHERE room_id = ? AND created_at > ? AND expires_at > ?
       ORDER BY created_at ASC
       LIMIT ?`,
    )
    .all(roomId, since, now, limit) as (Omit<Event, "payload"> & { payload: string })[];

  const events: Event[] = rows.map((row) => ({
    ...row,
    payload: JSON.parse(row.payload),
  }));

  const latestTs = events.length > 0 ? events[events.length - 1].created_at : since;

  return { events, latest_ts: latestTs };
}

export function deleteExpired(db: Database): number {
  const now = Date.now();
  const result = db.query("DELETE FROM events WHERE expires_at <= ?").run(now);
  return result.changes;
}
