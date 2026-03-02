import type { Database } from "bun:sqlite";

export function upsertUser(db: Database, id: string, email: string): void {
  db.query(
    `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
  ).run(id, email, Date.now());
}

export function getUserById(
  db: Database,
  id: string,
): { id: string; email: string; display_name: string | null; created_at: number } | null {
  return db.query("SELECT * FROM users WHERE id = ?").get(id) as {
    id: string;
    email: string;
    display_name: string | null;
    created_at: number;
  } | null;
}

export function getUserByEmail(
  db: Database,
  email: string,
): { id: string; email: string; display_name: string | null; created_at: number } | null {
  return db.query("SELECT * FROM users WHERE email = ?").get(email) as {
    id: string;
    email: string;
    display_name: string | null;
    created_at: number;
  } | null;
}

/** Get or create a placeholder user for pre-provisioning room membership. */
export function getOrCreatePendingUser(
  db: Database,
  email: string,
): { id: string; email: string; display_name: string | null; created_at: number } {
  const existing = getUserByEmail(db, email);
  if (existing) return existing;

  const id = `pending|${email}`;
  const now = Date.now();
  db.query("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)").run(id, email, now);
  return { id, email, display_name: null, created_at: now };
}

/** Migrate pending user's memberships to the real user, then delete the placeholder. */
export function claimPendingUser(db: Database, realUserId: string, email: string): void {
  const pendingId = `pending|${email}`;
  const pending = getUserById(db, pendingId);
  if (!pending) return;

  db.query("UPDATE OR IGNORE room_members SET user_id = ? WHERE user_id = ?").run(
    realUserId,
    pendingId,
  );
  db.query("DELETE FROM room_members WHERE user_id = ?").run(pendingId);
  db.query("DELETE FROM users WHERE id = ?").run(pendingId);
}
