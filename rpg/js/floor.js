import { T, COLS, ROWS } from './config.js';
import { MAP } from './map.js';
import { FLOOR_PAL, hex } from './palettes.js';

// ── Floor drawing ───────────────────────────────────────
export function drawFloor(scene) {
  const gfx = scene.add.graphics();
  gfx.setDepth(0);

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = MAP[r][c];
      const pal = FLOOR_PAL[t] || FLOOR_PAL[0];
      const x = c * T, y = r * T;
      const color = (r + c) % 2 === 0 ? hex(pal[0]) : hex(pal[1]);
      gfx.fillStyle(color);
      gfx.fillRect(x, y, T, T);
      drawTileDetail(gfx, t, x, y, r, c);
    }
  }
}

function drawTileDetail(gfx, t, x, y, r, c) {
  const hash = (r * 31 + c * 17) & 0xFFFF;

  if (t === 2) {
    // Pool water — stone edge where adjacent tile is not water
    const isWater = (rr, cc) =>
      rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && MAP[rr][cc] === 2;
    const edgeW = 4;
    // Stone rim
    gfx.fillStyle(0x9090a8);
    if (!isWater(r-1, c)) gfx.fillRect(x, y, T, edgeW);
    if (!isWater(r+1, c)) gfx.fillRect(x, y+T-edgeW, T, edgeW);
    if (!isWater(r, c-1)) gfx.fillRect(x, y, edgeW, T);
    if (!isWater(r, c+1)) gfx.fillRect(x+T-edgeW, y, edgeW, T);
    // Inner water
    const ex = isWater(r, c-1) ? 0 : edgeW;
    const ey = isWater(r-1, c) ? 0 : edgeW;
    const ew = T - ex - (isWater(r, c+1) ? 0 : edgeW);
    const eh = T - ey - (isWater(r+1, c) ? 0 : edgeW);
    gfx.fillStyle(0x4898d0);
    gfx.fillRect(x+ex, y+ey, ew, eh);
    // Corner accents
    gfx.fillStyle(0xa0a0b8);
    if (!isWater(r-1, c) && !isWater(r, c-1)) gfx.fillRect(x, y, edgeW+1, edgeW+1);
    if (!isWater(r-1, c) && !isWater(r, c+1)) gfx.fillRect(x+T-edgeW-1, y, edgeW+1, edgeW+1);
    if (!isWater(r+1, c) && !isWater(r, c-1)) gfx.fillRect(x, y+T-edgeW-1, edgeW+1, edgeW+1);
    if (!isWater(r+1, c) && !isWater(r, c+1)) gfx.fillRect(x+T-edgeW-1, y+T-edgeW-1, edgeW+1, edgeW+1);
  } else if (t === 1) {
    gfx.fillStyle(0x706050);
    gfx.fillRect(x, y + T - 1, T, 1);
    gfx.fillRect(x + T/2, y, 1, T);
    gfx.fillRect(x, y + T/2, T, 1);
    if (r > 0 && MAP[r-1][c] !== 1) {
      gfx.fillStyle(0x9a8a78);
      gfx.fillRect(x+1, y+1, T-2, 3);
      gfx.fillStyle(0x706050);
      gfx.fillRect(x, y + T - 2, T, 2);
    }
  } else if (t === 3) {
    if (hash % 4 === 0) {
      gfx.fillStyle(0x68c048);
      gfx.fillRect(x+6, y+4, 2, 5);
      gfx.fillRect(x+10, y+2, 2, 7);
      gfx.fillRect(x+14, y+5, 2, 4);
    }
    if (hash % 6 === 1) {
      gfx.fillStyle(0x78d058);
      gfx.fillRect(x+20, y+12, 2, 5);
      gfx.fillRect(x+24, y+10, 2, 6);
    }
    if (hash % 8 === 3) {
      gfx.fillStyle(0x48902a);
      gfx.fillRect(x+16, y+20, 3, 3);
    }
  } else if (t === 12) {
    const colors = [0xf06060, 0xf0e060, 0xf0a0f0, 0x60c0f0];
    for (let i = 0; i < 3; i++) {
      const fx = x + 4 + ((hash * (i+1)*7) % 20);
      const fy = y + 4 + ((hash * (i+1)*11) % 20);
      gfx.fillStyle(0x58b038);
      gfx.fillRect(fx+1, fy+3, 2, 6);
      gfx.fillStyle(colors[(hash + i) % colors.length]);
      gfx.fillRect(fx, fy, 4, 4);
      gfx.fillStyle(0xf8f080);
      gfx.fillRect(fx+1, fy+1, 2, 2);
    }
  } else if (t === 13) {
    gfx.fillStyle(0x7a5a28);
    gfx.fillRect(x+12, y+16, 8, 16);
    gfx.fillStyle(0x38982a);
    gfx.fillRect(x+2, y+2, 28, 18);
    gfx.fillStyle(0x48b038);
    gfx.fillRect(x+6, y+4, 20, 12);
    gfx.fillStyle(0x308a22);
    gfx.fillRect(x+4, y+8, 6, 8);
  } else if (t === 4) {
    gfx.fillStyle(0x000000, 0.06);
    if (hash % 3 === 0) gfx.fillRect(x+4, y+8, 10, 2);
    if (hash % 5 === 1) gfx.fillRect(x+14, y+18, 8, 2);
    if (hash % 7 === 2) {
      gfx.fillStyle(0x8a7a5a);
      gfx.fillRect(x+8, y+14, 3, 3);
      gfx.fillRect(x+20, y+6, 2, 2);
    }
  } else if (t === 5) {
    gfx.fillStyle(0xc04848);
    gfx.fillRect(x+2, y+2, T-4, T-4);
    gfx.fillStyle(0xd8a040);
    gfx.fillRect(x+2, y+2, T-4, 2);
    gfx.fillRect(x+2, y+T-4, T-4, 2);
    gfx.fillRect(x+2, y+2, 2, T-4);
    gfx.fillRect(x+T-4, y+2, 2, T-4);
    if ((r+c) % 2 === 0) {
      gfx.fillStyle(0xd05858);
      gfx.fillRect(x+8, y+8, T-16, T-16);
    }
  } else if (t === 6) {
    gfx.fillStyle(0xb08040);
    gfx.fillRect(x+1, y+1, T-2, T-2);
    gfx.fillStyle(0xc09048);
    gfx.fillRect(x+2, y+2, T-4, 4);
    gfx.fillStyle(0x8a6028);
    gfx.fillRect(x, y+T-3, T, 3);
    if (hash % 4 === 0) {
      gfx.fillStyle(0xb0a8a0);
      gfx.fillRect(x+8, y+8, 5, 7);
      gfx.fillStyle(0xe0c060);
      gfx.fillRect(x+8, y+8, 5, 2);
    }
  } else if (t === 7) {
    gfx.fillStyle(0x9a8058);
    gfx.fillRect(x+4, y+4, T-8, T-8);
    gfx.fillStyle(0x8a7048);
    gfx.fillRect(x+6, y+6, T-12, T-12);
    gfx.fillStyle(0x909090);
    gfx.fillRect(x+4, y+10, T-8, 2);
    gfx.fillRect(x+4, y+18, T-8, 2);
    gfx.fillStyle(0x6a5028);
    gfx.fillRect(x+14, y+12, 4, 5);
  } else if (t === 8) {
    gfx.fillStyle(0xb09048);
    gfx.fillRect(x+6, y, T-12, T);
    gfx.fillStyle(0xc0a058);
    gfx.fillRect(x+8, y+2, T-16, T-4);
    gfx.fillStyle(0xd8b860);
    gfx.fillRect(x+T/2+2, y+T/2-1, 4, 4);
    gfx.fillStyle(0x8a7a68);
    gfx.fillRect(x+4, y, 2, T);
    gfx.fillRect(x+T-6, y, 2, T);
  } else if (t === 9) {
    gfx.fillStyle(0x7a6040);
    gfx.fillRect(x+1, y+1, T-2, T-2);
    const bookColors = [0xc84040, 0x4050c0, 0x40b050, 0xc0a040, 0x9040c0, 0x40a0a0];
    for (let i = 0; i < 3; i++) {
      const by = y + 3 + i * 10;
      gfx.fillStyle(0x5a4828);
      gfx.fillRect(x+2, by+8, T-4, 2);
      for (let j = 0; j < 5; j++) {
        gfx.fillStyle(bookColors[(hash + i * 5 + j) % bookColors.length]);
        gfx.fillRect(x + 4 + j * 5, by, 4, 8);
      }
    }
  } else if (t === 10) {
    gfx.fillStyle(0x8a7868);
    gfx.fillRect(x, y, T, T);
    gfx.fillStyle(0x5a4838);
    gfx.fillRect(x+4, y+8, T-8, T-8);
    gfx.fillStyle(0x2a1810);
    gfx.fillRect(x+6, y+10, T-12, T-12);
    gfx.fillStyle(0x9a8878);
    gfx.fillRect(x+2, y+4, 4, T-4);
    gfx.fillRect(x+T-6, y+4, 4, T-4);
    gfx.fillRect(x+2, y+4, T-4, 4);
  } else if (t === 11) {
    gfx.fillStyle(0x9a7840);
    gfx.fillRect(x+8, y+8, T-16, T-12);
    gfx.fillRect(x+8, y+4, T-16, 6);
    gfx.fillStyle(0xaa8848);
    gfx.fillRect(x+10, y+6, T-20, 4);
    gfx.fillStyle(0x7a5828);
    gfx.fillRect(x+8, y+T-6, 3, 6);
    gfx.fillRect(x+T-11, y+T-6, 3, 6);
  } else if (t === 14) {
    gfx.fillStyle(0x8a8aa0);
    gfx.fillRect(x+4, y+4, T-8, T-8);
    gfx.fillStyle(0x60a0d8);
    gfx.fillRect(x+6, y+6, T-12, T-12);
    gfx.fillStyle(0x9090a8);
    gfx.fillRect(x+12, y+10, 8, 12);
    gfx.fillStyle(0xa0a0b8);
    gfx.fillRect(x+10, y+8, 12, 4);
  } else if (t === 15) {
    gfx.fillStyle(0x8a7a68);
    gfx.fillRect(x+12, y+8, 8, 4);
    gfx.fillStyle(0x9a8a78);
    gfx.fillRect(x+14, y+4, 4, 8);
  }
}
