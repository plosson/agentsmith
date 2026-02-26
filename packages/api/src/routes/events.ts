import type { Database } from "bun:sqlite";
import {
  DEFAULT_TTL_SECONDS,
  emitEventSchema,
  pollEventsQuerySchema,
  TTL_SECONDS,
} from "@agentsmith/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { consumeTargetedEvents, insertEvent, queryEvents } from "../db/events";
import { addMember } from "../db/rooms";
import { config } from "../lib/config";
import { NotFoundError, PayloadTooLargeError, ValidationError } from "../lib/errors";

export function eventRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/rooms/:roomId/events", async (c) => {
    const roomId = c.req.param("roomId");

    const room = db.query("SELECT id FROM rooms WHERE id = ?").get(roomId);
    if (!room) {
      throw new NotFoundError("Room");
    }

    const body = await c.req.json();
    const parsed = emitEventSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid event: event_type is required");
    }

    const payloadStr = JSON.stringify(parsed.data.payload);
    if (payloadStr.length > config.payloadMaxBytes) {
      throw new PayloadTooLargeError();
    }

    const userId = c.get("userId");
    const userEmail = c.get("userEmail");
    const ttlSeconds = TTL_SECONDS[parsed.data.event_type] ?? DEFAULT_TTL_SECONDS;

    addMember(db, roomId, userId);

    const event = insertEvent(db, {
      roomId,
      senderUserId: userEmail,
      senderSessionId: parsed.data.sender_session_id,
      eventType: parsed.data.event_type,
      payload: parsed.data.payload,
      ttlSeconds,
      targetUserId: parsed.data.target_user_id,
      targetSessionId: parsed.data.target_session_id,
    });

    const targeted = consumeTargetedEvents(db, roomId, userEmail, parsed.data.sender_session_id);

    return c.json(
      {
        id: event.id,
        room_id: event.room_id,
        created_at: event.created_at,
        expires_at: event.expires_at,
        messages: targeted.map((e) => e.payload),
      },
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
