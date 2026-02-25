import app from "./app";
import { config } from "./lib/config";

export default {
  port: config.port,
  fetch: app.fetch,
};
