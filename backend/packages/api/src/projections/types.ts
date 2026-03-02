import type { z } from "zod/v4";
import type { Event } from "@agentsmith/shared";

/** Transforms a single event into 0 or 1 output. Return null to filter out. */
export interface MapperProjection<T = unknown> {
  readonly name: string;
  readonly kind: "mapper";
  readonly map: (event: Event) => T | null;
  readonly schema?: z.ZodType<T>;
}

/** Aggregates a window of events into derived state. */
export interface ReducerProjection<T = unknown> {
  readonly name: string;
  readonly kind: "reducer";
  readonly reduce: (events: Event[]) => T;
  readonly schema?: z.ZodType<T>;
}

export type Projection = MapperProjection | ReducerProjection;
