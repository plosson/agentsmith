import type { Database } from "bun:sqlite";
import { createRoomSchema } from "@agentsmith/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { addMember, createRoom, getRoomWithMembers, isMember, listRooms } from "../db/rooms";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";

export function roomRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/rooms", (c) => {
    const userId = c.get("userId");
    const rooms = listRooms(db, userId);
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
      addMember(db, parsed.data.id, userId);
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
    const userId = c.get("userId");
    if (!isMember(db, roomId, userId)) {
      throw new ForbiddenError("Not a member of this room");
    }
    return c.json(room);
  });

  return router;
}
