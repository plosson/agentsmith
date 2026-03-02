import { afterEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { config } from "../lib/config";
import { requireAdmin } from "./admin";
import { errorHandler } from "./error";

describe("requireAdmin middleware", () => {
  const original = [...config.adminUsers];

  afterEach(() => {
    config.adminUsers.length = 0;
    config.adminUsers.push(...original);
  });

  function makeApp() {
    const app = new Hono<AppEnv>();
    app.onError(errorHandler);
    app.use("*", async (c, next) => {
      c.set("userId", "user-1");
      c.set("userEmail", (c.req.header("X-Email") ?? "nobody@test.com").toLowerCase());
      await next();
    });
    app.get("/admin", requireAdmin, (c) => c.json({ ok: true }));
    return app;
  }

  it("allows admin users", async () => {
    config.adminUsers.push("admin@test.com");
    const app = makeApp();
    const res = await app.request("/admin", {
      headers: { "X-Email": "admin@test.com" },
    });
    expect(res.status).toBe(200);
  });

  it("rejects non-admin users with 403", async () => {
    config.adminUsers.length = 0;
    config.adminUsers.push("admin@test.com");
    const app = makeApp();
    const res = await app.request("/admin", {
      headers: { "X-Email": "user@test.com" },
    });
    expect(res.status).toBe(403);
  });

  it("is case-insensitive (email lowercased at source)", async () => {
    config.adminUsers.length = 0;
    config.adminUsers.push("admin@test.com");
    const app = makeApp();
    const res = await app.request("/admin", {
      headers: { "X-Email": "Admin@Test.com" },
    });
    expect(res.status).toBe(200);
  });
});
