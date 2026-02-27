import { T, COLS, ROWS } from './config.js';

// ── Map (30 × 22) ──────────────────────────────────────
// Dense handcrafted office — vertically aligned tall sprites
const M = [
  'SSSCCSSSSSCCCCSSSSSSCCCSSSCCSS',
  'SCCCSSSSCCSSSSSCCCCSSSSSCCCSSS',
  'SSSSSCCSSSSSCCCSSSSSSSCCSSSSSS',
  'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  'WwxWwxWefWyzWWWWWyzWwxWwxWWbaW',
  'W!@W!@W#$W%^WWWWW%^W!@W!@WWnqW',
  'WVYBEABPBuvBBBcBPBklmBPB21B8BW',
  'WXZB9BBPBBPBBBBBPBKLBBPBBBBBBW',
  'WBBBBBBBBBBBBBBBBBBBBBBBBBBBBW',
  'WHIHIHIBpFgBHIHIHIBHIHIHIBHIBW',
  'WMd3rMdBRBBB6rMdMdBMd7rMdB3rBW',
  'WhihihiB.tJBhihihiBhihihiBhiBW',
  'WBBBBBBBBBBBBBBBBBBBBBBBBBBBBW',
  'WHIHIHIBpFgBHIHIHIBHIHIHIBHIBW',
  'WjMr6jMBRBBBr7jMjMBjMr3jMBr7BW',
  'WhihihiB.tJBhihihiBhihihiBhiBW',
  'WBBBBB4BBBBBBB5BBBBBBBBBBBBBBW',
  'WWWWWWWWDDWWWWWWWWWWDDWWWWWWWW',
  'WEABklmBPBBOBOBOBOBBdjMBbaBPBW',
  'W9PBKLBBPBBUBUBUBUBBrsRBnqBPBW',
  'WBBPBBBcoBBPBBBPBBBBPBBB8BBBBW',
  'WWWWWWWWWWWWWWWWWWWWWWWWWWWWWW',
].map(row => [...row]);

export const LEGEND = {
  // Floor & structure
  '.': 0, 'W': 1, 'B': 2, 'S': 3, 'C': 4, 'T': 5, 'D': 8, 'G': 16,
  // Furniture
  'd': 6, 'j': 7, 'r': 11, 's': 15, 'M': 23, 'Q': 24, 'R': 25, 'N': 26, 'p': 21,
  // Cubicle walls
  'H': 17, 'I': 18, 'h': 19, 'i': 20,
  // Seating
  'k': 27, 'l': 28, 'm': 29, 'K': 30, 'L': 31, '2': 60, '1': 61,
  // Plants
  'u': 32, 'v': 33, 'P': 12,
  // Windows & elevator (top halves)
  'w': 34, 'x': 35, 'y': 38, 'z': 39, 'e': 36, 'f': 37,
  // Windows & elevator (bottom halves)
  '!': 62, '@': 63, '#': 64, '$': 65, '%': 66, '^': 67,
  // Appliances & storage
  'V': 40, 'X': 41, 'Y': 42, 'Z': 43, 'E': 22, 'A': 46, 'O': 44, 'U': 45,
  // Bookshelves
  'b': 9, 'a': 10, 'n': 13, 'q': 14,
  // Filing cabinets
  'F': 47, 'g': 48, 't': 49, 'J': 50,
  // Decor
  'c': 51, 'o': 52, '3': 55, '6': 56, '7': 57, '8': 58, '9': 59,
  // Animals
  '4': 53, '5': 54,
};

export const MAP = M.map(row => row.map(ch => LEGEND[ch] ?? 0));
export const SOLID = new Set([1, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67]);

// ── Ceiling light positions ──────────────────────────────
export const LIGHTS = [];
LIGHTS.push({ x: 8 * T, y: 6 * T + T/2, w: 10 * T, h: T });
LIGHTS.push({ x: 22 * T, y: 6 * T + T/2, w: 10 * T, h: T });
LIGHTS.push({ x: 5 * T, y: 10 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 15 * T, y: 10 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 25 * T, y: 10 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 5 * T, y: 14 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 15 * T, y: 14 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 25 * T, y: 14 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 5 * T, y: 19 * T, w: 6 * T, h: T });
LIGHTS.push({ x: 15 * T, y: 19 * T, w: 4 * T, h: T });
LIGHTS.push({ x: 25 * T, y: 19 * T, w: 6 * T, h: T });

// ── Screen positions (for monitor glow) ──────────────────
export const SCREENS = [];
for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    if (MAP[r]?.[c] === 23) SCREENS.push({ x: c * T + T/2, y: r * T + T/2 });
  }
}
