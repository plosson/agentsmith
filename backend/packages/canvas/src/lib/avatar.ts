const AVATAR_COLORS = [
  "#e74c3c",
  "#3498db",
  "#2ecc71",
  "#f39c12",
  "#9b59b6",
  "#1abc9c",
  "#e67e22",
  "#34495e",
  "#16a085",
  "#c0392b",
  "#2980b9",
  "#8e44ad",
  "#27ae60",
  "#d35400",
  "#7f8c8d",
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function getAvatarColor(userId: string): string {
  return AVATAR_COLORS[hashString(userId) % AVATAR_COLORS.length];
}

export function getInitials(displayName: string): string {
  const name = displayName.split("@")[0];
  if (!name) return "?";
  return name.charAt(0).toUpperCase();
}

export function getSignalColor(signal: string): string {
  switch (signal) {
    case "SessionStarted":
    case "BuildSucceeded":
    case "TestsPassed":
      return "#2ecc71"; // green
    case "BuildFailed":
    case "TestsFailed":
      return "#e74c3c"; // red
    case "CommandRunning":
    case "LongRunningCommand":
      return "#f39c12"; // yellow
    case "WaitingForInput":
      return "#3498db"; // blue
    case "HighTokenUsage":
      return "#e67e22"; // orange
    case "SessionEnded":
    case "Idle":
    case "LowTokenUsage":
    default:
      return "#95a5a6"; // gray
  }
}
