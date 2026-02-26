export const TTL_SECONDS: Record<string, number> = {
  "hook.SessionStart": 86400,
  "hook.SessionEnd": 300,
  "hook.UserPromptSubmit": 600,
  "hook.PreToolUse": 300,
  "hook.PostToolUse": 300,
  "hook.Stop": 300,
  "hook.Notification": 120,
  interaction: 120,
};

export const DEFAULT_TTL_SECONDS = 300;
