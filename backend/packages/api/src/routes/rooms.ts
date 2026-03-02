import type { Database } from "bun:sqlite";
import { createRoomSchema, updateRoomSchema } from "@agentsmith/shared";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import {
  addMember,
  createRoom,
  getRoom,
  getRoomWithMembers,
  isMember,
  listRooms,
  removeMember,
  updateRoom,
} from "../db/rooms";
import { getOrCreatePendingUser, getUserByEmail } from "../db/users";
import { config } from "../lib/config";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../lib/errors";
import { requireAdmin } from "../middleware/admin";

export function roomRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.get("/rooms", (c) => {
    const userId = c.get("userId");
    const email = c.get("userEmail");
    const isAdmin = config.adminUsers.includes(email);
    const rooms = listRooms(db, isAdmin ? undefined : userId);
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
    const email = c.get("userEmail");
    const isAdmin = config.adminUsers.includes(email);
    if (!isAdmin && !isMember(db, roomId, userId)) {
      throw new ForbiddenError("Not a member of this room");
    }
    return c.json(room);
  });

  // --- Admin routes ---

  router.patch("/rooms/:roomId", requireAdmin, async (c) => {
    const roomId = c.req.param("roomId");
    const existing = getRoom(db, roomId);
    if (!existing) {
      throw new NotFoundError("Room");
    }

    const body = await c.req.json();
    const parsed = updateRoomSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError("Invalid body: is_public (boolean) is required");
    }

    const updated = updateRoom(db, roomId, parsed.data.is_public);
    return c.json(updated);
  });

  router.put("/rooms/:roomId/members/:userEmail", requireAdmin, (c) => {
    const roomId = c.req.param("roomId");
    const userEmail = c.req.param("userEmail").toLowerCase();

    const existing = getRoom(db, roomId);
    if (!existing) {
      throw new NotFoundError("Room");
    }

    const user = getOrCreatePendingUser(db, userEmail);
    addMember(db, roomId, user.id);
    return c.json({ ok: true });
  });

  router.delete("/rooms/:roomId/members/:userEmail", requireAdmin, (c) => {
    const roomId = c.req.param("roomId");
    const userEmail = c.req.param("userEmail").toLowerCase();

    const existing = getRoom(db, roomId);
    if (!existing) {
      throw new NotFoundError("Room");
    }

    const user = getUserByEmail(db, userEmail);
    if (!user) {
      throw new NotFoundError("User");
    }

    removeMember(db, roomId, user.id);
    return c.json({ ok: true });
  });

  return router;
}
