// Magic cats — a tree dreamed up by the player: it grows along the very stroke they drew.
// The compact data ({pts, n, seed}) is what gets saved (game.save.tree), so the same tree can
// be drawn again anywhere:   new DreamTree(save.tree).draw(ctx, x, groundY, t, scale)

import { TAU, rng, clamp, clamp01, lerp, ease } from '../util.js';
import { ink, tube } from '../paint.js';
import { D, crownSprite, drawFlower } from './garden-art.js';

const COLS = [D.cloud, D.pink, D.lilac, D.mint];

function resample(pts, step) {
  const out = [pts[0]];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (len < 0.001) continue;
    let d = step - carry;
    while (d <= len) { out.push([lerp(a[0], b[0], d / len), lerp(a[1], b[1], d / len)]); d += step; }
    carry = len - (d - step);
  }
  const last = pts[pts.length - 1], q = out[out.length - 1];
  if (Math.hypot(last[0] - q[0], last[1] - q[1]) > step * 0.4) out.push(last);
  return out;
}

export class DreamTree {
  // raw: [{x, y}] in world units, base: {x, y} where the trunk leaves the soil, n: number of blossoms
  static fromStroke(raw, base, n, seed) {
    let pts = [[0, 0]];
    for (const p of raw) pts.push([p.x - base.x, Math.min(-1, p.y - base.y)]);
    pts = resample(pts, 12);
    for (let k = 0; k < 2; k++) pts = pts.map((p, i) => (i === 0 || i === pts.length - 1 ? p : [(pts[i - 1][0] + 2 * p[0] + pts[i + 1][0]) / 4, (pts[i - 1][1] + 2 * p[1] + pts[i + 1][1]) / 4]));
    // a comfortable size whatever was drawn: 190…330 tall, not wider than 220 to either side
    let top = 0, wide = 1;
    for (const p of pts) { top = Math.min(top, p[1]); wide = Math.max(wide, Math.abs(p[0])); }
    const H = Math.max(30, -top);
    let k = 1;
    if (H < 190) k = 190 / H;
    if (H * k > 330) k = 330 / H;
    let kx = k;
    if (wide * kx > 220) kx = 220 / wide;
    pts = pts.map((p) => [p[0] * kx, p[1] * k]);
    if (pts.length > 26) { const out = []; for (let i = 0; i < 26; i++) out.push(pts[Math.round((i / 25) * (pts.length - 1))]); pts = out; }
    return { v: 1, pts: pts.map((p) => [Math.round(p[0]), Math.round(p[1])]), n: n || 0, seed: seed || 1 };
  }

  constructor(data) {
    this.data = data;
    const P = (this.P = data.pts.length > 1 ? data.pts : [[0, 0], [0, -200]]), n = P.length, seed = data.seed || 1;
    this.S = [0];
    for (let i = 1; i < n; i++) this.S.push(this.S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
    this.L = this.S[n - 1] || 1;
    const r = rng(seed);
    this.R = clamp(this.L * 0.25, 46, 80);
    // branches fork off the trunk, alternating sides
    this.branches = [];
    let side = r() < 0.5 ? -1 : 1;
    for (const u of this.L > 150 ? [0.42, 0.6, 0.79] : [0.55, 0.78]) {
      const a = this.at(u), len = clamp(this.L * 0.27, 40, 90) * (0.85 + r() * 0.3);
      let dx = a.nx * side * 0.9 + a.tx * 0.3, dy = a.ny * side * 0.9 + a.ty * 0.3 - 0.45;
      const d = Math.hypot(dx, dy) || 1;
      dx /= d; dy = Math.min(0.12, dy / d);
      const end = [a.x + dx * len, Math.min(-30, a.y + dy * len)];
      this.branches.push({ u, a: [a.x, a.y], c: [a.x + dx * len * 0.55, Math.min(-16, a.y + dy * len * 0.35 + 6)], end, w: lerp(9, 5, u) });
      side = -side;
    }
    // cloud crowns: one at each branch end, the biggest at the tip
    const ci = seed % COLS.length;
    this.crowns = this.branches.map((b, i) => ({ x: b.end[0], y: b.end[1] - this.R * 0.3, r: Math.round(this.R * (0.56 + r() * 0.1)), col: COLS[(ci + 1 + i) % COLS.length], seed: seed + 11 + i }));
    const tip = P[n - 1];
    this.main = { x: tip[0], y: Math.min(-40, tip[1] - this.R * 0.25), r: Math.round(this.R), col: COLS[ci], seed: seed + 7 };
    this.crowns.push(this.main);
    this.blossoms = [];
    for (let i = 0; i < (data.n || 0); i++) {
      const c = i % 3 === 0 || this.crowns.length === 1 ? this.main : this.crowns[Math.floor(r() * (this.crowns.length - 1))];
      const a = r() * TAU, d = Math.sqrt(r()) * c.r * 0.74;
      this.blossoms.push({ x: c.x + Math.cos(a) * d, y: c.y + Math.sin(a) * d * 0.78, k: 1, ph: r() * TAU, col: r() < 0.5 ? '#ffffff' : '#ffe1ea' });
    }
    this.g = 1;                                   // trunk + branches grown, 0..1
    this.ck = this.crowns.map(() => 1);           // each crown unfolded, 0..1
  }

  // point, tangent and normal at fraction u of the trunk
  at(u) {
    const s = clamp01(u) * this.L, S = this.S, P = this.P;
    let i = 1;
    while (i < S.length - 1 && S[i] < s) i++;
    const seg = S[i] - S[i - 1] || 1, f = clamp01((s - S[i - 1]) / seg);
    const j0 = Math.max(0, i - 2), j1 = Math.min(P.length - 1, i + 1);
    let tx = P[j1][0] - P[j0][0], ty = P[j1][1] - P[j0][1];
    const d = Math.hypot(tx, ty) || 1;
    tx /= d; ty /= d;
    return { x: lerp(P[i - 1][0], P[i][0], f), y: lerp(P[i - 1][1], P[i][1], f), tx, ty, nx: -ty, ny: tx };
  }

  // (bx, by) = where the trunk leaves the soil
  draw(ctx, bx, by, t, scale) {
    const g = clamp01(this.g);
    ctx.save(); ctx.translate(bx, by);
    if (scale && scale !== 1) ctx.scale(scale, scale);
    for (const b of this.branches) {
      const k = clamp01((g - b.u) / 0.22);
      if (k <= 0) continue;
      tube(ctx, [b.a, [lerp(b.a[0], b.c[0], k), lerp(b.a[1], b.c[1], k)], [lerp(b.a[0], b.end[0], k), lerp(b.a[1], b.end[1], k)]], b.w * (0.5 + 0.5 * k), D.bark, D.line, 3.2);
    }
    if (g > 0.01) {                               // the trunk: a tapering ribbon along the stroke
      const N = 22, L = [], R = [];
      for (let i = 0; i <= N; i++) {
        const u = (g * i) / N, a = this.at(u);
        const w = lerp(8.5, 3.2, Math.pow(u, 0.8)) * Math.min(1, (g - u) * 7 + 0.3) + (i === 0 ? 3.5 : i === 1 ? 1.5 : 0);
        L.push([a.x + a.nx * w, a.y + a.ny * w]); R.push([a.x - a.nx * w, a.y - a.ny * w]);
      }
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1] + 4);
      for (let i = 1; i <= N; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = N; i >= 1; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.lineTo(R[0][0], R[0][1] + 4); ctx.closePath();
      ctx.fillStyle = D.bark; ctx.fill(); ink(ctx, 3, D.line);
    }
    for (let i = 0; i < this.crowns.length; i++) {
      const c = this.crowns[i], k = this.ck[i];
      if (k <= 0.01) continue;
      const s = crownSprite(c.seed, c.r, c.col), sc = ease.outBack(clamp01(k));
      ctx.save(); ctx.translate(c.x, c.y + c.r * 0.3); ctx.rotate(Math.sin(t * 0.8 + c.seed) * 0.02); ctx.translate(0, -c.r * 0.3); ctx.scale(sc, sc);
      ctx.drawImage(s.c, -s.w / 2, -s.h / 2, s.w, s.h);
      ctx.restore();
    }
    for (const b of this.blossoms) if (b.k > 0.01) drawFlower(ctx, b.x, b.y, ease.outBack(clamp01(b.k)) * (1.05 + 0.07 * Math.sin(t * 2 + b.ph)), b.col);
    ctx.restore();
  }
}
