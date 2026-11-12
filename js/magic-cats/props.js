// Magic cats — scenery: trees (the cats' roads), houses with their windows, smoke, small props.

import { TAU, rng, hash, clamp, clamp01, lerp, smooth, spring, ease, shade, mixHex, rgba, rgb, css } from './util.js';
import { INK, PAL, ink, wobble, wobblyPoly, blobPath, sprite, tintSprite, wind, isStill, glow, crayonRings, chalk, squigglePoints, circlePts, heartPath, sparklePath, tube } from './paint.js';

// ───────────────────────── Trees ─────────────────────────
// kind: 'round' (cover: dotted crown) | 'apple' (heart apples) | 'dab' (summer-tree foliage) | 'big' (dark old tree)
const CROWN = {
  round: { base: '#3f9a45', light: '#63b858', dark: '#2a7a3a', dot: '#1f6a35' },
  apple: { base: '#2f9a55', light: '#55b86a', dark: '#1f7a45', dot: '#e8505a' },
  dab: { base: '#6fbf3f', light: '#b6e04a', dark: '#3f9a3a', dot: '#ffffff' },
  big: { base: '#1f7a3a', light: '#3a9a4a', dark: '#145a2c', dot: '#0f4a24' },
  pale: { base: '#a8dcea', light: '#d2f0f6', dark: '#7fc6dc', dot: '#5fb4cf' }
};

export class Tree {
  constructor(o) {
    o = o || {};
    this.x = o.x || 0;
    this.h = o.h || 190;                 // trunk height
    this.r = o.r || 66;                  // crown radius
    this.kind = o.kind || 'round';
    this.seed = o.seed || Math.floor(this.x * 7 + 13);
    const r = rng(this.seed);
    this.lean = o.lean !== undefined ? o.lean : (r() - 0.5) * 0.08;
    this.trunk = o.trunk || (r() < 0.5 ? PAL.trunk : PAL.trunkOchre);
    this.hollow = !!o.hollow;
    this.grow = o.grow === undefined ? 1 : o.grow;
    this.groundY = o.groundY || 0;
    this.b = { x: 0, v: 0 };             // bounce spring
    this.lookAt = null;                  // hollow eyes follow this {x, y}
    this.lumps = o.lumps || 6 + Math.floor(r() * 3);
    this._blink = 1 + r() * 4;
    this.shake = 0;
    this.items = o.items || null;        // e.g. book bags [{dx, dy, color}]
  }
  get g() { return ease.outCubic(clamp01(this.grow)); }
  get crownScale() { return ease.outBack(smooth((this.grow - 0.3) / 0.7)); }
  get topX() { return this.x + this.lean * this.h * this.g; }
  get crownY() { return this.groundY - this.h * this.g - this.r * 0.3 * this.crownScale; }
  // y where a cat's paws rest (a little into the foliage)
  get perchY() { return this.crownY - this.r * 0.74 * this.crownScale + this.b.x * 5; }
  get ready() { return this.grow >= 0.999; }
  land(v) { this.b.v += 5 * (v === undefined ? 1 : v); this.shake = 0.35; }
  update(dt) {
    spring(this.b, 0, dt, 150, 9);
    if (this.shake > 0) this.shake -= dt;
    this._blink -= dt;
    if (this._blink < -0.14) this._blink = 2 + Math.random() * 4;
  }
  draw(ctx, t) {
    const g = this.g, x = this.x, gy = this.groundY;
    if (this.grow < 0.06) { this._sprout(ctx, t); return; }
    const tx = this.topX, ty = gy - this.h * g;
    const bw = Math.max(10, this.r * 0.3) * (0.45 + 0.55 * g), tw = bw * 0.56;
    ctx.fillStyle = 'rgba(14,16,44,0.2)'; ctx.beginPath(); ctx.ellipse(x + 5, gy + 5, bw * 2.5, 6, 0, 0, TAU); ctx.fill();
    wobblyPoly(ctx, [[x - bw * 0.95, gy + 3], [x - bw * 0.52, gy - this.h * g * 0.14], [tx - tw / 2, ty - 4], [tx + tw / 2, ty - 4], [x + bw * 0.52, gy - this.h * g * 0.14], [x + bw * 0.95, gy + 3]], this.seed, 1.6, 60);
    ctx.fillStyle = this.trunk; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba(shade(this.trunk, 0.35), 0.5);
    ctx.fillRect(x - bw * 0.2 + this.lean * 20, ty, bw * 0.3, this.h * g);
    ctx.fillStyle = rgba(shade(this.trunk, -0.35), 0.35);
    ctx.fillRect(x + bw * 0.22, ty, bw, this.h * g);
    ctx.restore();
    ink(ctx, 3.6);
    if (this.hollow && g > 0.9) this._hollow(ctx, t, lerp(x, tx, 0.42), gy - this.h * 0.42);
    const cs = this.crownScale;
    if (cs > 0.01) {
      const R = this.r, k = CROWN[this.kind] || CROWN.round;
      const s = sprite('crown2:' + this.kind + ':' + this.seed + ':' + Math.round(R) + ':' + this.lumps, R * 2.7, R * 2.5, (c, W, H) => {
        const cx = W / 2, cy = H / 2, rr = rng(this.seed + 99);
        blobPath(c, cx, cy, R, R * 0.84, this.seed, this.lumps, 0.19);
        c.fillStyle = k.base; c.fill();
        c.save(); c.clip();
        const vol = c.createLinearGradient(0, cy - R, 0, cy + R * 0.95);       // light from above, shade underneath
        vol.addColorStop(0, rgba(k.light, 0.45)); vol.addColorStop(0.5, rgba(k.light, 0)); vol.addColorStop(1, rgba(k.dark, 0.62));
        c.fillStyle = vol; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) {
          const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.95, px = cx + Math.cos(a) * d - R * 0.18, py = cy + Math.sin(a) * d * 0.8 - R * 0.2;
          c.fillStyle = rgba(k.light, 0.35 + rr() * 0.35);
          c.beginPath(); c.ellipse(px, py, R * (0.1 + rr() * 0.13), R * (0.06 + rr() * 0.08), rr() * 3, 0, TAU); c.fill();
        }
        for (let i = 0; i < 16; i++) {
          const a = rr() * TAU, d = Math.sqrt(rr()) * R, px = cx + Math.cos(a) * d + R * 0.22, py = cy + Math.sin(a) * d * 0.8 + R * 0.26;
          c.fillStyle = rgba(k.dark, 0.3 + rr() * 0.3);
          c.beginPath(); c.ellipse(px, py, R * (0.1 + rr() * 0.14), R * (0.07 + rr() * 0.08), rr() * 3, 0, TAU); c.fill();
        }
        const n = this.kind === 'dab' ? 46 : this.kind === 'apple' ? 9 : 22;
        for (let i = 0; i < n; i++) {
          const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.82, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.8;
          if (this.kind === 'apple') {
            heartPath(c, px, py, R * 0.085); c.fillStyle = k.dot; c.fill(); c.lineWidth = 1.6; c.strokeStyle = INK; c.stroke();
            c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(px - R * 0.03, py - R * 0.03, R * 0.02, 0, TAU); c.fill();
          } else if (this.kind === 'dab') {
            c.fillStyle = rgba(k.dot, 0.5 + rr() * 0.5); sparklePath(c, px, py, 1.5 + rr() * 2.5, rr()); c.fill();
          } else {
            c.fillStyle = rgba(k.dot, 0.55); c.beginPath(); c.ellipse(px, py, 2.2, 3.2, rr(), 0, TAU); c.fill();
          }
        }
        c.restore();
        blobPath(c, cx, cy, R, R * 0.84, this.seed, this.lumps, 0.19);
        ink(c, 4);
      });
      const w = wind(x, t);
      const sway = w * 0.017 + (isStill() ? 0 : Math.sin(t * 0.8 + this.seed) * 0.005) + this.b.x * 0.025 + (this.shake > 0 ? Math.sin(t * 40) * 0.02 * this.shake : 0);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(sway);
      ctx.translate(0, -R * 0.3 * cs + this.b.x * 5);
      ctx.scale(cs * (1 + this.b.x * 0.03 + w * 0.007), cs * (1 - this.b.x * 0.05 - w * 0.007));
      ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
      if (this.items) for (const it of this.items) drawBag(ctx, it.dx, it.dy, it.color, t + it.dx, it.label);
      ctx.restore();
    }
  }
  _sprout(ctx, t) {
    const x = this.x, y = this.groundY, sw = Math.sin(t * 2.2 + this.seed) * 0.12, k = 0.6 + this.grow * 6;
    ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
    // little mound
    ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.ellipse(0, 2, 15, 5.5, 0, 0, TAU); ctx.fill(); ink(ctx, 2.4);
    tube(ctx, [[0, 0], [1, -9 * k]], 2.6, '#58a84a', INK, 2.4);
    for (const sd of [-1, 1]) {
      wobble(ctx, [[0, -9 * k], [sd * 8 * k, -15 * k], [sd * 3 * k, -7 * k]], this.seed + sd, 0.3);
      ctx.fillStyle = '#7fd05a'; ctx.fill(); ink(ctx, 2);
    }
    ctx.restore();
  }
  _hollow(ctx, t, x, y) {
    ctx.fillStyle = '#17101f'; ctx.beginPath(); ctx.ellipse(x, y, 10.5, 13, 0, 0, TAU); ctx.fill();
    if (this._blink < 0) return;
    let lx = 0, ly = 0;
    if (this.lookAt) { const dx = this.lookAt.x - x, dy = this.lookAt.y - y, d = Math.hypot(dx, dy) || 1; lx = (dx / d) * 1.6; ly = (dy / d) * 1.6; }
    for (const sd of [-1, 1]) {
      ctx.fillStyle = '#f6f3ea'; ctx.beginPath(); ctx.arc(x + sd * 4, y - 1, 3, 0, TAU); ctx.fill();
      ctx.fillStyle = '#17101f'; ctx.beginPath(); ctx.arc(x + sd * 4 + lx, y - 1 + ly, 1.4, 0, TAU); ctx.fill();
    }
  }
}

// A cloth bag of books hanging from a branch (the tree libraries).
export function drawBag(ctx, x, y, color, t, label) {
  const sw = Math.sin((t || 0) * 1.3) * 0.06;
  ctx.save(); ctx.translate(x, y); ctx.rotate(sw);
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.quadraticCurveTo(0, -9, 6, 0); ctx.stroke();
  wobblyPoly(ctx, [[-10, 0], [10, 0], [12, 26], [-12, 26]], Math.round(x * 3 + y), 1, 30);
  ctx.fillStyle = color || '#f2c23a'; ctx.fill(); ink(ctx, 2.6);
  ctx.strokeStyle = 'rgba(29,21,48,0.45)'; ctx.lineWidth = 1.2; ctx.beginPath();
  ctx.moveTo(-6, 9); ctx.lineTo(5, 8); ctx.moveTo(-5, 14); ctx.lineTo(6, 13.5); ctx.moveTo(-4, 19); ctx.lineTo(3, 18.5); ctx.stroke();
  ctx.restore();
}

// ───────────────────────── Houses ─────────────────────────
const HOUSE = {
  pink: { wall: '#eeb9dc', deep: '#d58fc0', roof: '#eeb9dc', roofDeep: '#d58fc0', door: '#8f4a7c' },
  blue: { wall: '#8fabe2', deep: '#5f80c6', roof: '#f1f5fb', roofDeep: '#c9d6ee', door: '#3d5796' },
  brick: { wall: '#a8473e', deep: '#7c2f2b', roof: '#b9553f', roofDeep: '#8a3a2c', door: '#5c2f22' },
  butter: { wall: '#f3dc86', deep: '#d9b84a', roof: '#d9783a', roofDeep: '#b0562a', door: '#a8562c' },
  mint: { wall: '#a8dcc0', deep: '#6fb898', roof: '#5f7ab8', roofDeep: '#42598f', door: '#42598f' },
  lilac: { wall: '#c5b3ea', deep: '#9a84cf', roof: '#f3dc86', roofDeep: '#d9b84a', door: '#6f58a8' }
};
const BLOOMS = ['#e8505a', '#f2c23a', '#f08ab0', '#ffffff', '#f6a64a'];

export class House {
  constructor(o) {
    o = o || {};
    this.x = o.x || 0; this.w = o.w || 150; this.h = o.h || 250;
    this.style = o.style || 'pink';
    this.roof = o.roof || (this.style === 'blue' ? 'snow' : this.style === 'brick' ? 'tile' : 'gable');
    this.seed = o.seed || Math.floor(this.x * 3 + 7);
    this.groundY = o.groundY || 0;
    this.built = o.built === undefined ? 1 : o.built;
    this.chimney = o.chimney === undefined ? (this.roof === 'tile') : o.chimney;
    this.smoke = o.smoke === undefined ? this.chimney : o.smoke;
    this.windows = [];
    const r = rng(this.seed + 5);
    if (o.windows) for (const w of o.windows) this.addWindow(w);
    else {
      const rows = Math.max(1, Math.round((this.h - 60) / 78)), cols = this.w > 130 ? 2 : 1;
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
        if (cols === 2 && r() < 0.12) continue;
        this.addWindow({ dx: cols === 2 ? (j ? 1 : -1) * this.w * 0.23 : 0, dy: -this.h + 62 + i * 78, lit: 0 });
      }
    }
    // door: false = none, {dx, color} = there, left out = wherever the ground floor has room for one
    this.door = o.door === undefined ? this._roomForDoor() : o.door;
    // a window box of flowers here and there (never where somebody leans out, or a cat lands)
    const rb = rng(this.seed + 77);
    for (const w of this.windows) if (w.box === undefined) w.box = rb() < 0.3 && !w.kid && !w.flame && !w.ledge && w.sill && w.kind === 'arch' && !w.skip;
  }
  _roomForDoor() {
    for (const dx of [0, -this.w * 0.24, this.w * 0.24]) {
      if (Math.abs(dx) + 24 > this.w / 2) continue;
      let ok = true;
      for (const w of this.windows) if (w.dy + w.h / 2 > -70 && Math.abs(w.dx - dx) < 21 + w.w / 2 + (w.ledge || 0)) ok = false;
      if (ok) return { dx };
    }
    return false;
  }
  addWindow(w) {
    const win = Object.assign({ dx: 0, dy: -100, w: 34, h: 46, kind: 'arch', lit: 0, rings: 0, kid: null, dark: PAL.winDark, sill: true, glowK: 1, flame: false, ledge: 0 }, w);
    this.windows.push(win);
    return win;
  }
  // world rect of window i: {x (centre), y (centre), w, h, top, bottom}
  win(i) {
    const w = typeof i === 'number' ? this.windows[i] : i;
    const y = this.groundY + w.dy;
    return { x: this.x + w.dx, y, w: w.w, h: w.h, top: y - w.h / 2, bottom: y + w.h / 2, sillY: y + w.h / 2 + 1 };
  }
  get roofY() { return this.groundY - this.h; }
  get topY() { return this.groundY - this.h - (this.roof === 'gable' ? this.w * 0.42 : this.roof === 'flat' ? 0 : 50); }
  get chimneyTop() { return { x: this.x + this.w * 0.22, y: this.roofY - (this.roof === 'tile' ? 58 : 64) }; }
  update(dt) { for (const w of this.windows) if (w.kid) w.kid.update(dt); }

  _shape(c, x, gy, sd) {
    const w = this.w, h = this.h, r = rng(sd);
    if (this.roof === 'gable') {
      const ax = x + (r() - 0.5) * w * 0.24, gh = w * 0.42;
      wobblyPoly(c, [[x - w / 2, gy + 3], [x - w / 2 - 2, gy - h], [ax, gy - h - gh], [x + w / 2 + 2, gy - h + 4], [x + w / 2, gy + 3]], sd, 1.8, 70);
    } else {
      wobblyPoly(c, [[x - w / 2, gy + 3], [x - w / 2 - 1, gy - h], [x + w / 2 + 1, gy - h], [x + w / 2, gy + 3]], sd, 1.8, 70);
    }
  }
  _body() {
    const w = this.w, h = this.h, k = HOUSE[this.style] || HOUSE.pink, pad = 30, top = (this.roof === 'gable' ? w * 0.42 : 70) + pad;
    return sprite('house:' + this.style + ':' + this.roof + ':' + this.seed + ':' + w + ':' + h + ':' + (this.chimney ? 1 : 0), w + pad * 2, h + top + 12, (c, W, H) => {
      const x = W / 2, gy = H - 8, r = rng(this.seed + 31);
      if (this.chimney) {
        const cx = x + w * 0.22, cy = gy - h;
        wobblyPoly(c, [[cx - 11, cy + 4], [cx - 12, cy - (this.roof === 'tile' ? 56 : 62)], [cx + 12, cy - (this.roof === 'tile' ? 58 : 64)], [cx + 11, cy + 4]], this.seed + 3, 1.2, 40);
        c.fillStyle = k.roofDeep; c.fill(); ink(c, 3.4);
      }
      this._shape(c, x, gy, this.seed);
      c.fillStyle = k.wall; c.fill();
      c.save(); c.clip();
      const g = c.createRadialGradient(x - w * 0.08, gy - h * 0.55, 10, x, gy - h * 0.5, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(255,255,255,0.42)'); g.addColorStop(0.5, 'rgba(255,255,255,0.08)'); g.addColorStop(1, rgba(k.deep, 0.75));
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 9; i++) {
        const bx = x + (r() - 0.5) * w, by = gy - r() * (h + 40), rad = 20 + r() * 40;
        const gg = c.createRadialGradient(bx, by, 0, bx, by, rad);
        gg.addColorStop(0, rgba(r() < 0.5 ? '#ffffff' : k.deep, 0.16)); gg.addColorStop(1, rgba(k.deep, 0));
        c.fillStyle = gg; c.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
      }
      if (this.style === 'brick') {
        c.strokeStyle = 'rgba(60,20,20,0.22)'; c.lineWidth = 1.2;
        for (let yy = gy - 14; yy > gy - h; yy -= 15) { c.beginPath(); c.moveTo(x - w / 2, yy + (r() - 0.5) * 2); c.lineTo(x + w / 2, yy + (r() - 0.5) * 2); c.stroke(); }
      }
      c.restore();
      this._shape(c, x, gy, this.seed); ink(c, 4);
      // separate roofs
      if (this.roof === 'snow') {
        wobblyPoly(c, [[x - w / 2 - 11, gy - h + 2], [x - w / 2 + 16, gy - h - 44], [x + w / 2 - 24, gy - h - 54], [x + w / 2 + 11, gy - h + 3]], this.seed + 9, 2, 60);
        const sg = c.createLinearGradient(0, gy - h - 54, 0, gy - h); sg.addColorStop(0, '#ffffff'); sg.addColorStop(1, k.roofDeep);
        c.fillStyle = sg; c.fill(); ink(c, 4);
      } else if (this.roof === 'tile') {
        wobblyPoly(c, [[x - w / 2 - 13, gy - h + 3], [x - w * 0.16, gy - h - 50], [x + w * 0.3, gy - h - 46], [x + w / 2 + 13, gy - h + 3]], this.seed + 9, 2, 60);
        c.fillStyle = k.roof; c.fill();
        c.save(); c.clip();
        c.strokeStyle = rgba(k.roofDeep, 0.9); c.lineWidth = 1.6;
        for (let yy = gy - h - 44; yy < gy - h + 6; yy += 10) for (let xx = x - w / 2 - 20 + ((yy / 10) & 1) * 7; xx < x + w / 2 + 20; xx += 14) { c.beginPath(); c.arc(xx, yy, 7, 0.15, Math.PI - 0.15); c.stroke(); }
        c.restore();
        wobblyPoly(c, [[x - w / 2 - 13, gy - h + 3], [x - w * 0.16, gy - h - 50], [x + w * 0.3, gy - h - 46], [x + w / 2 + 13, gy - h + 3]], this.seed + 9, 2, 60); ink(c, 4);
      }
    });
  }
  draw(ctx, t) {
    const x = this.x, gy = this.groundY;
    if (this.built < 1) this._frame(ctx, t);
    if (this.built > 0) {
      const s = this._body(), rising = this.built < 1;
      if (rising) {                    // being built: the walls go up from the ground
        const up = (s.h + 6) * clamp01(this.built);
        ctx.save(); ctx.beginPath(); ctx.rect(x - s.w / 2 - 10, gy + 10 - up, s.w + 20, up + 6); ctx.clip();
      }
      ctx.drawImage(s.c, x - s.w / 2, gy + 8 - s.h, s.w, s.h);
      if (this.door) this._door(ctx);
      for (const w of this.windows) this._window(ctx, w, t);
      if (rising) ctx.restore();
      if (this.smoke && this.built >= 1) drawSmoke(ctx, this.chimneyTop.x, this.chimneyTop.y, t, this.seed);
    }
  }
  // lights only (call after everything else for glows that sit on top)
  drawLights(ctx, t, night) {
    if (this.built < 1) return;
    for (const w of this.windows) {
      if (w.lit <= 0.02) continue;
      const g = this.win(w);
      if (night > 0.05) {                 // the window's light lies on the grass below
        const drop = this.groundY - g.bottom, a = 0.3 * w.lit * night / (1 + drop / 160);
        ctx.save(); ctx.translate(g.x, this.groundY + 12); ctx.scale(1, 0.26);
        glow(ctx, 0, 0, 74 + drop * 0.22, PAL.winWarm, a);
        ctx.restore();
      }
      glow(ctx, g.x, g.y, (w.w + w.h) * 1.15 * w.glowK, PAL.winWarm, 0.34 * w.lit * (0.92 + 0.08 * Math.sin(t * 3 + w.dx)));
      if (w.rings > 0.01) crayonRings(ctx, g.x, g.y, (w.w + w.h) * 0.9 * (0.6 + 0.4 * w.rings), t, { alpha: 0.5 * w.rings, grow: w.rings, seed: this.seed + w.dx, rings: 5 });
    }
  }
  _winPath(ctx, g, w) {
    const l = g.x - g.w / 2, r = g.x + g.w / 2, b = g.bottom, tp = g.top;
    ctx.beginPath();
    if (w.kind === 'round') ctx.ellipse(g.x, g.y, g.w / 2, g.h / 2, 0, 0, TAU);
    else if (w.kind === 'square') ctx.rect(l, tp, g.w, g.h);
    else {
      ctx.moveTo(l, b); ctx.lineTo(l, tp + g.h * 0.36);
      ctx.bezierCurveTo(l, tp - g.h * 0.08, r, tp - g.h * 0.08, r, tp + g.h * 0.36);
      ctx.lineTo(r, b); ctx.closePath();
    }
  }
  _window(ctx, w, t) {
    const g = this.win(w);
    this._winPath(ctx, g, w);
    ctx.fillStyle = w.lit > 0 ? mixHex(w.dark, PAL.winLit, w.lit) : w.dark; ctx.fill();
    if (w.lit > 0.25 && (w.kid || w.flame)) {
      ctx.save(); ctx.clip();
      const old = ctx.globalAlpha; ctx.globalAlpha = old * clamp01((w.lit - 0.25) / 0.5);
      if (w.kid) { w.kid.x = g.x + (w.kidDx || 0); w.kid.y = g.bottom + 2; w.kid.drawBust(ctx, t); }
      if (w.flame) drawCandle(ctx, g.x + (w.kid ? 11 : 0), g.bottom, t, 0.5);
      ctx.globalAlpha = old; ctx.restore();
      this._winPath(ctx, g, w);
    }
    ink(ctx, 3);
    if (w.box) {
      const rr = rng(this.seed * 3 + Math.round(w.dx + w.dy)), n = 4;
      for (let i = 0; i < n; i++) {
        const bx = g.x + ((i + 0.5) / n - 0.5) * (g.w + 2), by = g.bottom - 4 - rr() * 3, sw = wind(bx, t) * 0.7;
        ctx.beginPath(); ctx.ellipse(bx + sw * 0.4, by, 5.5, 6, 0, 0, TAU); ctx.fillStyle = i % 2 ? '#3f9a45' : '#57ad52'; ctx.fill(); ink(ctx, 1.8);
        ctx.fillStyle = BLOOMS[Math.floor(rr() * BLOOMS.length)];
        ctx.beginPath(); ctx.arc(bx + sw + (rr() - 0.5) * 3, by - 3.5 - rr() * 2, 2.3, 0, TAU); ctx.fill();
      }
    }
    if (w.sill && w.kind !== 'round') {
      wobblyPoly(ctx, [[g.x - g.w / 2 - 6 - w.ledge, g.bottom - 1], [g.x + g.w / 2 + 6, g.bottom - 1], [g.x + g.w / 2 + 5, g.bottom + 5], [g.x - g.w / 2 - 5 - w.ledge, g.bottom + 5]], this.seed + Math.round(w.dx), 0.6, 60);
      ctx.fillStyle = PAL.snow; ctx.fill(); ink(ctx, 2.4);
    }
  }
  _door(ctx) {
    const x = this.x + (this.door.dx || 0), gy = this.groundY, w = 28, h = 52, k = HOUSE[this.style] || HOUSE.pink;
    const arch = (hw, top, base) => { ctx.beginPath(); ctx.moveTo(x - hw, base); ctx.lineTo(x - hw, gy - top * 0.6); ctx.bezierCurveTo(x - hw, gy - top * 1.1, x + hw, gy - top * 1.1, x + hw, gy - top * 0.6); ctx.lineTo(x + hw, base); ctx.closePath(); };
    wobblyPoly(ctx, [[x - w / 2 - 9, gy + 4], [x - w / 2 - 5, gy - 3], [x + w / 2 + 5, gy - 3], [x + w / 2 + 9, gy + 4]], this.seed + 61, 0.6, 60);
    ctx.fillStyle = '#cfc8d8'; ctx.fill(); ink(ctx, 2.4);                                   // the step
    arch(w / 2, h, gy - 2);
    ctx.fillStyle = this.door.color || k.door || '#6b3f2a'; ctx.fill(); ink(ctx, 3);
    arch(w / 2 - 5, h - 9, gy - 8);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1.6; ctx.stroke();           // a panel
    ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(x + 7.5, gy - 23, 2.3, 0, TAU); ctx.fill();
  }
  // Timber frame while the house is still being built.
  _frame(ctx, t) {
    const x = this.x, gy = this.groundY, w = this.w, h = this.h, a = ctx.globalAlpha;
    ctx.globalAlpha = a * (1 - clamp01((this.built - 0.75) / 0.25));
    const beam = (p) => tube(ctx, p, 5, '#c99a5a', INK, 3.4);
    beam([[x - w / 2, gy], [x - w / 2, gy - h]]); beam([[x + w / 2, gy], [x + w / 2, gy - h]]); beam([[x, gy], [x, gy - h]]);
    beam([[x - w / 2, gy - h], [x + w / 2, gy - h]]); beam([[x - w / 2, gy - h * 0.5], [x + w / 2, gy - h * 0.5]]);
    beam([[x - w / 2, gy - h], [x, gy - h - w * 0.42]]); beam([[x + w / 2, gy - h], [x, gy - h - w * 0.42]]);
    beam([[x - w / 2, gy - h * 0.5], [x, gy]]); beam([[x + w / 2, gy - h], [x, gy - h * 0.5]]);
    ctx.globalAlpha = a;
  }
}

// The chalk squiggle of chimney smoke, slowly writhing upward.
export function drawSmoke(ctx, x, y, t, seed, h, alpha) {
  const pts = squigglePoints(x, y, h || 110, isStill() ? seed : t, seed, 9, wind(x, t) * 0.2);   // the curl keeps its shape when motion is reduced
  const n = pts.length, a = alpha === undefined ? 0.75 : alpha;
  for (let k = 0; k < 3; k++) {
    const i0 = Math.floor((n - 1) * k / 3), i1 = Math.floor((n - 1) * (k + 1) / 3) + 1;
    chalk(ctx, pts.slice(i0, i1 + 1), { width: 2.6, alpha: a * (1 - k * 0.3), seed: seed + k, color: '#bcd0f7' });
  }
}

// Candle with a crayon halo (the first picture of the book). (x, y) = base on the sill.
export function drawCandle(ctx, x, y, t, size, lit, halo) {
  const s = size || 1, L = lit === undefined ? 1 : lit;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  if (L > 0.01 && halo !== 0) crayonRings(ctx, 0, -40, 60 * (halo || 1), t, { alpha: 0.8 * L, grow: L, seed: 21, rings: 7 });
  // saucer
  ctx.beginPath(); ctx.ellipse(0, -1, 17, 4.5, 0, 0, TAU); ctx.fillStyle = '#f5c62e'; ctx.fill(); ink(ctx, 2);
  // wax
  wobblyPoly(ctx, [[-6, -2], [-5.5, -27], [5.5, -27], [6, -2]], 91, 0.6, 30);
  ctx.fillStyle = '#ffd63a'; ctx.fill(); ink(ctx, 2);
  ctx.strokeStyle = 'rgba(210,140,20,0.7)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-2, -24); ctx.lineTo(-2.4, -7); ctx.stroke();
  // wick + flame
  ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(0.5, -31); ctx.stroke();
  if (L > 0.01) {
    const fl = 1 + 0.12 * Math.sin(t * 11) + 0.08 * Math.sin(t * 23.7), sw = Math.sin(t * 5.3) * 1.4;
    glow(ctx, 0, -40, 46 * L, '#ffd27a', 0.8 * L);
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.bezierCurveTo(-7.5, -37, -4, -46 * fl, sw, -53 * fl * L - 0); ctx.bezierCurveTo(5, -45 * fl, 7.5, -37, 0, -30); ctx.closePath();
    ctx.fillStyle = '#ffb02e'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(0, -31); ctx.bezierCurveTo(-3.6, -36, -2, -41 * fl, sw * 0.6, -45 * fl); ctx.bezierCurveTo(2.4, -40 * fl, 3.6, -36, 0, -31); ctx.closePath();
    ctx.fillStyle = '#fff3b0'; ctx.fill();
  }
  ctx.restore();
}

// White saucer; fill 0..1 of glowing moon milk.
export function drawSaucer(ctx, x, y, fill, t, size) {
  const s = size || 1, f = clamp01(fill || 0);
  if (f > 0.02) glow(ctx, x, y - 4, 44 * s * (0.6 + 0.4 * f), PAL.moon, 0.6 * f * (0.9 + 0.1 * Math.sin((t || 0) * 3)));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  wobble(ctx, [[-17, -5], [-12, 2], [0, 3.5], [12, 2], [17, -5], [0, -2.5]], 61, 0.4);
  ctx.fillStyle = '#fbfbf6'; ctx.fill(); ink(ctx, 2.2);
  ctx.beginPath(); ctx.ellipse(0, -5, 16.5, 4.2, 0, 0, TAU); ctx.fillStyle = '#eef0f4'; ctx.fill(); ink(ctx, 2);
  if (f > 0.02) { ctx.beginPath(); ctx.ellipse(0, -5, 14.5 * (0.35 + 0.65 * f), 3.4 * (0.35 + 0.65 * f), 0, 0, TAU); ctx.fillStyle = '#f7f9c0'; ctx.fill(); }
  ctx.restore();
}

// Round bush with flowers.
export function drawBush(ctx, x, y, r, seed, flower) {
  const s = sprite('bush:' + seed + ':' + Math.round(r) + ':' + (flower || ''), r * 2.6, r * 2, (c, W, H) => {
    const rr = rng(seed);
    blobPath(c, W / 2, H * 0.6, r, r * 0.62, seed, 6, 0.2); c.fillStyle = '#2f8a4a'; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 14; i++) { c.fillStyle = rgba('#5ab05a', 0.3 + rr() * 0.3); c.beginPath(); c.ellipse(W / 2 + (rr() - 0.6) * r * 1.6, H * 0.6 + (rr() - 0.7) * r, r * 0.2, r * 0.12, rr() * 3, 0, TAU); c.fill(); }
    for (let i = 0; i < 12; i++) { c.fillStyle = flower || '#e8505a'; c.beginPath(); c.arc(W / 2 + (rr() - 0.5) * r * 1.7, H * 0.6 + (rr() - 0.5) * r * 0.9, 2 + rr() * 1.6, 0, TAU); c.fill(); }
    c.restore();
    blobPath(c, W / 2, H * 0.6, r, r * 0.62, seed, 6, 0.2); ink(c, 3.4);
  });
  ctx.drawImage(s.c, x - s.w / 2, y - s.h * 0.6 - r * 0.5, s.w, s.h);
}

export function drawBench(ctx, x, y) {
  ctx.save(); ctx.translate(x, y);
  tube(ctx, [[-24, 0], [-24, -18]], 3.4, '#d9c23a', INK, 2.6); tube(ctx, [[24, 0], [24, -18]], 3.4, '#d9c23a', INK, 2.6);
  for (const yy of [-34, -26]) { wobblyPoly(ctx, [[-30, yy], [30, yy - 1], [30, yy + 5], [-30, yy + 6]], 5 + yy, 0.6, 40); ctx.fillStyle = '#e8d24a'; ctx.fill(); ink(ctx, 2.4); }
  wobblyPoly(ctx, [[-32, -18], [32, -19], [33, -12], [-33, -11]], 9, 0.6, 40); ctx.fillStyle = '#e8d24a'; ctx.fill(); ink(ctx, 2.4);
  tube(ctx, [[-27, -12], [-27, -36]], 3, '#d9c23a', INK, 2.4); tube(ctx, [[27, -12], [27, -36]], 3, '#d9c23a', INK, 2.4);
  ctx.restore();
}

export function drawLadder(ctx, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len * 9, ny = dx / len * 9;
  ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = '#c9412e'; ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x0 - nx, y0 - ny); ctx.lineTo(x1 - nx, y1 - ny); ctx.moveTo(x0 + nx, y0 + ny); ctx.lineTo(x1 + nx, y1 + ny);
  for (let i = 1; i < len / 14; i++) { const u = (i * 14) / len; ctx.moveTo(x0 + dx * u - nx, y0 + dy * u - ny); ctx.lineTo(x0 + dx * u + nx, y0 + dy * u + ny); }
  ctx.stroke(); ctx.restore();
}

// Distant street silhouettes (soft, behind the playfield). lights: 0..1 — windows lit in the far houses.
const FAR = new Map();
function farLayout(seed) {
  let L = FAR.get(seed);
  if (L) return L;
  const r = rng(seed), W = 1400, H = 330;
  L = { b: [], trees: [], wins: [] };
  let x = 0;
  while (x < W) {
    const w = 60 + r() * 90, h = 90 + r() * 180;
    if (x + w > W) break;
    const peak = r() < 0.5 ? [w / 2 + (r() - 0.5) * 20, 30 + r() * 30] : null;
    L.b.push({ x, w, h, peak });
    const cols = w > 104 ? 2 : 1;
    for (let yy = 30; yy < h - 26; yy += 46) for (let c = 0; c < cols; c++) if (r() < 0.4) L.wins.push([x + (cols === 2 ? (c ? w * 0.7 : w * 0.3) : w * 0.5), H - h + yy]);
    x += w + (r() < 0.4 ? 30 + r() * 60 : 4);
    if (r() < 0.5 && x < W - 80) L.trees.push([x - 14, H - 80 - r() * 60, 34 + r() * 20]);
  }
  FAR.set(seed, L);
  return L;
}
export function drawFarTown(ctx, view, seed, color, alpha, parallax, baseY, lights, scale) {
  const par = parallax === undefined ? 0.35 : parallax, k = scale || 1, T = 1400 * k, y0 = baseY === undefined ? 0 : baseY;
  const s = tintSprite('far:' + seed, 1400, 330, (c, W, H) => {
    const L = farLayout(seed);
    c.fillStyle = '#ffffff';
    for (const b of L.b) {
      c.beginPath(); c.moveTo(b.x, H); c.lineTo(b.x, H - b.h);
      if (b.peak) c.lineTo(b.x + b.peak[0], H - b.h - b.peak[1]);
      c.lineTo(b.x + b.w, H - b.h); c.lineTo(b.x + b.w, H); c.closePath(); c.fill();
    }
    for (const t of L.trees) { c.beginPath(); c.arc(t[0], t[1], t[2], 0, TAU); c.fill(); c.fillRect(t[0] - 4, t[1] - 10, 8, H - t[1] + 10); }
  }, 1.5, color);
  const off = view.cam.x * (1 - par);
  const old = ctx.globalAlpha; ctx.globalAlpha = old * (alpha === undefined ? 1 : alpha);
  const first = Math.floor((view.left - off) / T) * T + off;
  for (let x = first; x < view.right; x += T) ctx.drawImage(s.c, x, y0 - 326 * k, T, 330 * k);
  if (lights > 0.03) {
    const w = sprite('far-lit:' + seed, 1400, 330, (c) => {
      c.fillStyle = '#ffd97a';
      for (const q of farLayout(seed).wins) { c.beginPath(); c.moveTo(q[0] - 4, q[1] + 7); c.lineTo(q[0] - 4, q[1] - 2); c.quadraticCurveTo(q[0], q[1] - 8, q[0] + 4, q[1] - 2); c.lineTo(q[0] + 4, q[1] + 7); c.closePath(); c.fill(); }
    }, 1.5);
    ctx.globalAlpha = old * Math.min(1, lights) * 0.8;
    for (let x = first; x < view.right; x += T) ctx.drawImage(w.c, x, y0 - 326 * k, T, 330 * k);
  }
  ctx.globalAlpha = old;
}
