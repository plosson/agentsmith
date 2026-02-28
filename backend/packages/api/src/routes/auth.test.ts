import { afterEach, describe, expect, it } from "bun:test";
import { authHeader, createTestContext, type TestContext } from "../test-utils";

describe("Auth routes", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  describe("POST /auth/google", () => {
    it("returns 400 when credential is missing", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("API key management", () => {
    it("POST /api/v1/api-keys creates a key", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ name: "my-key" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.key).toStartWith("ask_");
      expect(json.name).toBe("my-key");
      expect(json.id).toHaveLength(26);
    });

    it("GET /api/v1/api-keys lists keys (prefix only)", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...(await authHeader("user-1", "alice@test.com")),
      };

      // Create a key first
      await ctx.app.request("/api/v1/api-keys", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "my-key" }),
      });

      const res = await ctx.app.request("/api/v1/api-keys", { headers });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.keys).toHaveLength(1);
      expect(json.keys[0].key_prefix).toStartWith("ask_");
      expect(json.keys[0].key).toBeUndefined(); // Raw key not exposed
    });

    it("DELETE /api/v1/api-keys/:keyId deletes a key", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...(await authHeader("user-1", "alice@test.com")),
      };

      const createRes = await ctx.app.request("/api/v1/api-keys", {
        method: "POST",
        headers,
        body: JSON.stringify({ name: "to-delete" }),
      });
      const { id } = await createRes.json();

      const delRes = await ctx.app.request(`/api/v1/api-keys/${id}`, {
        method: "DELETE",
        headers,
      });
      expect(delRes.status).toBe(200);

      // Verify it's gone
      const listRes = await ctx.app.request("/api/v1/api-keys", { headers });
      const json = await listRes.json();
      expect(json.keys).toHaveLength(0);
    });

    it("DELETE /api/v1/api-keys/:keyId returns 404 for unknown key", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/api-keys/nonexistent", {
        method: "DELETE",
        headers: await authHeader("user-1", "alice@test.com"),
      });
      expect(res.status).toBe(404);
    });

    it("API key works for authentication", async () => {
      ctx = createTestContext();

      // Create a key
      const createRes = await ctx.app.request("/api/v1/api-keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ name: "plugin-key" }),
      });
      const { key } = await createRes.json();

      // Use the API key to list rooms
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: { Authorization: `Bearer ${key}` },
      });
      expect(res.status).toBe(200);
    });
  });
});
