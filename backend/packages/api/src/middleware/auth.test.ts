import { Database } from "bun:sqlite";
import { afterEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { createApp } from "../app";
import { migrate } from "../db/migrate";
import { config } from "../lib/config";
import { authHeader } from "../test-utils";
import { authMiddleware } from "./auth";
import { errorHandler } from "./error";

describe("auth middleware", () => {
  let db: Database;

  afterEach(() => {
    db?.close();
  });

  function createApp() {
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
    const app = createApp();
    const res = await app.request("/test");
    expect(res.status).toBe(401);
  });

  it("returns 401 when token is not valid base64 JSON", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: { Authorization: "Bearer notvalidbase64!!!" },
    });
    expect(res.status).toBe(401);
  });

  it("injects userId and userEmail from valid token", async () => {
    const app = createApp();
    const res = await app.request("/test", {
      headers: authHeader("user-1", "alice@test.com"),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ userId: "user-1", userEmail: "alice@test.com" });
  });

  it("upserts user into database on first request", async () => {
    const app = createApp();
    await app.request("/test", {
      headers: authHeader("user-1", "alice@test.com"),
    });
    const row = db.query("SELECT * FROM users WHERE id = ?").get("user-1") as {
      email: string;
    } | null;
    expect(row).toBeTruthy();
    expect(row?.email).toBe("alice@test.com");
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
