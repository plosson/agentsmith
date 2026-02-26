import { Hono } from "hono";
import { pages } from "./routes/pages";
import { partials } from "./routes/partials";

export function createApp(): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.route("/", pages);
  app.route("/partials", partials);

  return app;
}
