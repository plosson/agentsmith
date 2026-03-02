import type { Database } from "bun:sqlite";
import type { Room, RoomListItem, RoomMember, RoomWithMembers } from "@agentsmith/shared";

export function createRoom(db: Database, id: string, createdBy: string): Room {
  const now = Date.now();
  db.query("INSERT INTO rooms (id, created_by, created_at) VALUES (?, ?, ?)").run(
    id,
    createdBy,
    now,
  );
  return { id, created_by: createdBy, created_at: now };
}

export function listRooms(db: Database, userId?: string): RoomListItem[] {
  if (userId) {
    return db
      .query(
        `SELECT r.id, r.created_by, r.created_at,
                COUNT(rm2.user_id) AS member_count
         FROM rooms r
         INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
         LEFT JOIN room_members rm2 ON rm2.room_id = r.id
         GROUP BY r.id
         ORDER BY r.created_at DESC`,
      )
      .all(userId) as RoomListItem[];
  }
  return db
    .query(
      `SELECT r.id, r.created_by, r.created_at,
              COUNT(rm.user_id) AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
    )
    .all() as RoomListItem[];
}

export function getRoomWithMembers(db: Database, roomId: string): RoomWithMembers | null {
  const room = db.query("SELECT * FROM rooms WHERE id = ?").get(roomId) as Room | null;
  if (!room) return null;

  const members = db
    .query(
      `SELECT rm.user_id, u.email AS display_name, rm.joined_at
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ?
       ORDER BY rm.joined_at ASC`,
    )
    .all(roomId) as RoomMember[];

  return { ...room, members };
}

export function isMember(db: Database, roomId: string, userId: string): boolean {
  const row = db
    .query("SELECT 1 FROM room_members WHERE room_id = ? AND user_id = ?")
    .get(roomId, userId);
  return row !== null;
}

export function addMember(db: Database, roomId: string, userId: string): void {
  db.query(
    `INSERT INTO room_members (room_id, user_id, joined_at) VALUES (?, ?, ?)
     ON CONFLICT(room_id, user_id) DO NOTHING`,
  ).run(roomId, userId, Date.now());
}
