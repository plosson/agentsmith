import { T, AV, AV_OX, AV_OY, COLS, ROWS } from './config.js';
import { MAP, SOLID } from './map.js';
import { CHARS, SPAWNS, makeCharSVG } from './characters.js';

// ── Avatar texture generation ─────────────────────────
export function generateTextures(scene, callback) {
  const pendingTextures = [];

  for (let ci = 0; ci < CHARS.length; ci++) {
    const ch = CHARS[ci];
    const key = 'char_' + ci;
    const frameW = AV, frameH = AV;
    const frames = [0, 1, 2, 0];

    const cvs = document.createElement('canvas');
    cvs.width = frameW * 4;
    cvs.height = frameH;
    const ctx = cvs.getContext('2d');

    const svgs = frames.map(f => makeCharSVG(ch.palette, f, ch.accessory));
    const dataUris = svgs.map(s => 'data:image/svg+xml,' + encodeURIComponent(s));

    pendingTextures.push({ key, dataUris, cvs, ctx, frameW, frameH });
  }

  let loaded = 0;
  const total = pendingTextures.length * 4;
  let finished = false;

  function finishTextures() {
    if (finished) return;
    finished = true;

    for (const tex of pendingTextures) {
      if (scene.textures.exists(tex.key)) scene.textures.remove(tex.key);
      scene.textures.addSpriteSheet(tex.key, tex.cvs, {
        frameWidth: tex.frameW,
        frameHeight: tex.frameH,
      });
    }

    callback();
  }

  for (const tex of pendingTextures) {
    for (let i = 0; i < 4; i++) {
      const img = new Image();
      img.onload = () => {
        tex.ctx.drawImage(img, i * tex.frameW, 0, tex.frameW, tex.frameH);
        loaded++;
        if (loaded === total) {
          finishTextures();
        }
      };
      img.src = tex.dataUris[i];
    }
  }

  if (loaded === total) {
    finishTextures();
  }
}

// ── Sprite creation ─────────────────────────────────
export function createSprites(scene, avatars) {
  let player = null;

  for (const sd of SPAWNS) {
    const charDef = CHARS[sd.ci];
    const key = 'char_' + sd.ci;
    const sprite = scene.add.sprite(sd.col * T + T/2, sd.row * T + T/2, key, 0);
    sprite.setDisplaySize(AV, AV);
    sprite.setOrigin(0.5, (AV_OY + T/2) / AV);

    scene.anims.create({
      key: key + '_walk',
      frames: scene.anims.generateFrameNumbers(key, { frames: [0, 1, 0, 2] }),
      frameRate: 6,
      repeat: -1,
    });

    const nameTag = scene.add.text(sd.col * T + T/2, sd.row * T - AV_OY + 2, charDef.name, {
      fontFamily: "'Press Start 2P', monospace",
      fontSize: '9px',
      color: charDef.isPlayer ? '#60b8f0' : '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    });
    nameTag.setOrigin(0.5, 1);

    const avatar = {
      sprite, nameTag,
      col: sd.col, row: sd.row,
      x: sd.col * T, y: sd.row * T,
      tx: sd.col * T, ty: sd.row * T,
      speed: charDef.isPlayer ? 2.8 : 0.8 + Math.random() * 0.5,
      isPlayer: !!charDef.isPlayer,
      name: charDef.name,
      key: key,
      frame: 0, ft: 0,
      moving: false,
      dir: 0,
      idleT: 0,
      idleD: 60 + Math.random() * 180,
    };

    avatars.push(avatar);
    if (avatar.isPlayer) player = avatar;
  }

  return player;
}

// ── Movement helpers ──────────────────────────────────
export function canMove(avatars, avatar, col, row) {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  if (SOLID.has(MAP[row][col])) return false;
  for (const a of avatars) {
    if (a === avatar) continue;
    if (Math.round(a.tx / T) === col && Math.round(a.ty / T) === row) return false;
  }
  return true;
}

export function moveAvatar(avatar, dc, dr, avatars) {
  if (avatar.moving) return;
  const nc = Math.round(avatar.x / T) + dc;
  const nr = Math.round(avatar.y / T) + dr;
  if (!canMove(avatars, avatar, nc, nr)) return;
  avatar.tx = nc * T;
  avatar.ty = nr * T;
  avatar.col = nc;
  avatar.row = nr;
  avatar.moving = true;
  if (dc < 0) avatar.dir = 2;
  else if (dc > 0) avatar.dir = 3;
  else if (dr < 0) avatar.dir = 1;
  else avatar.dir = 0;
  avatar.sprite.play(avatar.key + '_walk', true);
}
