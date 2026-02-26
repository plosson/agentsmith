// ── Color palettes ──────────────────────────────────────
export const FLOOR_PAL = [
  ['#c8b8a0','#c0b098'],  // 0 stone
  ['#8a7a68','#807060'],  // 1 wall
  ['#5090c0','#4888b8'],  // 2 water
  ['#58a838','#50a030'],  // 3 grass
  ['#d8c898','#d0c090'],  // 4 path
  ['#b84040','#b03838'],  // 5 rug
  ['#a07030','#986828'],  // 6 bar/counter
  ['#8a7050','#827048'],  // 7 barrel
  ['#a08848','#988040'],  // 8 door
  ['#6a5840','#625038'],  // 9 bookshelf
  ['#7a5040','#724838'],  // 10 fireplace
  ['#8a7050','#827048'],  // 11 chair
  ['#58a838','#50a030'],  // 12 flowers
  ['#58a838','#50a030'],  // 13 tree
  ['#5090c0','#4888b8'],  // 14 fountain
  ['#c8b8a0','#c0b098'],  // 15 torch_wall
];

// ── Helper: CSS hex to Phaser int ───────────────────────
export function hex(str) {
  return parseInt(str.replace('#',''), 16);
}
