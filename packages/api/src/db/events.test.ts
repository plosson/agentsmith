import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { deleteExpired, insertEvent, queryEvents } from "./events";
import { migrate } from "./migrate";
import { createRoom } from "./rooms";
import { upsertUser } from "./users";

describe("events db", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function setup() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    return createRoom(db, "test-room", "user-1");
  }

  it("inserts an event and returns it", () => {
    const room = setup();
    const event = insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "Idle" },
      ttlSeconds: 600,
    });
    expect(event.id).toHaveLength(26);
    expect(event.room_id).toBe(room.id);
    expect(event.event_type).toBe("session.signal");
    expect(event.expires_at).toBe(event.created_at + 600_000);
  });

  it("queries events after a timestamp", () => {
    const room = setup();
    const e1 = insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "Idle" },
      ttlSeconds: 600,
    });
    const _e2 = insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "BuildSucceeded" },
      ttlSeconds: 600,
    });

    const result = queryEvents(db, room.id, 0, 50);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].id).toBe(e1.id);
    expect(result.latest_ts).toBeGreaterThan(0);
  });

  it("excludes expired events from queries", () => {
    const room = setup();
    // Insert an event with 0 TTL (already expired)
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("expired-id-000000000000000", room.id, "user-1", "session.signal", "{}", 0, now, now);

    insertEvent(db, {
      roomId: room.id,
      senderId: "user-1",
      eventType: "session.signal",
      payload: { session_id: "sess-1", signal: "Idle" },
      ttlSeconds: 600,
    });

    const result = queryEvents(db, room.id, 0, 50);
    expect(result.events).toHaveLength(1);
  });

  it("respects limit parameter", () => {
    const room = setup();
    for (let i = 0; i < 5; i++) {
      insertEvent(db, {
        roomId: room.id,
        senderId: "user-1",
        eventType: "session.signal",
        payload: { session_id: "sess-1", signal: "Idle" },
        ttlSeconds: 600,
      });
    }
    const result = queryEvents(db, room.id, 0, 2);
    expect(result.events).toHaveLength(2);
  });

  it("deletes expired events", () => {
    const room = setup();
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("expired-id-000000000000000", room.id, "user-1", "session.signal", "{}", 0, now, now);

    const deleted = deleteExpired(db);
    expect(deleted).toBe(1);
  });
});
