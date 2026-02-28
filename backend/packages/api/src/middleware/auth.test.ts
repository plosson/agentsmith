import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { createApp } from "../app";
import { createApiKey } from "../db/api-keys";
import { migrate } from "../db/migrate";
import { upsertUser } from "../db/users";
import { config } from "../lib/config";
import { authHeader } from "../test-utils";
import { authMiddleware } from "./auth";
import { errorHandler } from "./error";

const TEST_JWT_SECRET = "test-jwt-secret-for-agentsmith";

describe("auth middleware", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function createTestApp() {
    config.jwtSecret = TEST_JWT_SECRET;
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.use("*", authMiddleware(db));
    app.get("/test", (c) => {
      return c.json({
        userId: c.get("userId"),
        userEmail: c.get("userEmail"),
      });
    });
    return app;
  }

  it("returns 401 when no Authorization header", async () => {
    const app = createTestApp();
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is not a valid JWT", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer notavalidjwt" },
    });
    expect(res.status).toBe(401);
  });

  it("injects userId and userEmail from valid JWT", async () => {
    const app = createTestApp();
    const res = await app.request("/test", {
      headers: await authHeader("user-1", "alice@test.com"),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ userId: "user-1", userEmail: "alice@test.com" });
  });

  it("upserts user into database on first request", async () => {
    const app = createTestApp();
    await app.request("/test", {
      headers: await authHeader("user-1", "alice@test.com"),
    });
    const row = db.query("SELECT * FROM users WHERE id = ?").get("user-1") as {
      email: string;
    } | null;
    expect(row).toBeTruthy();
    expect(row?.email).toBe("alice@test.com");
  });

  it("authenticates with a valid API key", async () => {
    const app = createTestApp();
    // Create a user first, then an API key
    upsertUser(db, "apikey-user", "apiuser@test.com");
    const { rawKey } = await createApiKey(db, "apikey-user", "test-key");

    const res = await app.request("/test", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ userId: "apikey-user", userEmail: "apiuser@test.com" });
  });

  it("updates last_used_at when API key is used", async () => {
    const app = createTestApp();
    upsertUser(db, "apikey-user", "apiuser@test.com");
    const { id, rawKey } = await createApiKey(db, "apikey-user", "test-key");

    await app.request("/test", {
      headers: { Authorization: `Bearer ${rawKey}` },
    });

    const row = db.query("SELECT last_used_at FROM api_keys WHERE id = ?").get(id) as {
      last_used_at: number;
    };
    expect(row.last_used_at).toBeGreaterThan(0);
  });
});

describe("auth disabled", () => {
  let db: Database;
  const originalAuthDisabled = config.authDisabled;

  afterEach(() => {
    config.authDisabled = originalAuthDisabled;
    db?.close();
  });

  it("allows unauthenticated requests when AUTH_DISABLED is true", async () => {
    config.authDisabled = true;
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);

    const app = createApp(db);
    const res = await app.request("/api/v1/rooms");
    expect(res.status).toBe(200);
  });

  it("sets anonymous user context when AUTH_DISABLED is true", async () => {
    config.authDisabled = true;
    db = new Database(":memory:");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);

    const app = createApp(db);
    await app.request("/api/v1/rooms");

    const row = db.query("SELECT * FROM users WHERE id = ?").get("anonymous") as {
      id: string;
      email: string;
    } | null;
    expect(row).toBeTruthy();
    expect(row?.email).toBe("anonymous@local");
  });
});
