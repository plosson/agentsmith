import type { MapperProjection, Projection, ReducerProjection } from "./types";
import { avatarActions } from "./avatar-actions";
import { leaderboard } from "./leaderboard";

export type { MapperProjection, Projection, ReducerProjection } from "./types";

const projections = new Map<string, Projection>();

export function register(p: Projection): void {
  if (projections.has(p.name)) {
    throw new Error(`Duplicate projection name: ${p.name}`);
  }
  projections.set(p.name, p);
}

export function getProjection(name: string): Projection | undefined {
  return projections.get(name);
}

export function getMapper(name: string): MapperProjection | undefined {
  const p = projections.get(name);
  return p?.kind === "mapper" ? p : undefined;
}

export function getReducer(name: string): ReducerProjection | undefined {
  const p = projections.get(name);
  return p?.kind === "reducer" ? p : undefined;
}

export function listProjections(): Projection[] {
  return [...projections.values()];
}

// --- Register all projections here ---
register(avatarActions);
register(leaderboard);
