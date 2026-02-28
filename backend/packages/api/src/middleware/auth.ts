import type { Database } from "bun:sqlite";
import type { MiddlewareHandler } from "hono";
import { findByKeyHash, hashApiKey, updateLastUsed } from "../db/api-keys";
import { UnauthorizedError } from "../lib/errors";
import { verifySessionToken } from "../lib/jwt";

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

    // Try 1: Verify as session JWT
    try {
      const payload = await verifySessionToken(token);
      // Upsert user
      db.query(
        `INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET email = excluded.email`,
      ).run(payload.sub, payload.email, Date.now());

      c.set("userId", payload.sub);
      c.set("userEmail", payload.email);
      await next();
      return;
    } catch {
      // Not a valid JWT — try API key
    }

    // Try 2: Verify as API key
    try {
      const keyHash = await hashApiKey(token);
      const apiKey = findByKeyHash(db, keyHash);
      if (apiKey) {
        // Look up user email from users table
        const user = db.query("SELECT email FROM users WHERE id = ?").get(apiKey.user_id) as {
          email: string;
        } | null;
        if (!user) {
          throw new UnauthorizedError("API key owner not found");
        }

        updateLastUsed(db, apiKey.id);
        c.set("userId", apiKey.user_id);
        c.set("userEmail", user.email);
        await next();
        return;
      }
    } catch (e) {
      if (e instanceof UnauthorizedError) throw e;
      // Hash/lookup failed — fall through to 401
    }

    throw new UnauthorizedError("Invalid token");
  };
}
