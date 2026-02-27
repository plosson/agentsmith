import type { Database } from "bun:sqlite";
import type { MiddlewareHandler } from "hono";
import { UnauthorizedError } from "../lib/errors";

export function authMiddleware(db: Database): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");
    const queryToken = c.req.query("token");

    let token: string;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else if (queryToken) {
      token = queryToken;
    } else {
      throw new UnauthorizedError();
    }
    let payload: { sub: string; email: string };

    try {
      payload = JSON.parse(atob(token));
      if (!payload.sub || !payload.email) {
        throw new Error("missing fields");
      }
    } catch {
      throw new UnauthorizedError("Invalid token");
    }

    // Upsert user
    db.query(
      `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
    ).run(payload.sub, payload.email, Date.now());

    c.set("userId", payload.sub);
    c.set("userEmail", payload.email);

    await next();
  };
}
