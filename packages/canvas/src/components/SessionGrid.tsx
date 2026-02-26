import type { FC } from "hono/jsx";
import { Avatar } from "./Avatar";

type Session = {
  user_id: string;
  display_name: string;
  session_id: string;
  signal: string;
  updated_at: number;
};

export const SessionGrid: FC<{ sessions: Session[] }> = ({ sessions }) => {
  if (sessions.length === 0) {
    return (
      <div class="text-center py-10 text-gray-400">
        <p class="text-sm">No active sessions</p>
      </div>
    );
  }

  // Compute per-user session index for the badge
  const userSessionCount: Record<string, number> = {};
  const sessionsWithIndex = sessions.map((s) => {
    const count = userSessionCount[s.user_id] ?? 0;
    userSessionCount[s.user_id] = count + 1;
    return { ...s, sessionIndex: count };
  });

  // Only show badges if a user has multiple sessions
  const usersWithMultiple = new Set(
    Object.entries(userSessionCount)
      .filter(([, count]) => count > 1)
      .map(([userId]) => userId),
  );

  return (
    <div class="flex flex-wrap gap-2">
      {sessionsWithIndex.map((s) => (
        <Avatar
          userId={s.user_id}
          displayName={s.display_name}
          sessionId={s.session_id}
          signal={s.signal}
          sessionIndex={usersWithMultiple.has(s.user_id) ? s.sessionIndex : undefined}
        />
      ))}
    </div>
  );
};
