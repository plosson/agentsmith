import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";

describe("migrate", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  it("creates all tables", () => {
    db = new Database(":memory:");
    migrate(db);

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    const tableNames = tables.map((t) => t.name);
    expect(tableNames).toContain("users");
    expect(tableNames).toContain("rooms");
    expect(tableNames).toContain("room_members");
    expect(tableNames).toContain("events");
  });

  it("is idempotent", () => {
    db = new Database(":memory:");
    migrate(db);
    migrate(db);

    const tables = db
      .query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];

    expect(tables.length).toBeGreaterThanOrEqual(4);
  });
});
