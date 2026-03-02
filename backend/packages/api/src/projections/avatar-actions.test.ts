import { describe, expect, it } from "bun:test";
import type { Event } from "@agentsmith/shared";
import { avatarActions } from "./avatar-actions";

function makeEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: "01ABC",
    room_id: "test-room",
    type: "hook.Stop",
    format: "claude_code_v27",
    sender: { user_id: "alice@test.com", session_id: "sess-1" },
    target: null,
    payload: {},
    ttl_seconds: 300,
    created_at: Date.now(),
    expires_at: Date.now() + 300_000,
    ...overrides,
  };
}

describe("avatarActions mapper", () => {
  it("has name 'avatar_actions' and kind 'mapper'", () => {
    expect(avatarActions.name).toBe("avatar_actions");
    expect(avatarActions.kind).toBe("mapper");
  });

  it("maps hook.PreToolUse to hands_wiggle", () => {
    const result = avatarActions.map(makeEvent({ type: "hook.PreToolUse" }));
    expect(result).toEqual({
      user_id: "alice@test.com",
      session_id: "sess-1",
      action: "hands_wiggle",
      duration_ms: 5000,
    });
  });

  it("maps hook.UserPromptSubmit to speech_bubble", () => {
    const result = avatarActions.map(makeEvent({ type: "hook.UserPromptSubmit" }));
    expect(result).toEqual({
      user_id: "alice@test.com",
      session_id: "sess-1",
      action: "speech_bubble",
      duration_ms: 3000,
    });
  });

  it("maps hook.SessionStart to enter", () => {
    const result = avatarActions.map(makeEvent({ type: "hook.SessionStart" }));
    expect(result).toEqual({
      user_id: "alice@test.com",
      session_id: "sess-1",
      action: "enter",
      duration_ms: null,
    });
  });

  it("maps hook.SessionEnd to leave", () => {
    const result = avatarActions.map(makeEvent({ type: "hook.SessionEnd" }));
    expect(result).toEqual({
      user_id: "alice@test.com",
      session_id: "sess-1",
      action: "leave",
      duration_ms: null,
    });
  });

  it("maps hook.Stop to idle", () => {
    const result = avatarActions.map(makeEvent({ type: "hook.Stop" }));
    expect(result).toEqual({
      user_id: "alice@test.com",
      session_id: "sess-1",
      action: "idle",
      duration_ms: null,
    });
  });

  it("returns null for unknown event types", () => {
    const result = avatarActions.map(makeEvent({ type: "hook.Notification" }));
    expect(result).toBeNull();
  });

  it("returns null for interaction events", () => {
    const result = avatarActions.map(makeEvent({ type: "interaction" }));
    expect(result).toBeNull();
  });
});
