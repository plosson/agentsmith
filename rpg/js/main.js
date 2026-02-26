import { W, H } from './config.js';
import { TavernScene } from './scene.js';

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
  backgroundColor: '#c8b8a0',
  scene: TavernScene,
};

new Phaser.Game(config);
