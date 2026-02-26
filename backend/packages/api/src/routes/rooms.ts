import type { Database } from "bun:sqlite";
import { createRoomSchema } from "@agentsmith/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { createRoom, getRoomWithMembers, listRooms } from "../db/rooms";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";

export function roomRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/rooms", (c) => {
    const rooms = listRooms(db);
    return c.json({ rooms });
  });

  router.post("/rooms", async (c) => {
    const body = await c.req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid room id: must match ^[a-z0-9-]{2,48}$");
    }

    const userId = c.get("userId");

    try {
      const room = createRoom(db, parsed.data.id, userId);
      return c.json(room, 201);
    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes("UNIQUE constraint")) {
        throw new ConflictError(`Room '${parsed.data.id}' already exists`);
      }
      throw err;
    }
  });

  router.get("/rooms/:roomId", (c) => {
    const roomId = c.req.param("roomId");
    const room = getRoomWithMembers(db, roomId);
    if (!room) {
      throw new NotFoundError("Room");
    }
    return c.json(room);
  });

  return router;
}
