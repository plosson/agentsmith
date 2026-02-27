import { T, W, H, COLS, ROWS, state } from './config.js';
import { MAP, LIGHTS, SCREENS } from './map.js';

// ── Lighting canvas setup ───────────────────────────────
export function initLighting() {
  const lightCvs = document.getElementById('light-canvas');
  lightCvs.width = W;
  lightCvs.height = H;
  return lightCvs.getContext('2d');
}

export function drawLighting(lightCtx) {
  const tick = state.tick;

  // Cool bright ambient (office fluorescent base)
  lightCtx.globalCompositeOperation = 'source-over';
  lightCtx.fillStyle = '#e8e8ec';
  lightCtx.fillRect(0, 0, W, H);

  lightCtx.globalCompositeOperation = 'lighter';

  // Ceiling lights — broad, cool-white rectangles
  for (const l of LIGHTS) {
    const flicker = 0.95 + Math.sin(tick * 0.005 + l.x * 0.01) * 0.03;
    const radius = Math.max(l.w, l.h) * 0.8;
    const grad = lightCtx.createRadialGradient(l.x, l.y, 0, l.x, l.y, radius);
    grad.addColorStop(0, `rgba(255,255,248,${0.18 * flicker})`);
    grad.addColorStop(0.4, `rgba(245,248,255,${0.08 * flicker})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = grad;
    lightCtx.fillRect(l.x - l.w, l.y - l.h, l.w * 2, l.h * 2);
  }

  // Monitor glow — subtle blue from screens
  for (const s of SCREENS) {
    const pulse = 0.9 + Math.sin(tick * 0.02 + s.x * 0.05) * 0.08;
    const grad = lightCtx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 48);
    grad.addColorStop(0, `rgba(100,160,220,${0.10 * pulse})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    lightCtx.fillStyle = grad;
    lightCtx.fillRect(s.x - 48, s.y - 48, 96, 96);
  }

  // Glass wall daylight — soft warm light
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 16) {
        const fx = c * T + T / 2, fy = r * T + T / 2;
        const grad = lightCtx.createRadialGradient(fx, fy, 0, fx, fy, 60);
        grad.addColorStop(0, 'rgba(255,248,230,0.10)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        lightCtx.fillStyle = grad;
        lightCtx.fillRect(fx - 60, fy - 60, 120, 120);
      }
    }
  }

  lightCtx.globalCompositeOperation = 'source-over';
}
