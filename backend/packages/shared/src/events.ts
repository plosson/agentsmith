export interface Event {
  id: string;
  room_id: string;
  type: string;
  format: string;
  sender: { user_id: string; session_id: string | null };
  target: { user_id: string | null; session_id: string | null } | null;
  payload: unknown;
  ttl_seconds: number;
  created_at: number;
  expires_at: number;
}
