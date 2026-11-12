// Magic cats — art for scene 9. The cats' own world is the book's last picture ("Angel and
// bird"): pale and airy, cyan line drawing on white, cloud shapes full of spirals, fine pink
// wing lines. Scenery here is outlined in that cyan; the cats and the things they handle keep
// the usual plum ink, so they stay in front.

import { TAU, rng, clamp, clamp01, lerp, ease, spring } from '../util.js';
import { INK, ink, wobble, wobblyPoly, blobPath, sprite, glow, chalk, circlePts, heartPath, starPath, tube, rgba, mixHex } from '../paint.js';
import { drawBundle } from '../actors.js';

export const D = {
  line: '#3aa7cf', deep: '#2787b6', cloud: '#a9dcea', cloudLight: '#c6e9f2', cloudDeep: '#8fd0e2',
  pink: '#f8cdd8', pinkDeep: '#ee9db4', butter: '#fdf0bd', mint: '#cdeedd', lilac: '#e2d8f6',
  gold: '#ffd35a', goldDeep: '#d99a1e', milk: '#f7f9c0', bark: '#f7f3f8'
};

// ── spirals: the signature mark of this world ──
export function spiralPath(ctx, x, y, r, turns, dir, rot) {
  const n = Math.max(10, Math.ceil((turns || 1.7) * (14 + Math.min(40, r * 0.6))));
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = (rot || 0) + (dir || 1) * u * (turns || 1.7) * TAU, rr = r * (1 - u * 0.93);
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
  }
}
function spirals(c, list, w, color) {
  c.strokeStyle = color || D.line; c.lineWidth = w || 2.2; c.lineCap = 'round'; c.lineJoin = 'round';
  for (const s of list) { spiralPath(c, s[0], s[1], s[2], s[3], s[4], s[5]); c.stroke(); }
}

// White cloud with a spiral inside (dream mist, sky clouds).
export function drawSpiralCloud(ctx, x, y, w, seed, alpha) {
  if (alpha !== undefined && alpha <= 0.01) return;
  const h = w * 0.56;
  const s = sprite('gd-cloud:' + seed + ':' + Math.round(w), w * 1.25, h * 1.4, (c, W, H) => {
    const r = rng(seed);
    blobPath(c, W / 2, H / 2, w * 0.5, h * 0.42, seed, 7, 0.2);
    c.fillStyle = '#ffffff'; c.fill(); ink(c, 3, D.line);
    spirals(c, [[W / 2 - w * 0.16, H / 2 + 2, h * 0.24, 1.9, 1, r() * 6], [W / 2 + w * 0.2, H / 2 - 2, h * 0.15, 1.5, -1, r() * 6]], 2.2);
  }, 1.5);
  const a = ctx.globalAlpha;
  ctx.globalAlpha = a * (alpha === undefined ? 1 : alpha);
  ctx.drawImage(s.c, x - s.w / 2, y - s.h / 2, s.w, s.h);
  ctx.globalAlpha = a;
}

// Cloud crown of a magic tree (cached).
export function crownSprite(seed, r, col) {
  return sprite('gd-crown:' + seed + ':' + r + ':' + col, r * 2.7, r * 2.4, (c, W, H) => {
    const cx = W / 2, cy = H / 2, rr = rng(seed + 9);
    blobPath(c, cx, cy, r, r * 0.8, seed, 7, 0.2);
    c.fillStyle = col; c.fill();
    c.save(); c.clip();
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.4, r * 0.1, cx, cy, r * 1.2);
    g.addColorStop(0, 'rgba(255,255,255,0.78)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
    blobPath(c, cx, cy, r, r * 0.8, seed, 7, 0.2); ink(c, 3.4, D.line);
    const n = r > 50 ? 5 : r > 34 ? 4 : 3, list = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rr() * 0.8, d = r * (0.3 + rr() * 0.28);
      list.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, r * (0.13 + rr() * 0.09), 1.6 + rr() * 0.5, rr() < 0.5 ? 1 : -1, rr() * TAU]);
    }
    spirals(c, list, 2, rgba(D.deep, 0.75));
  });
}

// Small flower / blossom.
export function drawFlower(ctx, x, y, s, col) {
  if (s <= 0.02) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = col || '#ffffff'; ctx.strokeStyle = D.pinkDeep; ctx.lineWidth = 1;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU - 1.57; ctx.beginPath(); ctx.arc(Math.cos(a) * 4, Math.sin(a) * 4, 3.1, 0, TAU); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = '#ffc23a'; ctx.beginPath(); ctx.arc(0, 0, 2.6, 0, TAU); ctx.fill();
  ctx.restore();
}

// ── the sleeping angel with cloud hair, and her bird ──
function drawAngelBird(ctx, x, y, t) {
  const peck = Math.max(0, Math.sin(t * 0.9) - 0.94) * 16;
  ctx.save(); ctx.translate(x, y + Math.sin(t * 2.1) * 1.2);
  ctx.strokeStyle = D.deep; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-3, 9); ctx.lineTo(-5, 20); ctx.moveTo(5, 9); ctx.lineTo(4, 20); ctx.stroke();
  ctx.rotate(-peck * 0.25);
  wobble(ctx, [[10, -8], [24, -17], [22, -3]], 6, 0.3); ctx.fillStyle = D.cloudDeep; ctx.fill(); ink(ctx, 2, D.line);          // tail
  wobble(ctx, [[-15, -1], [-7, -12], [8, -11], [15, -3], [10, 9], [-4, 11], [-13, 6]], 3, 0.5); ctx.fillStyle = D.cloud; ctx.fill(); ink(ctx, 2.4, D.line);
  wobble(ctx, [[-2, -6], [11, -6], [13, 3], [2, 6]], 4, 0.4); ctx.fillStyle = D.cloudDeep; ctx.fill(); ink(ctx, 2, D.line);   // wing
  wobble(ctx, [[-24, -4], [-14, -6], [-15, 2]], 5, 0.3); ctx.fillStyle = D.deep; ctx.fill();                                   // beak
  ctx.fillStyle = D.deep; ctx.beginPath(); ctx.arc(-9, -5, 1.4, 0, TAU); ctx.fill();
  ctx.restore();
}
export const ANGEL_BIRD = { x: 124, y: -41 };   // offset of the bird from the angel's centre (× scale)
export function drawAngel(ctx, x, y, s, t, alpha) {
  if (alpha <= 0.01) return;
  const W = 440, H = 430;
  const sp = sprite('gd-angel', W, H, (c) => {
    const cx = W / 2;
    c.lineJoin = c.lineCap = 'round';
    c.strokeStyle = rgba('#f0a2b8', 0.7); c.lineWidth = 1.8;               // wings: fans of fine pink lines
    for (const sd of [-1, 1]) for (let i = 0; i < 10; i++) {
      c.beginPath(); c.moveTo(cx + sd * 60, 330);
      c.quadraticCurveTo(cx + sd * (120 + i * 5), 300 - i * 16, cx + sd * (212 - i * 2), 150 + i * 24);
      c.stroke();
    }
    blobPath(c, cx, 168, 176, 142, 77, 10, 0.14); c.fillStyle = D.cloud; c.fill(); ink(c, 4, D.line);   // hair
    c.beginPath(); c.moveTo(cx + 6, 20); c.bezierCurveTo(cx - 8, 60, cx + 8, 84, cx, 116); c.strokeStyle = D.line; c.lineWidth = 3; c.stroke();
    spirals(c, [[cx - 128, 118, 22, 1.8, 1, 0.5], [cx - 100, 222, 27, 2, -1, 2], [cx - 150, 176, 14, 1.5, 1, 4], [cx - 50, 58, 15, 1.6, -1, 1],
      [cx + 62, 62, 20, 1.8, 1, 3], [cx + 150, 252, 22, 1.8, -1, 0], [cx + 78, 292, 17, 1.6, 1, 5], [cx - 60, 294, 15, 1.5, -1, 2.5]], 2.4, D.line);
    wobble(c, [[cx - 66, 176], [cx - 58, 134], [cx - 24, 116], [cx + 22, 118], [cx + 58, 138], [cx + 66, 180], [cx + 54, 232], [cx + 28, 270], [cx, 286], [cx - 28, 270], [cx - 54, 232]], 5, 1);
    c.fillStyle = '#ffffff'; c.fill(); ink(c, 3, D.line);                                            // face
    for (const sd of [-1, 1]) {                                                                       // closed eyes
      const ex = cx + sd * 30, ey = 196;
      c.strokeStyle = D.line; c.lineWidth = 2.6;
      c.beginPath(); c.arc(ex, ey, 20, Math.PI * 0.2, Math.PI * 0.8); c.stroke();
      for (const k of [-0.5, 0, 0.5]) { const a = Math.PI * 0.5 + k * 0.7; c.beginPath(); c.moveTo(ex + Math.cos(a) * 20, ey + Math.sin(a) * 20); c.lineTo(ex + Math.cos(a) * 26, ey + Math.sin(a) * 26); c.stroke(); }
      c.fillStyle = rgba('#f4a9bc', 0.35); c.beginPath(); c.arc(cx + sd * 44, 238, 10, 0, TAU); c.fill();
    }
    c.strokeStyle = D.line; c.lineWidth = 2.6; c.beginPath(); c.moveTo(cx - 13, 283); c.lineTo(cx - 18, 322); c.moveTo(cx + 13, 283); c.lineTo(cx + 18, 322); c.stroke();
    blobPath(c, cx, 372, 150, 46, 78, 9, 0.16); c.fillStyle = D.cloud; c.fill(); ink(c, 4, D.line);  // dress: another cloud
    spirals(c, [[cx - 80, 372, 14, 1.6, 1, 0], [cx + 6, 380, 12, 1.5, -1, 2], [cx + 86, 368, 15, 1.6, 1, 4]], 2.2, D.line);
    c.beginPath(); c.arc(cx + 124, 172, 38, 0, TAU); c.fillStyle = '#ffffff'; c.fill(); ink(c, 3, D.line);   // the bird's round window
  }, 1.5);
  const br = 1 + 0.01 * Math.sin(t * 1.1);
  ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y); ctx.scale(s, s * br);
  ctx.drawImage(sp.c, -W / 2, -H / 2, W, H);
  drawAngelBird(ctx, ANGEL_BIRD.x, ANGEL_BIRD.y, t);
  ctx.restore();
}

// ── the little houses with cat-ear roofs ──
const HOME_COLS = [['#fbdbe5', '#f3b3c7'], ['#fdf3c8', '#f5dc86'], ['#d8f2e4', '#aee0c6'], ['#e7dffa', '#cdbff0']];
export function drawCatHouse(ctx, x, o) {
  const w = o.w, h = o.h, col = HOME_COLS[o.col % HOME_COLS.length];
  const s = sprite('gd-home:' + w + ':' + h + ':' + o.col, w + 90, h + 96, (c, W, H) => {
    const cx = W / 2, gy = H - 8, top = gy - h;
    c.lineJoin = c.lineCap = 'round';
    for (const sd of [-1, 1]) {                                                    // ears
      wobble(c, [[cx + sd * w * 0.46, top - 6], [cx + sd * w * 0.36, top - 62], [cx + sd * w * 0.1, top - 30]], 30 + sd, 0.8);
      c.fillStyle = col[1]; c.fill(); ink(c, 3.4, D.deep);
      c.beginPath(); c.moveTo(cx + sd * w * 0.38, top - 16); c.lineTo(cx + sd * w * 0.34, top - 46); c.lineTo(cx + sd * w * 0.21, top - 27); c.closePath(); c.fillStyle = D.pinkDeep; c.fill();
    }
    c.beginPath(); c.moveTo(cx - w / 2 - 10, top + 8); c.bezierCurveTo(cx - w * 0.5, top - 46, cx + w * 0.5, top - 46, cx + w / 2 + 10, top + 8); c.closePath();
    c.fillStyle = col[1]; c.fill(); ink(c, 3.4, D.deep);                           // rounded roof = top of the head
    wobblyPoly(c, [[cx - w / 2, gy + 2], [cx - w / 2 + 1, top + 4], [cx + w / 2 - 1, top + 4], [cx + w / 2, gy + 2]], 31 + o.col, 1.4, 60);
    c.fillStyle = col[0]; c.fill(); ink(c, 3.4, D.deep);                           // walls
    const ey = top + h * 0.34;
    for (const sd of [-1, 1]) {                                                    // two round windows: the eyes
      c.beginPath(); c.ellipse(cx + sd * w * 0.24, ey, 13, 14.5, 0, 0, TAU); c.fillStyle = '#ffeeb0'; c.fill(); ink(c, 3, D.deep);
      c.beginPath(); c.ellipse(cx + sd * w * 0.24, ey, 2.8, 10.5, 0, 0, TAU); c.fillStyle = rgba('#27608a', 0.6); c.fill();
    }
    c.beginPath(); c.moveTo(cx - 6, ey + 20); c.lineTo(cx + 6, ey + 20); c.lineTo(cx, ey + 27); c.closePath(); c.fillStyle = D.pinkDeep; c.fill();
    c.strokeStyle = D.deep; c.lineWidth = 1.8; c.beginPath();                      // whiskers
    for (const sd of [-1, 1]) for (const dy of [-5, 2, 9]) { c.moveTo(cx + sd * (w / 2 - 16), ey + 24 + dy * 0.6); c.lineTo(cx + sd * (w / 2 + 20), ey + 22 + dy * 1.7); }
    c.stroke();
    const dw = 28, dh = Math.min(46, h * 0.4);                                     // the door, with a paw on it
    c.beginPath(); c.moveTo(cx - dw / 2, gy + 2); c.lineTo(cx - dw / 2, gy - dh * 0.55); c.bezierCurveTo(cx - dw / 2, gy - dh * 1.08, cx + dw / 2, gy - dh * 1.08, cx + dw / 2, gy - dh * 0.55); c.lineTo(cx + dw / 2, gy + 2); c.closePath();
    c.fillStyle = col[1]; c.fill(); ink(c, 3, D.deep);
    c.fillStyle = rgba(D.deep, 0.55); c.beginPath(); c.arc(cx, gy - dh * 0.4, 3.4, 0, TAU); c.fill();
    for (const a of [-0.9, -0.3, 0.3, 0.9]) { c.beginPath(); c.arc(cx + Math.sin(a) * 6.5, gy - dh * 0.4 - 3 - Math.cos(a) * 4.5, 1.7, 0, TAU); c.fill(); }
  });
  ctx.drawImage(s.c, x - s.w / 2, 8 - s.h, s.w, s.h);
}

// ── speech bubbles with tiny pictures: this is how the cats talk ──
export function drawIcon(ctx, icon, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1); ctx.lineJoin = ctx.lineCap = 'round';
  if (icon === 'heart') { heartPath(ctx, 0, 1, 7.5); ctx.fillStyle = '#ef7f9c'; ctx.fill(); }
  else if (icon === 'star') { starPath(ctx, 0, 0, 11, 0); ctx.fillStyle = '#f5bd2e'; ctx.fill(); }
  else if (icon === 'moon') {
    ctx.fillStyle = '#f2c93a'; ctx.beginPath(); ctx.arc(-1, 0, 10.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(4.5, -3, 9, 0, TAU); ctx.fill();
  } else if (icon === 'fish') {
    ctx.fillStyle = '#7fc0e8';
    ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(-15, -6); ctx.lineTo(-15, 6); ctx.closePath(); ctx.fill(); ink(ctx, 1.6, D.deep);
    ctx.beginPath(); ctx.ellipse(1, 0, 10.5, 6.2, 0, 0, TAU); ctx.fill(); ink(ctx, 1.6, D.deep);
    ctx.fillStyle = D.deep; ctx.beginPath(); ctx.arc(6, -1.5, 1.3, 0, TAU); ctx.fill();
  } else if (icon === 'tale') { drawBundle(ctx, 0, -9, 0, 0.6, 3); }
  else if (icon === 'book') {
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, -7); ctx.quadraticCurveTo(sd * 7, -11, sd * 13, -7); ctx.lineTo(sd * 13, 7); ctx.quadraticCurveTo(sd * 7, 3, 0, 7); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 1.8, D.deep); }
    ctx.strokeStyle = rgba(D.deep, 0.5); ctx.lineWidth = 1; ctx.beginPath(); for (const sd of [-1, 1]) for (const yy of [-3, 1]) { ctx.moveTo(sd * 3, yy); ctx.lineTo(sd * 10, yy - 1); } ctx.stroke();
  } else if (icon === 'tree') {
    tube(ctx, [[0, 11], [0, 0]], 3, D.bark, D.deep, 2);
    ctx.beginPath(); ctx.arc(0, -4, 9.5, 0, TAU); ctx.fillStyle = D.cloud; ctx.fill(); ink(ctx, 1.8, D.deep);
    starPath(ctx, 0, -4, 5, 0); ctx.fillStyle = '#f5bd2e'; ctx.fill();
  }
  ctx.restore();
}
export function drawBubble(ctx, x, y, icon, k, a, t, flip) {
  if (k <= 0.01) return;
  const s = ease.outBack(clamp01(k));
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.globalAlpha *= a === undefined ? 1 : a;
  ctx.save(); if (flip) ctx.scale(-1, 1);                        // the tail points at the speaker
  ctx.beginPath(); ctx.moveTo(-15, 14); ctx.lineTo(-23, 33); ctx.lineTo(-2, 19); ctx.closePath(); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 2.6, D.deep);
  wobble(ctx, circlePts(0, 0, 27, 12, 21), 61, 0.8); ctx.fillStyle = '#ffffff'; ctx.fill(); ink(ctx, 2.6, D.deep);
  ctx.beginPath(); ctx.moveTo(-13, 15.5); ctx.lineTo(-5, 18); ctx.lineWidth = 4.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
  ctx.restore();
  drawIcon(ctx, icon, 0, 0, 1 + 0.06 * Math.sin((t || 0) * 6));
  ctx.restore();
}

// ── hedge and garden gate ──
export function drawHedge(ctx, x0, x1, seed) {
  const w = x1 - x0, h = 84;
  const s = sprite('gd-hedge:' + Math.round(w) + ':' + seed, w + 24, h + 44, (c, W, H) => {
    const r = rng(seed), n = Math.max(2, Math.round(w / 54)), base = H - 8, L = 12;
    const shape = () => {
      const rr = rng(seed + 1);
      c.beginPath(); c.moveTo(L, base + 2); c.lineTo(L, base - h * 0.56);
      for (let i = 0; i < n; i++) { const xa = L + (w * i) / n, xb = L + (w * (i + 1)) / n; c.quadraticCurveTo((xa + xb) / 2, base - h * (0.98 + rr() * 0.3), xb, base - h * (0.56 + rr() * 0.08)); }
      c.lineTo(L + w, base + 2); c.closePath();
    };
    shape(); c.fillStyle = '#cdebd9'; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < n * 3; i++) { c.fillStyle = rgba(r() < 0.5 ? '#ffffff' : '#a8dcc2', 0.45); c.beginPath(); c.ellipse(L + r() * w, base - r() * h, 14 + r() * 10, 7 + r() * 5, r() * 3, 0, TAU); c.fill(); }
    c.restore();
    shape(); ink(c, 3.2, D.line);
    const list = [];
    for (let i = 0; i < n; i++) list.push([L + (w * (i + 0.5)) / n + (r() - 0.5) * 12, base - h * (0.42 + r() * 0.3), 9 + r() * 6, 1.6, r() < 0.5 ? 1 : -1, r() * 6]);
    spirals(c, list, 2, rgba(D.deep, 0.6));
    for (let i = 0; i < n * 2; i++) drawFlower(c, L + 8 + r() * (w - 16), base - 8 - r() * h * 0.5, 0.9 + r() * 0.4, r() < 0.5 ? '#ffffff' : '#ffe1ea');
  }, 1.5);
  ctx.drawImage(s.c, x0 - 12, 8 - s.h, s.w, s.h);
}
// open: 0..1 (both leaves swing in), flip: 0..1 (the sign turns from "book" to "tree of tales")
export function drawGate(ctx, x, open, flip, t) {
  const pw = 60;
  for (const sd of [-1, 1]) {                                   // the two leaves
    ctx.save(); ctx.translate(x + sd * pw, 0); ctx.scale(sd * (1 - 0.86 * ease.inOutQuad(clamp01(open))), 1);
    tube(ctx, [[-3, -30], [-pw + 3, -30]], 4, '#ffffff', D.deep, 3); tube(ctx, [[-3, -76], [-pw + 3, -76]], 4, '#ffffff', D.deep, 3);
    for (let i = 0; i < 4; i++) {
      const px = -9 - i * 13.4;
      wobblyPoly(ctx, [[px - 5, 2], [px - 5, -94], [px, -106], [px + 5, -94], [px + 5, 2]], 40 + i, 0.6, 60);
      ctx.fillStyle = i % 2 ? '#ffffff' : D.pink; ctx.fill(); ink(ctx, 2.4, D.deep);
    }
    ctx.restore();
  }
  for (const sd of [-1, 1]) {                                   // posts
    tube(ctx, [[x + sd * pw, 4], [x + sd * pw, -150]], 11, '#fff7e6', D.deep, 4);
    ctx.beginPath(); ctx.arc(x + sd * pw, -158, 9, 0, TAU); ctx.fillStyle = D.pink; ctx.fill(); ink(ctx, 3, D.deep);
  }
  tube(ctx, [[x - pw, -150], [x - pw * 0.6, -206], [x, -222], [x + pw * 0.6, -206], [x + pw, -150]], 8, '#fff7e6', D.deep, 4);   // arch
  // the sign
  const sw = Math.sin(t * 1.3) * 0.04, f = clamp01(flip), k = Math.abs(Math.cos(f * Math.PI));
  ctx.save(); ctx.translate(x, -214); ctx.rotate(sw);
  ctx.strokeStyle = D.deep; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(-16, 16); ctx.moveTo(16, 0); ctx.lineTo(16, 16); ctx.stroke();
  ctx.translate(0, 38); ctx.scale(Math.max(0.06, k), 1);
  wobblyPoly(ctx, [[-29, -23], [29, -23], [29, 23], [-29, 23]], 44, 0.8, 40); ctx.fillStyle = '#fffaf0'; ctx.fill(); ink(ctx, 3, D.deep);
  drawIcon(ctx, f < 0.5 ? 'book' : 'tree', 0, 1, 1.25);
  ctx.restore();
}

// ── basket for the picked tales ──
export function drawBasket(ctx, x, y, n, k, pop) {
  if (k <= 0.01) return;
  const s = ease.outBack(clamp01(k));
  ctx.save(); ctx.translate(x, y); ctx.scale(s * (1 + pop * 0.05), s * (1 - pop * 0.07));
  const slots = [[-15, -42, -0.25], [13, -43, 0.22], [-1, -50, 0.04], [-24, -36, -0.4], [24, -37, 0.38]];
  for (let i = 0; i < Math.min(n, slots.length); i++) drawBundle(ctx, slots[i][0], slots[i][1], slots[i][2], 0.62, 90 + i);
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-26, -24); ctx.bezierCurveTo(-26, -74, 26, -74, 26, -24); ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.stroke();
  ctx.lineWidth = 4.6; ctx.strokeStyle = '#d9b06a'; ctx.stroke();
  wobblyPoly(ctx, [[-30, -26], [30, -26], [23, 2], [-23, 2]], 95, 0.8, 40); ctx.fillStyle = '#ecc98a'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(150,100,40,0.45)'; ctx.lineWidth = 1.6; ctx.beginPath();
  for (let i = -3; i <= 3; i++) { ctx.moveTo(i * 9 - 4, -28); ctx.lineTo(i * 8 + 3, 4); }
  for (const yy of [-18, -9]) { ctx.moveTo(-32, yy); ctx.lineTo(32, yy + 1); }
  ctx.stroke(); ctx.restore();
  wobblyPoly(ctx, [[-30, -26], [30, -26], [23, 2], [-23, 2]], 95, 0.8, 40); ink(ctx, 2.8);
  wobblyPoly(ctx, [[-33, -31], [33, -31], [32, -24], [-32, -24]], 96, 0.6, 40); ctx.fillStyle = '#f3d79f'; ctx.fill(); ink(ctx, 2.6);
  ctx.restore();
}

// ── magic trees and the tales that grow on them ──
export class MagicTree {
  constructor(o) {
    this.x = o.x; this.h = o.h; this.r = o.r; this.seed = o.seed; this.col = o.col || D.cloud;
    this.b = { x: 0, v: 0 }; this.shim = 0;
  }
  get cy() { return -this.h - this.r * 0.3; }
  ring() { this.b.v += 5; this.shim = 1; }
  update(dt) { spring(this.b, 0, dt, 150, 9); if (this.shim > 0) this.shim = Math.max(0, this.shim - dt * 0.9); }
  _sway(t) { return Math.sin(t * 0.8 + this.seed) * 0.016 + this.b.x * 0.025; }
  // where something hung at (dx, dy) from the crown's centre is right now
  hang(dx, dy, t) {
    const a = this._sway(t), lx = dx, ly = -this.r * 0.3 + dy + this.b.x * 5, cs = Math.cos(a), sn = Math.sin(a);
    return { x: this.x + lx * cs - ly * sn, y: -this.h + lx * sn + ly * cs };
  }
  draw(ctx, t) {
    const x = this.x, ty = -this.h, bw = Math.max(9, this.r * 0.25);
    wobblyPoly(ctx, [[x - bw, 3], [x - bw * 0.55, ty * 0.2], [x - bw * 0.42, ty - 4], [x + bw * 0.42, ty - 4], [x + bw * 0.55, ty * 0.2], [x + bw, 3]], this.seed, 1.4, 60);
    ctx.fillStyle = D.bark; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = rgba(D.pink, 0.55); ctx.fillRect(x + bw * 0.12, ty, bw, -ty + 6); ctx.restore();
    ink(ctx, 3, D.line);
    spiralPath(ctx, x - 1, ty * 0.42, bw * 0.42, 1.5, 1, this.seed); ctx.strokeStyle = rgba(D.deep, 0.6); ctx.lineWidth = 1.8; ctx.stroke();
    const s = crownSprite(this.seed, this.r, this.col);
    ctx.save(); ctx.translate(x, ty); ctx.rotate(this._sway(t)); ctx.translate(0, -this.r * 0.3 + this.b.x * 5);
    ctx.scale(1 + this.b.x * 0.03, 1 - this.b.x * 0.05);
    ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  }
}

// A tale on the branch: first a bud, then a paper lantern with a little star inside that turns
// gold when it is ripe. (x, y) = where it hangs from; R = full size; k = growth 0..1; gold 0..1.
export function drawPod(ctx, x, y, R, k, gold, t, swing, seed) {
  const r = R * Math.max(0.1, k);
  ctx.save(); ctx.translate(x, y); ctx.rotate(swing || 0);
  ctx.strokeStyle = D.deep; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -R * 0.6); ctx.lineTo(0, 1); ctx.stroke();
  if (k < 0.28) {
    const bs = clamp01(k / 0.22); ctx.scale(bs, bs);
    wobble(ctx, [[0, 0], [-4.5, 6], [0, 13], [4.5, 6]], seed, 0.3); ctx.fillStyle = '#bfe8cf'; ctx.fill(); ink(ctx, 2, D.line);
  } else {
    if (gold > 0.02) glow(ctx, 0, r * 1.05, r * 3.4, D.gold, 0.6 * gold, 'source-over');
    wobble(ctx, [[0, 0], [-r * 0.84, r * 0.7], [-r * 0.8, r * 1.45], [0, r * 2.06], [r * 0.8, r * 1.45], [r * 0.84, r * 0.7]], seed, 0.4);
    ctx.fillStyle = gold > 0.02 ? mixHex('#ffffff', '#fff0b4', gold) : '#ffffff'; ctx.fill();
    ink(ctx, 2.4, gold > 0.5 ? D.goldDeep : D.line);
    ctx.strokeStyle = rgba(gold > 0.5 ? D.goldDeep : D.line, 0.5); ctx.lineWidth = 1.2; ctx.beginPath();
    ctx.moveTo(0, 1); ctx.quadraticCurveTo(-r * 0.46, r, 0, r * 2); ctx.moveTo(0, 1); ctx.quadraticCurveTo(r * 0.46, r, 0, r * 2); ctx.stroke();
    ctx.globalAlpha *= 0.3 + 0.7 * gold; ctx.fillStyle = '#f2b22e';
    starPath(ctx, 0, r * 1.08, r * (0.42 + 0.12 * gold) * (1 + 0.08 * Math.sin(t * 5 + seed)), t * 0.7 * gold); ctx.fill();
  }
  ctx.restore();
}

// The ancient tree: a tale has been growing on it for hundreds of years. x = trunk centre.
export function drawAncient(ctx, x, t) {
  const W = 780, H = 700;
  const s = sprite('gd-ancient', W, H, (c) => {
    const cx = W / 2, gy = H - 8, r = rng(808);
    c.lineJoin = c.lineCap = 'round';
    const trunk = () => wobblyPoly(c, [[cx - 122, gy + 2], [cx - 74, gy - 60], [cx - 58, gy - 180], [cx - 50, gy - 336], [cx + 50, gy - 336], [cx + 58, gy - 180], [cx + 74, gy - 60], [cx + 122, gy + 2]], 811, 2.2, 70);
    trunk(); c.fillStyle = '#f4f0f9'; c.fill();
    c.save(); c.clip();
    const g = c.createLinearGradient(cx - 120, 0, cx + 120, 0);
    g.addColorStop(0, 'rgba(184,172,220,0.5)'); g.addColorStop(0.32, 'rgba(255,255,255,0)'); g.addColorStop(0.72, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(150,196,228,0.55)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.restore();
    trunk(); ink(c, 4, D.deep);
    c.strokeStyle = rgba(D.deep, 0.45); c.lineWidth = 2;                                   // bark
    for (const dx of [-34, -8, 22, 44]) { c.beginPath(); c.moveTo(cx + dx * 1.6, gy - 6); c.bezierCurveTo(cx + dx * 1.1 + 10, gy - 110, cx + dx - 12, gy - 210, cx + dx * 0.9, gy - 322); c.stroke(); }
    spirals(c, [[cx - 14, gy - 150, 21, 2.3, 1, 1], [cx + 30, gy - 244, 13, 1.8, -1, 2], [cx - 38, gy - 62, 11, 1.6, 1, 4]], 2.2, rgba(D.deep, 0.7));
    const lobes = [[cx - 150, 152, 150, 100, '#9dd6e7'], [cx + 150, 152, 150, 100, '#9dd6e7'], [cx - 222, 262, 128, 94, '#8fd0e2'], [cx + 222, 262, 128, 94, '#8fd0e2'], [cx, 322, 196, 70, '#95d3e5'], [cx, 214, 252, 146, '#a6dbeb']];
    lobes.forEach((l, i) => {
      blobPath(c, l[0], l[1], l[2], l[3], 820 + i, 9, 0.14); c.fillStyle = l[4]; c.fill();
      c.save(); c.clip();
      const gg = c.createRadialGradient(l[0] - l[2] * 0.3, l[1] - l[3] * 0.5, 10, l[0], l[1], l[2] * 1.1);
      gg.addColorStop(0, 'rgba(255,255,255,0.6)'); gg.addColorStop(0.6, 'rgba(255,255,255,0.08)'); gg.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gg; c.fillRect(0, 0, W, H);
      c.restore();
      blobPath(c, l[0], l[1], l[2], l[3], 820 + i, 9, 0.14); ink(c, 4, D.line);
    });
    const list = [];
    for (let i = 0; i < 17; i++) { const l = lobes[i % lobes.length], a = r() * TAU, d = Math.sqrt(r()) * 0.68; list.push([l[0] + Math.cos(a) * l[2] * d, l[1] + Math.sin(a) * l[3] * d, 13 + r() * 22, 1.6 + r() * 0.8, r() < 0.5 ? 1 : -1, r() * TAU]); }
    spirals(c, list, 2.4, rgba(D.deep, 0.7));
    for (const hx of [-270, -150, -62, 70, 158, 262]) {                                    // old curls hanging down
      const x0 = cx + hx, y0 = (Math.abs(hx) > 200 ? 338 : 372) + r() * 14, pts = [];
      for (let i = 0; i <= 8; i++) pts.push([x0 + Math.sin(i * 0.9) * 5, y0 + i * (5 + r() * 2)]);
      chalk(c, pts, { color: D.line, width: 2, alpha: 0.85, seed: hx });
      spirals(c, [[x0, pts[8][1] + 7, 6, 1.4, 1, 0]], 1.8);
    }
  }, 1.5);
  const br = 1 + 0.005 * Math.sin(t * 0.7);
  ctx.save(); ctx.translate(x, 8); ctx.scale(1, br); ctx.drawImage(s.c, -W / 2, -H, W, H); ctx.restore();
}

// ── drooping saplings that the gardener cats look after ──
export class Sapling {
  constructor(x, seed) { this.x = x; this.seed = seed; this.perk = 0; this.b = { x: 0, v: 0 }; }
  update(dt) { spring(this.b, 0, dt, 160, 10); }
  draw(ctx, t) {
    const p = ease.inOutSine(clamp01(this.perk)), bend = 1 - p, x = this.x;
    const top = [x + bend * 30, -66 + bend * 30 - this.b.x * 4];
    tube(ctx, [[x, 2], [x + bend * 4, -34], top], 5.5, D.bark, D.line, 3.4);
    ctx.save(); ctx.translate(top[0], top[1]); ctx.rotate(bend * 0.95 + Math.sin(t * 1.1 + this.seed) * 0.03 * p);
    ctx.translate(0, -15); ctx.scale(lerp(0.86, 1, p) * (1 + this.b.x * 0.04), lerp(0.74, 1, p) * (1 - this.b.x * 0.05));
    const grey = crownSprite(this.seed, 27, '#d5dee3'), col = crownSprite(this.seed, 27, D.cloud);
    ctx.drawImage(grey.c, -grey.w / 2, -grey.h / 2, grey.w, grey.h);
    const a = ctx.globalAlpha; ctx.globalAlpha = a * p; ctx.drawImage(col.c, -col.w / 2, -col.h / 2, col.w, col.h); ctx.globalAlpha = a;
    for (let i = 0; i < 6; i++) {
      const an = (i / 6) * TAU + this.seed, k = clamp01((this.perk - 0.7 - i * 0.04) / 0.1);
      if (k > 0) drawFlower(ctx, Math.cos(an) * 17, Math.sin(an) * 13, ease.outBack(k) * 1.15, i % 2 ? '#ffffff' : '#ffe1ea');
    }
    ctx.restore();
  }
}

// ── watering can full of moon milk ──
export function drawCan(ctx, x, y, dir, tilt) {
  ctx.save(); ctx.translate(x, y); ctx.scale(dir, 1); ctx.rotate(tilt * 0.75);
  tube(ctx, [[10, -4], [26, -14], [30, -15]], 4.5, '#eef2f6', INK, 2.6);
  ctx.beginPath(); ctx.ellipse(31, -15.5, 3.5, 5.5, 0.3, 0, TAU); ctx.fillStyle = '#eef2f6'; ctx.fill(); ink(ctx, 2);
  ctx.beginPath(); ctx.arc(-13, -2, 9, Math.PI * 0.5, Math.PI * 1.5); ink(ctx, 3);
  wobblyPoly(ctx, [[-12, 8], [-11, -12], [11, -12], [12, 8]], 7, 0.6, 30); ctx.fillStyle = '#eef2f6'; ctx.fill(); ink(ctx, 2.4);
  ctx.beginPath(); ctx.ellipse(0, -12, 10, 3, 0, 0, TAU); ctx.fillStyle = D.milk; ctx.fill(); ink(ctx, 1.6);
  ctx.fillStyle = '#f2c93a'; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill(); ctx.fillStyle = '#eef2f6'; ctx.beginPath(); ctx.arc(2, -1.4, 3.8, 0, TAU); ctx.fill();
  ctx.restore();
}
export function canSpout(x, y, dir, tilt) {
  const a = tilt * 0.75, rx = 31 * Math.cos(a) + 15.5 * Math.sin(a), ry = 31 * Math.sin(a) - 15.5 * Math.cos(a);
  return { x: x + dir * rx, y: y + ry };
}

// ── the soil where a new tree may be dreamed up ──
export function drawMound(ctx, x, t, grown, pulse) {
  ctx.save();
  if (pulse > 0.01) glow(ctx, x, -6, 70, D.gold, 0.45 * pulse, 'source-over');
  wobble(ctx, [[x - 52, 3], [x - 34, -10], [x, -15], [x + 34, -10], [x + 52, 3], [x, 7]], 91, 1); ctx.fillStyle = '#ecd3bd'; ctx.fill(); ink(ctx, 3, D.deep);
  ctx.fillStyle = 'rgba(160,110,90,0.45)';
  for (const d of [[-24, -3], [-6, -8], [14, -5], [28, -1], [-36, 1]]) { ctx.beginPath(); ctx.arc(x + d[0], d[1], 1.8, 0, TAU); ctx.fill(); }
  if (!grown) {
    const sw = Math.sin(t * 2.2) * 0.14;
    ctx.save(); ctx.translate(x, -13); ctx.rotate(sw);
    tube(ctx, [[0, 0], [0, -11]], 2.4, '#a8dcc2', D.deep, 2);
    for (const sd of [-1, 1]) { wobble(ctx, [[0, -11], [sd * 9, -18], [sd * 3, -8]], 92 + sd, 0.3); ctx.fillStyle = '#bfe8cf'; ctx.fill(); ink(ctx, 1.8, D.deep); }
    ctx.restore();
  }
  tube(ctx, [[x + 66, 2], [x + 66, -34]], 4, '#fff7e6', D.deep, 3);
  wobblyPoly(ctx, [[x + 49, -53], [x + 84, -55], [x + 85, -32], [x + 50, -30]], 93, 0.8, 40); ctx.fillStyle = '#fffaf0'; ctx.fill(); ink(ctx, 2.6, D.deep);
  starPath(ctx, x + 67, -42.5, 7.5, 0); ctx.fillStyle = '#f5bd2e'; ctx.fill();
  ctx.restore();
}

// ── things the upright cats wear (drawn over a Cat in 'upright' mode) ──
// Everything worn on the body rides on the trunk of the rig: the frame below follows the shoulder
// (breath, the bob and lean of the walk, a bow), so a scarf or an apron moves with the cat instead of
// floating at a fixed offset. The garments are drawn in the trunk's rest coordinates (shoulder at
// (1, −41), hip at (−1.5, −26), as the upright rig stands still).
const REST_A = Math.atan2(2.5, 15);
function upright(ctx, cat) {
  cat.frame(ctx);
  const J = cat.J, hx = J.hip[0], hy = J.hip[1], sx = J.sh[0], sy = J.sh[1];
  const a = Math.atan2(sx - hx, hy - sy) - REST_A, k = clamp(Math.hypot(sx - hx, sy - hy) / 15.2, 0.85, 1.15);
  ctx.translate(sx, sy); ctx.rotate(a); ctx.scale(1, k); ctx.translate(-1, 41);
}
export function drawScarf(ctx, cat, col) {
  ctx.save(); upright(ctx, cat);
  tube(ctx, [[-7, -41], [-11, -31], [-8, -25]], 5, col, INK, 3);
  tube(ctx, [[-10, -44], [1, -41], [12, -44]], 5.5, col, INK, 3.2);
  ctx.restore();
}
export function drawBow(ctx, cat, col) {
  ctx.save(); upright(ctx, cat); ctx.translate(2, -41);
  for (const sd of [-1, 1]) { wobble(ctx, [[0, 0], [sd * 10, -5.5], [sd * 10, 5.5]], 5 + sd, 0.3); ctx.fillStyle = col; ctx.fill(); ink(ctx, 2); }
  ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, TAU); ctx.fillStyle = col; ctx.fill(); ink(ctx, 1.8);
  ctx.restore();
}
export function drawEarFlower(ctx, cat) {
  ctx.save(); cat.frame(ctx);
  const e = cat.localAnchor('ear');                       // tucked in at the ear the cat turns towards us (follows the head)
  drawFlower(ctx, e.x, e.y, 1.35, '#ffffff');
  ctx.restore();
}
export function drawApron(ctx, cat) {
  ctx.save(); upright(ctx, cat);
  wobblyPoly(ctx, [[-7, -38], [9, -38], [12, -13], [-9, -13]], 12, 0.5, 30); ctx.fillStyle = '#bfe8cf'; ctx.fill(); ink(ctx, 2.2);
  wobblyPoly(ctx, [[-2, -27], [7, -27], [7, -19], [-2, -19]], 13, 0.3, 30); ctx.fillStyle = '#e4f6ea'; ctx.fill(); ink(ctx, 1.6);
  ctx.restore();
}
