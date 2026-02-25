import type { SessionSignal } from "./signals";

export interface Event {
  id: string;
  room_id: string;
  sender_id: string;
  event_type: string;
  payload: unknown;
  ttl_seconds: number;
  created_at: number;
  expires_at: number;
}

export interface SessionSignalPayload {
  session_id: string;
  signal: SessionSignal;
}

export interface InteractionPayload {
  target_session_id?: string;
  interaction_type: string;
  data?: unknown;
}
