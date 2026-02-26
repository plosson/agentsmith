import { afterEach, describe, expect, it } from "bun:test";
import { authHeader, createTestContext, type TestContext } from "../test-utils";

describe("Room routes", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  // --- Plugin client: creates a room to use for signaling ---

  describe("POST /api/v1/rooms (plugin creates room)", () => {
    it("creates a room and returns 201", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("plugin-user-1", "alice@test.com"),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe("my-project");
      expect(json.created_by).toBe("plugin-user-1");
    });

    it("returns 400 for invalid room name", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("plugin-user-1", "alice@test.com"),
        },
        body: JSON.stringify({ id: "INVALID NAME!" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate room name", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...authHeader("plugin-user-1", "alice@test.com"),
      };
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "my-project" }),
      });
      expect(res.status).toBe(409);
    });
  });

  // --- Web UI client: browses rooms ---

  describe("GET /api/v1/rooms (web UI lists rooms)", () => {
    it("returns empty array when no rooms", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ rooms: [] });
    });

    it("returns rooms with member count", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...authHeader("plugin-user-1", "alice@test.com"),
      };
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.rooms).toHaveLength(1);
      expect(json.rooms[0].id).toBe("my-project");
      expect(json.rooms[0].member_count).toBe(0);
    });
  });

  describe("GET /api/v1/rooms/:roomId (web UI views room)", () => {
    it("returns room with members", async () => {
      ctx = createTestContext();
      const createRes = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeader("plugin-user-1", "alice@test.com"),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const room = await createRes.json();
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("my-project");
      expect(json.members).toBeArray();
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent", {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(404);
    });
  });

  // --- Auth required ---

  describe("auth required", () => {
    it("returns 401 when no auth header", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms");
      expect(res.status).toBe(401);
    });
  });
});
