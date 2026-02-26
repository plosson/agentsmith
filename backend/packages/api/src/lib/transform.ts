import type { Event } from "@agentsmith/shared";

export type Transformer = (event: Event) => Event;

const registry: Record<string, Transformer> = {};

export function transformEvent(event: Event, toFormat?: string): Event {
  if (!toFormat || toFormat === event.format) return event;
  const key = `${event.format}:${toFormat}`;
  const transformer = registry[key];
  return transformer ? transformer(event) : event;
}

export function registerTransformer(from: string, to: string, fn: Transformer): void {
  registry[`${from}:${to}`] = fn;
}
