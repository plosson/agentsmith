import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "../db/migrate";
import { createRoom } from "../db/rooms";
import { upsertUser } from "../db/users";
import { startCleanup, stopCleanup } from "./cleanup";

describe("cleanup", () => {
  let db: Database;

  afterEach(() => {
    stopCleanup();
    db?.close();
  });

  it("deletes expired events on interval", async () => {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    const room = createRoom(db, "test-room", "user-1");

    // Insert already-expired event
    const now = Date.now();
    db.query(
      `INSERT INTO events (id, room_id, type, format, sender_user_id, payload, ttl_seconds, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expired-cleanup-test-00000",
      room.id,
      "hook.Stop",
      "claude_code_v27",
      "user-1",
      "{}",
      0,
      now,
      now,
    );

    const countBefore = db.query("SELECT COUNT(*) AS c FROM events").get() as { c: number };
    expect(countBefore.c).toBe(1);

    startCleanup(db, 50); // 50ms interval for test
    await new Promise((r) => setTimeout(r, 150));

    const countAfter = db.query("SELECT COUNT(*) AS c FROM events").get() as { c: number };
    expect(countAfter.c).toBe(0);
  });
});
