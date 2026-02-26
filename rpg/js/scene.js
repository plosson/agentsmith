import { T, COLS, ROWS, AV_OY, state } from './config.js';
import { MAP, FIREPLACES } from './map.js';
import { drawFloor } from './floor.js';
import { generateTextures, createSprites, moveAvatar } from './avatars.js';
import { spawnParticles, updateParticles, drawParticles } from './particles.js';
import { initLighting, drawLighting } from './lighting.js';

// ── Phaser scene ────────────────────────────────────────
export class TavernScene extends Phaser.Scene {
  constructor() {
    super('TavernScene');
    this.avatars = [];
    this.player = null;
    this.particles = [];
  }

  preload() {}

  create() {
    drawFloor(this);

    this.lightCtx = initLighting();

    generateTextures(this, () => {
      this._texturesReady = true;
      this.player = createSprites(this, this.avatars);
    });

    this.setupInput();

    // Fireplace overlay graphics (redrawn each frame)
    this.fireGfx = this.add.graphics();
    this.fireGfx.setDepth(1);

    // Fountain overlay graphics
    this.waterGfx = this.add.graphics();
    this.waterGfx.setDepth(1);

    // Particle graphics layer
    this.particleGfx = this.add.graphics();
    this.particleGfx.setDepth(9000);
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ── Animated tiles ────────────────────────────────────
  animateFire() {
    const tick = state.tick;
    this.fireGfx.clear();
    for (const fp of FIREPLACES) {
      const fc = Math.floor(fp.x / T);
      const fr = Math.floor(fp.y / T);
      const x = fc * T, y = fr * T;
      this.fireGfx.fillStyle(0x2a1810);
      this.fireGfx.fillRect(x+6, y+10, T-12, T-12);
      const colors = [0xff6020, 0xff8030, 0xffaa40, 0xffe060];
      for (let i = 0; i < 5; i++) {
        const fx = x + 10 + Math.sin(tick*0.15 + i*2)*4 + (i%3)*3;
        const fy = y + T - 8 - Math.abs(Math.sin(tick*0.1 + i*1.5))*8 - i*2;
        const fs = 3 + Math.sin(tick*0.2 + i)*2;
        this.fireGfx.fillStyle(colors[i % colors.length]);
        this.fireGfx.fillRect(fx, fy, fs, fs + 2);
      }
    }
  }

  animateWater() {
    const tick = state.tick;
    if (tick % 20 !== 0) return;
    this.waterGfx.clear();
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const tile = MAP[r][c];
        if (tile !== 14 && tile !== 2) continue;
        const x = c*T, y = r*T;
        if (tile === 14) {
          const color = (r+c)%2===0 ? 0x60a0d8 : 0x5898d0;
          this.waterGfx.fillStyle(color);
          this.waterGfx.fillRect(x+6, y+6, T-12, T-12);
          const shimmerAlpha = 0.2 + Math.sin(tick*0.04+c+r)*0.15;
          this.waterGfx.fillStyle(0xb4e6ff, shimmerAlpha);
          const wy = y+8 + Math.sin(tick*0.03 + c*2)*4;
          this.waterGfx.fillRect(x+8, wy, T-16, 2);
        } else {
          // Pool water — animated surface within stone edges
          const isW = (rr, cc) =>
            rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && MAP[rr][cc] === 2;
          const ew = 4;
          const ex = isW(r, c-1) ? 0 : ew;
          const ey = isW(r-1, c) ? 0 : ew;
          const iw = T - ex - (isW(r, c+1) ? 0 : ew);
          const ih = T - ey - (isW(r+1, c) ? 0 : ew);
          const color = (r+c)%2===0 ? 0x5898d0 : 0x5090c0;
          this.waterGfx.fillStyle(color);
          this.waterGfx.fillRect(x+ex, y+ey, iw, ih);
          // Shimmer ripples
          const shimmerAlpha = 0.15 + Math.sin(tick*0.03+c*1.5+r)*0.12;
          this.waterGfx.fillStyle(0xb4e6ff, shimmerAlpha);
          const wy = y+ey+2 + Math.sin(tick*0.025 + c*2.5 + r*0.7)*3;
          this.waterGfx.fillRect(x+ex+2, wy, iw-4, 2);
        }
      }
    }
  }

  // ── Update loop ───────────────────────────────────────
  update() {
    state.tick++;

    if (!this.player || !this._texturesReady) return;

    // Player input
    if (!this.player.moving) {
      if (this.cursors.left.isDown) moveAvatar(this.player, -1, 0, this.avatars);
      else if (this.cursors.right.isDown) moveAvatar(this.player, 1, 0, this.avatars);
      else if (this.cursors.up.isDown) moveAvatar(this.player, 0, -1, this.avatars);
      else if (this.cursors.down.isDown) moveAvatar(this.player, 0, 1, this.avatars);
    }

    // Update all avatars
    for (const a of this.avatars) {
      if (a.moving) {
        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d < a.speed) {
          a.x = a.tx; a.y = a.ty;
          a.moving = false;
          a.frame = 0;
          a.sprite.stop();
          a.sprite.setFrame(0);
        } else {
          a.x += (dx/d) * a.speed;
          a.y += (dy/d) * a.speed;
        }
      } else if (!a.isPlayer) {
        a.idleT++;
        if (a.idleT >= a.idleD) {
          a.idleT = 0;
          a.idleD = 80 + Math.random() * 240;
          const dirs = [[0,1],[0,-1],[-1,0],[1,0]];
          const [dc, dr] = dirs[Math.floor(Math.random()*4)];
          moveAvatar(a, dc, dr, this.avatars);
        }
      }

      // Sync sprite position
      a.sprite.x = a.x + T/2;
      a.sprite.y = a.y + T/2;
      a.sprite.setDepth(a.y + T);
      a.sprite.setFlipX(a.dir === 2);

      // Sync nametag
      a.nameTag.x = a.x + T/2;
      a.nameTag.y = a.y - AV_OY + 6;
      a.nameTag.setDepth(a.y + T + 1);
    }

    // Animated tiles
    this.animateFire();
    this.animateWater();

    // Particles
    spawnParticles(this.particles);
    updateParticles(this.particles);
    drawParticles(this.particleGfx, this.particles);

    // Lighting (raw canvas overlay)
    drawLighting(this.lightCtx);
  }
}
