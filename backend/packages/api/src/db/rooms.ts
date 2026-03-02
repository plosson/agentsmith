import type { Database } from "bun:sqlite";
import type { Room, RoomListItem, RoomMember, RoomWithMembers } from "@agentsmith/shared";

export function createRoom(db: Database, id: string, createdBy: string, isPublic = true): Room {
  const now = Date.now();
  db.query("INSERT INTO rooms (id, created_by, created_at, is_public) VALUES (?, ?, ?, ?)").run(
    id,
    createdBy,
    now,
    isPublic ? 1 : 0,
  );
  return { id, created_by: createdBy, created_at: now, is_public: isPublic };
}

export function getRoom(db: Database, roomId: string): Room | null {
  const row = db.query("SELECT * FROM rooms WHERE id = ?").get(roomId) as {
    id: string;
    created_by: string;
    created_at: number;
    is_public: number;
  } | null;
  if (!row) return null;
  return { ...row, is_public: !!row.is_public };
}

export function updateRoom(db: Database, roomId: string, isPublic: boolean): Room | null {
  db.query("UPDATE rooms SET is_public = ? WHERE id = ?").run(isPublic ? 1 : 0, roomId);
  return getRoom(db, roomId);
}

export function removeMember(db: Database, roomId: string, userId: string): boolean {
  const result = db
    .query("DELETE FROM room_members WHERE room_id = ? AND user_id = ?")
    .run(roomId, userId);
  return result.changes > 0;
}

export function listRooms(db: Database, userId?: string): RoomListItem[] {
  type RawRow = Omit<RoomListItem, "is_public"> & { is_public: number };
  const toItem = (row: RawRow): RoomListItem => ({ ...row, is_public: !!row.is_public });

  if (userId) {
    const rows = db
      .query(
        `SELECT r.id, r.created_by, r.created_at, r.is_public,
                COUNT(rm2.user_id) AS member_count
         FROM rooms r
         INNER JOIN room_members rm ON rm.room_id = r.id AND rm.user_id = ?
         LEFT JOIN room_members rm2 ON rm2.room_id = r.id
         GROUP BY r.id
         ORDER BY r.created_at DESC`,
      )
      .all(userId) as RawRow[];
    return rows.map(toItem);
  }
  const rows = db
    .query(
      `SELECT r.id, r.created_by, r.created_at, r.is_public,
              COUNT(rm.user_id) AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
    )
    .all() as RawRow[];
  return rows.map(toItem);
}

export function getRoomWithMembers(db: Database, roomId: string): RoomWithMembers | null {
  const row = db.query("SELECT * FROM rooms WHERE id = ?").get(roomId) as {
    id: string;
    created_by: string;
    created_at: number;
    is_public: number;
  } | null;
  if (!row) return null;

  const members = db
    .query(
      `SELECT rm.user_id, u.email, COALESCE(u.display_name, u.email) AS display_name, rm.joined_at
       FROM room_members rm
       JOIN users u ON u.id = rm.user_id
       WHERE rm.room_id = ?
       ORDER BY rm.joined_at ASC`,
    )
    .all(roomId) as RoomMember[];

  return { ...row, is_public: !!row.is_public, members };
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
