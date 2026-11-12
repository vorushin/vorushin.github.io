// Magic cats — painting primitives. Everything here imitates the printed book's naive
// gouache + airbrush + chalk look: wobbly plum outlines, dabbed foliage, speckled skies,
// chalk squiggles and the candle's concentric crayon halo.

import { TAU, rng, hash, clamp01, lerp, rgb, css, mix, mixHex, rgba } from './util.js';

export const PAL = {
  ink: '#1d1530', cream: '#f6efc9', paper: '#f7f0dc', gold: '#ffcf5a', ember: '#f39a3d', chalk: '#c9d8fb',
  winLit: '#ffe36e', winWarm: '#ffc94d', winDark: '#5a2140', winNight: '#232a66',
  pink: '#eab6da', pinkDeep: '#d58fc0', blue: '#86a3dc', blueDeep: '#5f80c6', snow: '#f1f5fb',
  brick: '#a2433b', brickDeep: '#7c2f2b', butter: '#f3d77a', mint: '#9fd8b4',
  leaf: '#3f9a45', leafLight: '#74c05a', leafDark: '#1f6a35', trunk: '#b06a34', trunkOchre: '#c9a23f', trunkDark: '#7a4a26',
  red: '#d9483b', moon: '#eef0a0', white: '#fbfbf6', milk: '#f4f6c8', skin: '#f6d2b8', hairOrange: '#ee7b2a'
};
export const INK = PAL.ink;

// ── Sky palettes (one per time of day / dream), all hex so they can be mixed ──
export const SKIES = {
  night: { top: '#0b1038', mid: '#17226a', bot: '#2c409a', ground: '#1e5d3c', ground2: '#123a2a', tuft: ['#2f7d4a', '#3fa45c', '#6a58ad', '#b860a6'], star: 1, cloud: '#3a4aa0' },
  dawn: { top: '#3d4aa2', mid: '#b98bc4', bot: '#fbc08e', ground: '#3f8a4a', ground2: '#2a6a3c', tuft: ['#4fa658', '#7cc566', '#d98ab8', '#f2c46a'], star: 0.12, cloud: '#f7c9c0' },
  day: { top: '#ffe83b', mid: '#fff066', bot: '#fff7a8', ground: '#58b948', ground2: '#3d9a3c', tuft: ['#3f9a45', '#7fce5c', '#e86f9a', '#e2483b'], star: 0, cloud: '#fffbe0' },
  green: { top: '#5fb0ea', mid: '#a4d6f4', bot: '#eaf6d2', ground: '#45c23a', ground2: '#2f9c36', tuft: ['#2f9c36', '#7fdc5c', '#f0e25a', '#e8f7a0'], star: 0, cloud: '#ffffff' },
  dusk: { top: '#6d1a7e', mid: '#8a3795', bot: '#a56ab5', ground: '#7a569e', ground2: '#5d3f86', tuft: ['#b9a6e8', '#d8ccf5', '#8fb2ea', '#f2e9ff'], star: 0.7, cloud: '#b07cc0' },
  sea: { top: '#0e2a5c', mid: '#1f5a8c', bot: '#58b0b8', ground: '#1f6f8f', ground2: '#124a6e', tuft: ['#3fa4b8', '#7fd4d8', '#c8f0f0', '#5f8fd8'], star: 0.8, cloud: '#4f8fb8' },
  morning: { top: '#7fc4f0', mid: '#bfe3f7', bot: '#fde6c8', ground: '#5fb0c8', ground2: '#3f8fb0', tuft: ['#ffffff', '#d8f0ff', '#ffe9c8', '#bfe3f7'], star: 0, cloud: '#ffffff' },
  sunset: { top: '#3b3f96', mid: '#c0689a', bot: '#ffb86a', ground: '#4f6fa8', ground2: '#3a4f8a', tuft: ['#ffd9a0', '#ffb8a0', '#c8a0e0', '#ffffff'], star: 0.3, cloud: '#ffc6a8' },
  pale: { top: '#dff1f7', mid: '#eef8fb', bot: '#fbfdfd', ground: '#cfeaf2', ground2: '#b5dde9', tuft: ['#8fcfe0', '#b5dde9', '#f6c7d3', '#ffffff'], star: 0, cloud: '#ffffff' }
};

export function mixSky(a, b, t) {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    top: mixHex(a.top, b.top, t), mid: mixHex(a.mid, b.mid, t), bot: mixHex(a.bot, b.bot, t),
    ground: mixHex(a.ground, b.ground, t), ground2: mixHex(a.ground2, b.ground2, t),
    tuft: a.tuft.map((c, i) => mixHex(c, b.tuft[i], t)), star: lerp(a.star, b.star, t), cloud: mixHex(a.cloud, b.cloud, t)
  };
}

// ── Sprite cache (pre-rendered textured props). Sprites are in world units × SPR px. ──
// SPR follows the screen (view.js sets it on every resize: the density the closest framing will show);
// a sprite that names its own `scale` keeps it.
export let SPR = 2;
const SPRITES = new Map();
export function setSpriteRes(k) {
  if (!(k > 0) || k === SPR) return false;
  SPR = k;
  for (const key of Array.from(SPRITES.keys())) { const s = SPRITES.get(key); if (s.auto) { s.c.width = 0; s.c.height = 0; if (s.t) { s.t.width = 0; s.t.height = 0; } SPRITES.delete(key); } }
  return true;
}
export function sprite(key, w, h, draw, scale) {
  let s = SPRITES.get(key);
  if (!s) {
    const k = scale || SPR;
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w * k));
    c.height = Math.max(1, Math.ceil(h * k));
    const g = c.getContext('2d');
    g.scale(k, k);
    draw(g, w, h);
    s = { c, w, h, auto: !scale };
    SPRITES.set(key, s);
  }
  return s;
}
export function freeSprites(prefix) {
  for (const k of Array.from(SPRITES.keys())) {
    if (!prefix || k.indexOf(prefix) === 0) { const s = SPRITES.get(k); s.c.width = 0; s.c.height = 0; if (s.t) { s.t.width = 0; s.t.height = 0; } SPRITES.delete(k); }
  }
}
// A sprite of one flat colour whose colour keeps changing (skies in transition, far roofs…):
// the shape is painted once in white — draw() must use white only — and re-tinted in place
// whenever another colour is asked for. (Caching one sprite per colour would pile up hundreds.)
export function tintSprite(key, w, h, draw, scale, color) {
  const s = sprite(key, w, h, draw, scale);
  if (s.tintOf !== color) {
    if (!s.t) { s.t = document.createElement('canvas'); s.t.width = s.c.width; s.t.height = s.c.height; }
    const g = s.t.getContext('2d');
    g.globalCompositeOperation = 'copy'; g.drawImage(s.c, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, s.t.width, s.t.height);
    s.tintOf = color;
  }
  s.tinted = s.tinted || { w: s.w, h: s.h };
  s.tinted.c = s.t;
  return s.tinted;
}

// ── Outline ──
export function ink(ctx, w, color) {
  ctx.lineWidth = w === undefined ? 3.5 : w;
  ctx.strokeStyle = color || INK;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
}

// Organic closed path through slightly jittered points (corners get rounded).
export function wobble(ctx, pts, seed, amp, closed) {
  const r = rng(seed || 1), a = amp === undefined ? 2.5 : amp;
  const j = pts.map((p) => [p[0] + (r() - 0.5) * 2 * a, p[1] + (r() - 0.5) * 2 * a]);
  const n = j.length;
  ctx.beginPath();
  if (closed === false) {
    ctx.moveTo(j[0][0], j[0][1]);
    for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(j[i][0], j[i][1], (j[i][0] + j[i + 1][0]) / 2, (j[i][1] + j[i + 1][1]) / 2);
    ctx.lineTo(j[n - 1][0], j[n - 1][1]);
  } else {
    ctx.moveTo((j[n - 1][0] + j[0][0]) / 2, (j[n - 1][1] + j[0][1]) / 2);
    for (let i = 0; i < n; i++) {
      const p = j[i], q = j[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }
}

// Hand-drawn polygon: straight-ish edges that wander a little, corners kept.
export function wobblyPoly(ctx, pts, seed, amp, seg, closed) {
  const r = rng(seed || 1), a = amp === undefined ? 1.6 : amp, step = seg || 46;
  const n = pts.length, last = closed === false ? n - 1 : n;
  ctx.beginPath();
  ctx.moveTo(pts[0][0] + (r() - 0.5) * a, pts[0][1] + (r() - 0.5) * a);
  for (let i = 0; i < last; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    const k = Math.max(1, Math.round(len / step));
    const nx = -dy / len, ny = dx / len;
    for (let s = 1; s <= k; s++) {
      const t = s / k, off = s === k ? (r() - 0.5) * a : (r() - 0.5) * 2 * a;
      const x = p[0] + dx * t + nx * off, y = p[1] + dy * t + ny * off;
      const mt = (s - 0.5) / k, moff = (r() - 0.5) * 2 * a;
      ctx.quadraticCurveTo(p[0] + dx * mt + nx * moff, p[1] + dy * mt + ny * moff, x, y);
    }
  }
  if (closed !== false) ctx.closePath();
}

// Scalloped cloud / tree-crown outline (the blobby shapes of the tree-library picture).
export function blobPath(ctx, cx, cy, rx, ry, seed, lumps, depth) {
  const r = rng(seed || 1), n = lumps || 7, d = depth === undefined ? 0.2 : depth;
  const a0 = r() * TAU, pts = [];
  for (let i = 0; i < n; i++) {
    const ang = a0 + ((i + (r() - 0.5) * 0.4) / n) * TAU, rad = 1 + (r() - 0.5) * 0.14;
    pts.push([ang, rad]);
  }
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const p = pts[i % n], x = cx + Math.cos(p[0]) * rx * p[1], y = cy + Math.sin(p[0]) * ry * p[1];
    if (i === 0) { ctx.moveTo(x, y); continue; }
    const q = pts[(i - 1) % n];
    let am = (q[0] + p[0] + (i === n ? TAU : 0)) / 2;
    const bulge = 1 + d * 2 + r() * 0.08;
    ctx.quadraticCurveTo(cx + Math.cos(am) * rx * bulge, cy + Math.sin(am) * ry * bulge, x, y);
  }
  ctx.closePath();
}

// ── Light ──
const GLOWS = new Map();
function glowSprite(color) {
  let c = GLOWS.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d'), col = rgb(color);
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, css(col, 1));
    gr.addColorStop(0.25, css(col, 0.55));
    gr.addColorStop(0.6, css(col, 0.14));
    gr.addColorStop(1, css(col, 0));
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    GLOWS.set(color, c);
  }
  return c;
}
// Additive soft glow.
export function glow(ctx, x, y, r, color, a, mode) {
  if (a <= 0.003 || r <= 0) return;
  const old = ctx.globalAlpha, oc = ctx.globalCompositeOperation;
  ctx.globalAlpha = old * Math.min(1, a);
  ctx.globalCompositeOperation = mode || 'lighter';
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = old;
  ctx.globalCompositeOperation = oc;
}

// The candle picture's halo: concentric rough crayon rings.
export function crayonRings(ctx, x, y, R, t, o) {
  o = o || {};
  const cols = o.colors || ['#ffe36e', '#ffb648', '#8fbdf5', '#f0705a', '#ffd85a', '#ff9f4a'];
  const n = o.rings || Math.max(3, Math.round(R / 8));
  const a = o.alpha === undefined ? 0.85 : o.alpha;
  const grow = o.grow === undefined ? 1 : o.grow;
  const tt = STILL ? 0 : (t || 0), boil = Math.floor(tt * 5);     // under reduced motion the rings keep still
  const lw = (R / n) * (o.thick || 0.56);
  ctx.save();
  ctx.lineCap = 'round';
  for (let k = 1; k <= n; k++) {
    const vis = clamp01(grow * n - (k - 1));
    if (vis <= 0) break;
    const r = rng((o.seed || 7) + k * 131 + boil * 17);
    const rad = (R * k) / n * (1 + 0.025 * Math.sin(tt * 2.1 + k * 1.7));
    ctx.strokeStyle = rgba(cols[(k + (o.shift || 0)) % cols.length], a * vis * (1 - (k / n) * (o.fade === undefined ? 0.45 : o.fade)));
    ctx.lineWidth = lw * (0.8 + r() * 0.4);
    const start = r() * TAU;
    for (let s = 0; s < 3; s++) {
      const a0 = start + (s * TAU) / 3 + r() * 0.3, a1 = a0 + (TAU / 3) * (0.72 + r() * 0.24);
      ctx.beginPath();
      ctx.arc(x + (r() - 0.5) * 1.6, y + (r() - 0.5) * 1.6, Math.max(0.5, rad + (r() - 0.5) * 1.8), a0, a1);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// Rough chalk polyline, optionally only partly drawn (progress 0..1).
export function chalk(ctx, pts, o) {
  o = o || {};
  const w = o.width || 2.4, col = o.color || PAL.chalk, a = o.alpha === undefined ? 0.9 : o.alpha;
  const prog = o.progress === undefined ? 1 : clamp01(o.progress);
  if (pts.length < 2 || prog <= 0 || a <= 0) return;
  const f = (pts.length - 1) * prog, full = Math.floor(f), part = f - full;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let pass = 0; pass < 3; pass++) {
    const r = rng((o.seed || 3) + pass * 977), j = pass === 0 ? 0 : (o.rough === undefined ? 1.1 : o.rough);
    ctx.beginPath();
    ctx.moveTo(pts[0][0] + (r() - 0.5) * j, pts[0][1] + (r() - 0.5) * j);
    for (let i = 1; i <= full; i++) ctx.lineTo(pts[i][0] + (r() - 0.5) * 2 * j, pts[i][1] + (r() - 0.5) * 2 * j);
    if (part > 0 && full + 1 < pts.length) {
      ctx.lineTo(lerp(pts[full][0], pts[full + 1][0], part), lerp(pts[full][1], pts[full + 1][1], part));
    }
    ctx.strokeStyle = rgba(col, a * (pass === 0 ? 0.62 : 0.3));
    ctx.lineWidth = pass === 0 ? w : w * (1.7 - pass * 0.35);
    ctx.stroke();
  }
  ctx.restore();
}

// Points of a curly smoke/steam squiggle rising from (x, y) — the chimney motif.
export function squigglePoints(x, y, h, t, seed, amp, lean) {
  const r = rng(seed || 5), pts = [], n = Math.max(8, Math.round(h / 7));
  const a = amp || 12, ph = r() * TAU, k1 = 0.5 + r() * 0.25, k2 = 0.23 + r() * 0.1;
  for (let i = 0; i <= n; i++) {
    const u = i / n, yy = y - u * h;
    const grow = Math.min(1, u * 3);
    const xx = x + grow * (Math.sin(i * k1 + ph - t * 1.3) * a * (0.5 + u) + Math.sin(i * k2 + ph * 2 - t * 0.6) * a * 1.2 * u) + u * u * h * (0.12 + (lean || 0));
    pts.push([xx, yy]);
  }
  return pts;
}

// Small 4-point sparkle / 5-point star / heart paths.
export function sparklePath(ctx, x, y, r, rot) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (rot || 0) + (i / 8) * TAU, rr = i % 2 ? r * 0.28 : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
export function starPath(ctx, x, y, r, rot, inner) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (rot || 0) - Math.PI / 2 + (i / 10) * TAU, rr = i % 2 ? r * (inner || 0.46) : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
  ctx.closePath();
}
export function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.5, y - s * 0.1, x - s * 0.7, y - s * 1.2, x, y - s * 0.35);
  ctx.bezierCurveTo(x + s * 0.7, y - s * 1.2, x + s * 1.5, y - s * 0.1, x, y + s * 0.9);
  ctx.closePath();
}

// ── Wind: one breath for the whole world — a slow sway, and gusts that travel across the scene ──
let STILL = false;
export function setStill(v) { STILL = !!v; }
export function isStill() { return STILL; }
export function wind(x, t) {
  if (STILL) return 0;
  const g = Math.sin(t * 0.31 - x * 0.0016), gust = g > 0.55 ? (g - 0.55) / 0.45 : 0;
  return 0.35 * Math.sin(t * 0.9 + x * 0.004) + gust * gust * (3 - 2 * gust) * (1 + 0.3 * Math.sin(t * 5.3 + x * 0.02));
}

// ── Layer cache ──
// Full-screen layers that seldom change (the sky's airbrush and spray; the far roofs) are painted
// once into an offscreen canvas and then simply blitted. `paint(g, vv)` draws them with the
// ordinary functions, given a stand-in view `vv` that is wider (and, for whole-screen layers,
// taller) than the screen by a margin. While the camera drifts the picture is shifted — sideways
// by the layers' parallax, up and down with the world — and while it zooms the picture is scaled,
// until it no longer covers its part of the screen (or the zoom has come to rest): then it is
// painted afresh. `band` = {y0, y1} limits the cache to a strip of the world.
export const SKY_PAR = 0.05;
export class Layer {
  // o: {par (sideways parallax of what is painted), margin, marginY (px), every (while colours are changing, repaint every n-th frame)}
  constructor(o) { o = o || {}; this.par = o.par === undefined ? 1 : o.par; this.margin = o.margin || 0; this.marginY = o.marginY || 0; this.every = o.every || 3; this.c = null; this.key = null; this.stale = 0; this.still = 0; }
  draw(ctx, view, key, paint, band) {
    const dpr = view.dpr, M = this.margin, MY = band ? 0 : this.marginY, sc = view.scale, slack = band ? 1.5 : 0.5;
    const top = band ? Math.max(0, Math.floor(view.sy(band.y0))) : 0, bot = band ? Math.min(view.H, Math.ceil(view.sy(band.y1))) : view.H;
    if (bot <= top) return;
    this.still = Math.abs(sc - this.sc1) < sc * 2e-4 ? this.still + 1 : 0;
    this.sc1 = sc;
    // where the picture painted earlier lies on the screen now
    let ok = !!this.c && this.W === view.W && this.H === view.H && this.dpr === dpr, k = 1, lx = 0, ly = 0;
    if (ok) {
      k = sc / this.s0;
      lx = view.ox + (-M - view.ox) * k - (view.cam.x - this.x0) * this.par * sc;
      ly = view.oy + (this.top - MY - view.oy) * k - (view.cam.y - this.y0) * sc;
      ok = Math.abs(k - 1) <= 0.12 && lx <= slack && lx + this.cw * k >= view.W - slack && ly <= top + slack && ly + this.ch * k >= bot - slack &&
        !(Math.abs(k - 1) > 0.004 && this.still >= 8);                  // a zoom that has come to rest is painted sharp again
    }
    let fresh = ok && key === this.key && !Layer.off;
    if (ok && !fresh && !Layer.off && this.stale < this.every - 1) { this.stale++; fresh = true; }      // colours in transition: not every frame
    if (!fresh) {
      const cw = view.W + 2 * M, ch = bot - top + 2 * MY, w = Math.round(cw * dpr), h = Math.round(ch * dpr);
      if (!this.c) this.c = document.createElement('canvas');
      if (this.c.width !== w || this.c.height !== h) { this.c.width = w; this.c.height = h; }
      const g = this.c.getContext('2d'), vv = Object.create(view);
      vv.W = cw; vv.H = ch; vv.ox = view.ox + M; vv.oy = view.oy - top + MY;
      vv.left = view.left - M / sc; vv.right = view.right + M / sc; vv.top = view.top + (top - MY) / sc; vv.bottom = vv.top + ch / sc;
      vv.apply = (c) => { const q = dpr * sc; c.setTransform(q, 0, 0, q, dpr * (vv.ox - view.cam.x * sc), dpr * (vv.oy - view.cam.y * sc)); };
      vv.screen = (c) => c.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
      g.clearRect(0, 0, w, h);
      vv.apply(g);
      paint(g, vv);
      this.key = key; this.x0 = view.cam.x; this.y0 = view.cam.y; this.s0 = sc; this.top = top; this.cw = cw; this.ch = ch;
      this.W = view.W; this.H = view.H; this.dpr = dpr; this.stale = 0;
      k = 1; lx = -M; ly = top - MY;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (k === 1) ctx.drawImage(this.c, Math.round(lx * dpr), Math.round(ly * dpr));
    else ctx.drawImage(this.c, lx * dpr, ly * dpr, this.c.width * k, this.c.height * k);
    ctx.restore();
  }
}
Layer.off = false;                 // tests: paint afresh every frame (to compare with the cached picture)
// The sky of a scene: the gradient, and over it the airbrush blotches and the sprayed speckle (cached).
const SKYLAYER = new Layer({ par: SKY_PAR, margin: 48, marginY: 150 });
export function drawSkyAll(ctx, view, sky, seed, o) {
  o = o || {};
  const spray = o.spray || sky.spray || mixHex(sky.mid, '#ffffff', 0.32), a2 = o.dark === undefined ? 0.3 + 0.25 * sky.star : o.dark, air = o.air === undefined ? 0.5 : o.air;
  drawSky(ctx, view, sky);
  SKYLAYER.draw(ctx, view, sky.cloud + spray + sky.top + a2.toFixed(2) + ':' + seed + ':' + air, (g, vv) => {
    drawAirbrush(g, vv, sky.cloud, air, seed);
    drawSpray(g, vv, spray, o.light === undefined ? 0.5 : o.light, seed);
    if (a2 > 0.01) drawSpray(g, vv, sky.top, a2, seed + 3);
  });
}

// ── Sky, stars, moon, clouds ──
export function drawSky(ctx, view, sky) {
  const horizon = view.sy(0);
  ctx.save();
  ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
  const g = ctx.createLinearGradient(0, Math.min(0, horizon - view.H), 0, Math.max(horizon, 1));
  g.addColorStop(0, sky.top);
  g.addColorStop(0.55, sky.mid);
  g.addColorStop(1, sky.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, view.W, view.H);
  ctx.restore();
}

// Big soft airbrush blotches that give the sky its sprayed, uneven look.
export function drawAirbrush(ctx, view, color, alpha, seed) {
  if (alpha <= 0) return;
  const s = tintSprite('airbrush:' + (seed || 1), 256, 256, (g) => {
    const r = rng(seed || 1), c = [255, 255, 255];
    for (let i = 0; i < 16; i++) {
      const x = r() * 256, y = r() * 256, rad = 30 + r() * 70;
      for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) {
        if (x + ox + rad < 0 || x + ox - rad > 256 || y + oy + rad < 0 || y + oy - rad > 256) continue;
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, css(c, 0.16 + r() * 0.12));
        gr.addColorStop(1, css(c, 0));
        g.fillStyle = gr;
        g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
  }, 1, color);
  const T = 1100, par = SKY_PAR;
  const off = view.cam.x * (1 - par);   // pattern anchored so it drifts slowly against the camera
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let x = Math.floor((view.left - off) / T) * T + off; x < view.right; x += T) {
    for (let y = Math.floor(view.top / T) * T; y < 0; y += T) ctx.drawImage(s.c, x, y, T, T);
  }
  ctx.restore();
}

// The sprayed speckle of the book's night skies: clouds of fine dots, denser in drifts.
export function drawSpray(ctx, view, color, alpha, seed, top) {
  if (alpha <= 0.01) return;
  const N = 384;
  const s = tintSprite('spray:' + (seed || 1), N, N, (g) => {
    const r = rng((seed || 1) * 31 + 7), c = [255, 255, 255];
    // where the drifts are: a handful of soft centres (wrapped, so the tile repeats)
    const drift = [];
    for (let i = 0; i < 7; i++) drift.push([r() * N, r() * N, 50 + r() * 90]);
    const dens = (x, y) => {
      let d = 0.12;
      for (const q of drift) {
        let dx = Math.abs(x - q[0]), dy = Math.abs(y - q[1]);
        if (dx > N / 2) dx = N - dx; if (dy > N / 2) dy = N - dy;
        d += Math.exp(-(dx * dx + dy * dy) / (q[2] * q[2]));
      }
      return Math.min(1, d);
    };
    for (let i = 0; i < 5200; i++) {
      const x = r() * N, y = r() * N;
      if (r() > dens(x, y)) continue;
      const rad = 0.5 + r() * r() * 1.5;
      g.fillStyle = css(c, 0.16 + r() * 0.3);
      g.beginPath(); g.arc(x, y, rad, 0, TAU); g.fill();
    }
  }, 1, color);
  const T = 900, par = SKY_PAR, off = view.cam.x * (1 - par), yTop = top === undefined ? view.top : top;
  ctx.save();
  ctx.globalAlpha *= alpha;
  for (let x = Math.floor((view.left - off) / T) * T + off; x < view.right; x += T) {
    for (let y = Math.floor(yTop / T) * T; y < 0; y += T) ctx.drawImage(s.c, x, y, T, T);
  }
  ctx.restore();
}

export function makeStars(seed, n) {
  const r = rng(seed || 11), a = [];
  for (let i = 0; i < (n || 150); i++) {
    const big = r() < 0.07;
    a.push({ x: r() * 2400, y: -90 - Math.pow(r(), 0.8) * 1250, r: big ? 2.2 + r() * 1.6 : 0.7 + r() * 1.3, ph: r() * TAU, sp: 0.5 + r() * 1.6, big, gold: r() < 0.18 });
  }
  // the candle picture's gold flecks: a few soft, larger, warmer dots
  for (let i = 0; i < Math.round((n || 150) * 0.16); i++) a.push({ x: r() * 2400, y: -110 - Math.pow(r(), 0.7) * 1100, r: 1.6 + r() * r() * 3, ph: r() * TAU, sp: 0.3 + r() * 0.7, big: false, gold: true, fleck: true });
  return a;
}
export function drawStars(ctx, view, stars, t, alpha, calm) {
  if (alpha <= 0.01) return;
  const T = 2400, cx = view.cam.x, par = 0.08;
  ctx.save();
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    if (s.y < view.top - 6) continue;
    const v = ((((s.x - cx * par + T / 2) % T) + T) % T) - T / 2;
    const x = cx + v;
    if (x < view.left - 6 || x > view.right + 6) continue;
    const tw = calm ? 0.8 : 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph));
    const haze = clamp01((-s.y - 90) / 160);
    ctx.globalAlpha = alpha * (s.fleck ? 0.38 + 0.22 * tw : tw) * haze;
    ctx.fillStyle = s.fleck ? '#f2c468' : s.gold ? '#ffe9a8' : '#f4f6ff';
    if (s.big) { sparklePath(ctx, x, s.y, s.r * (1.6 + 0.5 * tw), 0); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, s.y, s.r, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

export function drawMoon(ctx, x, y, r, t, o) {
  o = o || {};
  const col = o.color || PAL.moon;
  glow(ctx, x, y, r * 3.6, col, (o.halo === undefined ? 0.5 : o.halo) * (1 + 0.05 * Math.sin((t || 0) * 0.8)), 'screen');
  glow(ctx, x, y, r * 1.9, col, 0.5, 'screen');
  ctx.save();
  const a0 = ctx.globalAlpha;                 // the caller may be fading the whole moon out: her face fades with her
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
  g.addColorStop(0, mixHex(col, '#ffffff', 0.55));
  g.addColorStop(1, col);
  ctx.fillStyle = g;
  wobble(ctx, circlePts(x, y, r, 14), o.seed || 5, r * 0.02);
  ctx.fill();
  ctx.globalAlpha = a0 * 0.1;
  ctx.fillStyle = '#8f9440';
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.12, r * 0.2, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.28, y + r * 0.32, r * 0.13, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.arc(x + r * 0.18, y - r * 0.42, r * 0.09, 0, TAU); ctx.fill();
  if (o.face > 0.02) {                 // somebody tickled her: a sleepy smile
    ctx.globalAlpha = a0 * Math.min(1, o.face);
    ctx.strokeStyle = '#7c7a2e'; ctx.lineWidth = Math.max(1.4, r * 0.055); ctx.lineCap = 'round';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(x + sd * r * 0.3, y - r * 0.02, r * 0.14, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(x, y + r * 0.16, r * 0.26, Math.PI * 0.2, Math.PI * 0.8); ctx.stroke();
    ctx.fillStyle = 'rgba(240,150,150,0.35)';
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * r * 0.52, y + r * 0.2, r * 0.13, r * 0.09, 0, 0, TAU); ctx.fill(); }
  }
  ctx.restore();
}

export function circlePts(x, y, r, n, ry) {
  const a = [];
  for (let i = 0; i < n; i++) a.push([x + Math.cos((i / n) * TAU) * r, y + Math.sin((i / n) * TAU) * (ry === undefined ? r : ry)]);
  return a;
}

// Soft airbrushed cloud (cached). x,y = centre.
export function drawCloud(ctx, x, y, w, seed, color, alpha) {
  const h = w * 0.5;
  const s = tintSprite('cloud:' + seed + ':' + Math.round(w), w * 1.3, h * 1.5, (g, W, H) => {
    const r = rng(seed), c = [255, 255, 255];
    for (let i = 0; i < 9; i++) {
      const cx = W * (0.2 + r() * 0.6), cy = H * (0.45 + r() * 0.25), rad = w * (0.14 + r() * 0.16);
      const gr = g.createRadialGradient(cx, cy - rad * 0.2, rad * 0.1, cx, cy, rad);
      gr.addColorStop(0, css(c, 0.95));
      gr.addColorStop(0.7, css(c, 0.55));
      gr.addColorStop(1, css(c, 0));
      g.fillStyle = gr;
      g.beginPath(); g.arc(cx, cy, rad, 0, TAU); g.fill();
    }
  }, 1.5, color);
  const old = ctx.globalAlpha;
  ctx.globalAlpha = old * (alpha === undefined ? 1 : alpha);
  ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h);
  ctx.globalAlpha = old;
}

// ── Ground: a painted band — brushed patches, grass in three depths, flowers by day ──
// (green with pink / violet strokes among it, like the cover). o: {y, t, plain, bare (no flowers)}
const GRASS = [
  { y0: 2, y1: 16, step: 8, len: 6, more: 5, w: 1.5, fan: 2, n: 2 },        // far: a fine fringe under the horizon
  { y0: 14, y1: 78, step: 12, len: 9, more: 9, w: 2, fan: 3.4, n: 3 },      // middle
  { y0: 70, y1: 250, step: 21, len: 15, more: 16, w: 2.8, fan: 5, n: 3 }    // near: big loose tufts
];
export function drawGround(ctx, view, sky, o) {
  o = o || {};
  const y0 = o.y || 0, x0 = view.left - 20, x1 = view.right + 20, y1 = Math.max(view.bottom + 20, y0 + 60);
  const g = ctx.createLinearGradient(0, y0, 0, y0 + 240);
  g.addColorStop(0, sky.ground);
  g.addColorStop(1, sky.ground2);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(x0, y1);
  const stepE = 40;
  for (let x = Math.floor(x0 / stepE) * stepE; x <= x1 + stepE; x += stepE) {
    ctx.lineTo(x, y0 + (hash(x * 3 + 17) - 0.5) * 5);
  }
  ctx.lineTo(x1, y1);
  ctx.closePath();
  ctx.fill();
  if (o.plain) return;
  const t = o.t === undefined ? 0 : o.t, deep = Math.min(view.bottom + 30, y0 + 260);
  ctx.save();
  // broad brushed patches, lighter and deeper
  const step = 44;
  for (let i = Math.floor(x0 / step); i * step < x1; i++) {
    for (let k = 0; k < 2; k++) {
      const h1 = hash(i * 31 + 5 + k * 77), h2 = hash(i * 57 + 9 + k * 13), h3 = hash(i * 91 + 3 + k * 41);
      const py = y0 + 14 + h2 * h2 * 200;
      if (py > deep) continue;
      ctx.globalAlpha = k ? 0.14 + h3 * 0.16 : 0.2 + h3 * 0.24;
      ctx.fillStyle = k ? sky.ground2 : sky.tuft[(i & 1) ? 1 : 0];
      ctx.beginPath();
      ctx.ellipse(i * step + h1 * step, py, (16 + h1 * 30) * (0.7 + h2), (3 + h3 * 5) * (0.7 + h2 * 0.8), (h3 - 0.5) * 0.12, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // grass, batched per depth and colour
  ctx.lineCap = 'round';
  for (let b = 0; b < GRASS.length; b++) {
    const G = GRASS[b];
    if (y0 + G.y0 > deep) break;
    for (let c = 0; c < 4; c++) {
      ctx.beginPath();
      let any = false;
      for (let i = Math.floor(x0 / G.step); i * G.step < x1; i++) {
        const h = hash(i * 13 + 1 + b * 101);
        const col = h < 0.44 ? 0 : h < 0.8 ? 1 : h < 0.91 ? 2 : 3;
        if (col !== c) continue;
        const bx = i * G.step + hash(i * 7 + 2 + b * 53) * G.step, row = hash(i * 23 + 4 + b * 29);
        const by = y0 + lerp(G.y0, G.y1, row * row);
        if (by > deep) continue;
        const len = G.len + hash(i * 41 + 6 + b) * G.more, sway = wind(bx, t) * (1.2 + b * 1.1);
        for (let k = 0; k < G.n; k++) {
          const f = G.n === 1 ? 0 : (k / (G.n - 1)) * 2 - 1, tip = (hash(i * 3 + k + b * 7) - 0.5) * G.fan;
          const l = len * (1 - Math.abs(f) * 0.22);
          ctx.moveTo(bx + f * G.fan * 0.5, by);
          ctx.quadraticCurveTo(bx + f * G.fan * 0.9, by - l * 0.6, bx + f * G.fan * 1.5 + tip + sway, by - l);
        }
        any = true;
      }
      if (!any) continue;
      ctx.strokeStyle = rgba(sky.tuft[c], c < 2 ? 0.78 : 0.62);
      ctx.lineWidth = G.w;
      ctx.stroke();
    }
  }
  // by day the meadow is dotted with little flowers
  const day = o.bare ? 0 : 1 - clamp01(sky.star / 0.5);
  if (day > 0.02) {
    const fstep = 43, cols = ['#ffffff', '#ffd84a', '#f08ab0', '#ffffff', '#e8505a', '#ffffff', '#f6a64a'];
    ctx.globalAlpha = day;
    for (let i = Math.floor(x0 / fstep); i * fstep < x1; i++) {
      const h = hash(i * 61 + 7);
      if (h > 0.66) continue;
      const fx = i * fstep + hash(i * 29 + 3) * fstep, row = hash(i * 17 + 9), fy = y0 + 12 + row * row * 150, r = 2.4 + row * 2;
      if (fy > deep) continue;
      const sw = wind(fx, t) * (0.8 + row), kind = Math.floor(h * 30) % 3;
      ctx.strokeStyle = rgba(sky.tuft[0], 0.8); ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(fx, fy + r * 2.4); ctx.quadraticCurveTo(fx, fy + r, fx + sw, fy); ctx.stroke();
      ctx.fillStyle = cols[Math.floor(h * 16) % cols.length];
      if (kind === 2) { ctx.beginPath(); ctx.ellipse(fx + sw, fy, r * 1.1, r * 0.9, 0, 0, TAU); ctx.fill(); }          // a poppy dab
      else {
        const np = kind ? 6 : 5;
        for (let q = 0; q < np; q++) { ctx.beginPath(); ctx.arc(fx + sw + Math.cos((q / np) * TAU) * r, fy + Math.sin((q / np) * TAU) * r, r * (kind ? 0.6 : 0.72), 0, TAU); ctx.fill(); }
        ctx.fillStyle = '#f2b93a'; ctx.beginPath(); ctx.arc(fx + sw, fy, r * 0.6, 0, TAU); ctx.fill();
      }
    }
  }
  ctx.restore();
}

// The fringe of grass in front of whatever stands on the ground (trunks, walls): call after those.
export function drawGrassFront(ctx, view, sky, o) {
  o = o || {};
  const y0 = o.y || 0, x0 = view.left - 20, x1 = view.right + 20, t = o.t === undefined ? 0 : o.t, step = 10;
  ctx.save();
  ctx.lineCap = 'round';
  for (let c = 0; c < 3; c++) {
    ctx.beginPath();
    for (let i = Math.floor(x0 / step); i * step < x1; i++) {
      const h = hash(i * 19 + 3);
      const col = h < 0.42 ? 0 : h < 0.84 ? 1 : 2;
      if (col !== c || hash(i * 5 + 11) < 0.18) continue;
      const bx = i * step + hash(i * 7 + 1) * step, by = y0 + 3 + hash(i * 11 + 5) * 5, len = 7 + hash(i * 37 + 2) * 9, sway = wind(bx, t) * 1.3;
      for (let k = -1; k <= 1; k++) {
        ctx.moveTo(bx + k * 1.8, by);
        ctx.quadraticCurveTo(bx + k * 2.6, by - len * 0.6, bx + k * 4.2 + (hash(i * 3 + k) - 0.5) * 3 + sway, by - len * (k ? 0.8 : 1));
      }
    }
    ctx.strokeStyle = c === 2 ? rgba(sky.tuft[2], 0.7) : c ? rgba(sky.tuft[1], 0.9) : mix(sky.ground, sky.tuft[0], 0.5, 0.95);
    ctx.lineWidth = 1.9;
    ctx.stroke();
  }
  ctx.restore();
}

// Noise tile for the DOM film-grain overlay (data URL).
export function grainURL(size, strength) {
  const n = size || 180, c = document.createElement('canvas');
  c.width = c.height = n;
  const g = c.getContext('2d'), img = g.createImageData(n, n), d = img.data, r = rng(4242);
  for (let i = 0; i < n * n; i++) {
    const v = r(), speck = r() < 0.035;
    const lum = speck ? 255 : 128 + (v - 0.5) * 2 * 110;
    d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = lum;
    d[i * 4 + 3] = (speck ? 120 : 70) * (strength || 1);
  }
  g.putImageData(img, 0, 0);
  return c.toDataURL('image/png');
}

// Gold speckles (the candle picture's sparks).
export function drawSpeckles(ctx, x, y, w, h, seed, n, color, t) {
  const r = rng(seed);
  ctx.save();
  ctx.fillStyle = color || PAL.gold;
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, rad = 0.6 + r() * r() * 2.6, ph = r() * TAU;
    ctx.globalAlpha = (0.35 + 0.5 * r()) * (t === undefined ? 1 : 0.65 + 0.35 * Math.sin(t * (0.6 + r()) + ph));
    ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

// Rounded rect path helper
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// A limb / tail: dark underlay stroke + coloured stroke on top = outlined tube.
export function tube(ctx, pts, w, color, outline, ow) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    if (pts.length === 2) ctx.lineTo(pts[1][0], pts[1][1]);
    else {
      for (let i = 1; i < pts.length - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2);
      ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
    }
  };
  if (outline !== false) { path(); ctx.strokeStyle = outline || INK; ctx.lineWidth = w + (ow === undefined ? 5 : ow); ctx.stroke(); }
  path(); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.stroke();
}

export { mix, mixHex, rgba };
