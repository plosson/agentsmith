export const SESSION_SIGNALS = [
  "SessionStarted",
  "SessionEnded",
  "Idle",
  "CommandRunning",
  "LongRunningCommand",
  "WaitingForInput",
  "BuildSucceeded",
  "BuildFailed",
  "TestsPassed",
  "TestsFailed",
  "HighTokenUsage",
  "LowTokenUsage",
] as const;

export type SessionSignal = (typeof SESSION_SIGNALS)[number];
