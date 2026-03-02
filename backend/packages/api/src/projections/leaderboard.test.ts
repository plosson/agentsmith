import { describe, expect, it } from "bun:test";
import type { Event } from "@agentsmith/shared";
import { leaderboard } from "./leaderboard";

function makeEvent(type: string, userId: string, createdAt?: number): Event {
  return {
    id: "01ABC",
    room_id: "test-room",
    type,
    format: "claude_code_v27",
    sender: { user_id: userId, session_id: null },
    target: null,
    payload: {},
    ttl_seconds: 300,
    created_at: createdAt ?? Date.now(),
    expires_at: (createdAt ?? Date.now()) + 300_000,
  };
}

describe("leaderboard reducer", () => {
  it("has name 'leaderboard' and kind 'reducer'", () => {
    expect(leaderboard.name).toBe("leaderboard");
    expect(leaderboard.kind).toBe("reducer");
  });

  it("returns empty users array for no events", () => {
    const result = leaderboard.reduce([]);
    expect(result).toEqual({ users: [] });
  });

  it("scores UserPromptSubmit as 1 point", () => {
    const result = leaderboard.reduce([makeEvent("hook.UserPromptSubmit", "alice@test.com")]);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].user_id).toBe("alice@test.com");
    expect(result.users[0].score).toBe(1);
    expect(result.users[0].event_count).toBe(1);
  });

  it("scores PreToolUse as 2 points", () => {
    const result = leaderboard.reduce([makeEvent("hook.PreToolUse", "alice@test.com")]);
    expect(result.users[0].score).toBe(2);
  });

  it("scores Stop as 3 points", () => {
    const result = leaderboard.reduce([makeEvent("hook.Stop", "alice@test.com")]);
    expect(result.users[0].score).toBe(3);
  });

  it("scores interaction as 5 points", () => {
    const result = leaderboard.reduce([makeEvent("interaction", "alice@test.com")]);
    expect(result.users[0].score).toBe(5);
  });

  it("ignores events with no scoring rule", () => {
    const result = leaderboard.reduce([makeEvent("hook.Notification", "alice@test.com")]);
    expect(result.users).toHaveLength(0);
  });

  it("aggregates multiple events per user", () => {
    const result = leaderboard.reduce([
      makeEvent("hook.UserPromptSubmit", "alice@test.com"), // +1
      makeEvent("hook.PreToolUse", "alice@test.com"), // +2
      makeEvent("hook.Stop", "alice@test.com"), // +3
    ]);
    expect(result.users).toHaveLength(1);
    expect(result.users[0].score).toBe(6);
    expect(result.users[0].event_count).toBe(3);
  });

  it("separates scores by user", () => {
    const result = leaderboard.reduce([
      makeEvent("hook.Stop", "alice@test.com"), // +3
      makeEvent("interaction", "bob@test.com"), // +5
    ]);
    expect(result.users).toHaveLength(2);
    // Sorted by score descending
    expect(result.users[0].user_id).toBe("bob@test.com");
    expect(result.users[0].score).toBe(5);
    expect(result.users[1].user_id).toBe("alice@test.com");
    expect(result.users[1].score).toBe(3);
  });

  it("sorts users by score descending", () => {
    const result = leaderboard.reduce([
      makeEvent("hook.UserPromptSubmit", "alice@test.com"), // 1
      makeEvent("interaction", "bob@test.com"), // 5
      makeEvent("hook.Stop", "charlie@test.com"), // 3
    ]);
    expect(result.users.map((u) => u.user_id)).toEqual([
      "bob@test.com",
      "charlie@test.com",
      "alice@test.com",
    ]);
  });

  it("tracks last_active as most recent created_at", () => {
    const now = Date.now();
    const result = leaderboard.reduce([
      makeEvent("hook.UserPromptSubmit", "alice@test.com", now - 5000),
      makeEvent("hook.Stop", "alice@test.com", now),
    ]);
    expect(result.users[0].last_active).toBe(now);
  });
});
