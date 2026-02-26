import { z } from "zod/v4";

export const roomNameSchema = z.string().regex(/^[a-z0-9-]{2,48}$/);

export const createRoomSchema = z.object({
  id: roomNameSchema,
});

const eventParticipantSchema = z.object({
  user_id: z.string().min(1),
  session_id: z.string().min(1).optional(),
});

export const emitEventSchema = z.object({
  room_id: z.string().min(1),
  type: z.string().min(1),
  format: z.string().min(1),
  sender: eventParticipantSchema,
  target: eventParticipantSchema.optional(),
  payload: z.unknown(),
});

export const pollEventsQuerySchema = z.object({
  since: z.coerce.number().int().nonnegative(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  format: z.string().min(1).optional(),
});

export const deviceTokenSchema = z.object({
  device_code: z.string().min(1),
});
