import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { config } from "../lib/config";
import { authHeader, createTestContext, type TestContext } from "../test-utils";

describe("Room routes", () => {
  let ctx: TestContext;
  const originalAdmins = [...config.adminUsers];

  beforeEach(() => {
    config.adminUsers.length = 0;
    config.adminUsers.push("admin@test.com");
  });

  afterEach(() => {
    ctx?.db.close();
    config.adminUsers.length = 0;
    config.adminUsers.push(...originalAdmins);
  });

  // --- Plugin client: creates a room to use for signaling ---

  describe("POST /api/v1/rooms (plugin creates room)", () => {
    it("creates a room and returns 201", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
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
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "INVALID NAME!" }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 409 for duplicate room name", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...(await authHeader("plugin-user-1", "alice@test.com")),
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
        headers: await authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ rooms: [] });
    });

    it("returns rooms with member count (only rooms user belongs to)", async () => {
      ctx = createTestContext();
      const headers = {
        "Content-Type": "application/json",
        ...(await authHeader("plugin-user-1", "alice@test.com")),
      };
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers,
        body: JSON.stringify({ id: "my-project" }),
      });
      // Creator is auto-added as member, so they can see their room
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: await authHeader("plugin-user-1", "alice@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.rooms).toHaveLength(1);
      expect(json.rooms[0].id).toBe("my-project");
      expect(json.rooms[0].member_count).toBe(1);
    });

    it("does not return rooms user is not a member of", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: await authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.rooms).toHaveLength(0);
    });
  });

  describe("GET /api/v1/rooms/:roomId (web UI views room)", () => {
    it("returns room with members for a member", async () => {
      ctx = createTestContext();
      const createRes = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const room = await createRes.json();
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}`, {
        headers: await authHeader("plugin-user-1", "alice@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.id).toBe("my-project");
      expect(json.members).toBeArray();
    });

    it("returns 403 for non-member", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        headers: await authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent", {
        headers: await authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(404);
    });
  });

  // --- is_public field ---

  describe("is_public field in responses", () => {
    it("created room includes is_public: true by default", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const json = await res.json();
      expect(json.is_public).toBe(true);
    });

    it("room list includes is_public", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms", {
        headers: await authHeader("plugin-user-1", "alice@test.com"),
      });
      const json = await res.json();
      expect(json.rooms[0].is_public).toBe(true);
    });

    it("room detail includes is_public", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        headers: await authHeader("plugin-user-1", "alice@test.com"),
      });
      const json = await res.json();
      expect(json.is_public).toBe(true);
    });
  });

  // --- Admin routes ---

  describe("PATCH /api/v1/rooms/:roomId (admin updates room)", () => {
    it("admin can set room to private", async () => {
      ctx = createTestContext();
      // Create room as regular user
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      // Admin sets it to private
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("admin-1", "admin@test.com")),
        },
        body: JSON.stringify({ is_public: false }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.is_public).toBe(false);
    });

    it("admin can set room back to public", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      // Set to private
      await ctx.app.request("/api/v1/rooms/my-project", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("admin-1", "admin@test.com")),
        },
        body: JSON.stringify({ is_public: false }),
      });
      // Set back to public
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("admin-1", "admin@test.com")),
        },
        body: JSON.stringify({ is_public: true }),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.is_public).toBe(true);
    });

    it("non-admin gets 403", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ is_public: false }),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("admin-1", "admin@test.com")),
        },
        body: JSON.stringify({ is_public: false }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid body", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("admin-1", "admin@test.com")),
        },
        body: JSON.stringify({ is_public: "not-a-bool" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/v1/rooms/:roomId/members/:userEmail (admin adds member)", () => {
    it("admin can add a member by email", async () => {
      ctx = createTestContext();
      // Create room + ensure both users exist
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      // Ensure bob exists in users table
      await ctx.app.request("/api/v1/rooms", {
        headers: await authHeader("user-2", "bob@test.com"),
      });
      // Admin adds bob
      const res = await ctx.app.request("/api/v1/rooms/my-project/members/bob@test.com", {
        method: "PUT",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("non-admin gets 403", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project/members/bob@test.com", {
        method: "PUT",
        headers: await authHeader("user-1", "alice@test.com"),
      });
      expect(res.status).toBe(403);
    });

    it("creates pending user for non-existent email", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project/members/nobody@test.com", {
        method: "PUT",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent/members/alice@test.com", {
        method: "PUT",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/rooms/:roomId/members/:userEmail (admin removes member)", () => {
    it("admin can remove a member by email", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      // Verify alice is a member
      const before = await ctx.app.request("/api/v1/rooms/my-project", {
        headers: await authHeader("user-1", "alice@test.com"),
      });
      expect((await before.json()).members).toHaveLength(1);

      // Admin removes alice
      const res = await ctx.app.request("/api/v1/rooms/my-project/members/alice@test.com", {
        method: "DELETE",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(200);
    });

    it("non-admin gets 403", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project/members/alice@test.com", {
        method: "DELETE",
        headers: await authHeader("user-1", "alice@test.com"),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent/members/alice@test.com", {
        method: "DELETE",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent user", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project/members/nobody@test.com", {
        method: "DELETE",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /api/v1/rooms/:roomId (admin deletes room)", () => {
    it("admin can delete a room", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        method: "DELETE",
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      // Verify room is gone
      const get = await ctx.app.request("/api/v1/rooms/my-project", {
        headers: await authHeader("admin-1", "admin@test.com"),
      });
      expect(get.status).toBe(404);
    });

    it("non-admin gets 403", async () => {
      ctx = createTestContext();
      await ctx.app.request("/api/v1/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("user-1", "alice@test.com")),
        },
        body: JSON.stringify({ id: "my-project" }),
      });
      const res = await ctx.app.request("/api/v1/rooms/my-project", {
        method: "DELETE",
        headers: await authHeader("user-1", "alice@test.com"),
      });
      expect(res.status).toBe(403);
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent", {
        method: "DELETE",
        headers: await authHeader("admin-1", "admin@test.com"),
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
