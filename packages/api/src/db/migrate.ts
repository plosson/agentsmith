import type { Database } from "bun:sqlite";

export function migrate(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id          TEXT PRIMARY KEY,
      email       TEXT NOT NULL,
      display_name TEXT,
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL UNIQUE,
      created_by  TEXT NOT NULL REFERENCES users(id),
      created_at  INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id     TEXT NOT NULL REFERENCES rooms(id),
      user_id     TEXT NOT NULL REFERENCES users(id),
      joined_at   INTEGER NOT NULL,
      PRIMARY KEY (room_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      id                TEXT PRIMARY KEY,
      room_id           TEXT NOT NULL REFERENCES rooms(id),
      type              TEXT NOT NULL,
      format            TEXT NOT NULL,
      sender_user_id    TEXT NOT NULL,
      sender_session_id TEXT,
      target_user_id    TEXT,
      target_session_id TEXT,
      payload           TEXT NOT NULL,
      ttl_seconds       INTEGER NOT NULL,
      created_at        INTEGER NOT NULL,
      expires_at        INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_events_room_created ON events(room_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_events_expires ON events(expires_at);
    CREATE INDEX IF NOT EXISTS idx_events_target ON events(room_id, target_user_id, target_session_id, expires_at);
  `);
}
