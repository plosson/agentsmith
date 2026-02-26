import type { FC } from "hono/jsx";
import { getSignalColor } from "../lib/avatar";

export const SignalBadge: FC<{ signal: string }> = ({ signal }) => {
  const color = getSignalColor(signal);
  const label = signal.replace(/([A-Z])/g, " $1").trim();

  return (
    <div class="flex items-center gap-1.5">
      <span
        class="inline-block w-2 h-2 rounded-full"
        style={`background-color: ${color}`}
      />
      <span class="text-xs text-gray-500">{label}</span>
    </div>
  );
};
