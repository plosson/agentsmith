import { Database } from "bun:sqlite";
import type { Hono } from "hono";
import type { AppEnv } from "./app";
import { createApp } from "./app";
import { migrate } from "./db/migrate";
import { config } from "./lib/config";
import { EventBus } from "./lib/event-bus";
import { signSessionToken } from "./lib/jwt";

const TEST_JWT_SECRET = "test-jwt-secret-for-agentsmith";

export interface TestContext {
  db: Database;
  app: Hono<AppEnv>;
  bus: EventBus;
}

export function createTestContext(): TestContext {
  config.jwtSecret = TEST_JWT_SECRET;

  const db = new Database(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);

  const bus = new EventBus();
  const app = createApp(db, bus);
  return { db, app, bus };
}

export async function makeToken(sub: string, email: string): Promise<string> {
  config.jwtSecret = TEST_JWT_SECRET;
  return signSessionToken(sub, email);
}

export async function authHeader(sub: string, email: string): Promise<Record<string, string>> {
  return { Authorization: `Bearer ${await makeToken(sub, email)}` };
}
