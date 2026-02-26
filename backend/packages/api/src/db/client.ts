import { Database } from "bun:sqlite";
import { config } from "../lib/config";

let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database(config.databasePath, { create: true });
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
