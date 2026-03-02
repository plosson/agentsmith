import type { Database } from "bun:sqlite";
import {
  DEFAULT_TTL_SECONDS,
  emitEventSchema,
  pollEventsQuerySchema,
  TTL_SECONDS,
} from "@agentsmith/shared";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { AppEnv } from "../app";
import { consumeTargetedEvents, insertEvent, queryEvents } from "../db/events";
import { addMember, createRoom, getRoom, isMember } from "../db/rooms";
import { config } from "../lib/config";
import { ForbiddenError, PayloadTooLargeError, ValidationError } from "../lib/errors";
import type { EventBus } from "../lib/event-bus";
import { getMapper, getProjection } from "../projections";

const HEARTBEAT_INTERVAL_MS = 15_000;

export function eventRoutes(db: Database, bus: EventBus): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/rooms/:roomId/events", async (c) => {
    const roomId = c.req.param("roomId");
    const userId = c.get("userId");

    const existingRoom = getRoom(db, roomId);
    if (!existingRoom) {
      // Auto-create as public + auto-join
      createRoom(db, roomId, userId);
      addMember(db, roomId, userId);
    } else if (existingRoom.is_public) {
      // Public room — auto-join
      addMember(db, roomId, userId);
    } else {
      // Private room — must already be a member
      if (!isMember(db, roomId, userId)) {
        throw new ForbiddenError("Not a member of this private room");
      }
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

    const ttlSeconds = TTL_SECONDS[parsed.data.type] ?? DEFAULT_TTL_SECONDS;

    const userEmail = c.get("userEmail");

    const event = insertEvent(db, {
      roomId,
      type: parsed.data.type,
      format: parsed.data.format,
      senderUserId: userEmail,
      senderSessionId: parsed.data.sender.session_id,
      payload: parsed.data.payload,
      ttlSeconds,
      targetUserId: parsed.data.target?.user_id,
      targetSessionId: parsed.data.target?.session_id,
    });

    if (!parsed.data.target) {
      bus.publish(event);
    }

    const targeted = consumeTargetedEvents(db, roomId, userEmail, parsed.data.sender.session_id);

    const format = c.req.query("format");
    let messages: unknown[];
    if (format) {
      const mapper = getMapper(format);
      if (mapper) {
        messages = targeted.map((e) => mapper.map(e) ?? e.payload);
      } else {
        messages = targeted.map((e) => e.payload);
      }
    } else {
      messages = targeted.map((e) => e.payload);
    }

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

  router.get("/rooms/:roomId/events/stream", (c) => {
    const roomId = c.req.param("roomId");
    const userId = c.get("userId");
    if (!isMember(db, roomId, userId)) {
      throw new ForbiddenError("Not a member of this room");
    }
    const since = Number(c.req.query("since") || "0");
    const format = c.req.query("format");

    // Parse comma-separated formats into mapper array
    const formatNames = format
      ? format
          .split(",")
          .map((f) => f.trim())
          .filter(Boolean)
      : [];
    const mappers = formatNames.map((name) => {
      const m = getMapper(name);
      if (!m) throw new ValidationError(`Unknown or non-mapper projection: ${name}`);
      return m;
    });

    return streamSSE(c, async (stream) => {
      let latestTs = since;
      let aborted = false;

      // 1. Catch-up: send events since the given timestamp
      const result = queryEvents(db, roomId, since, 200);
      for (const event of result.events) {
        if (mappers.length > 0) {
          for (const mapper of mappers) {
            const projected = mapper.map(event);
            if (projected !== null) {
              await stream.writeSSE({
                event: "projection",
                data: JSON.stringify({ format: mapper.name, data: projected }),
                id: event.id,
              });
            }
          }
        } else {
          await stream.writeSSE({
            event: "event",
            data: JSON.stringify(event),
            id: event.id,
          });
        }
        if (event.created_at > latestTs) {
          latestTs = event.created_at;
        }
      }

      // 2. Subscribe to live events
      const unsubscribe = bus.subscribe(roomId, (event) => {
        if (aborted) return;
        // Deduplicate: skip events already sent during catch-up
        if (event.created_at <= latestTs) return;
        latestTs = event.created_at;

        if (mappers.length > 0) {
          for (const mapper of mappers) {
            const projected = mapper.map(event);
            if (projected !== null) {
              stream.writeSSE({
                event: "projection",
                data: JSON.stringify({ format: mapper.name, data: projected }),
                id: event.id,
              });
            }
          }
        } else {
          stream.writeSSE({
            event: "event",
            data: JSON.stringify(event),
            id: event.id,
          });
        }
      });

      // 3. Heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        if (aborted) return;
        stream.writeSSE({ event: "ping", data: "" });
      }, HEARTBEAT_INTERVAL_MS);

      // 4. Cleanup on disconnect
      stream.onAbort(() => {
        aborted = true;
        clearInterval(heartbeat);
        unsubscribe();
      });

      // Keep the stream open by awaiting a promise that resolves on abort
      await new Promise<void>((resolve) => {
        stream.onAbort(() => resolve());
      });
    });
  });

  router.get("/rooms/:roomId/events", (c) => {
    const roomId = c.req.param("roomId");
    const userId = c.get("userId");
    if (!isMember(db, roomId, userId)) {
      throw new ForbiddenError("Not a member of this room");
    }
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

    if (!format) {
      return c.json({ events: result.events, latest_ts: result.latest_ts });
    }

    const projection = getProjection(format);
    if (!projection) {
      throw new ValidationError(`Unknown projection: ${format}`);
    }

    if (projection.kind === "reducer") {
      return c.json(projection.reduce(result.events));
    }

    // Mapper: filter nulls
    const events = result.events.map((e) => projection.map(e)).filter((e) => e !== null);
    return c.json({ events, latest_ts: result.latest_ts });
  });

  return router;
}
