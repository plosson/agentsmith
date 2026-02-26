import { T, W, H, COLS, ROWS, state } from './config.js';
import { MAP, TORCHES, FIREPLACES } from './map.js';

// ── Lighting canvas setup ───────────────────────────────
export function initLighting() {
  const lightCvs = document.getElementById('light-canvas');
  lightCvs.width = W;
  lightCvs.height = H;
  return lightCvs.getContext('2d');
}

export function drawLighting(lightCtx) {
  const tick = state.tick;

  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = '#e8ddd0';
  lightCtx.fillRect(0, 0, W, H);

  lightCtx.globalCompositeOperation = 'lighter';

  for (const t of TORCHES) {
    const flicker = 0.9 + Math.sin(tick * 0.12 + t.x) * 0.05 + Math.random() * 0.05;
    const radius = 60 * flicker;
    const grad = lightCtx.createRadialGradient(t.x, t.y, 0, t.x, t.y, radius);
    grad.addColorStop(0, `rgba(255,220,160,${0.3 * flicker})`);
    grad.addColorStop(0.5, `rgba(255,190,120,${0.12 * flicker})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = grad;
    lightCtx.fillRect(t.x - radius, t.y - radius, radius * 2, radius * 2);
  }

  for (const fp of FIREPLACES) {
    const flicker = 0.9 + Math.sin(tick * 0.15 + fp.x * 0.1) * 0.06 + Math.random() * 0.04;
    const radius = 100 * flicker;
    const grad = lightCtx.createRadialGradient(fp.x, fp.y, 0, fp.x, fp.y, radius);
    grad.addColorStop(0, `rgba(255,200,120,${0.35 * flicker})`);
    grad.addColorStop(0.3, `rgba(255,160,80,${0.15 * flicker})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = grad;
    lightCtx.fillRect(fp.x - radius, fp.y - radius, radius * 2, radius * 2);
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 14) {
        const fx = c * T + T/2, fy = r * T + T/2;
        const grad = lightCtx.createRadialGradient(fx, fy, 0, fx, fy, 45);
        grad.addColorStop(0, 'rgba(140,200,255,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        lightCtx.fillStyle = grad;
        lightCtx.fillRect(fx - 45, fy - 45, 90, 90);
      }
    }
  }

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 3 || MAP[r][c] === 12 || MAP[r][c] === 13) {
        lightCtx.fillStyle = 'rgba(80,100,50,0.15)';
        lightCtx.fillRect(c * T, r * T, T, T);
      }
    }
  }

  lightCtx.globalCompositeOperation = 'source-over';
}
