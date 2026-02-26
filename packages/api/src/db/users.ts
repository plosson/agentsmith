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
