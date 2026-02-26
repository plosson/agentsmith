import type { FC } from "hono/jsx";
import { getAvatarColor, getInitials } from "../lib/avatar";
import { SignalBadge } from "./SignalBadge";

type AvatarProps = {
  userId: string;
  displayName: string;
  sessionId: string;
  signal: string;
  sessionIndex?: number;
};

export const Avatar: FC<AvatarProps> = ({ userId, displayName, sessionId, signal, sessionIndex }) => {
  const color = getAvatarColor(userId);
  const initials = getInitials(displayName);

  return (
    <div class="flex flex-col items-center gap-2 p-3" title={`${displayName}\n${sessionId}`}>
      <div class="relative">
        <div
          class="w-14 h-14 rounded-full flex items-center justify-center text-white font-semibold text-lg"
          style={`background-color: ${color}`}
        >
          {initials}
        </div>
        {sessionIndex !== undefined && sessionIndex > 0 && (
          <span class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border border-gray-300 text-[10px] font-medium flex items-center justify-center text-gray-600">
            {sessionIndex + 1}
          </span>
        )}
      </div>
      <SignalBadge signal={signal} />
    </div>
  );
};
