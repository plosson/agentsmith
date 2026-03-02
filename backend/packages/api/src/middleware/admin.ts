import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../app";
import { config } from "../lib/config";
import { ForbiddenError } from "../lib/errors";

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const email = c.get("userEmail");
  if (!config.adminUsers.includes(email)) {
    throw new ForbiddenError("Admin access required");
  }
  await next();
};
