// ── Config ──────────────────────────────────────────────
export const T = 32;
export const COLS = 30;
export const ROWS = 22;
export const W = COLS * T;
export const H = ROWS * T;
export const AV = 64;
export const AV_OX = (AV - T) / 2;
export const AV_OY = AV - T;

// Mutable shared state
export const state = { tick: 0 };
