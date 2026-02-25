import { afterEach, describe, expect, it } from "bun:test";
import { createTestContext, authHeader, type TestContext } from "../test-utils";

describe("Event routes", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  async function createRoom(name: string, sub: string, email: string) {
    const res = await ctx.app.request("/api/v1/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(sub, email) },
      body: JSON.stringify({ name }),
    });
    return res.json();
  }

  // --- Plugin client emits session signals ---

  describe("POST /api/v1/rooms/:roomId/events (plugin emits signal)", () => {
    it("emits an event and returns 201", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({
          event_type: "session.signal",
          payload: { session_id: "sess-1", signal: "Idle" },
        }),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toHaveLength(26);
      expect(json.room_id).toBe(room.id);
      expect(json.expires_at).toBeGreaterThan(json.created_at);
    });

    it("auto-joins sender to room membership", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({
          event_type: "session.signal",
          payload: { session_id: "sess-1", signal: "Idle" },
        }),
      });
      const detailRes = await ctx.app.request(`/api/v1/rooms/${room.id}`, {
        headers: authHeader("plugin-1", "alice@test.com"),
      });
      const detail = await detailRes.json();
      expect(detail.members).toHaveLength(1);
      expect(detail.members[0].user_id).toBe("plugin-1");
    });

    it("returns 404 for non-existent room", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent/events", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({ event_type: "session.signal", payload: {} }),
      });
      expect(res.status).toBe(404);
    });

    it("returns 400 for invalid body", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({ event_type: "", payload: {} }),
      });
      expect(res.status).toBe(400);
    });

    it("returns 413 for oversized payload", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const bigPayload = { data: "x".repeat(70_000) };
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({ event_type: "session.signal", payload: bigPayload }),
      });
      expect(res.status).toBe(413);
    });
  });

  // --- Plugin/Web UI polls events ---

  describe("GET /api/v1/rooms/:roomId/events (poll events)", () => {
    it("returns events since a timestamp", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader("plugin-1", "alice@test.com") },
        body: JSON.stringify({
          event_type: "session.signal",
          payload: { session_id: "sess-1", signal: "Idle" },
        }),
      });

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events?since=0&limit=50`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(1);
      expect(json.events[0].event_type).toBe("session.signal");
      expect(json.latest_ts).toBeGreaterThan(0);
    });

    it("returns 400 when since param missing", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(400);
    });

    it("returns empty array when no new events", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(
        `/api/v1/rooms/${room.id}/events?since=${Date.now()}&limit=50`,
        { headers: authHeader("web-user-1", "bob@test.com") },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(0);
    });
  });
});
