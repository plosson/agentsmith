import { createApp } from "./app";
import { config } from "./lib/config";

const app = createApp();

export default {
  port: config.port,
  fetch: app.fetch,
};
