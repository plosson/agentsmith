import { afterEach, describe, expect, it } from "bun:test";
import { authHeader, createTestContext, makeToken, type TestContext } from "../test-utils";

describe("Event routes", () => {
  let ctx: TestContext;

  afterEach(() => {
    ctx?.db.close();
  });

  async function createRoom(name: string, sub: string, email: string) {
    const res = await ctx.app.request("/api/v1/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader(sub, email)) },
      body: JSON.stringify({ id: name }),
    });
    return res.json();
  }

  function makeEvent(
    roomId: string,
    overrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    return {
      room_id: roomId,
      type: "hook.Stop",
      format: "claude_code_v27",
      sender: { user_id: "alice@test.com" },
      payload: { status: "idle" },
      ...overrides,
    };
  }

  // --- Plugin client emits session signals ---

  describe("POST /api/v1/rooms/:roomId/events (plugin emits signal)", () => {
    it("emits an event and returns 201", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toHaveLength(26);
      expect(json.room_id).toBe(room.id);
      expect(json.expires_at).toBeGreaterThan(json.created_at);
      expect(json.messages).toEqual([]);
    });

    it("auto-joins sender to room membership", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });
      const detailRes = await ctx.app.request(`/api/v1/rooms/${room.id}`, {
        headers: await authHeader("plugin-1", "alice@test.com"),
      });
      const detail = await detailRes.json();
      expect(detail.members).toHaveLength(1);
      expect(detail.members[0].user_id).toBe("plugin-1");
    });

    it("auto-creates room if it does not exist", async () => {
      ctx = createTestContext();
      const res = await ctx.app.request("/api/v1/rooms/nonexistent/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent("nonexistent")),
      });
      expect(res.status).toBe(201);
    });

    it("returns 400 for invalid body (empty type)", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id, { type: "" })),
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when room_id in body mismatches URL", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent("wrong-room-id")),
      });
      expect(res.status).toBe(400);
    });

    it("returns 413 for oversized payload", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id, { payload: { data: "x".repeat(70_000) } })),
      });
      expect(res.status).toBe(413);
    });
  });

  // --- Event targeting and message delivery ---

  describe("POST /api/v1/rooms/:roomId/events (targeted messages)", () => {
    it("returns messages when targeted events exist for sender", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Web canvas sends targeted event to alice
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("web-1", "bob@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            type: "interaction",
            format: "canvas_v1",
            sender: { user_id: "bob@test.com" },
            target: { user_id: "alice@test.com" },
            payload: { action: "ping" },
          }),
        ),
      });

      // Plugin emits event → response includes messages
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            sender: { user_id: "alice@test.com", session_id: "sess-1" },
          }),
        ),
      });
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.messages).toHaveLength(1);
      expect(json.messages[0]).toEqual({ action: "ping" });
    });

    it("consumed events are not returned twice", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Web canvas sends targeted event to alice
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("web-1", "bob@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            type: "interaction",
            format: "canvas_v1",
            sender: { user_id: "bob@test.com" },
            target: { user_id: "alice@test.com" },
            payload: { action: "ping" },
          }),
        ),
      });

      // First emit consumes the message
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });

      // Second emit returns no messages
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });
      const json = await res.json();
      expect(json.messages).toHaveLength(0);
    });

    it("session-specific targeting delivers only to correct session", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Target alice's sess-2 specifically
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("web-1", "bob@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            type: "interaction",
            format: "canvas_v1",
            sender: { user_id: "bob@test.com" },
            target: { user_id: "alice@test.com", session_id: "sess-2" },
            payload: { action: "specific" },
          }),
        ),
      });

      // sess-1 should NOT receive it
      const res1 = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            sender: { user_id: "alice@test.com", session_id: "sess-1" },
          }),
        ),
      });
      const json1 = await res1.json();
      expect(json1.messages).toHaveLength(0);

      // sess-2 should receive it
      const res2 = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            sender: { user_id: "alice@test.com", session_id: "sess-2" },
          }),
        ),
      });
      const json2 = await res2.json();
      expect(json2.messages).toHaveLength(1);
      expect(json2.messages[0]).toEqual({ action: "specific" });
    });

    it("targeted events are excluded from poll results", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Broadcast event
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });

      // Targeted event
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("web-1", "bob@test.com")),
        },
        body: JSON.stringify(
          makeEvent(room.id, {
            type: "interaction",
            format: "canvas_v1",
            sender: { user_id: "bob@test.com" },
            target: { user_id: "alice@test.com" },
            payload: { action: "ping" },
          }),
        ),
      });

      // Poll should only return the broadcast event
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events?since=0&limit=50`, {
        headers: await authHeader("web-user-1", "viewer@test.com"),
      });
      const json = await res.json();
      expect(json.events).toHaveLength(1);
      expect(json.events[0].type).toBe("hook.Stop");
    });
  });

  // --- Plugin/Web UI polls events ---

  describe("GET /api/v1/rooms/:roomId/events (poll events)", () => {
    it("returns events since a timestamp", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events?since=0&limit=50`, {
        headers: await authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(1);
      expect(json.events[0].type).toBe("hook.Stop");
      expect(json.events[0].format).toBe("claude_code_v27");
      expect(json.events[0].sender.user_id).toBe("alice@test.com");
      expect(json.latest_ts).toBeGreaterThan(0);
    });

    it("returns 400 when since param missing", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        headers: await authHeader("web-user-1", "bob@test.com"),
      });
      expect(res.status).toBe(400);
    });

    it("returns empty array when no new events", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      const res = await ctx.app.request(
        `/api/v1/rooms/${room.id}/events?since=${Date.now()}&limit=50`,
        { headers: await authHeader("web-user-1", "bob@test.com") },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(0);
    });

    it("supports ?format= query param (passthrough for same format)", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });

      const res = await ctx.app.request(
        `/api/v1/rooms/${room.id}/events?since=0&limit=50&format=claude_code_v27`,
        { headers: await authHeader("web-user-1", "bob@test.com") },
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.events).toHaveLength(1);
      expect(json.events[0].format).toBe("claude_code_v27");
    });
  });

  // --- SSE streaming ---

  /** Parse SSE text into an array of {event, data, id} objects */
  function parseSSE(text: string): { event?: string; data: string; id?: string }[] {
    const messages: { event?: string; data: string; id?: string }[] = [];
    const blocks = text.split("\n\n").filter((b) => b.trim());
    for (const block of blocks) {
      const msg: { event?: string; data: string; id?: string } = { data: "" };
      const dataLines: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) msg.event = line.slice(7);
        else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
        else if (line.startsWith("id: ")) msg.id = line.slice(4);
      }
      msg.data = dataLines.join("\n");
      messages.push(msg);
    }
    return messages;
  }

  describe("GET /api/v1/rooms/:roomId/events/stream (SSE)", () => {
    it("returns 200 with text/event-stream content type", async () => {
      ctx = createTestContext();
      await createRoom("test-room", "plugin-1", "alice@test.com");

      const res = await ctx.app.request("/api/v1/rooms/test-room/events/stream?since=0", {
        headers: await authHeader("web-1", "bob@test.com"),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    });

    it("sends catch-up events from DB", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Insert an event first
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id)),
      });

      const res = await ctx.app.request(`/api/v1/rooms/${room.id}/events/stream?since=0`, {
        headers: await authHeader("web-1", "bob@test.com"),
      });

      // Read a chunk from the stream
      expect(res.body).toBeDefined();
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();
      const { value } = await reader.read();
      reader.cancel();

      const text = new TextDecoder().decode(value);
      const messages = parseSSE(text);

      const eventMsgs = messages.filter((m) => m.event === "event");
      expect(eventMsgs.length).toBeGreaterThanOrEqual(1);

      const parsed = JSON.parse(eventMsgs[0].data);
      expect(parsed.type).toBe("hook.Stop");
      expect(parsed.sender.user_id).toBe("alice@test.com");
    });

    it("receives live events via bus publish", async () => {
      ctx = createTestContext();
      await createRoom("test-room", "plugin-1", "alice@test.com");

      const res = await ctx.app.request("/api/v1/rooms/test-room/events/stream?since=0", {
        headers: await authHeader("web-1", "bob@test.com"),
      });

      expect(res.body).toBeDefined();
      const reader = (res.body as ReadableStream<Uint8Array>).getReader();

      // Publish an event directly on the bus
      ctx.bus.publish({
        id: "test-live-id",
        room_id: "test-room",
        type: "hook.Test",
        format: "test_v1",
        sender: { user_id: "alice@test.com", session_id: null },
        target: null,
        payload: { live: true },
        ttl_seconds: 300,
        created_at: Date.now(),
        expires_at: Date.now() + 300_000,
      });

      const { value } = await reader.read();
      reader.cancel();

      const text = new TextDecoder().decode(value);
      const messages = parseSSE(text);
      const eventMsgs = messages.filter((m) => m.event === "event");
      expect(eventMsgs.length).toBeGreaterThanOrEqual(1);

      const parsed = JSON.parse(eventMsgs[0].data);
      expect(parsed.payload).toEqual({ live: true });
    });

    it("POST broadcast event is delivered to SSE subscribers", async () => {
      ctx = createTestContext();
      const room = await createRoom("test-room", "plugin-1", "alice@test.com");

      // Connect SSE stream
      const sseRes = await ctx.app.request(`/api/v1/rooms/${room.id}/events/stream?since=0`, {
        headers: await authHeader("web-1", "bob@test.com"),
      });
      expect(sseRes.body).toBeDefined();
      const reader = (sseRes.body as ReadableStream<Uint8Array>).getReader();

      // POST a broadcast event
      await ctx.app.request(`/api/v1/rooms/${room.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent(room.id, { payload: { signal: "live-test" } })),
      });

      const { value } = await reader.read();
      reader.cancel();

      const text = new TextDecoder().decode(value);
      const messages = parseSSE(text);
      const eventMsgs = messages.filter((m) => m.event === "event");
      expect(eventMsgs.length).toBeGreaterThanOrEqual(1);

      const parsed = JSON.parse(eventMsgs[eventMsgs.length - 1].data);
      expect(parsed.payload).toEqual({ signal: "live-test" });
    });

    it("targeted events are NOT published to SSE", async () => {
      ctx = createTestContext();
      await createRoom("test-room", "plugin-1", "alice@test.com");

      // Verify subscriber count is 0 before connect
      expect(ctx.bus.subscriberCount("test-room")).toBe(0);

      // Connect SSE
      const sseRes = await ctx.app.request("/api/v1/rooms/test-room/events/stream?since=0", {
        headers: await authHeader("web-1", "bob@test.com"),
      });
      expect(sseRes.body).toBeDefined();
      const reader = (sseRes.body as ReadableStream<Uint8Array>).getReader();

      expect(ctx.bus.subscriberCount("test-room")).toBe(1);

      // POST a targeted event — should NOT go through bus
      await ctx.app.request("/api/v1/rooms/test-room/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("web-1", "bob@test.com")),
        },
        body: JSON.stringify(
          makeEvent("test-room", {
            type: "interaction",
            sender: { user_id: "bob@test.com" },
            target: { user_id: "alice@test.com" },
            payload: { action: "ping" },
          }),
        ),
      });

      // Post a broadcast so we can read at least one event
      await ctx.app.request("/api/v1/rooms/test-room/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeader("plugin-1", "alice@test.com")),
        },
        body: JSON.stringify(makeEvent("test-room", { payload: { marker: true } })),
      });

      const { value } = await reader.read();
      reader.cancel();

      const text = new TextDecoder().decode(value);
      const messages = parseSSE(text);
      const eventMsgs = messages.filter((m) => m.event === "event");

      // Should only see the broadcast event, not the targeted one
      for (const msg of eventMsgs) {
        const parsed = JSON.parse(msg.data);
        expect(parsed.type).not.toBe("interaction");
      }
    });

    it("supports ?token= query param auth", async () => {
      ctx = createTestContext();
      await createRoom("test-room", "plugin-1", "alice@test.com");

      const token = await makeToken("web-1", "bob@test.com");
      const res = await ctx.app.request(
        `/api/v1/rooms/test-room/events/stream?since=0&token=${token}`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/event-stream");
    });

    it("returns 401 without auth", async () => {
      ctx = createTestContext();
      await createRoom("test-room", "plugin-1", "alice@test.com");

      const res = await ctx.app.request("/api/v1/rooms/test-room/events/stream?since=0");
      expect(res.status).toBe(401);
    });
  });
});
