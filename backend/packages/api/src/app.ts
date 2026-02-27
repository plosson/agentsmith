import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { config } from "./lib/config";
import { EventBus } from "./lib/event-bus";
import { authMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { requestLogger } from "./middleware/logger";
import { eventRoutes } from "./routes/events";
import { presenceRoutes } from "./routes/presence";
import { roomRoutes } from "./routes/rooms";

export type AppEnv = {
  Variables: {
    userId: string;
    userEmail: string;
  };
};

export function createApp(db: Database, bus?: EventBus): Hono<AppEnv> {
  const eventBus = bus ?? new EventBus();
  const app = new Hono<AppEnv>();

  app.use("*", requestLogger);
  app.use("*", cors());
  app.onError(errorHandler);

  app.get("/health", (c) => {
    const uptime = Math.floor(process.uptime());
    return c.json({
      status: "ok",
      uptime_seconds: uptime,
      auth: config.authDisabled ? "disabled" : "enabled",
    });
  });

  if (config.authDisabled) {
    app.use("/api/*", async (c, next) => {
      const userId = "anonymous";
      const userEmail = "anonymous@local";
      db.query(
        `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
      ).run(userId, userEmail, Date.now());
      c.set("userId", userId);
      c.set("userEmail", userEmail);
      await next();
    });
  } else {
    app.use("/api/*", authMiddleware(db));
  }
  app.route("/api/v1", roomRoutes(db));
  app.route("/api/v1", eventRoutes(db, eventBus));
  app.route("/api/v1", presenceRoutes(db));

  return app;
}
