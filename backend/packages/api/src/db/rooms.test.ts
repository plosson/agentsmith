import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";
import {
  addMember,
  createRoom,
  deleteRoom,
  getRoom,
  getRoomWithMembers,
  listRooms,
  removeMember,
  updateRoom,
} from "./rooms";
import { upsertUser } from "./users";

describe("rooms db", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function setup() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    upsertUser(db, "user-2", "bob@test.com");
  }

  it("creates a room and returns it", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    expect(room.id).toBe("test-room");
    expect(room.created_by).toBe("user-1");
    expect(room.is_public).toBe(true);
  });

  it("creates a private room when isPublic=false", () => {
    setup();
    const room = createRoom(db, "private-room", "user-1", false);
    expect(room.is_public).toBe(false);
  });

  it("throws on duplicate room name", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    expect(() => createRoom(db, "test-room", "user-1")).toThrow();
  });

  it("lists rooms with member count and is_public", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    addMember(db, room.id, "user-2");
    const rooms = listRooms(db);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].member_count).toBe(2);
    expect(rooms[0].is_public).toBe(true);
  });

  it("gets room with members and is_public", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    const result = getRoomWithMembers(db, room.id);
    expect(result).toBeTruthy();
    expect(result?.members).toHaveLength(1);
    expect(result?.members[0].user_id).toBe("user-1");
    expect(result?.is_public).toBe(true);
  });

  it("returns null for non-existent room", () => {
    setup();
    const result = getRoomWithMembers(db, "nonexistent");
    expect(result).toBeNull();
  });

  it("addMember is idempotent", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    addMember(db, room.id, "user-1");
    const result = getRoomWithMembers(db, room.id);
    expect(result?.members).toHaveLength(1);
  });

  it("getRoom returns room with is_public boolean", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    const room = getRoom(db, "test-room");
    expect(room).toBeTruthy();
    expect(room?.id).toBe("test-room");
    expect(room?.is_public).toBe(true);
  });

  it("getRoom returns null for non-existent room", () => {
    setup();
    expect(getRoom(db, "nonexistent")).toBeNull();
  });

  it("updateRoom toggles is_public", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    const updated = updateRoom(db, "test-room", false);
    expect(updated?.is_public).toBe(false);

    const restored = updateRoom(db, "test-room", true);
    expect(restored?.is_public).toBe(true);
  });

  it("updateRoom returns null for non-existent room", () => {
    setup();
    const result = updateRoom(db, "nonexistent", false);
    expect(result).toBeNull();
  });

  it("removeMember removes a member and returns true", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    addMember(db, "test-room", "user-1");
    expect(removeMember(db, "test-room", "user-1")).toBe(true);
    const result = getRoomWithMembers(db, "test-room");
    expect(result?.members).toHaveLength(0);
  });

  it("removeMember returns false when member does not exist", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    expect(removeMember(db, "test-room", "user-2")).toBe(false);
  });

  it("deleteRoom removes room, members, and events", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    addMember(db, "test-room", "user-1");
    addMember(db, "test-room", "user-2");
    // Insert a fake event
    db.query(
      "INSERT INTO events (id, room_id, type, format, sender_user_id, payload, ttl_seconds, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run("evt-1", "test-room", "test", "v1", "user-1", "{}", 300, Date.now(), Date.now() + 300000);

    expect(deleteRoom(db, "test-room")).toBe(true);
    expect(getRoom(db, "test-room")).toBeNull();
    expect(getRoomWithMembers(db, "test-room")).toBeNull();
    const events = db.query("SELECT * FROM events WHERE room_id = ?").all("test-room");
    expect(events).toHaveLength(0);
  });

  it("deleteRoom returns false for non-existent room", () => {
    setup();
    expect(deleteRoom(db, "nonexistent")).toBe(false);
  });
});
