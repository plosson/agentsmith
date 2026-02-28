import type { Database } from "bun:sqlite";
import { Hono } from "hono";
import type { AppEnv } from "../app";
import { createApiKey, deleteApiKey, listByUser } from "../db/api-keys";
import { NotFoundError, ValidationError } from "../lib/errors";
import { signSessionToken, verifyGoogleToken } from "../lib/jwt";

/**
 * Public auth routes (no middleware required).
 * Mounted at the root level, outside /api/* auth middleware.
 */
export function authRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/auth/google", async (c) => {
    const body = await c.req.json();
    const credential = body.credential;
    if (!credential || typeof credential !== "string") {
      throw new ValidationError("Missing credential");
    }

    const google = await verifyGoogleToken(credential);
    const userId = `google|${google.sub}`;

    // Upsert user with Google info
    db.query(
      `INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET email = excluded.email, display_name = excluded.display_name`,
    ).run(userId, google.email, google.name ?? null, Date.now());

    const token = await signSessionToken(userId, google.email);

    return c.json({
      token,
      user: {
        id: userId,
        email: google.email,
        name: google.name ?? null,
        picture: google.picture ?? null,
      },
    });
  });

  return router;
}

/**
 * Protected API key management routes.
 * Mounted under /api/v1 (behind auth middleware).
 */
export function apiKeyRoutes(db: Database): Hono<AppEnv> {
  const router = new Hono<AppEnv>();

  router.post("/api-keys", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json().catch(() => ({}));
    const name = body.name || "default";

    const result = await createApiKey(db, userId, name);
    return c.json(
      {
        id: result.id,
        key: result.rawKey,
        key_prefix: result.keyPrefix,
        name,
        created_at: result.createdAt,
      },
      201,
    );
  });

  router.get("/api-keys", (c) => {
    const userId = c.get("userId");
    const keys = listByUser(db, userId);
    return c.json({
      keys: keys.map((k) => ({
        id: k.id,
        name: k.name,
        key_prefix: k.key_prefix,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
      })),
    });
  });

  router.delete("/api-keys/:keyId", (c) => {
    const userId = c.get("userId");
    const keyId = c.req.param("keyId");
    const deleted = deleteApiKey(db, keyId, userId);
    if (!deleted) {
      throw new NotFoundError("API key");
    }
    return c.json({ deleted: true });
  });

  return router;
}

