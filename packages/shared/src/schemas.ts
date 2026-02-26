import { z } from "zod/v4";

export const roomNameSchema = z.string().regex(/^[a-z0-9-]{2,48}$/);

export const createRoomSchema = z.object({
  name: roomNameSchema,
});

export const emitEventSchema = z.object({
  event_type: z.string().min(1),
  payload: z.unknown(),
  sender_session_id: z.string().min(1).optional(),
  target_user_id: z.string().min(1).optional(),
  target_session_id: z.string().min(1).optional(),
});

export const pollEventsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});

export const deviceTokenSchema = z.object({
  device_code: z.string().min(1),
});
