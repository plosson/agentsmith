import type { Event } from "@agentsmith/shared";

export type EventCallback = (event: Event) => void;

export class EventBus {
  private subscribers = new Map<string, Set<EventCallback>>();

  subscribe(roomId: string, cb: EventCallback): () => void {
    let subs = this.subscribers.get(roomId);
    if (!subs) {
      subs = new Set();
      this.subscribers.set(roomId, subs);
    }
    subs.add(cb);

    return () => {
      subs.delete(cb);
      if (subs.size === 0) {
        this.subscribers.delete(roomId);
      }
    };
  }

  publish(event: Event): void {
    const subs = this.subscribers.get(event.room_id);
    if (!subs) return;

    for (const cb of subs) {
      try {
        cb(event);
      } catch {
        // One bad client must not break others
      }
    }
  }

  subscriberCount(roomId: string): number {
    return this.subscribers.get(roomId)?.size ?? 0;
  }
}
