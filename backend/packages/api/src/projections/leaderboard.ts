import type { Event } from "@agentsmith/shared";
import type { ReducerProjection } from "./types";

export interface LeaderboardEntry {
  user_id: string;
  score: number;
  event_count: number;
  last_active: number;
}

export interface LeaderboardState {
  users: LeaderboardEntry[];
}

const SCORE_MAP: Record<string, number> = {
  "hook.UserPromptSubmit": 1,
  "hook.PreToolUse": 2,
  "hook.Stop": 3,
  interaction: 5,
};

export const leaderboard: ReducerProjection<LeaderboardState> = {
  name: "leaderboard",
  kind: "reducer",
  reduce(events: Event[]): LeaderboardState {
    const byUser = new Map<string, LeaderboardEntry>();

    for (const event of events) {
      const points = SCORE_MAP[event.type];
      if (points === undefined) continue;

      const userId = event.sender.user_id;
      const existing = byUser.get(userId);

      if (existing) {
        existing.score += points;
        existing.event_count += 1;
        if (event.created_at > existing.last_active) {
          existing.last_active = event.created_at;
        }
      } else {
        byUser.set(userId, {
          user_id: userId,
          score: points,
          event_count: 1,
          last_active: event.created_at,
        });
      }
    }

    const users = [...byUser.values()].sort((a, b) => b.score - a.score);
    return { users };
  },
};
