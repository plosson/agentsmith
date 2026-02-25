import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { eventRoutes } from "./routes/events";
import { presenceRoutes } from "./routes/presence";
import { roomRoutes } from "./routes/rooms";

export function createApp(db: Database): Hono {
  const app = new Hono();

  app.use("*", cors());
  app.onError(errorHandler);

  app.get("/health", (c) => c.json({ status: "ok" }));

  app.use("/api/*", authMiddleware(db));
  app.route("/api/v1", roomRoutes(db));
  app.route("/api/v1", eventRoutes(db));
  app.route("/api/v1", presenceRoutes(db));

  return app;
}
