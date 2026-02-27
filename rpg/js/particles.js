import { T, W, H, COLS, ROWS, state } from './config.js';
import { MAP, SCREENS } from './map.js';

// ── Particle system ─────────────────────────────────────
export function spawnParticles(particles) {
  const tick = state.tick;

  // Dust motes
  if (tick % 40 === 0) {
    const rx = Math.random() * W;
    const ry = Math.random() * H;
    const rc = Math.floor(rx / T);
    const rr = Math.floor(ry / T);
    if (rc >= 0 && rc < COLS && rr >= 0 && rr < ROWS) {
      const tile = MAP[rr][rc];
      if (tile === 0 || tile === 2) {
        particles.push({
          x: rx, y: ry,
          vx: (Math.random() - 0.5) * 0.3, vy: -Math.random() * 0.2 - 0.04,
          life: 3 + Math.random() * 4, maxLife: 3 + Math.random() * 4,
          size: 2, type: 'dust',
        });
      }
    }
  }

  // Coffee steam (from coffee machines, tile 22)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 22 && Math.random() < 0.06) {
        particles.push({
          x: c * T + T / 2 + (Math.random() - 0.5) * 8, y: r * T + 4,
          vx: (Math.random() - 0.5) * 0.4, vy: -Math.random() * 1.0 - 0.4,
          life: 1.0 + Math.random() * 1.0, maxLife: 1.0 + Math.random() * 1.0,
          size: 2, type: 'steam',
        });
      }
    }
  }

  // Monitor flicker
  if (tick % 30 === 0) {
    for (const s of SCREENS) {
      if (Math.random() < 0.25) {
        particles.push({
          x: s.x + (Math.random() - 0.5) * T, y: s.y + (Math.random() - 0.5) * T,
          vx: 0, vy: 0,
          life: 0.3 + Math.random() * 0.3, maxLife: 0.3 + Math.random() * 0.3,
          size: 2, type: 'flicker',
        });
      }
    }
  }
}

export function updateParticles(particles) {
  const dt = 1 / 60;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === 'steam') {
      p.vx *= 0.98;
      p.size += 0.005;
    }
    if (p.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

export function drawParticles(gfx, particles) {
  const tick = state.tick;
  gfx.clear();
  for (const p of particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    if (p.type === 'dust') {
      gfx.fillStyle(Phaser.Display.Color.GetColor(220, 220, 230), alpha * 0.35);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'steam') {
      gfx.fillStyle(Phaser.Display.Color.GetColor(240, 240, 245), alpha * 0.4);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'flicker') {
      const pulse = 0.5 + Math.sin(tick * 0.1 + p.x) * 0.3;
      gfx.fillStyle(Phaser.Display.Color.GetColor(140, 200, 255), alpha * pulse);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
}
