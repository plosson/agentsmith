import type { ErrorHandler } from "hono";
import { AppError } from "../lib/errors";

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json({ error: err.code, message: err.message }, err.statusCode as any);
  }

  console.error("Unhandled error:", err);
  return c.json({ error: "INTERNAL_ERROR", message: "An unexpected error occurred" }, 500);
};
