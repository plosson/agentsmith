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
import { transformEvent } from "../lib/transform";

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
      throw new ValidationError("Invalid event: type, format, and sender.user_id are required");
    }

    if (parsed.data.room_id !== roomId) {
      throw new ValidationError("room_id in body does not match URL");
    }

    const payloadStr = JSON.stringify(parsed.data.payload);
    if (payloadStr.length > config.payloadMaxBytes) {
      throw new PayloadTooLargeError();
    }

    const userId = c.get("userId");
    const ttlSeconds = TTL_SECONDS[parsed.data.type] ?? DEFAULT_TTL_SECONDS;

    addMember(db, roomId, userId);

    const event = insertEvent(db, {
      roomId,
      type: parsed.data.type,
      format: parsed.data.format,
      senderUserId: parsed.data.sender.user_id,
      senderSessionId: parsed.data.sender.session_id,
      payload: parsed.data.payload,
      ttlSeconds,
      targetUserId: parsed.data.target?.user_id,
      targetSessionId: parsed.data.target?.session_id,
    });

    const targeted = consumeTargetedEvents(
      db,
      roomId,
      parsed.data.sender.user_id,
      parsed.data.sender.session_id,
    );

    const format = c.req.query("format");
    const messages = targeted.map((e) => transformEvent(e, format).payload);

    return c.json(
      {
        id: event.id,
        room_id: event.room_id,
        created_at: event.created_at,
        expires_at: event.expires_at,
        messages,
      },
      201,
    );
  });

  router.get("/rooms/:roomId/events", (c) => {
    const roomId = c.req.param("roomId");
    const query = {
      since: c.req.query("since"),
      limit: c.req.query("limit"),
      format: c.req.query("format"),
    };

    const parsed = pollEventsQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new ValidationError("Invalid query: since (integer) is required");
    }

    const result = queryEvents(db, roomId, parsed.data.since, parsed.data.limit);
    const format = parsed.data.format;
    const events = result.events.map((e) => transformEvent(e, format));

    return c.json({ events, latest_ts: result.latest_ts });
  });

  return router;
}
