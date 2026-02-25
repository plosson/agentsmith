import { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { migrate } from "./db/migrate";
import { errorHandler } from "./middleware/error";
import { authMiddleware } from "./middleware/auth";

export interface TestContext {
  db: Database;
  app: Hono;
}

export function createTestContext(): TestContext {
  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);

  const app = new Hono();
  app.use("*", cors());
  app.use("/api/*", authMiddleware(db));
  app.onError(errorHandler);
  app.get("/health", (c) => c.json({ status: "ok" }));

  return { db, app };
}

export function makeToken(sub: string, email: string): string {
  return btoa(JSON.stringify({ sub, email }));
}

export function authHeader(sub: string, email: string): Record<string, string> {
  return { Authorization: `Bearer ${makeToken(sub, email)}` };
}
