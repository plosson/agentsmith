import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import {
  createApiKey,
  deleteApiKey,
  findByKeyHash,
  generateApiKey,
  hashApiKey,
  listByUser,
  updateLastUsed,
} from "./api-keys";
import { migrate } from "./migrate";
import { upsertUser } from "./users";

describe("API keys", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function setup() {
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    upsertUser(db, "user-1", "alice@test.com");
    return db;
  }

  describe("generateApiKey", () => {
    it("produces a key with ask_ prefix", () => {
      const key = generateApiKey();
      expect(key).toStartWith("ask_");
      expect(key.length).toBeGreaterThan(20);
    });

    it("produces unique keys", () => {
      const keys = new Set(Array.from({ length: 10 }, () => generateApiKey()));
      expect(keys.size).toBe(10);
    });
  });

  describe("hashApiKey", () => {
    it("produces consistent hashes", async () => {
      const key = "ask_test123";
      const h1 = await hashApiKey(key);
      const h2 = await hashApiKey(key);
      expect(h1).toBe(h2);
    });

    it("produces different hashes for different keys", async () => {
      const h1 = await hashApiKey("ask_aaa");
      const h2 = await hashApiKey("ask_bbb");
      expect(h1).not.toBe(h2);
    });
  });

  describe("createApiKey + findByKeyHash", () => {
    it("creates and retrieves a key by hash", async () => {
      setup();
      const { id, rawKey, keyPrefix } = await createApiKey(db, "user-1", "test-key");

      expect(id).toHaveLength(26);
      expect(rawKey).toStartWith("ask_");
      expect(keyPrefix).toBe(rawKey.slice(0, 12));

      const hash = await hashApiKey(rawKey);
      const found = findByKeyHash(db, hash);
      expect(found).toBeTruthy();
      expect(found?.user_id).toBe("user-1");
      expect(found?.name).toBe("test-key");
    });
  });

  describe("listByUser", () => {
    it("lists keys for a specific user", async () => {
      setup();
      await createApiKey(db, "user-1", "key-1");
      await createApiKey(db, "user-1", "key-2");

      const keys = listByUser(db, "user-1");
      expect(keys).toHaveLength(2);
    });

    it("returns empty for users with no keys", () => {
      setup();
      const keys = listByUser(db, "user-1");
      expect(keys).toHaveLength(0);
    });
  });

  describe("deleteApiKey", () => {
    it("deletes a key belonging to the user", async () => {
      setup();
      const { id } = await createApiKey(db, "user-1", "key-1");
      const deleted = deleteApiKey(db, id, "user-1");
      expect(deleted).toBe(true);
      expect(listByUser(db, "user-1")).toHaveLength(0);
    });

    it("returns false when key does not belong to user", async () => {
      setup();
      upsertUser(db, "user-2", "bob@test.com");
      const { id } = await createApiKey(db, "user-1", "key-1");
      const deleted = deleteApiKey(db, id, "user-2");
      expect(deleted).toBe(false);
    });
  });

  describe("updateLastUsed", () => {
    it("updates last_used_at timestamp", async () => {
      setup();
      const { id } = await createApiKey(db, "user-1", "key-1");

      updateLastUsed(db, id);

      const row = db.query("SELECT last_used_at FROM api_keys WHERE id = ?").get(id) as {
        last_used_at: number;
      };
      expect(row.last_used_at).toBeGreaterThan(0);
    });
  });
});
