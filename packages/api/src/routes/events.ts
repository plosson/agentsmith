import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { emitEventSchema, pollEventsQuerySchema, TTL_SECONDS, DEFAULT_TTL_SECONDS } from "@agentsmith/shared";
import { insertEvent, queryEvents } from "../db/events";
import { addMember } from "../db/rooms";
import { NotFoundError, PayloadTooLargeError, ValidationError } from "../lib/errors";
import { config } from "../lib/config";

export function eventRoutes(db: Database): Hono {
  const router = new Hono();

  router.post("/rooms/:roomId/events", async (c) => {
    const roomId = c.req.param("roomId");

    // Check room exists
    const room = db.query("SELECT id FROM rooms WHERE id = ?").get(roomId);
    if (!room) {
      throw new NotFoundError("Room");
    }

    const body = await c.req.json();
    const parsed = emitEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid event: event_type is required");
    }

    // Check payload size
    const payloadStr = JSON.stringify(parsed.data.payload);
    if (payloadStr.length > config.payloadMaxBytes) {
      throw new PayloadTooLargeError();
    }

    const userId = c.get("userId") as string;
    const ttlSeconds = TTL_SECONDS[parsed.data.event_type] ?? DEFAULT_TTL_SECONDS;

    // Auto-join room
    addMember(db, roomId, userId);

    const event = insertEvent(db, {
      roomId,
      senderId: userId,
      eventType: parsed.data.event_type,
      payload: parsed.data.payload,
      ttlSeconds,
    });

    return c.json(
      { id: event.id, room_id: event.room_id, created_at: event.created_at, expires_at: event.expires_at },
      201,
    );
  });

  router.get("/rooms/:roomId/events", (c) => {
    const roomId = c.req.param("roomId");
    const query = {
      since: c.req.query("since"),
      limit: c.req.query("limit"),
    };

    const parsed = pollEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query: since (integer) is required");
    }

    const result = queryEvents(db, roomId, parsed.data.since, parsed.data.limit);
    return c.json(result);
  });

  return router;
}
