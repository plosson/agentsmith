import type { Event } from "@agentsmith/shared";
import type { MapperProjection } from "./types";

export interface AvatarAction {
  user_id: string;
  session_id: string | null;
  action: string;
  duration_ms: number | null;
}

const ACTION_MAP: Record<string, { action: string; duration_ms: number | null }> = {
  "hook.PreToolUse": { action: "hands_wiggle", duration_ms: 5000 },
  "hook.UserPromptSubmit": { action: "speech_bubble", duration_ms: 3000 },
  "hook.SessionStart": { action: "enter", duration_ms: null },
  "hook.SessionEnd": { action: "leave", duration_ms: null },
  "hook.Stop": { action: "idle", duration_ms: null },
};

export const avatarActions: MapperProjection<AvatarAction> = {
  name: "avatar_actions",
  kind: "mapper",
  map(event: Event): AvatarAction | null {
    const mapping = ACTION_MAP[event.type];
    if (!mapping) return null;
    return {
      user_id: event.sender.user_id,
      session_id: event.sender.session_id,
      ...mapping,
    };
  },
};
