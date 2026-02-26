import { T, W, H, COLS, ROWS, state } from './config.js';
import { MAP, TORCHES, FIREPLACES } from './map.js';

// ── Particle system ─────────────────────────────────────
export function spawnParticles(particles) {
  const tick = state.tick;

  // Torch sparks
  for (const t of TORCHES) {
    if (Math.random() < 0.15) {
      particles.push({
        x: t.x + (Math.random()-0.5)*6, y: t.y - 4,
        vx: (Math.random()-0.5)*2, vy: -Math.random()*2 - 0.5,
        life: 0.4 + Math.random()*0.4, maxLife: 0.4 + Math.random()*0.4,
        size: 1 + Math.random()*2, type: 'spark',
      });
    }
  }
  // Fireplace sparks
  for (const fp of FIREPLACES) {
    if (Math.random() < 0.3) {
      particles.push({
        x: fp.x + (Math.random()-0.5)*12, y: fp.y - 2,
        vx: (Math.random()-0.5)*2, vy: -Math.random()*2 - 0.5,
        life: 0.4 + Math.random()*0.4, maxLife: 0.4 + Math.random()*0.4,
        size: 1 + Math.random()*2, type: 'spark',
      });
    }
  }
  // Dust motes
  if (tick % 20 === 0) {
    const rx = Math.random() * W;
    const ry = Math.random() * H;
    const rc = Math.floor(rx / T);
    const rr = Math.floor(ry / T);
    if (rc >= 0 && rc < COLS && rr >= 0 && rr < ROWS) {
      const tile = MAP[rr][rc];
      if (tile === 0 || tile === 5 || tile === 15) {
        particles.push({
          x: rx, y: ry,
          vx: (Math.random()-0.5)*0.3, vy: -Math.random()*0.2 - 0.05,
          life: 3 + Math.random()*4, maxLife: 3 + Math.random()*4,
          size: 1 + Math.random(), type: 'dust',
        });
      }
    }
  }
  // Fireflies
  if (tick % 40 === 0) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (MAP[r][c] === 3 && Math.random() < 0.008) {
          particles.push({
            x: c*T + Math.random()*T, y: r*T + Math.random()*T,
            vx: (Math.random()-0.5)*0.5, vy: (Math.random()-0.5)*0.5,
            life: 4 + Math.random()*6, maxLife: 4 + Math.random()*6,
            size: 2, type: 'firefly',
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }
  }
  // Fountain water
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (MAP[r][c] === 14 && Math.random() < 0.12) {
        particles.push({
          x: c*T + T/2 + (Math.random()-0.5)*4, y: r*T + T/2,
          vx: (Math.random()-0.5)*0.3, vy: -Math.random()*1.5 - 0.5,
          life: 0.5 + Math.random()*0.5, maxLife: 0.5 + Math.random()*0.5,
          size: 1.5, type: 'water',
        });
      }
      // Pool ripple sparkles
      if (MAP[r][c] === 2 && Math.random() < 0.02) {
        particles.push({
          x: c*T + 6 + Math.random()*(T-12), y: r*T + 6 + Math.random()*(T-12),
          vx: 0, vy: 0,
          life: 0.6 + Math.random()*0.8, maxLife: 0.6 + Math.random()*0.8,
          size: 1 + Math.random(), type: 'pool',
        });
      }
    }
  }
}

export function updateParticles(particles) {
  const tick = state.tick;
  const dt = 1/60;
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === 'spark') {
      p.vy += 0.05;
    } else if (p.type === 'firefly') {
      p.vx += Math.sin(tick * 0.02 + p.phase) * 0.02;
      p.vy += Math.cos(tick * 0.015 + p.phase) * 0.02;
      p.vx *= 0.98;
      p.vy *= 0.98;
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
    if (p.type === 'spark') {
      const g = Math.floor(150 + Math.random()*80);
      gfx.fillStyle(Phaser.Display.Color.GetColor(255, g, 50), alpha);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'dust') {
      gfx.fillStyle(Phaser.Display.Color.GetColor(255, 240, 180), alpha * 0.5);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'firefly') {
      const pulse = 0.3 + Math.sin(tick * 0.08 + p.phase) * 0.7;
      const a = alpha * pulse;
      gfx.fillStyle(Phaser.Display.Color.GetColor(180, 255, 80), a * 0.8);
      gfx.fillRect(p.x-1, p.y-1, p.size+2, p.size+2);
      gfx.fillStyle(Phaser.Display.Color.GetColor(220, 255, 150), a);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'water') {
      gfx.fillStyle(Phaser.Display.Color.GetColor(140, 200, 255), alpha * 0.6);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    } else if (p.type === 'pool') {
      const pulse = 0.5 + Math.sin(tick * 0.06 + p.x + p.y) * 0.3;
      gfx.fillStyle(Phaser.Display.Color.GetColor(180, 230, 255), alpha * pulse);
      gfx.fillRect(p.x, p.y, p.size, p.size);
    }
  }
}
