import { describe, expect, mock, test } from "bun:test";
import type { Event } from "@agentsmith/shared";
import { EventBus } from "./event-bus";

function makeEvent(roomId: string, overrides?: Partial<Event>): Event {
  return {
    id: "test-id",
    room_id: roomId,
    type: "hook.Test",
    format: "test_v1",
    sender: { user_id: "alice@co", session_id: null },
    target: null,
    payload: {},
    ttl_seconds: 300,
    created_at: Date.now(),
    expires_at: Date.now() + 300_000,
    ...overrides,
  };
}

describe("EventBus", () => {
  test("delivers events to subscribers of the correct room", () => {
    const bus = new EventBus();
    const cb = mock(() => {});
    bus.subscribe("room-1", cb);

    const event = makeEvent("room-1");
    bus.publish(event);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith(event);
  });

  test("does not deliver events to subscribers of other rooms", () => {
    const bus = new EventBus();
    const cb = mock(() => {});
    bus.subscribe("room-2", cb);

    bus.publish(makeEvent("room-1"));

    expect(cb).not.toHaveBeenCalled();
  });

  test("delivers to multiple subscribers of the same room", () => {
    const bus = new EventBus();
    const cb1 = mock(() => {});
    const cb2 = mock(() => {});
    bus.subscribe("room-1", cb1);
    bus.subscribe("room-1", cb2);

    bus.publish(makeEvent("room-1"));

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  test("unsubscribe stops delivery", () => {
    const bus = new EventBus();
    const cb = mock(() => {});
    const unsub = bus.subscribe("room-1", cb);

    unsub();
    bus.publish(makeEvent("room-1"));

    expect(cb).not.toHaveBeenCalled();
  });

  test("cleans up empty room sets after unsubscribe", () => {
    const bus = new EventBus();
    const unsub = bus.subscribe("room-1", () => {});

    expect(bus.subscriberCount("room-1")).toBe(1);
    unsub();
    expect(bus.subscriberCount("room-1")).toBe(0);
  });

  test("isolates errors — one bad callback does not break others", () => {
    const bus = new EventBus();
    const badCb = mock(() => {
      throw new Error("boom");
    });
    const goodCb = mock(() => {});

    bus.subscribe("room-1", badCb);
    bus.subscribe("room-1", goodCb);

    bus.publish(makeEvent("room-1"));

    expect(badCb).toHaveBeenCalledTimes(1);
    expect(goodCb).toHaveBeenCalledTimes(1);
  });

  test("publish to room with no subscribers is a no-op", () => {
    const bus = new EventBus();
    // Should not throw
    bus.publish(makeEvent("room-1"));
  });
});
