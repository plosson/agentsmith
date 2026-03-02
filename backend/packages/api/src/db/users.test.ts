import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { migrate } from "./migrate";
import { getUserByEmail, getUserById, upsertUser } from "./users";

describe("users db", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function setup() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
  }

  it("getUserByEmail returns matching user", () => {
    setup();
    const user = getUserByEmail(db, "alice@test.com");
    expect(user).toBeTruthy();
    expect(user?.id).toBe("user-1");
    expect(user?.email).toBe("alice@test.com");
  });

  it("getUserByEmail returns null for unknown email", () => {
    setup();
    expect(getUserByEmail(db, "nobody@test.com")).toBeNull();
  });

  it("getUserById returns matching user", () => {
    setup();
    const user = getUserById(db, "user-1");
    expect(user).toBeTruthy();
    expect(user?.email).toBe("alice@test.com");
  });

  it("upsertUser updates email on conflict", () => {
    setup();
    upsertUser(db, "user-1", "newalice@test.com");
    const user = getUserById(db, "user-1");
    expect(user?.email).toBe("newalice@test.com");
  });
});
