import type { Database } from "bun:sqlite";
import { deleteExpired } from "../db/events";

let timer: ReturnType<typeof setInterval> | null = null;

export function startCleanup(db: Database, intervalMs: number): void {
  stopCleanup();
  timer = setInterval(() => {
    const deleted = deleteExpired(db);
    if (deleted > 0) {
      console.log(`[cleanup] deleted ${deleted} expired events`);
    }
  }, intervalMs);
}

export function stopCleanup(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
