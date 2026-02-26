import { createApp } from "./app";
import { getDb } from "./db/client";
import { migrate } from "./db/migrate";
import { startCleanup } from "./lib/cleanup";
import { config } from "./lib/config";

const db = getDb();
migrate(db);
startCleanup(db, config.cleanupIntervalMs);

const app = createApp(db);

export default {
  port: config.port,
  fetch: app.fetch,
};
