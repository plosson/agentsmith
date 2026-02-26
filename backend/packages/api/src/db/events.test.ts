import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { consumeTargetedEvents, deleteExpired, insertEvent, queryEvents } from "./events";
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
      type: "hook.Stop",
      format: "claude_code_v27",
      senderUserId: "alice@test.com",
      payload: { status: "idle" },
      ttlSeconds: 600,
    });
    expect(event.id).toHaveLength(26);
    expect(event.room_id).toBe(room.id);
    expect(event.type).toBe("hook.Stop");
    expect(event.format).toBe("claude_code_v27");
    expect(event.sender.user_id).toBe("alice@test.com");
    expect(event.expires_at).toBe(event.created_at + 600_000);
  });

  it("queries events after a timestamp", () => {
    const room = setup();
    const e1 = insertEvent(db, {
      roomId: room.id,
      type: "hook.Stop",
      format: "claude_code_v27",
      senderUserId: "alice@test.com",
      payload: { status: "idle" },
      ttlSeconds: 600,
    });
    const _e2 = insertEvent(db, {
      roomId: room.id,
      type: "hook.PostToolUse",
      format: "claude_code_v27",
      senderUserId: "alice@test.com",
      payload: { tool: "Bash" },
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
      `INSERT INTO events (id, room_id, type, format, sender_user_id, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expired-id-000000000000000",
      room.id,
      "hook.Stop",
      "claude_code_v27",
      "user-1",
      "{}",
      0,
      now,
      now,
    );

    insertEvent(db, {
      roomId: room.id,
      type: "hook.Stop",
      format: "claude_code_v27",
      senderUserId: "alice@test.com",
      payload: { status: "idle" },
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
        type: "hook.Stop",
        format: "claude_code_v27",
        senderUserId: "alice@test.com",
        payload: { status: "idle" },
        ttlSeconds: 600,
      });
    }
    const result = queryEvents(db, room.id, 0, 2);
    expect(result.events).toHaveLength(2);
  });

  it("inserts event with session_id and target fields", () => {
    const room = setup();
    const event = insertEvent(db, {
      roomId: room.id,
      type: "interaction",
      format: "canvas_v1",
      senderUserId: "alice@test.com",
      senderSessionId: "sess-1",
      payload: { action: "ping" },
      ttlSeconds: 60,
      targetUserId: "bob@test.com",
      targetSessionId: "sess-2",
    });
    expect(event.sender.session_id).toBe("sess-1");
    expect(event.target?.user_id).toBe("bob@test.com");
    expect(event.target?.session_id).toBe("sess-2");
  });

  it("queryEvents excludes targeted events", () => {
    const room = setup();
    insertEvent(db, {
      roomId: room.id,
      type: "hook.Stop",
      format: "claude_code_v27",
      senderUserId: "alice@test.com",
      payload: { status: "idle" },
      ttlSeconds: 600,
    });
    insertEvent(db, {
      roomId: room.id,
      type: "interaction",
      format: "canvas_v1",
      senderUserId: "alice@test.com",
      payload: { action: "ping" },
      ttlSeconds: 60,
      targetUserId: "bob@test.com",
    });
    const result = queryEvents(db, room.id, 0, 50);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].type).toBe("hook.Stop");
  });

  it("consumeTargetedEvents returns matching events and deletes them", () => {
    const room = setup();
    upsertUser(db, "user-2", "bob@test.com");
    insertEvent(db, {
      roomId: room.id,
      type: "interaction",
      format: "canvas_v1",
      senderUserId: "bob@test.com",
      payload: { action: "ping" },
      ttlSeconds: 60,
      targetUserId: "alice@test.com",
    });

    const consumed = consumeTargetedEvents(db, room.id, "alice@test.com");
    expect(consumed).toHaveLength(1);
    expect(consumed[0].payload).toEqual({ action: "ping" });

    // Should not return again
    const again = consumeTargetedEvents(db, room.id, "alice@test.com");
    expect(again).toHaveLength(0);
  });

  it("consumeTargetedEvents skips expired events", () => {
    const room = setup();
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, type, format, sender_user_id, payload, ttl_seconds, created_at, expires_at, target_user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expired-target-00000000000",
      room.id,
      "interaction",
      "canvas_v1",
      "bob@test.com",
      '{"action":"old"}',
      0,
      now,
      now,
      "alice@test.com",
    );

    const consumed = consumeTargetedEvents(db, room.id, "alice@test.com");
    expect(consumed).toHaveLength(0);
  });

  it("consumeTargetedEvents with user-only targeting", () => {
    const room = setup();
    upsertUser(db, "user-2", "bob@test.com");
    insertEvent(db, {
      roomId: room.id,
      type: "interaction",
      format: "canvas_v1",
      senderUserId: "bob@test.com",
      payload: { action: "broadcast-to-user" },
      ttlSeconds: 60,
      targetUserId: "alice@test.com",
    });

    // Any session of alice should receive it
    const consumed = consumeTargetedEvents(db, room.id, "alice@test.com", "any-session");
    expect(consumed).toHaveLength(1);
  });

  it("consumeTargetedEvents with session-specific targeting", () => {
    const room = setup();
    upsertUser(db, "user-2", "bob@test.com");
    insertEvent(db, {
      roomId: room.id,
      type: "interaction",
      format: "canvas_v1",
      senderUserId: "bob@test.com",
      payload: { action: "session-specific" },
      ttlSeconds: 60,
      targetUserId: "alice@test.com",
      targetSessionId: "sess-1",
    });

    // Wrong session should not receive it
    const wrong = consumeTargetedEvents(db, room.id, "alice@test.com", "sess-other");
    expect(wrong).toHaveLength(0);

    // Correct session should receive it
    const correct = consumeTargetedEvents(db, room.id, "alice@test.com", "sess-1");
    expect(correct).toHaveLength(1);
  });

  it("deletes expired events", () => {
    const room = setup();
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, type, format, sender_user_id, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expired-id-000000000000000",
      room.id,
      "hook.Stop",
      "claude_code_v27",
      "user-1",
      "{}",
      0,
      now,
      now,
    );

    const deleted = deleteExpired(db);
    expect(deleted).toBe(1);
  });
});
