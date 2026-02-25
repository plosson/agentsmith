import { afterEach, describe, expect, it } from "bun:test";
import { createTestContext, authHeader, type TestContext } from "../test-utils";

describe("Presence route", () => {
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

  async function emitSignal(roomId: string, sub: string, email: string, sessionId: string, signal: string) {
    return ctx.app.request(`/api/v1/rooms/${roomId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader(sub, email) },
      body: JSON.stringify({
        event_type: "session.signal",
        payload: { session_id: sessionId, signal },
      }),
    });
  }

  // --- Web UI reads presence ---

  describe("GET /api/v1/rooms/:roomId/presence (web UI views avatars)", () => {
    it("returns latest signal per session", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      await emitSignal(room.id, "plugin-1", "alice@test.com", "sess-1", "Idle");
      await emitSignal(room.id, "plugin-1", "alice@test.com", "sess-1", "BuildSucceeded");

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions).toHaveLength(1);
      expect(json.sessions[0].session_id).toBe("sess-1");
      expect(json.sessions[0].signal).toBe("BuildSucceeded");
      expect(json.sessions[0].user_id).toBe("plugin-1");
      expect(json.sessions[0].display_name).toBeTruthy();
    });

    it("returns multiple sessions from different users", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      await emitSignal(room.id, "plugin-1", "alice@test.com", "sess-1", "Idle");
      await emitSignal(room.id, "plugin-2", "bob@test.com", "sess-2", "CommandRunning");

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "viewer@test.com"),
      });
      const json = await res.json();
      expect(json.sessions).toHaveLength(2);
    });

    it("returns empty sessions when no signals", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.sessions).toHaveLength(0);
    });

    it("excludes sessions with expired signals", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Insert an expired signal directly
      const now = Date.now();
      ctx.db
        .query(
          `INSERT INTO events (id, room_id, sender_id, event_type, payload, ttl_seconds, created_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "expired-signal-00000000000",
          room.id,
          "plugin-1",
          "session.signal",
          JSON.stringify({ session_id: "sess-old", signal: "Idle" }),
          0,
          now - 700_000,
          now - 100_000,
        );

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/presence`, {
        headers: authHeader("web-user-1", "bob@test.com"),
      });
      const json = await res.json();
      expect(json.sessions).toHaveLength(0);
    });
  });
});
