import { createApp } from "./app";
import { config } from "./lib/config";
import { getDb } from "./db/client";
import { migrate } from "./db/migrate";

const db = getDb();
migrate(db);

const app = createApp(db);

export default {
  port: config.port,
  fetch: app.fetch,
};
