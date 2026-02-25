import { Database } from "bun:sqlite";
import type { Hono } from "hono";
import { migrate } from "./db/migrate";
import { createApp } from "./app";

export interface TestContext {
  db: Database;
  app: Hono;
}

export function createTestContext(): TestContext {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);

  const app = createApp(db);
  return { db, app };
}

export function makeToken(sub: string, email: string): string {
  return btoa(JSON.stringify({ sub, email }));
}

export function authHeader(sub: string, email: string): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(sub, email)}` };
}
