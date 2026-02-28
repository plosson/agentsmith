import { createApp } from "./app";
import { getDb } from "./db/client";
import { migrate } from "./db/migrate";
import { startCleanup } from "./lib/cleanup";
import { config } from "./lib/config";

if (!config.authDisabled && !config.jwtSecret) {
  console.error(
    "FATAL: JWT_SECRET is required when auth is enabled. Set JWT_SECRET or AUTH_DISABLED=true.",
  );
  process.exit(1);
}

const db = getDb();
migrate(db);
startCleanup(db, config.cleanupIntervalMs);

const app = createApp(db);

export default {
  port: config.port,
  fetch: app.fetch,
};
