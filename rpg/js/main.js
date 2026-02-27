import { W, H } from './config.js';
import { OfficeScene } from './scene.js';

// ── Sizing ──────────────────────────────────────────────
document.getElementById('game-wrapper').style.width = W + 'px';
document.getElementById('game-wrapper').style.height = H + 'px';

// ── Phaser config ───────────────────────────────────────
const config = {
  type: Phaser.CANVAS,
  width: W,
  height: H,
  parent: 'phaser-game',
  pixelArt: true,
  backgroundColor: '#d0d4dc',
  scene: OfficeScene,
};

new Phaser.Game(config);
