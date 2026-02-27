// ── Config ──────────────────────────────────────────────
export const T = 32;
export const COLS = 30;
export const ROWS = 22;
export const W = COLS * T;   // 960
export const H = ROWS * T;   // 704
export const AV = 64;
export const AV_OX = (AV - T) / 2;   // 16
export const AV_OY = AV - T;          // 32

// Mutable shared state
export const state = { tick: 0 };
