import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";
import { upsertUser } from "./users";
import { createRoom, listRooms, getRoomWithMembers, addMember } from "./rooms";

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
    expect(room.name).toBe("test-room");
    expect(room.created_by).toBe("user-1");
    expect(room.id).toHaveLength(26);
  });

  it("throws on duplicate room name", () => {
    setup();
    createRoom(db, "test-room", "user-1");
    expect(() => createRoom(db, "test-room", "user-1")).toThrow();
  });

  it("lists rooms with member count", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    addMember(db, room.id, "user-2");
    const rooms = listRooms(db);
    expect(rooms).toHaveLength(1);
    expect(rooms[0].member_count).toBe(2);
  });

  it("gets room with members", () => {
    setup();
    const room = createRoom(db, "test-room", "user-1");
    addMember(db, room.id, "user-1");
    const result = getRoomWithMembers(db, room.id);
    expect(result).toBeTruthy();
    expect(result!.members).toHaveLength(1);
    expect(result!.members[0].user_id).toBe("user-1");
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
    expect(result!.members).toHaveLength(1);
  });
});
