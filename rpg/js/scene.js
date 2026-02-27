import { T, COLS, ROWS, AV_OY, state } from './config.js';
import { MAP, SCREENS } from './map.js';
import { drawFloor } from './floor.js';
import { generateTextures, createSprites, moveAvatar } from './avatars.js';
import { spawnParticles, updateParticles, drawParticles } from './particles.js';
import { initLighting, drawLighting } from './lighting.js';

// ── Phaser scene ────────────────────────────────────────
export class OfficeScene extends Phaser.Scene {
  constructor() {
    super('OfficeScene');
    this.avatars = [];
    this.player = null;
    this.particles = [];
  }

  preload() {
    this.load.atlas('office', 'assets/PixelOfficeAssets.png', 'assets/atlas.json');
  }

  create() {
    drawFloor(this);

    this.lightCtx = initLighting();

    generateTextures(this, () => {
      this._texturesReady = true;
      this.player = createSprites(this, this.avatars);
    });

    this.setupInput();

    // Zone labels — high-contrast, readable
    const labelStyle = {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '8px',
      color: '#f0f0f0',
      stroke: '#000000',
      strokeThickness: 3,
    };
    this.add.text(8 * T, 6 * T + 6, 'Lobby', labelStyle).setDepth(2).setAlpha(0.7);
    this.add.text(2 * T, 9 * T + 6, 'Upper Offices', labelStyle).setDepth(2).setAlpha(0.7);
    this.add.text(2 * T, 13 * T + 6, 'Lower Offices', labelStyle).setDepth(2).setAlpha(0.7);
    this.add.text(2 * T, 18 * T + 6, 'Break Room', labelStyle).setDepth(2).setAlpha(0.7);
    this.add.text(20 * T, 18 * T + 6, 'Meeting', labelStyle).setDepth(2).setAlpha(0.7);

    // Screen overlay graphics (redrawn each frame for glow effect)
    this.screenGfx = this.add.graphics();
    this.screenGfx.setDepth(1);

    // Particle graphics layer
    this.particleGfx = this.add.graphics();
    this.particleGfx.setDepth(9000);

    // HUD clock
    this._clockEl = document.getElementById('hud-clock');
  }

  setupInput() {
    this.cursors = this.input.keyboard.createCursorKeys();
  }

  // ── Animated screens (subtle monitor glow) ─────────────
  animateScreens() {
    const tick = state.tick;
    if (tick % 10 !== 0) return;
    this.screenGfx.clear();
    for (const s of SCREENS) {
      const sc = Math.floor(s.x / T);
      const sr = Math.floor(s.y / T);
      const x = sc * T, y = sr * T;
      const flicker = 0.7 + Math.sin(tick * 0.03 + sc * 2) * 0.15;
      this.screenGfx.fillStyle(0x4488cc, 0.15 * flicker);
      this.screenGfx.fillRect(x + 2, y + 1, T - 4, T - 3);
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
      a.nameTag.y = a.y - AV_OY + 2;
      a.nameTag.setDepth(a.y + T + 1);
    }

    // Animated screens
    this.animateScreens();

    // Particles
    spawnParticles(this.particles);
    updateParticles(this.particles);
    drawParticles(this.particleGfx, this.particles);

    // Lighting (raw canvas overlay)
    drawLighting(this.lightCtx);

    // HUD clock
    if (state.tick % 60 === 0 && this._clockEl) {
      const d = new Date();
      this._clockEl.textContent =
        String(d.getHours()).padStart(2,'0') + ':' +
        String(d.getMinutes()).padStart(2,'0');
    }
  }
}
