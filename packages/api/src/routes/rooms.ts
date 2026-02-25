import type { Database } from "bun:sqlite";
import { createRoomSchema } from "@agentsmith/shared";
import { Hono } from "hono";
import { createRoom, getRoomWithMembers, listRooms } from "../db/rooms";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";

export function roomRoutes(db: Database): Hono {
  const router = new Hono();

  router.get("/rooms", (c) => {
    const rooms = listRooms(db);
    return c.json({ rooms });
  });

  router.post("/rooms", async (c) => {
    const body = await c.req.json();
    const parsed = createRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid room name: must match ^[a-z0-9-]{2,48}$");
    }

    const userId = c.get("userId") as string;

    try {
      const room = createRoom(db, parsed.data.name, userId);
      return c.json(room, 201);
    } catch (err: any) {
      if (err.message?.includes("UNIQUE constraint")) {
        throw new ConflictError(`Room name '${parsed.data.name}' already exists`);
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
