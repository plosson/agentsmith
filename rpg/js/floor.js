import { T, COLS, ROWS } from './config.js';
import { MAP } from './map.js';
import { FLOOR_PAL, hex } from './palettes.js';

// ── Tile ID → atlas frame name ─────────────────────────
const SPRITE_TILES = {
  6:  'desk_l',
  7:  'desk_r',
  9:  'bookshelf_tl',
  10: 'bookshelf_tr',
  11: 'chair',
  12: 'plant_pot',
  13: 'bookshelf_bl',
  14: 'bookshelf_br',
  15: 'chair2',
  // 17-20: cubicle walls drawn procedurally for better gray contrast
  22: 'coffee_machine',
  // 23-24: monitor/keyboard drawn procedurally for better visibility
  25: 'printer',
  26: 'phone',
  27: 'couch_l',
  28: 'couch_m',
  29: 'couch_r',
  30: 'couch_red_l',
  31: 'couch_red_r',
  // 32-33: plants drawn procedurally (atlas sprites have opaque sky-blue bg)
  34: 'window_lt',
  35: 'window_rt',
  36: 'elevator_lt',
  37: 'elevator_rt',
  38: 'window2_lt',
  39: 'window2_rt',
  62: 'window_lb',
  63: 'window_rb',
  64: 'elevator_lb',
  65: 'elevator_rb',
  66: 'window2_lb',
  67: 'window2_rb',
  40: 'vending_t',
  41: 'vending_b',
  42: 'vending2_t',
  43: 'vending2_b',
  44: 'server_t',
  45: 'server_b',
  46: 'microwave',
  47: 'filing_tl',
  48: 'filing_tr',
  49: 'filing_bl',
  50: 'filing_br',
  51: 'calendar',
  52: 'clock',
  53: 'cat',
  54: 'corgi',
  55: 'flag_us',
  56: 'flag_in',
  57: 'flag_uk',
  // 58: drawn procedurally (trash can)
  59: 'water_cooler',
  60: 'sofa',
};

// Tiles that use floor base underneath (sprite on top of floor)
const FLOOR_BASE_IDS = new Set([
  6, 7, 9, 10, 11, 12, 13, 14, 15, 21, 22, 24, 25, 26,
  27, 28, 29, 30, 31, 32, 33, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56,
  57, 58, 59, 60, 61,
]);

// ── Floor drawing ───────────────────────────────────────
export function drawFloor(scene) {
  const gfx = scene.add.graphics();
  gfx.setDepth(0);

  const hasAtlas = scene.textures.exists('office');

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = MAP[r][c];
      const x = c * T, y = r * T;

      // Draw base color
      const basePal = FLOOR_BASE_IDS.has(t) ? FLOOR_PAL[0] : (FLOOR_PAL[t] || FLOOR_PAL[0]);
      const color = (r + c) % 2 === 0 ? hex(basePal[0]) : hex(basePal[1]);
      gfx.fillStyle(color);
      gfx.fillRect(x, y, T, T);

      // Procedural detail for structure tiles
      if (!SPRITE_TILES[t]) {
        drawTileDetail(gfx, t, x, y, r, c);
      }

      // Place atlas sprite
      if (SPRITE_TILES[t] && hasAtlas) {
        const frameName = SPRITE_TILES[t];
        if (t === 60) {
          // Sofa: 32×16 native, spans 2 tiles
          const sprite = scene.add.sprite(x + T, y + T / 2, 'office', frameName);
          sprite.setDisplaySize(T * 2, T);
          sprite.setDepth(1);
        } else {
          const sprite = scene.add.sprite(x + T / 2, y + T / 2, 'office', frameName);
          sprite.setDisplaySize(T, T);
          sprite.setDepth(1);
        }
      }
    }
  }
}

function drawTileDetail(gfx, t, x, y, r, c) {
  if (t === 1) {
    // Wall — clean white with subtle horizontal mortar lines
    gfx.fillStyle(0xd8d8e0);
    gfx.fillRect(x, y + Math.floor(T * 0.5), T, 1);
    // Top highlight when exposed to sky/wall_top
    if (r > 0 && MAP[r - 1][c] !== 1 && MAP[r - 1][c] !== 16) {
      gfx.fillStyle(0xf4f4f8);
      gfx.fillRect(x, y, T, 2);
    }
    // Bottom baseboard when floor below
    const below = r < ROWS - 1 ? MAP[r + 1][c] : -1;
    if (below === 0 || below === 2 || below === 8) {
      gfx.fillStyle(0xc0c0c8);
      gfx.fillRect(x, y + T - 3, T, 3);
      gfx.fillStyle(0xb0b0b8);
      gfx.fillRect(x, y + T - 1, T, 1);
    }
  } else if (t === 0 || t === 2) {
    // Blue floor — prominent tile seams like reference
    // Light seam lines on right and bottom edges
    gfx.fillStyle(0x90c8e0, 0.6);
    gfx.fillRect(x + T - 2, y, 2, T);
    gfx.fillRect(x, y + T - 2, T, 2);
    // Subtle dark inner edge for depth
    gfx.fillStyle(0x000000, 0.06);
    gfx.fillRect(x, y, T, 1);
    gfx.fillRect(x, y, 1, T);
  } else if (t === 3) {
    // Sky — gradient from dark top to lighter bottom
    const skyShade = r === 0 ? 0x3080b8 : r === 1 ? 0x4090c8 : 0x4898d0;
    gfx.fillStyle(skyShade);
    gfx.fillRect(x, y, T, T);
  } else if (t === 4) {
    // Cloud — solid white block, adjacent tiles merge into big shapes
    gfx.fillStyle(0xffffff, 0.92);
    gfx.fillRect(x, y, T, T);
    // Round exposed corners by restoring sky color
    const above = r > 0 && MAP[r-1]?.[c] === 4;
    const below = r < ROWS-1 && MAP[r+1]?.[c] === 4;
    const left = c > 0 && MAP[r][c-1] === 4;
    const right = c < COLS-1 && MAP[r][c+1] === 4;
    const skyC = r === 0 ? 0x3080b8 : r === 1 ? 0x4090c8 : 0x4898d0;
    if (!above && !left) { gfx.fillStyle(skyC); gfx.fillRect(x, y, 6, 4); gfx.fillRect(x, y, 4, 6); }
    if (!above && !right) { gfx.fillStyle(skyC); gfx.fillRect(x+T-6, y, 6, 4); gfx.fillRect(x+T-4, y, 4, 6); }
    if (!below && !left) { gfx.fillStyle(skyC); gfx.fillRect(x, y+T-4, 6, 4); gfx.fillRect(x, y+T-6, 4, 6); }
    if (!below && !right) { gfx.fillStyle(skyC); gfx.fillRect(x+T-6, y+T-4, 6, 4); gfx.fillRect(x+T-4, y+T-6, 4, 6); }
    // Subtle shadow on bottom edge
    if (!below) { gfx.fillStyle(0x000000, 0.04); gfx.fillRect(x + 4, y + T - 2, T - 8, 2); }
  } else if (t === 5) {
    // Wall top strip — dark concrete cap like reference
    gfx.fillStyle(0x888890);
    gfx.fillRect(x, y, T, T);
    gfx.fillStyle(0x9898a0);
    gfx.fillRect(x, y, T, 3);
    gfx.fillStyle(0x606068);
    gfx.fillRect(x, y + T - 3, T, 3);
  } else if (t === 8) {
    // Door — glass with steel frame
    gfx.fillStyle(0x607890);
    gfx.fillRect(x + 2, y, 1, T);
    gfx.fillRect(x + T - 3, y, 1, T);
    gfx.fillStyle(0x80a8c8);
    gfx.fillRect(x + 4, y + 1, T - 8, T - 2);
    gfx.fillStyle(0x90b8d8, 0.5);
    gfx.fillRect(x + 5, y + 2, T - 10, T - 4);
    // Handle
    gfx.fillStyle(0xc8d0d8);
    gfx.fillRect(x + T / 2 + 2, y + T / 2 - 2, 3, 4);
    // Reflection
    gfx.fillStyle(0xffffff, 0.15);
    gfx.fillRect(x + 6, y + 3, 3, T - 8);
  } else if (t === 58) {
    // Trash can — gray bin with rim
    const cx = x + T / 2, cy = y + T / 2;
    gfx.fillStyle(0x606068);
    gfx.fillRect(cx - 6, cy - 4, 12, 12);
    gfx.fillStyle(0x505058);
    gfx.fillRect(cx - 7, cy - 6, 14, 3);
    gfx.fillStyle(0x707078);
    gfx.fillRect(cx - 5, cy - 1, 10, 1);
    gfx.fillRect(cx - 5, cy + 3, 10, 1);
  } else if (t >= 17 && t <= 20) {
    // Cubicle partition walls — gray with 3D effect
    const isTop = (t === 17 || t === 18);
    const isLeft = (t === 17 || t === 19);
    // Main gray body
    gfx.fillStyle(0xa8b0b8);
    gfx.fillRect(x, y, T, T);
    // Top edge highlight
    gfx.fillStyle(0xc0c8d0);
    gfx.fillRect(x, y, T, 3);
    // Bottom shadow
    gfx.fillStyle(0x808890);
    gfx.fillRect(x, y + T - 3, T, 3);
    // Horizontal divider line
    gfx.fillStyle(0x909098);
    gfx.fillRect(x, y + Math.floor(T / 2), T, 2);
    // Vertical edge for left/right distinction
    if (isLeft) {
      gfx.fillStyle(0xb8c0c8);
      gfx.fillRect(x, y, 2, T);
    } else {
      gfx.fillStyle(0x909098);
      gfx.fillRect(x + T - 2, y, 2, T);
    }
    // Corner accent
    if (isTop) {
      gfx.fillStyle(0xd0d4dc);
      gfx.fillRect(x + 2, y + 2, T - 4, 2);
    }
  } else if (t === 32 || t === 33) {
    // Plant — green bush on small pot
    const cx = x + T / 2;
    // Pot
    gfx.fillStyle(0x8a6848);
    gfx.fillRect(cx - 5, y + T - 8, 10, 6);
    gfx.fillStyle(0x7a5838);
    gfx.fillRect(cx - 6, y + T - 9, 12, 3);
    // Bush
    gfx.fillStyle(0x40a848);
    gfx.fillRect(cx - 10, y + 4, 20, 18);
    gfx.fillStyle(0x38a040);
    gfx.fillRect(cx - 8, y + 2, 16, 8);
    gfx.fillStyle(0x50b858);
    gfx.fillRect(cx - 6, y + 6, 4, 8);
    gfx.fillRect(cx + 4, y + 4, 4, 6);
    // Left/right variation
    if (t === 32) {
      gfx.fillStyle(0x48b050);
      gfx.fillRect(cx - 12, y + 8, 6, 10);
    } else {
      gfx.fillStyle(0x48b050);
      gfx.fillRect(cx + 6, y + 8, 6, 10);
    }
  } else if (t === 21) {
    // Whiteboard — white rectangle with border
    gfx.fillStyle(0xf0f0f4);
    gfx.fillRect(x + 2, y + 2, T - 4, T - 4);
    gfx.fillStyle(0xc0c0c8);
    gfx.fillRect(x + 2, y + 2, T - 4, 2);
    gfx.fillRect(x + 2, y + 2, 2, T - 4);
    gfx.fillRect(x + 2, y + T - 4, T - 4, 2);
    gfx.fillRect(x + T - 4, y + 2, 2, T - 4);
    // Marker dots
    gfx.fillStyle(0x3070a0);
    gfx.fillRect(x + 8, y + 8, 6, 2);
    gfx.fillStyle(0xa03030);
    gfx.fillRect(x + 8, y + 14, 10, 2);
    gfx.fillStyle(0x309030);
    gfx.fillRect(x + 8, y + 20, 8, 2);
  } else if (t === 23) {
    // Monitor — dark screen with stand
    gfx.fillStyle(0x282830);
    gfx.fillRect(x + 3, y + 2, T - 6, T - 8);
    // Screen content glow
    gfx.fillStyle(0x4080b0, 0.5);
    gfx.fillRect(x + 5, y + 4, T - 10, T - 12);
    // Stand
    gfx.fillStyle(0x505058);
    gfx.fillRect(x + T/2 - 3, y + T - 6, 6, 4);
    gfx.fillRect(x + T/2 - 5, y + T - 3, 10, 2);
    // Screen highlight
    gfx.fillStyle(0xffffff, 0.1);
    gfx.fillRect(x + 6, y + 5, 3, T - 14);
  } else if (t === 24) {
    // Keyboard — small rectangle
    gfx.fillStyle(0x404048);
    gfx.fillRect(x + 4, y + T/2 - 3, T - 8, 8);
    gfx.fillStyle(0x505058);
    gfx.fillRect(x + 5, y + T/2 - 2, T - 10, 6);
    // Key dots
    gfx.fillStyle(0x606068);
    for (let kx = 0; kx < 3; kx++) {
      for (let ky = 0; ky < 2; ky++) {
        gfx.fillRect(x + 7 + kx * 6, y + T/2 - 1 + ky * 3, 4, 2);
      }
    }
  } else if (t === 16) {
    // Glass wall — translucent panel with metal frame
    gfx.fillStyle(0x8098b0);
    gfx.fillRect(x, y, T, T);
    gfx.fillStyle(0xa0c0d8, 0.7);
    gfx.fillRect(x + 2, y + 2, T - 4, T - 4);
    // Reflection streak
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillRect(x + 3, y + 3, 3, T - 6);
    // Frame
    gfx.fillStyle(0x607080);
    gfx.fillRect(x, y, T, 2);
    gfx.fillRect(x, y + T - 2, T, 2);
    gfx.fillRect(x, y, 2, T);
    gfx.fillRect(x + T - 2, y, 2, T);
  }
}
