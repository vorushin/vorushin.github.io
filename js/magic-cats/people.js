// Magic cats — people: children (and grown-ups) as small rigged figures in the book's ink-and-gouache look.
// A bust for windows (drawBust) and a whole figure (drawFull), both from one skeleton.
//
// How it works
//   • Skeleton (local frame, facing +x when dir = 1, y down, origin = feet / sill / hands / resting line):
//     pelvis P → spine (lean) → chest C → shoulders, neck, head H; two arms (shoulder → elbow → wrist,
//     elbow by two-bone IK towards a pole point) and two legs (hip → knee → ankle, likewise).
//   • Channels: every number that shapes the figure (pelvis, lean, head offset/tilt/turn, wrists, elbow
//     poles, ankles, knee pole, face: smile/open/width/lids/happy eyes/brows/gaze, book) is a channel.
//     _pose() writes TARGETS for the current pose × mood (+ a running act); update() eases the current
//     values towards them, each channel at its own rate — so poses are moved into, never switched.
//   • Overlays on top of the eased pose, each with an eased weight: walk (phase from the distance really
//     moved), wave (forearm swinging about the elbow), cheer pumping, breathing, blinks, glances,
//     reading eyes and page turns, swinging legs; springs for pigtails / hair / skirt / the hang swing.
//   • Drawing: rig.js `inked` groups give one ink line round each silhouette (head + ears; torso + neck;
//     an arm with its sleeve and mitten; a leg with its shoe). Arms have a layer: 0 behind the body,
//     1 in front of it, 2 in front of the face. The line boils ~6×/s (still under reduced motion).
//   • drawHead(ctx, o) paints just a head with the same faces and hair, for scenes that paint people.

import { TAU, clamp, clamp01, lerp, approach, smooth, shade } from './util.js';
import { INK, isStill } from './paint.js';
import { blob, oval, boil, line, ik2 } from './rig.js';

// a lean rig.js `limb`: the centre line resampled with 3 steps per bone (not 5), caps of 4 points; same look at
// figure sizes, a third fewer vertices to rasterise. w: a number or [start, end].
function limb(pts, w) {
  const n = pts.length, W0 = typeof w === 'number' ? w : w[0], W1 = typeof w === 'number' ? w : w[1], STEPS = 3, P = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, t2 = t * t, t3 = t2 * t, h1 = 2 * t3 - 3 * t2 + 1, h2 = t3 - 2 * t2 + t, h3 = -2 * t3 + 3 * t2, h4 = t3 - t2;
      P.push([h1 * p1[0] + h2 * 0.5 * (p2[0] - p0[0]) + h3 * p2[0] + h4 * 0.5 * (p3[0] - p1[0]), h1 * p1[1] + h2 * 0.5 * (p2[1] - p0[1]) + h3 * p2[1] + h4 * 0.5 * (p3[1] - p1[1])]);
    }
  }
  P.push(pts[n - 1]);
  const m = P.length, L = new Array(m), Rr = new Array(m);
  let a0 = 0, a1 = 0;
  for (let i = 0; i < m; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(m - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const h = (W0 + (W1 - W0) * (i / (m - 1))) / 2;
    L[i] = [P[i][0] - dy * h, P[i][1] + dx * h]; Rr[i] = [P[i][0] + dy * h, P[i][1] - dx * h];
    if (i === 0) a0 = Math.atan2(dy, dx); if (i === m - 1) a1 = Math.atan2(dy, dx);
  }
  const out = L;
  const cap = (c, ang, h) => { for (let i = 1; i < 4; i++) { const u = ang + Math.PI / 2 - (i / 4) * Math.PI; out.push([c[0] + Math.cos(u) * h, c[1] + Math.sin(u) * h]); } };
  cap(P[m - 1], a1, W1 / 2);
  for (let i = m - 1; i >= 0; i--) out.push(Rr[i]);
  cap(P[0], a0 + Math.PI, W0 / 2);
  return out;
}

// rig.js `inked`, with the fills of neighbouring parts of the same colour merged into one path (fewer fills:
// rasterising is what a figure costs). Every outline is traced clockwise so overlaps never cancel out.
function traceCW(ctx, s) {
  const n = s.length;
  let a = 0; for (let i = 0, j = n - 1; i < n; j = i++) a += (s[j][0] - s[i][0]) * (s[j][1] + s[i][1]);
  const rev = a > 0, P = (i) => s[rev ? n - 1 - i : i];
  if (s.smooth) {
    const l = P(n - 1), f = P(0);
    ctx.moveTo((l[0] + f[0]) / 2, (l[1] + f[1]) / 2);
    for (let i = 0; i < n; i++) { const p = P(i), q = P((i + 1) % n); ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  } else { ctx.moveTo(P(0)[0], P(0)[1]); for (let i = 1; i < n; i++) ctx.lineTo(P(i)[0], P(i)[1]); }
  ctx.closePath();
}
// A group of tubes (stroked centre lines: {p: points, w: width, c: colour}) and shapes ({s: shape, c}) with one
// ink outline round the union: all the ink first, then the colours. A tube is 2 strokes of a 2–3 point path —
// far cheaper to rasterise than a limb outline polygon, and it looks the same (round caps, a soft joint).
function tubePath(ctx, p) {
  ctx.moveTo(p[0][0], p[0][1]);
  if (p.length === 2) { ctx.lineTo(p[1][0], p[1][1]); return; }
  const a = p[0], b = p[1], c = p[2];
  ctx.lineTo(a[0] + (b[0] - a[0]) * 0.72, a[1] + (b[1] - a[1]) * 0.72);
  ctx.quadraticCurveTo(b[0], b[1], b[0] + (c[0] - b[0]) * 0.28, b[1] + (c[1] - b[1]) * 0.28);
  ctx.lineTo(c[0], c[1]);
}
function group(ctx, items, lw) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
  let shapes = false;
  for (const it of items) if (it.p) { ctx.beginPath(); tubePath(ctx, it.p); ctx.lineWidth = it.w + lw * 2; ctx.stroke(); } else shapes = true;
  if (shapes) { ctx.beginPath(); for (const it of items) if (it.s) traceCW(ctx, it.s); ctx.lineWidth = lw * 2; ctx.stroke(); }
  for (let i = 0; i < items.length;) {
    const it = items[i];
    if (it.p) { ctx.beginPath(); tubePath(ctx, it.p); ctx.strokeStyle = it.c; ctx.lineWidth = it.w; ctx.stroke(); i++; continue; }
    ctx.beginPath(); let j = i;
    while (j < items.length && items[j].s && items[j].c === it.c) { traceCW(ctx, items[j].s); j++; }
    ctx.fillStyle = it.c; ctx.fill(); i = j;
  }
}
function inked(ctx, parts, lw) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (lw > 0) { ctx.beginPath(); for (let i = 0; i < parts.length; i++) traceCW(ctx, parts[i][0]); ctx.strokeStyle = INK; ctx.lineWidth = lw * 2; ctx.stroke(); }
  for (let i = 0; i < parts.length;) {
    const col = parts[i][1];
    if (!col) { i++; continue; }
    ctx.beginPath(); let j = i;
    while (j < parts.length && parts[j][1] === col) { traceCW(ctx, parts[j][0]); j++; }
    ctx.fillStyle = col; ctx.fill(); i = j;
  }
}

// Palette and character. hair skin shirt style are the old contract; the rest is new.
export const KIDS = {
  pigtails: { hair: '#ee7b2a', skin: '#f6d2b8', shirt: '#5aa9e6', style: 'pigtails', pants: '#f6d2b8', shoe: '#d64b3c', bobble: '#2f6fc0', dress: true, collar: '#fbf8ee', book: '#d9483b' },  // the girl on the cover
  spiky: { hair: '#f08a2a', skin: '#f3c9a8', shirt: '#e9c23a', style: 'spiky', pants: '#4f6fb0', shoe: '#c9473a', pocket: true, book: '#3f8a5a' },          // the reader in the tree
  bob: { hair: '#6b3f2a', skin: '#e8b890', shirt: '#e06a8a', style: 'bob', pants: '#4a3f78', shoe: '#5a3a2a', stripes: '#fbf3f0', clip: '#ffd84a', book: '#5aa9e6' },
  curly: { hair: '#2a2030', skin: '#c68a60', shirt: '#7fce8a', style: 'curly', pants: '#3f7f5a', shoe: '#f4f1ea', shorts: true, star: '#ffd84a', book: '#e9a23a' },
  blond: { hair: '#f2d066', skin: '#f6d2b8', shirt: '#b08ae0', style: 'mop', pants: '#6a58a8', shoe: '#3f3a62', buttons: '#fbf3dc', book: '#e06a8a' },
  bun: { hair: '#b9b3c6', skin: '#f0cbb0', shirt: '#9a6ab0', style: 'bun', pants: '#5a4a72', shoe: '#4a3a3a', body: 'adult', old: true, glasses: true, shawl: '#e8b4c8', dress: true, book: '#3f6fa8' },   // grandma
  cap: { hair: '#c4bfcc', skin: '#eec5a5', shirt: '#5a7ab0', style: 'cap', pants: '#5a5262', shoe: '#4a3a30', body: 'adult', old: true, cap: '#8a6f58', moustache: true, buttons: '#e9dcc0', book: '#8a4a3a' }, // grandpa
  papa: { hair: '#5a3a26', skin: '#eec5a5', shirt: '#4f8a6a', style: 'short', pants: '#3e3a56', shoe: '#3a2a22', body: 'adult', beard: true, collar: '#f4f1ea', book: '#d9483b' },
  mama: { hair: '#8a4a2a', skin: '#f6d2b8', shirt: '#d98a5a', style: 'long', pants: '#5a4a7a', shoe: '#7a3a3a', body: 'adult', necklace: '#ffe9a8', book: '#5aa9e6' }
};

const BODY = {
  // R head radius; spine pelvis→chest; neck chest→head centre; sw/hw half-widths of shoulders/hips;
  // up/fore arm bones; thigh/shin; tw/th scale the torso outline; stride = one step
  kid: { R: 11.2, spine: 18, neck: 13.6, sw: 7.0, hw: 3.6, up: 8.5, fore: 8.1, thigh: 8.4, shin: 8.2, armW: 4.3, legW: 5.6, standHip: -18.6, bustHip: 4, stride: 12, tw: 1, th: 1, lw: 1.9 },
  adult: { R: 9.8, spine: 27, neck: 13.4, sw: 9.6, hw: 5, up: 12.6, fore: 11.6, thigh: 16.8, shin: 16.8, armW: 4.9, legW: 6.4, standHip: -36.4, bustHip: 13.4, stride: 15, tw: 1.32, th: 1.5, lw: 1.9 }
};
const ARM0 = 16.6;                    // kid arm length: hand offsets in _pose are written for it and scaled

// channels
const NAMES = ['bx', 'by', 'lean', 'hx', 'hy', 'tilt', 'turn', 'lhx', 'lhy', 'rhx', 'rhy', 'lpx', 'lpy', 'rpx', 'rpy',
  'lfx', 'lfy', 'rfx', 'rfy', 'kp', 'shr', 'smile', 'open', 'mw', 'lid', 'hap', 'brow', 'lkx', 'lky', 'book', 'lha', 'rha', 'sad', 'wide'];
const C = {}; NAMES.forEach((n, i) => { C[n] = i; });
const NCH = NAMES.length;
const REBASE = ['bx', 'by', 'lhx', 'lhy', 'rhx', 'rhy', 'lfx', 'lfy', 'rfx', 'rfy'];
const poseClass = (p) => (p === 'hang' ? 'hang' : p === 'lie' ? 'lie' : 'base');
const RATE = new Float64Array(NCH);
for (let i = 0; i < NCH; i++) RATE[i] = 8;
[['bx', 6], ['by', 6], ['lean', 5], ['hx', 6], ['hy', 6], ['tilt', 5], ['turn', 5], ['lhx', 9], ['lhy', 9], ['rhx', 9], ['rhy', 9],
  ['lpx', 7], ['lpy', 7], ['rpx', 7], ['rpy', 7], ['lfx', 10], ['lfy', 10], ['rfx', 10], ['rfy', 10], ['kp', 6], ['shr', 6],
  ['smile', 7], ['open', 11], ['mw', 9], ['lid', 22], ['hap', 9], ['brow', 7], ['lkx', 12], ['lky', 12], ['book', 6], ['lha', 9], ['rha', 9], ['sad', 3], ['wide', 6]]
  .forEach(([n, r]) => { RATE[C[n]] = r; });

const ACTS = { yawn: 2.6, rubEyes: 2, clap: 1.7, nod: 1.1, point: 1.8, shrug: 1.2, stretch: 2.2 };

const MOUTH = '#a8435a', TONGUE = '#e98a96', BLUSH = 'rgba(240,120,130,0.36)', NOSE = 'rgba(150,80,60,0.75)';
const PAGE = '#f7f0dc';

// ── small helpers ──
const P2 = () => [0, 0];
function set2(a, x, y) { a[0] = x; a[1] = y; return a; }
// knee / elbow by IK, the joint on the side of the pole point
function ikPole(a, b, l1, l2, px, py, outJ, outB) {
  const s1 = ik2(a, b, l1, l2, 1), s2 = ik2(a, b, l1, l2, -1);
  const d1 = (s1[0][0] - px) ** 2 + (s1[0][1] - py) ** 2, d2 = (s2[0][0] - px) ** 2 + (s2[0][1] - py) ** 2;
  const s = d1 <= d2 ? s1 : s2;
  set2(outJ, s[0][0], s[0][1]); set2(outB, s[1][0], s[1][1]);
}
// the same with a continuous bend b (−1 … 1, eased by the caller so a joint never jumps to the other side);
// returns the side the pole asks for (+1 / −1)
function ikBend(a, b, l1, l2, px, py, bend, outJ, outB) {
  const s1 = ik2(a, b, l1, l2, 1), s2 = ik2(a, b, l1, l2, -1), j1 = s1[0], j2 = s2[0];
  const k = (bend + 1) / 2;
  set2(outJ, j2[0] + (j1[0] - j2[0]) * k, j2[1] + (j1[1] - j2[1]) * k); set2(outB, s1[1][0], s1[1][1]);
  return (j1[0] - px) ** 2 + (j1[1] - py) ** 2 <= (j2[0] - px) ** 2 + (j2[1] - py) ** 2 ? 1 : -1;
}
// the hair/face shapes are written for a kid head of radius 11.2; boil the control points
function bz(pts, seed, amp) { return blob(amp ? boil(pts, seed, amp) : pts); }
// an exact critically damped spring step (eases in and out; stable for any dt). s = [x, v]; returns x
function crit(x, v, target, w, dt, out, i) {
  const c1 = x - target, c2 = v + w * c1, e = Math.exp(-w * dt);
  out[i] = (c2 - w * (c1 + c2 * dt)) * e;           // new velocity
  return target + (c1 + c2 * dt) * e;
}
function env(u, a, b) { return u <= 0 || u >= 1 ? 0 : Math.min(1, smooth(u / a), smooth((1 - u) / b)); }

// ─────────────────────────────── the head ───────────────────────────────
// f: { turn, tilt, smile, open, mw, lid, hap, brow, lkx, lky, sway, pigL, pigR, back } ; drawn at (0, 0), kid size
// part: 'back' (hair behind the head) | 'front' (ears, face, features, hair on top)
function paintHead(ctx, k, f, bs, amp, part, lw) {
  const tt = clamp(f.turn || 0, -1, 1), at = Math.abs(tt), tx = tt * 3.3, st = k.style, adult = k.body === 'adult';
  const hair = k.hair, skin = k.skin, thin = lw * 0.62;
  if (part === 'back') {
    if (f.back) return;
    if (st === 'pigtails') pigtails(ctx, k, f, tt, bs, amp, lw);
    else if (st === 'long') {
      const sw = (f.sway || 0) * 2;
      inked(ctx, [[bz([[-12.6, -7], [-14.6, 3], [-15 + sw, 13], [-13 + sw, 19.5], [-7, 18], [0, 15.5], [7, 18], [13 + sw, 19.5], [15 + sw, 13], [14.6, 3], [12.6, -7]].map((p) => [p[0] - tt * 1.6, p[1]]), bs + 1, amp), hair]], lw);
    } else if (st === 'bun') {
      inked(ctx, [[bz(oval(-tt * 2.6, -14.2, 5.8, 5.2, 0, 9), bs + 2, amp), hair]], lw);
    } else if (st === 'bob') {
      inked(ctx, [[bz([[-13.2, -5], [-14.2, 6], [-12.4, 10.2], [-6, 9], [6, 9], [12.4, 10.2], [14.2, 6], [13.2, -5]].map((p) => [p[0] - tt * 1.2, p[1]]), bs + 3, amp), hair]], lw);
    } else if (st === 'curly') {
      const parts = [];
      for (let i = 0; i <= 8; i++) { const a = Math.PI * 0.86 + (i / 8) * Math.PI * 1.28, r = 12.6; parts.push([oval(Math.cos(a) * r - tt * 1.4, Math.sin(a) * r * 0.92 - 1.5, 4.6, 4.4, 0, 8), hair]); }
      inked(ctx, parts, lw);
    }
    return;
  }
  // ears + face: one silhouette
  const face = [[-11.2, -2], [-10.6, -8], [-6, -11.4], [0, -12], [6, -11.4], [10.6, -8], [11.2, -2], [10, 5], [5.5, 10], [0, 11.2], [-5.5, 10], [-10, 5]];
  for (const p of face) {
    const far = p[0] * tt > 0;
    if (far) p[0] *= 1 - 0.1 * at;
    if (p[1] > 3) p[0] += tt * 1.6 * (p[1] - 3) / 8;
    if (adult && p[1] > 2) p[1] *= 1.08;
  }
  const parts = [];
  for (const sd of [-1, 1]) {
    const far = sd * tt > 0;
    if (far && at > 0.55 && !f.back) continue;
    const ex = far ? sd * (11 - 2.4 * at) : sd * 11 + tt * 3.6;
    parts.push([bz(oval(ex, 0.6, 2.4, 3.1, 0, 7), bs + 5 + sd, amp * 0.6), skin]);
  }
  parts.push([bz(face, bs + 7, amp), skin]);
  inked(ctx, parts, lw);
  if (f.back) {                         // seen from behind: the whole face is hair (+ pigtails in front)
    inked(ctx, [[bz([[-11.6, 4], [-12.4, -7], [-7, -13.2], [0, -14], [7, -13.2], [12.4, -7], [11.6, 4], [8, 9.6], [0, 11], [-8, 9.6]], bs + 9, amp), hair]], lw);
    if (st === 'pigtails') { pigtails(ctx, k, f, 0, bs, amp, lw); bobbles(ctx, k, 0, lw); }
    else if (st === 'bun') inked(ctx, [[bz(oval(0, -11, 5.8, 5.2, 0, 9), bs + 2, amp), hair]], lw);
    return;
  }
  // inner ear stroke
  if (!f.lo) {
    ctx.beginPath();
    for (const sd of [-1, 1]) {
      const far = sd * tt > 0;
      if (far && at > 0.55) continue;
      const ex = far ? sd * (11 - 2.4 * at) : sd * 11 + tt * 3.6;
      ctx.moveTo(ex + sd * 0.3, -0.8); ctx.quadraticCurveTo(ex + sd * 1.2, 0.8, ex + sd * 0.2, 2.2);
    }
    ctx.strokeStyle = 'rgba(150,80,60,0.55)'; ctx.lineWidth = thin * 0.8; ctx.lineCap = 'round'; ctx.stroke();
  }
  const fy = clamp(f.lky || 0, -1, 1) * 1.1;
  ctx.save(); ctx.translate(0, fy);
  // blush
  const hap = f.hap || 0, smile = f.smile || 0;
  ctx.fillStyle = BLUSH; ctx.beginPath();
  for (const sd of [-1, 1]) {
    const far = sd * tt > 0, cx = tx + sd * 6.7 * (far ? 1 - 0.3 * at : 1 - 0.05 * at), rx = 2.6 * (far ? 1 - 0.3 * at : 1);
    ctx.moveTo(cx + rx, 4.4); ctx.ellipse(cx, 4.4, rx, 1.7 + hap * 0.2, 0, 0, TAU);
  }
  ctx.fill();
  // eyes
  const lid = f.lid === undefined ? 1 : f.lid, lkx = clamp(f.lkx || 0, -1, 1), lky = clamp(f.lky || 0, -1, 1);
  const wd = 1 + (f.wide || 0) * 0.3, ery = (adult ? 1.7 : 1.95) * wd, erx = (adult ? 1.4 : 1.6) * wd * (1 + (f.wide || 0) * 0.08), eyes = [];
  for (const sd of [-1, 1]) {
    const far = sd * tt > 0, ex = tx + sd * (adult ? 4.0 : 4.3) * (far ? 1 - 0.3 * at : 1 - 0.06 * at), sx = far ? 1 - 0.3 * at : 1, ey = 0.4;
    eyes.push(ex);
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    if (hap > 0.5) {
      ctx.lineWidth = 1.45; ctx.beginPath(); ctx.ellipse(ex, ey + 1.5, 2.3 * sx, 2.1, 0, Math.PI * 1.12, Math.PI * 1.88); ctx.stroke();
    } else if (lid < 0.3) {
      ctx.lineWidth = 1.35; ctx.beginPath(); ctx.ellipse(ex, ey - 0.3, 2.2 * sx, 1.6, 0, Math.PI * 0.12, Math.PI * 0.88); ctx.stroke();
      if (k.old) line(ctx, [[ex + sd * 2.6 * sx, ey - 0.4], [ex + sd * 3.6 * sx, ey - 1.2]], 0.7, 'rgba(29,21,48,0.4)');
    } else {
      const ry = ery * (0.35 + 0.65 * clamp01((lid - 0.3) / 0.7)), px = ex + lkx * 0.9 * sx, py = ey + lky * 0.75 + (1 - lid) * 0.5;
      if (sd < 0) ctx.beginPath();
      ctx.moveTo(px + erx * sx, py); ctx.ellipse(px, py, erx * sx, ry, 0, 0, TAU);
      if (sd > 0) { ctx.fillStyle = INK; ctx.fill(); }
      if (lid > 0.55 && !f.lo) (f._hl || (f._hl = [])).push(px + 0.5 * sx, py - 0.7);
      if (k.old && !f.lo) line(ctx, [[ex + sd * 2.7 * sx, ey + 0.3], [ex + sd * 3.6 * sx, ey - 0.4]], 0.7, 'rgba(29,21,48,0.4)');
    }
  }
  if (f._hl && f._hl.length) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); for (let i = 0; i < f._hl.length; i += 2) { ctx.moveTo(f._hl[i] + 0.55, f._hl[i + 1]); ctx.arc(f._hl[i], f._hl[i + 1], 0.55, 0, TAU); } ctx.fill(); f._hl.length = 0; }
  // brows
  const brow = f.brow || 0;
  for (let i = 0; i < 2; i++) {
    const sd = i ? 1 : -1, ex = eyes[i], far = sd * tt > 0, w = 2.1 * (far ? 1 - 0.3 * at : 1), y = -4.4 - brow * 1.1 - hap * 0.3;
    const sad = f.sad || 0, inY = y + 0.5 - sad * 1.7, outY = y + 0.5 + sad * 0.6;     // a wistful brow: up in the middle
    if (i === 0) ctx.beginPath();
    ctx.moveTo(ex - w, sd < 0 ? outY : inY); ctx.quadraticCurveTo(ex, y - 1.7 + sad * 0.4, ex + w, sd < 0 ? inY : outY);
    if (i === 1) { ctx.strokeStyle = k.old ? (k._brow || (k._brow = shade(hair, -0.35))) : 'rgba(29,21,48,0.6)'; ctx.lineWidth = k.old && k.style === 'cap' ? 1.5 : 1.05; ctx.lineCap = 'round'; ctx.stroke(); }
  }
  // nose
  const nx = tx * 1.15, nd = tt >= 0 ? 1 : -1;
  if (adult) line(ctx, [[nx + 0.2 * nd, 0.9], [nx + 1.5 * nd, 3.6], [nx - 0.2 * nd, 4.2]], 1.05, NOSE);
  else line(ctx, [[nx + 0.5 * nd, 2.1], [nx + 1.6 * nd, 3.4], [nx + 0.1 * nd, 3.9]], 1, NOSE);
  // beard (under the mouth), moustache
  if (k.beard) {
    const B = [[-10.9, -1], [-10.4, 5.2], [-5.9, 10.8], [0, 12.3], [5.9, 10.8], [10.4, 5.2], [10.9, -1], [9.2, 2.6], [6.4, 7.4], [3, 8.9], [0, 9.3], [-3, 8.9], [-6.4, 7.4], [-9.2, 2.6]];
    for (const p of B) { if (p[0] * tt > 0) p[0] *= 1 - 0.1 * at; p[0] += tt * (p[1] > 3 ? 1.8 : 0.4); }
    inked(ctx, [[bz(B, bs + 13, amp * 0.6), hair]], thin);
  }
  // mouth
  mouth(ctx, tx * 1.05, (adult ? 6.4 : 5.9) + (k.moustache ? 1.1 : k.beard ? 0.6 : 0), smile, (f.open || 0) * (k.beard ? 0.85 : 1), (f.mw === undefined ? 1 : f.mw) * (k.beard ? 1.35 : 1), adult ? 0.9 : 1);   // in a beard a mouth must be wider to read
  if (k.beard) { const up = Math.max(0, (f.open || 0) - 0.4) * 1.2; inked(ctx, [[bz([[nx - 4.4, 4.9 - up], [nx - 2, 3.6 - up], [nx, 4.2 - up], [nx + 2, 3.6 - up], [nx + 4.4, 4.9 - up], [nx + 2, 5.0 - up], [nx, 4.6 - up], [nx - 2, 5.0 - up]], bs + 14, amp * 0.4), hair]], thin * 0.8); }
  if (k.moustache) inked(ctx, [[bz([[nx - 4.2, 5.8], [nx - 2.2, 4.1], [nx, 4.8], [nx + 2.2, 4.1], [nx + 4.2, 5.8], [nx + 2.2, 5.6], [nx, 5.2], [nx - 2.2, 5.6]], bs + 15, amp * 0.4), shade(hair, 0.15)]], thin * 0.7);
  if (k.glasses) {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.05;
    for (let i = 0; i < 2; i++) { const sd = i ? 1 : -1, far = sd * tt > 0; ctx.beginPath(); ctx.ellipse(eyes[i], 0.5, 3.3 * (far ? 1 - 0.3 * at : 1), 3.1, 0, 0, TAU); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(eyes[0] + 3.2, 0.2); ctx.quadraticCurveTo(tx, -0.8, eyes[1] - 3.2, 0.2); ctx.stroke();
  }
  ctx.restore();
  hairFront(ctx, k, f, tt, tx, bs, amp, lw);
  if (st === 'pigtails') bobbles(ctx, k, tt, lw, f.lo);
}

function mouth(ctx, cx, y0, s, o, mw, sc) {
  const w = 2.75 * mw * sc, cy = y0 - s * 0.6 - Math.max(0, o - 0.8) * 1.2;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = INK;
  if (o < 0.08) {
    const dB = s * 2.3 - 0.2;
    ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.bezierCurveTo(cx - w * 0.5, cy + dB * 1.33, cx + w * 0.5, cy + dB * 1.33, cx + w, cy); ctx.stroke();
    return;
  }
  const dT = s * 0.55 - o * (1.3 - s * 0.75), dB = s * 1.4 + o * 3.3, rnd = clamp01((o - 0.6) / 0.6) * (1 - s);   // a big round mouth (yawn) has round corners
  const path = () => {
    ctx.beginPath(); ctx.moveTo(cx - w, cy);
    ctx.bezierCurveTo(cx - w * lerp(0.55, 1.05, rnd), cy + dT * 1.33, cx + w * lerp(0.55, 1.05, rnd), cy + dT * 1.33, cx + w, cy);
    ctx.bezierCurveTo(cx + w * lerp(0.75, 1.1, rnd), cy + dB * 1.33, cx - w * lerp(0.75, 1.1, rnd), cy + dB * 1.33, cx - w, cy);
    ctx.closePath();
  };
  path(); ctx.fillStyle = MOUTH; ctx.fill();
  if (o > 0.75 && s < 0.4) { ctx.fillStyle = '#5e1a2c'; ctx.beginPath(); ctx.ellipse(cx, cy + dB * 0.5 + dT * 0.2, w * 0.62, Math.max(0.6, (dB - dT) * 0.36), 0, 0, TAU); ctx.fill(); }   // the throat of a yawn
  if (o > 0.35 && dB > 2.4 && s > 0.45) { ctx.save(); path(); ctx.clip(); ctx.fillStyle = TONGUE; ctx.beginPath(); ctx.ellipse(cx, cy + dB * 0.95, w * 0.6, dB * 0.38, 0, 0, TAU); ctx.fill(); ctx.restore(); }
  path(); ctx.lineWidth = 1.2; ctx.stroke();
}

// pigtails: tied high (ear-top level), narrow at the bobble, flaring out and a little up; springy
function pigRoot(sd, tt) { const far = sd * tt > 0; return [sd * (10.4 - (far ? 2.6 : -0.4) * Math.abs(tt)) - tt * 1.0, -6.4]; }
function pigtails(ctx, k, f, tt, bs, amp, lw) {
  for (const sd of [-1, 1]) {
    const r = pigRoot(sd, tt), rx = r[0], ry = r[1];
    const sp = sd < 0 ? (f.pigL || 0) : (f.pigR || 0), a = -0.32 + sp;          // out and slightly up, plus the spring
    const c = Math.cos(a), s = Math.sin(a);
    const T = [[0, -1.5], [3.6, -2.3], [7.4, -3.9], [10.8, -4.9], [12.9, -3.3], [11.9, -1.4], [13.7, 0.5], [12.2, 2.6], [8.2, 3.1], [4, 2.3], [0, 1.5]];
    const pts = T.map((p) => [rx + sd * (p[0] * c - p[1] * s), ry + p[0] * s + p[1] * c]);
    inked(ctx, [[bz(pts, bs + 21 + sd, amp), k.hair]], lw);
    const q = (u, v) => [rx + sd * (u * c - v * s), ry + u * s + v * c];
    if (!f.lo) line(ctx, [q(3.6, -0.2), q(7.6, -1.1), q(11, -1.6)], lw * 0.45, 'rgba(29,21,48,0.3)');
  }
}
function bobbles(ctx, k, tt, lw, lo) {
  for (const sd of [-1, 1]) {
    if (sd * tt > 0.6) continue;
    const r = pigRoot(sd, tt);
    inked(ctx, [[oval(r[0] + sd * 0.4, r[1], 2.25, 2.25, 0, 8), k.bobble || '#2f6fc0']], lw * 0.75);
    if (!lo) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.beginPath(); ctx.arc(r[0] + sd * 0.4 - 0.6, r[1] - 0.8, 0.65, 0, TAU); ctx.fill(); }
  }
}

function hairFront(ctx, k, f, tt, tx, bs, amp, lw) {
  const st = k.style, hair = k.hair, sh = tt * 0.8, sway = f.sway || 0;
  const S = (pts) => pts.map((p) => [p[0] + sh, p[1]]);
  let top = null;
  if (st === 'pigtails') top = [[-12.2, 0.5], [-12.7, -8], [-7.6, -13.3], [0, -14.3], [7.6, -13.3], [12.7, -8], [12.2, 0.5], [10.4, -3.8], [6.2 + tx, -6.2], [1.6 + tx, -7.4], [tx * 1.1, -6.2], [-1.6 + tx, -7.4], [-6.2 + tx, -6.2], [-10.4, -3.8]];
  else if (st === 'spiky') {
    const q = sway * 1.6;
    top = [[-12, -1.5], [-14.2 + q, -10.4], [-9.4, -9.6], [-9.2 + q, -17.6], [-4, -12.4], [-0.6 + q, -20.4], [3, -12.8], [8.4 + q, -18.6], [9.2, -10.8], [14.4 + q, -12.6], [12, -1.5], [8.6, -6.4], [2 + tx, -8.2], [-5 + tx, -7.2], [-9, -5]];
  } else if (st === 'bob') top = [[-13.4, 8.6], [-14.2, -3.6], [-11.2, -12], [-4, -14.9], [4, -14.9], [11.2, -12], [14.2, -3.6], [13.4, 8.6], [10.6, 8.8], [10.4, 0], [9.6, -5.2], [3 + tx, -5.9], [-3 + tx, -5.9], [-9.6, -5.2], [-10.4, 0], [-10.6, 8.8]];
  else if (st === 'mop') top = [[-12.4, 1], [-13.2, -7], [-9.2, -12.9], [-2, -14.7], [5, -14.2], [11, -11.2], [13.2, -6], [12.4, 1], [10.6, -3], [7.4 + tx, -5], [4.2 + tx, -3.8], [1 + tx, -5.4], [-2.2 + tx, -3.9], [-5.4 + tx, -5.6], [-8.6, -3.8], [-10.8, -2]];
  else if (st === 'short' || st === 'cap') top = [[-11.8, -0.5], [-12.4, -8], [-8, -12.9], [0, -13.8], [8, -12.9], [12.4, -8], [11.8, -0.5], [10.8, -4.5], [9, -7.6], [3 + tx, -8.6], [-2 + tx, -7.4], [-5.5 + tx, -8.4], [-9.5, -7], [-10.8, -3.6]];
  else if (st === 'bun') top = [[-11.9, -0.5], [-12.5, -8], [-8, -13], [0, -13.9], [8, -13], [12.5, -8], [11.9, -0.5], [10.6, -5], [7, -8.6], [2 + tx, -9.4], [tx, -8.4], [-2 + tx, -9.4], [-7, -8.6], [-10.6, -5]];
  else if (st === 'long') top = [[-12.6, 6], [-12.9, -8], [-7.8, -13.5], [0, -14.4], [7.8, -13.5], [12.9, -8], [12.6, 6], [11, 1], [9.6, -4.4], [5 + tx, -6.4], [-3 + tx, -8.6], [-8 + tx, -5.8], [-10.6, -1.4], [-11, 4]];
  if (st === 'curly') {
    const parts = [];
    for (let i = 0; i <= 6; i++) { const a = Math.PI * 1.08 + (i / 6) * Math.PI * 0.84; parts.push([oval(Math.cos(a) * 10.4 + sh, Math.sin(a) * 9.6 - 3.2, 4.4, 4.0, 0, 8), hair]); }
    for (let i = 0; i < 4; i++) parts.push([oval(-6.6 + i * 4.4 + tx * 0.8, -7.2 + (i % 2) * 0.8, 3.2, 3, 0, 8), hair]);
    inked(ctx, parts, lw);
    if (!f.lo) { ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 0.9; ctx.beginPath();
      for (let i = 0; i < 5; i++) { const cx = -8 + i * 4 + sh, cy = -10.5 + (i % 2) * 1.6; ctx.moveTo(cx - 1.6, cy); ctx.arc(cx, cy, 1.6, Math.PI, TAU * 0.9); } ctx.stroke(); }
    return;
  }
  if (top) {
    inked(ctx, [[bz(S(top), bs + 31, amp), hair]], lw);
    // a few strands
    const strand = f.lo ? null : 'rgba(29,21,48,0.28)';
    if (strand)
    { if (!strand) {} else if (st === 'pigtails' || st === 'bun') line(ctx, [[tx * 1.1 + sh, -6.6], [tx * 0.6 + sh, -10.5], [sh - 0.5, -13.4]], 0.8, strand);
    else if (st === 'short' || st === 'cap') line(ctx, [[3 + tx + sh, -8.4], [5 + sh, -11.2], [8 + sh, -12]], 0.8, strand);
    else if (st === 'bob' || st === 'long' || st === 'mop') line(ctx, [[-6 + sh, -7], [-1 + sh, -12.6], [5 + sh, -13]], 0.8, strand); }
  }
  if (st === 'mop') {        // the cowlick
    const q = sway * 1.4;
    inked(ctx, [[limb([[1.4 + sh, -13.6], [2.2 + sh + q * 0.4, -16.4], [4.4 + sh + q, -17]], [2.2, 1.1]), hair]], lw * 0.7);
  }
  if (st === 'bob' && k.clip) inked(ctx, [[bz([[-9.4 + sh, -7.4], [-5.2 + sh, -9.4], [-4.6 + sh, -8], [-8.8 + sh, -6]], bs + 33, amp * 0.5), k.clip]], lw * 0.6);
  if (st === 'cap') {
    const cc = k.cap || '#8a6f58', b = tt * 2.4;
    inked(ctx, [[bz([[-12.8, -4], [-12.9, -9.6], [-8.4, -15], [0, -16.2], [8.4, -15], [12.9, -9.6], [12.8, -4]].map((p) => [p[0] + sh, p[1]]), bs + 35, amp), cc],
      [bz([[-13.4 + b, -6.2], [0 + b * 1.4, -7.4], [13.4 + b, -6.2], [14.6 + b * 1.8, -3.2], [0 + b * 1.6, -4.2], [-14 + b, -3.2]], bs + 36, amp * 0.6), shade(cc, -0.18)]], lw);
    ctx.fillStyle = shade(cc, -0.3); ctx.beginPath(); ctx.arc(sh, -15.6, 1.2, 0, TAU); ctx.fill();
  }
}

// ─────────────────────────────── an open book, pages towards us ───────────────────────────────
// a, b: the wrists holding its outer bottom corners; the pages make a shallow V, tilted back towards the reader
function drawBook(ctx, ax, ay, bxp, byp, col, page, lw, bs, amp, lo, flat) {
  const cx = (ax + bxp) / 2, cy = (ay + byp) / 2, ang = Math.atan2(byp - ay, bxp - ax) * 0.6, hw = Math.max(6, Math.hypot(bxp - ax, byp - ay) / 2 + 0.6);
  const h = hw * 0.78, dip = hw * 0.16;
  ctx.save(); ctx.translate(cx, cy - h * 0.38); ctx.rotate(ang);
  // cover: a rim round the pages
  const cov = [[-hw - 0.9, -h * 0.5 - 0.4], [0, -h * 0.5 + dip + 0.6], [hw + 0.9, -h * 0.5 - 0.4], [hw + 0.9, h * 0.5 + 0.9], [0, h * 0.5 + dip + 1.4], [-hw - 0.9, h * 0.5 + 0.9]];
  inked(ctx, [[cov, col]], lw * 0.85);
  // pages
  const pg = (sd) => [[0, -h * 0.5 + dip], [sd * hw * 0.5, -h * 0.5 - 0.2], [sd * hw, -h * 0.5 + 0.3], [sd * hw, h * 0.5], [sd * hw * 0.5, h * 0.5 - 0.2], [0, h * 0.5 + dip]];
  for (const sd of [-1, 1]) {
    const q = pg(sd);
    ctx.beginPath(); ctx.moveTo(q[0][0], q[0][1]); ctx.quadraticCurveTo(q[1][0], q[1][1] - 0.6, q[2][0], q[2][1]); ctx.lineTo(q[3][0], q[3][1]); ctx.quadraticCurveTo(q[4][0], q[4][1] - 0.6, q[5][0], q[5][1]); ctx.closePath();
    ctx.fillStyle = PAGE; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.5; ctx.lineJoin = 'round'; ctx.stroke();
    // a few lines of text
    ctx.strokeStyle = 'rgba(29,21,48,0.38)'; ctx.lineWidth = Math.max(0.55, h * 0.07); ctx.lineCap = 'round';
    ctx.beginPath();
    for (let r = 0; r < 4; r += lo ? 2 : 1) {
      const v = -h * 0.28 + r * h * 0.19, x0 = sd * hw * 0.16, x1 = sd * hw * (r === 3 ? 0.55 : 0.84), y0 = v + dip * 0.8, y1 = v + 0.15;
      ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  }
  if (page > 0 && page < 1) {              // a page lifts off the right side and lies down on the left
    const u = smooth(page), ex = hw * Math.cos(Math.PI * u), lift = Math.sin(Math.PI * u) * h * (flat ? 0.22 : 0.5);   // (in a window the book is under the chin: a low page)
    const q = [[0, -h * 0.5 + dip], [ex * 0.55, -h * 0.5 - lift * 0.8], [ex, -h * 0.5 - lift + 0.3], [ex, h * 0.5 - lift * 0.7], [ex * 0.55, h * 0.5 - lift * 0.5], [0, h * 0.5 + dip]];
    inked(ctx, [[q, PAGE]], lw * 0.5);
  }
  ctx.restore();
}

// a mitten: wrist w, forearm direction (dx, dy), angle twist a; thumb on side ts
function mitten(w, dx, dy, a, ts, size, open) {
  const c = Math.cos(a), s = Math.sin(a), ux = dx * c - dy * s, uy = dx * s + dy * c, nx = -uy * ts, ny = ux * ts;
  const r = 2.75 * size, cx = w[0] + ux * r * 0.7, cy = w[1] + uy * r * 0.7, rot = Math.atan2(uy, ux);
  const palm = oval(cx, cy, r * (open ? 1.08 : 1), r * (open ? 0.92 : 0.86), rot, 8);
  const th = oval(cx - ux * r * 0.15 + nx * r * 0.82, cy - uy * r * 0.15 + ny * r * 0.82, r * 0.42, r * 0.36, rot + ts * 0.9, 5);
  return [palm, th];
}

// ─────────────────────────────── the person ───────────────────────────────
export class Kid {
  constructor(o) {
    o = o || {};
    this.kind = o.kind || 'pigtails';
    this.k = Object.assign({}, KIDS[this.kind] || KIDS.pigtails, o.colors || {});
    this.B = BODY[this.k.body || 'kid'];
    this.x = o.x || 0; this.y = o.y || 0; this.size = o.size || 1; this.dir = o.dir || 1;
    this.mood = o.mood || 'wait';     // 'wait' | 'happy' | 'sleep' | 'read' | 'wave' | 'wistful' | 'wonder' (+ full figures: 'hug' | 'hold')
    this.pose = o.pose || 'stand';    // full figure: 'stand' | 'walk' | 'sit' | 'hang' | 'lie'
    this.look = null;                 // {x, y} world point to look at
    this.turn = null;                 // head turn −1 … 1 (null: by itself / towards `look`)
    this.seed = o.seed || Math.floor(Math.random() * 1e5);
    this.walk = 0;                    // walk phase (still accepted: a scene may advance it)
    this.joy = { x: 0, v: 0 };
    this.hidden = false;
    this.cur = new Float64Array(NCH); this.tgt = new Float64Array(NCH); this.vel = new Float64Array(NCH); this._pv = new Float64Array(4);
    this._mode = 'full';              // which framing the targets are for (bust | full)
    this._t = 0; this._lastDraw = -1; this._upd = false;
    this._blink = 1 + Math.random() * 3; this._blinkT = 0;
    this._glance = 1 + Math.random() * 3; this._gaze = [0, 0]; this._gturn = 0;
    this._phase = 0; this._lastWalk = 0; this._px = this.x; this._py = this.y; this._moved = 0; this._spd = 0;
    this._w = { walk: 0, wave: 0, waveL: 0, pump: 0, swing: 0, read: 0, sleep: 0, dep: 0, hk: 0 };
    this._act = null;                 // { kind, t, dur }
    this._page = -1; this._pageIn = 3 + Math.random() * 3;
    this._sigh = 6 + Math.random() * 6; this._sighT = 0;
    this._pig = [{ x: 0, v: 0 }, { x: 0, v: 0 }]; this._hair = { x: 0, v: 0 }; this._skirt = { x: 0, v: 0 };
    this._sw = { x: 0, v: 0 };         // hang swing angle
    this._hv = [0, 0]; this._hp = null;
    this._lastPose = this.pose; this._lastMood = this.mood; this._dir = this.dir; this._cls = poseClass(this.pose);
    this.wind = null;                 // {x, y}: the air streaming past the figure (world units/s) — hair, pigtails, skirt follow it
    this._bend = [0, 0, 0, 0]; this._bendTo = [0, 0, 0, 0]; this._wakeT = 0; this._popT = -1; this._legSw = { x: 0, v: 0 }; this._em = this.mood; this._peek = 6 + Math.random() * 6; this._peekT = 0;
    this.G = { P: P2(), Cc: P2(), H: P2(), S: [P2(), P2()], E: [P2(), P2()], W: [P2(), P2()], F: [P2(), P2()], hop: 0, Hp: [P2(), P2()], K: [P2(), P2()], A: [P2(), P2()], rot: 0 };
    this._anc = { hand: { x: 0, y: 0 }, handL: { x: 0, y: 0 }, handR: { x: 0, y: 0 }, headTop: { x: 0, y: 0 }, head: { x: 0, y: 0 }, lap: { x: 0, y: 0 } };
    this._snap = true;
  }

  // a cheer: a little dip, then the pop (and the happy mood)
  cheer() { this.mood = 'happy'; if (this._wakeT > 0 || this._popT >= 0) return; this.joy.v -= 4; this._popT = 0.11; }
  // one-off bits of acting: 'yawn' | 'rubEyes' | 'clap' | 'nod' | 'point' | 'shrug' | 'stretch'
  act(kind) { if (ACTS[kind]) this._act = { kind, t: 0, dur: ACTS[kind] }; return ACTS[kind] || 0; }
  get acting() { return this._act ? this._act.kind : null; }
  // a world point (as last drawn): 'hand' (= 'handR', the near hand), 'handL', 'head' (centre), 'headTop', 'lap'
  anchor(name) { return this._anc[name] || this._anc.headTop; }
  // What the figure stands (sits, hangs) on moved by (dx, dy) world units since the last update: a cloud, a sill,
  // a boat. Call it each frame along with moving x/y; that part of the motion is then neither steps nor air speed.
  carry(dx, dy) {
    this._px += dx; this._py += dy;
    if (this._hp) { this._hp[0] += dx; this._hp[1] += dy; }
  }

  update(dt) {
    if (!(dt > 0)) return;
    dt = Math.min(dt, 0.1);
    this._upd = true; this._t += dt;
    const still = isStill();
    if (this.dir !== this._dir) { this._mirror(); this._dir = this.dir; }
    // moods: waking up comes first (eyes open, head lifts), then whatever was asked for
    if (this.mood !== this._lastMood) {
      if (this._lastMood === 'sleep' && this.mood !== 'wait') this._wakeT = 0.65;
      if (this.mood === 'happy' && this._popT < 0 && this._wakeT <= 0) { this.joy.v -= 4; this._popT = 0.11; }
      if (this.mood === 'sleep') this._sigh = 5 + Math.random() * 5;
      if (this.mood === 'wistful') { this._wistT = 0; this._wistBook = this._lastMood === 'read'; }
    }
    if (this.mood === 'wistful') { const w0 = this._wistT || 0; this._wistT = w0 + dt; if (w0 < 0.9 && this._wistT >= 0.9) this._sighT = 1.8; }
    if (this._wakeT > 0) { this._wakeT -= dt; if (this._wakeT <= 0 && this.mood === 'happy') { this.joy.v -= 4; this._popT = 0.11; } }
    this._em = this._wakeT > 0 ? 'wait' : this.mood;
    // the joy spring (cheer, hops): a dip, then the pop
    const j = this.joy;
    if (this._popT >= 0) { this._popT -= dt; if (this._popT < 0) { j.v += 13; this._pig[0].v += 3; this._pig[1].v += 3; } }
    j.v += (-140 * j.x - 9 * j.v) * dt; j.x += j.v * dt;
    // blinks, glances, sighs, page turns
    this._blink -= dt;
    if (this._blink < 0) { this._blinkT = 0.13; this._blink = Math.random() < 0.2 ? 0.25 : 2 + Math.random() * 3.5; }
    if (this._blinkT > 0) this._blinkT -= dt;
    this._glance -= dt;
    if (this._glance < 0) {
      this._glance = 1.6 + Math.random() * 3.2;
      const r = Math.random();
      if (still) { this._gaze[0] = 0; this._gaze[1] = 0; this._gturn = 0; }
      else if (r < 0.45) { this._gaze[0] = 0; this._gaze[1] = 0; this._gturn = 0; }
      else { this._gaze[0] = (Math.random() - 0.5) * 1.8; this._gaze[1] = (Math.random() - 0.5) * 0.8; this._gturn = this._gaze[0] * 0.25; }
    }
    this._peek -= dt;
    if (this._peek < 0) { this._peekT = 1.1; this._peek = 7 + Math.random() * 7; }
    if (this._peekT > 0) this._peekT -= dt;
    if (this.mood === 'read') {
      this._pageIn -= dt;
      if (this._page >= 0) { this._page += dt / 0.7; if (this._page >= 1) this._page = -1; }
      else if (this._pageIn < 0) { this._page = 0; this._pageIn = 4 + Math.random() * 3; }
    } else this._page = -1;
    if (this.mood === 'sleep') { this._sigh -= dt; if (this._sigh < 0) { this._sighT = 1.8; this._sigh = 7 + Math.random() * 8; } }
    if (this._sighT > 0) this._sighT -= dt;
    if (this._act) { this._act.t += dt; if (this._act.t >= this._act.dur) this._act = null; }
    // walking: the phase follows the distance really moved (or a scene's own `walk`)
    const dx = this.x - this._px, dy = this.y - this._py;
    this._px = this.x; this._py = this.y;
    const tele = Math.abs(dx) > 40 * this.size || Math.abs(dy) > 40 * this.size;
    const loc = tele ? 0 : (dx * this.dir) / this.size;
    const dw = this.walk - this._lastWalk; this._lastWalk = this.walk;
    if (this.pose === 'walk') {
      this._phase += (loc / this.B.stride) * Math.PI + (Math.abs(dw) < 3 ? dw : 0);
      if (Math.abs(loc) > 0.01 || Math.abs(dw) > 1e-4) this._moved = 0.25;
    }
    this._moved -= dt;
    this._spd = approach(this._spd, tele ? 0 : dx / dt / this.size * this.dir, 8, dt);
    // overlay weights
    const W = this._w, m = this._em, full = this._mode === 'full', sn = this._snap;
    const w = (n, v, r) => { W[n] = sn ? v : approach(W[n], v, r, dt); };
    w('walk', this.pose === 'walk' && this._moved > 0 ? 1 : 0, 7);
    w('wave', m === 'wave' && this.pose !== 'hang' && this.pose !== 'lie' ? 1 : 0, 6);
    w('waveL', 0, 6);                // (the far arm only waves for a moment after a turn round)
    w('pump', m === 'happy' && this.pose !== 'hang' && this.pose !== 'lie' ? 1 : 0, 5);
    w('read', m === 'read' ? 1 : 0, 4);
    w('sleep', m === 'sleep' || (this.pose === 'lie' && m === 'wait') ? 1 : 0, 2);
    w('swing', this.pose === 'sit' && full ? 1 : 0, 3);
    w('dep', this.pose === 'lie' && full ? 1 : 0, 6);         // lying: seen from the side (shoulders and hips in depth)
    w('hk', this.pose === 'hang' && full ? 1 : 0, 6);         // hanging: arms stretched a little
    // pose targets, eased channels
    this._pose(this.tgt, this._t);
    const cur = this.cur, tgt = this.tgt;
    const cls = poseClass(this.pose);
    if (cls !== this._cls && !this._snap && full) {        // the origin means something else now (feet / hands / resting line):
      const a = this._sw.x;
      if (a) {                     // bake the swing into the pose
        const ca = Math.cos(a), sa = Math.sin(a), px = cur[C.bx], py = cur[C.by];
        const rot = (nx, ny, about) => { const x = cur[C[nx]] - (about ? px : 0), y = cur[C[ny]] - (about ? py : 0); cur[C[nx]] = (about ? px : 0) + x * ca - y * sa; cur[C[ny]] = (about ? py : 0) + x * sa + y * ca; };
        cur[C.bx] = px * ca - py * sa; cur[C.by] = px * sa + py * ca;
        const qx = cur[C.bx], qy = cur[C.by];
        for (const [nx, ny] of [['lhx', 'lhy'], ['rhx', 'rhy'], ['lfx', 'lfy'], ['rfx', 'rfy']]) { const x = cur[C[nx]] - px, y = cur[C[ny]] - py; cur[C[nx]] = qx + x * ca - y * sa; cur[C[ny]] = qy + x * sa + y * ca; }
        rot('lpx', 'lpy', false); rot('rpx', 'rpy', false); rot('hx', 'hy', false);
        cur[C.lean] += a; void rot;
      }
      const ddx = tgt[C.bx] - cur[C.bx], ddy = tgt[C.by] - cur[C.by];
      for (const n of REBASE) { cur[C[n]] += n.charAt(n.length - 1) === 'x' ? ddx : ddy; }
      this._sw.x = 0; this._sw.v = 0; this._legSw.x = 0; this._legSw.v = 0;
    }
    this._cls = cls;
    if (this._snap || !this._bendInit) { if (this._bendInit) for (let i = 0; i < 4; i++) this._bend[i] = this._bendTo[i]; }
    else for (let i = 0; i < 4; i++) this._bend[i] = approach(this._bend[i], this._bendTo[i], 9, dt);
    if (this._snap) { cur.set(tgt); this.vel.fill(0); this._pv.fill(0); this._snap = false; this._needBend = true; }
    else {
      const sleepy = m === 'sleep' ? 0.38 : 1;             // falling asleep is slow; waking is not
      const hx0 = cur[C.lhx], hy0 = cur[C.lhy], hx1 = cur[C.rhx], hy1 = cur[C.rhy], vel = this.vel;
      for (let i = 0; i < NCH; i++) cur[i] = crit(cur[i], vel[i], tgt[i], 1.25 * RATE[i] * (i === C.lid ? (m === 'sleep' ? 0.12 : 1) : sleepy), dt, vel, i);
      // hands move in arcs about the shoulder (the outward way round), not in straight lines through the body
      const wh = 1.25 * RATE[C.lhx] * sleepy, pv = this._pv;
      for (let i = 0; i < 2; i++) {
        const sd = i ? 1 : -1, sh = this._shoulderOf(cur, sd), ix = i ? C.rhx : C.lhx, iy = i ? C.rhy : C.lhy;
        const ox = (i ? hx1 : hx0) - sh[0], oy = (i ? hy1 : hy0) - sh[1], tx = tgt[ix] - sh[0], ty = tgt[iy] - sh[1];
        const rc = Math.hypot(ox, oy), rt = Math.hypot(tx, ty);
        if (rc < 0.5 || rt < 0.5) continue;
        const ac = Math.atan2(oy, ox), at = Math.atan2(ty, tx), out = sd > 0 ? 0 : Math.PI;
        let d = at - ac; while (d > Math.PI) d -= TAU; while (d < -Math.PI) d += TAU;
        if (Math.abs(d) > 2.2) { const alt = d > 0 ? d - TAU : d + TAU, mid = (q) => { let u = ac + q / 2 - out; while (u > Math.PI) u -= TAU; while (u < -Math.PI) u += TAU; return Math.abs(u); }; if (mid(alt) < mid(d)) d = alt; }
        const a = crit(ac, pv[i * 2], ac + d, wh, dt, pv, i * 2), r = crit(rc, pv[i * 2 + 1], rt, wh, dt, pv, i * 2 + 1);
        cur[ix] = sh[0] + Math.cos(a) * r; cur[iy] = sh[1] + Math.sin(a) * r;
      }
    }
    // springs: hair follows the head's motion; the hang swing trails the speed
    const hx = this.x + cur[C.bx] * this.size * this.dir, hy = this.y + (cur[C.by] - this.B.spine - this.B.neck) * this.size - j.x * 3 * this.size;
    if (this._hp) {
      const vx = (hx - this._hp[0]) / dt, vy = (hy - this._hp[1]) / dt, ax = (vx - this._hv[0]) / dt, ay = (vy - this._hv[1]) / dt;
      this._hv[0] = vx; this._hv[1] = vy;
      if (!tele && !still) {          // the head is shoved about: the hair lags (tips go down when it is pushed up)
        const kx = clamp(ax * this.dir / this.size, -2500, 2500), ky = clamp(ay / this.size, -2500, 2500);
        this._pig[0].v += (-ky * 0.07 + kx * 0.025) * dt;
        this._pig[1].v += (-ky * 0.07 - kx * 0.025) * dt;
        this._hair.v += -kx * 0.05 * dt; this._skirt.v += (-kx * 0.04 - ky * 0.02) * dt;
      }
    }
    this._hp = [hx, hy];
    // wind: the air flowing towards −x (local) streams the pigtails back (the far one straight back, the near one down), the
    // hair and the skirt hem; a flutter on top. Off (null) by default, then the springs rest at 0 as before.
    let wP0 = 0, wP1 = 0, wH = 0;
    if (this.wind && !still) {
      const wl = clamp(-(this.wind.x * this.dir) / 220, -1, 1), wu = clamp(-this.wind.y / 400, -0.5, 0.5), fl = Math.sin(this._t * 13 + this.seed) * 0.07 * Math.abs(wl);
      wP0 = 0.34 * wl - wu * 0.3 + fl; wP1 = 0.55 * wl - wu * 0.3 - fl; wH = -0.75 * wl;
    }
    { const s0 = this._pig[0], s1 = this._pig[1];
      s0.v += (-90 * (s0.x - wP0) - 4 * s0.v) * dt; s0.x = clamp(s0.x + s0.v * dt, -0.6, 0.7);
      s1.v += (-90 * (s1.x - wP1) - 4 * s1.v) * dt; s1.x = clamp(s1.x + s1.v * dt, -0.6, 0.7); }
    { const s = this._hair; s.v += (-110 * (s.x - wH) - 7 * s.v) * dt; s.x = clamp(s.x + s.v * dt, -1, 1); }
    { const s = this._skirt; s.v += (-110 * (s.x - wH * 0.7) - 7 * s.v) * dt; s.x = clamp(s.x + s.v * dt, -1, 1); }
    if (this.pose === 'hang') {          // the body trails behind the speed of the hands and swings back when it stops
      const target = clamp(this._spd * 0.0024, -0.6, 0.6);      // (moving +x: the feet trail towards −x)
      this._sw.v += (-22 * (this._sw.x - target) - 1.3 * this._sw.v) * dt; this._sw.x += this._sw.v * dt;
      const L = this._legSw; L.v += (-60 * (L.x - this._sw.x) - 5 * L.v) * dt; L.x += L.v * dt;     // the legs a beat later
    } else { this._sw.x = approach(this._sw.x, 0, 6, dt); this._sw.v = 0; this._legSw.x = this._sw.x; this._legSw.v = 0; }
    this._lastPose = this.pose; this._lastMood = this.mood;
    this._solve(this._lastDraw >= 0 ? this._lastDraw + dt : this._t); this._anchors();
  }
  _anchors() {
    const G = this.G, A = this._anc, B = this.B;
    this._toWorld(A.hand, G.F[1][0], G.F[1][1]); this._toWorld(A.handR, G.F[1][0], G.F[1][1]); this._toWorld(A.handL, G.F[0][0], G.F[0][1]); this._toWorld(A.head, G.H[0], G.H[1]);
    this._toWorld(A.headTop, G.H[0] + Math.sin(G.rot) * B.R * 1.3, G.H[1] - Math.cos(G.rot) * B.R * 1.3);
    this._toWorld(A.lap, (G.P[0] + G.K[0][0] + G.K[1][0]) / 3, Math.min(G.P[1], (G.K[0][1] + G.K[1][1]) / 2) - 2);
  }

  _shoulderOf(T, sd) {
    const B = this.B, ln = T[C.lean], ux = Math.sin(ln), uy = -Math.cos(ln), cx = T[C.bx] + ux * B.spine, cy = T[C.by] + uy * B.spine;
    const side = this._mode === 'bust' ? 1 : lerp(1, 0.22, this._w.dep);
    return [cx + Math.cos(ln) * sd * side * B.sw - ux * (2.5 - T[C.shr]), cy + Math.sin(ln) * sd * side * B.sw - uy * (2.5 - T[C.shr])];
  }
  // dir flipped: mirror the eased state, so the drawing is the same this frame and then moves into the new pose
  _mirror() {
    const c = this.cur, sw = (a, b) => { const t = c[C[a]]; c[C[a]] = c[C[b]]; c[C[b]] = t; };
    sw('lhx', 'rhx'); sw('lhy', 'rhy'); sw('lpx', 'rpx'); sw('lpy', 'rpy'); sw('lfx', 'rfx'); sw('lfy', 'rfy'); sw('lha', 'rha');
    for (const n of ['bx', 'hx', 'lhx', 'rhx', 'lpx', 'rpx', 'lfx', 'rfx', 'lean', 'tilt', 'turn', 'lkx', 'lha', 'rha']) c[C[n]] = -c[C[n]];
    { const v = this.vel, sv = (a, b) => { const t = v[C[a]]; v[C[a]] = v[C[b]]; v[C[b]] = t; };
      sv('lhx', 'rhx'); sv('lhy', 'rhy'); sv('lpx', 'rpx'); sv('lpy', 'rpy'); sv('lfx', 'rfx'); sv('lfy', 'rfy'); sv('lha', 'rha');
      for (const n of ['bx', 'hx', 'lhx', 'rhx', 'lpx', 'rpx', 'lfx', 'rfx', 'lean', 'tilt', 'turn', 'lkx', 'lha', 'rha']) v[C[n]] = -v[C[n]];
      this._pv.fill(0); }
    if (this.pose === 'lie' || this.pose === 'sit') { /* lying/sitting figures face along x: the body itself turns (eased from the mirror) */ }
    const b = this._bend; let q = b[0]; b[0] = -b[1]; b[1] = -q; q = b[2]; b[2] = -b[3]; b[3] = -q;
    const p = this._pig; const t = p[0]; p[0] = p[1]; p[1] = t;
    { const W = this._w, q = W.wave; W.wave = W.waveL; W.waveL = q; }
    this._hair.x = -this._hair.x; this._sw.x = -this._sw.x; this._sw.v = -this._sw.v; this._legSw.x = -this._legSw.x;
    this._gaze[0] = -this._gaze[0]; this._gturn = -this._gturn; this._spd = -this._spd;
    if (this._layer) { const l = this._layer[0]; this._layer[0] = this._layer[1]; this._layer[1] = l; }
  }

  // ── targets: pose × mood (+ act) ──
  _pose(T, t) {
    const B = this.B, m0 = this._em || this.mood, m = m0 === 'wistful' || m0 === 'wonder' ? 'wait' : m0, ps = this.pose, bust = this._mode === 'bust', as = (B.up + B.fore) / ARM0, ls = (B.thigh + B.shin) / 17.4;
    const put = (n, v) => { T[C[n]] = v; };
    const shoulder = (sd) => {          // target shoulder position from the target pelvis + lean
      const ln = T[C.lean], ux = Math.sin(ln), uy = -Math.cos(ln);
      const cx = T[C.bx] + ux * B.spine, cy = T[C.by] + uy * B.spine;
      return [cx + Math.cos(ln) * sd * B.sw - ux * (2.5 - T[C.shr]), cy + Math.sin(ln) * sd * B.sw - uy * (2.5 - T[C.shr])];
    };
    const hand = (sd, dx, dy) => { const s = shoulder(sd); put(sd < 0 ? 'lhx' : 'rhx', s[0] + dx * as); put(sd < 0 ? 'lhy' : 'rhy', s[1] + dy * as); };
    const handAt = (sd, x, y) => { put(sd < 0 ? 'lhx' : 'rhx', x); put(sd < 0 ? 'lhy' : 'rhy', y); };
    const pole = (sd, dx, dy) => { put(sd < 0 ? 'lpx' : 'rpx', dx * as); put(sd < 0 ? 'lpy' : 'rpy', dy * as); };
    const foot = (sd, x, y) => { put(sd < 0 ? 'lfx' : 'rfx', x); put(sd < 0 ? 'lfy' : 'rfy', y); };
    const face = (smile, open, mw, lid, hap, brow) => { put('smile', smile); put('open', open); put('mw', mw); put('lid', lid); put('hap', hap); put('brow', brow); };
    // defaults
    put('hx', 0); put('hy', 0); put('tilt', 0); put('turn', 0); put('shr', 0); put('book', 0); put('lha', 0); put('rha', 0); put('kp', -0.15);
    put('lkx', 0); put('lky', 0); put('sad', 0); put('wide', 0);
    this._layer = this._layer || [0, 1];
    const L = this._layer; L[0] = 0; L[1] = 1;
    face(0.35, 0, 1, 1, 0, 0);
    if (bust) {
      put('bx', 0); put('by', B.bustHip); put('lean', 0.04);
      foot(-1, -B.hw, B.bustHip + 16); foot(1, B.hw, B.bustHip + 16);
      L[0] = 1; L[1] = 1;
      const sill = -1.6;
      if (m === 'happy') {
        put('by', B.bustHip - 1.2); put('lean', -0.02); put('shr', 1.6);
        hand(-1, -7.0, -13.6); hand(1, 7.0, -13.6); pole(-1, -16, 2); pole(1, 16, 2);
        put('lha', -0.3); put('rha', 0.3); L[0] = 2; L[1] = 2;        // in a window the raised hands come in front of the pigtails
        face(1, 0.7, 1.3, 1, 1, 0.6);
      } else if (m === 'wave') {
        put('by', B.bustHip - 0.6); put('tilt', -0.06);
        handAt(-1, -3.2, sill); pole(-1, -12, 6);
        hand(1, 4.4, -15.4); pole(1, 11, 4); put('rha', 0); L[1] = 2;
        face(0.85, 0.3, 1, 1, 0, 0.45);
      } else if (m === 'read') {
        put('by', B.bustHip + 1.4); put('lean', 0.08); put('hy', 2.2); put('tilt', 0.05);
        handAt(-1, -7.8 * as, -7.8); handAt(1, 7.8 * as, -7.8); pole(-1, -12, 8); pole(1, 12, 8);
        put('book', 1); face(0.2, 0, 0.9, 0.8, 0, 0.2); put('lky', 1);
      } else if (m === 'sleep') {
        // asleep on the folded forearms: elbows out on the sill, the cheek on the arms
        put('by', B.bustHip + 2); put('lean', 0.03); put('hx', 6 * (B.R / 11.2)); put('hy', 9.6 * (B.R / 11.2)); put('tilt', 0.6); put('shr', 1);
        handAt(-1, -3.4 * as, -5.6); handAt(1, 4.2 * as, -4.8); pole(-1, -20, 6); pole(1, 20, 6);
        put('lha', 0.15); put('rha', -0.15);
        face(0, 0.22, 0.45, 0, 0, -0.1);
      } else {          // wait: leaning on the sill, looking out
        put('by', B.bustHip + 1.2); put('lean', 0.08); put('shr', 1.4); put('tilt', 0.03);
        handAt(-1, -3.4, sill); handAt(1, 3.6, sill + 0.4); pole(-1, -13, 5); pole(1, 13, 5);
        face(0.35, 0, 1, 1, 0, 0);
      }
    } else if (ps === 'sit') {
      put('bx', -1); put('by', -3.6 * ls); put('lean', -0.03); put('kp', -1.2);
      foot(-1, (-1 - B.hw + 8.6) * ls, 5.4 * ls); foot(1, (-1 + B.hw + 9.4) * ls, 4.8 * ls);
      L[0] = 0; L[1] = 1;
      if (m === 'happy') { hand(-1, -8.4, -13.4); hand(1, 8.4, -13.4); pole(-1, -16, 2); pole(1, 16, 2); face(1, 0.7, 1.3, 1, 1, 0.6); L[0] = 1; }
      else if (m === 'wave') { handAt(-1, -9 * as, -2); pole(-1, -10, 4); hand(1, 6, -14); pole(1, 14, 2); face(0.85, 0.3, 1, 1, 0, 0.45); }
      else if (m === 'read') {
        put('lean', 0.08); put('hy', 1.4); put('tilt', 0.08);
        handAt(-1, -4 * ls, -15 * ls); handAt(1, 10 * ls, -15.6 * ls); pole(-1, -6, 14); pole(1, 6, 14); L[0] = 1;
        put('book', 1); face(0.2, 0, 0.9, 0.8, 0, 0.2); put('lky', 1); put('lkx', 0.3); put('turn', 0.25);
      } else if (m === 'sleep') {
        put('lean', 0.1); put('hy', 3); put('tilt', 0.35);
        handAt(-1, 1, -5 * ls); handAt(1, 6 * ls, -5 * ls); pole(-1, -6, 10); pole(1, 6, 10); L[0] = 1;
        face(0, 0.2, 0.45, 0, 0, -0.1);
      } else { handAt(-1, -9.2 * as, -2.4); handAt(1, 7 * as, -2.6); pole(-1, -10, 4); pole(1, 6, 8); }
    } else if (ps === 'hang') {
      // (x, y) = the hands; the body hangs below them (and is swung as a whole in drawing)
      const gx = 10.5 * (B.R / 11.2), reach = (B.up + B.fore) * 1.22 * 0.97, sh = 4 + Math.sqrt(Math.max(1, reach * reach - (gx - B.sw) ** 2)), cy = sh + 2.5 - 2.6;
      put('bx', 0); put('by', cy + B.spine); put('lean', 0); put('shr', 2.6); put('hy', 3.5);
      handAt(-1, -gx, 4); handAt(1, gx, 4); pole(-1, -18, -4); pole(1, 18, -4);
      put('kp', -0.6);
      const hipY = cy + B.spine, leg = B.thigh + B.shin;
      foot(-1, -B.hw + 1, hipY + leg * 0.9); foot(1, B.hw + 3, hipY + leg * 0.82);
      L[0] = 1; L[1] = 1;
      put('lha', 0); put('rha', 0);
      if (m === 'happy' || m === 'wave') { face(1, 0.7, 1.3, 1, 1, 0.6); foot(1, B.hw + 6 * ls, hipY + leg * 0.7); }
      else if (m === 'sleep') face(0, 0.2, 0.45, 0, 0, -0.1);
      else face(0.5, 0.15, 1, 1, 0, 0.3);
    } else if (ps === 'lie') {
      // lying on the back, head to +x, the resting line at y = 0
      const th = 8.6 * B.tw * 0.62;
      put('bx', -7); put('by', -th); put('lean', Math.PI / 2); put('tilt', -0.95); put('hy', -4.2); put('hx', 1.5);
      put('kp', -Math.PI / 2 - 0.2);
      foot(-1, -7 - 16.9 * ls, -2.8 * ls); foot(1, -7 - 13.4 * ls, -2.6 * ls);
      handAt(-1, 17 * ls, -2.4); handAt(1, -5 * ls, -th * 1.7); pole(-1, 8, 6); pole(1, -2, 9);
      put('lha', -0.6); L[0] = 0; L[1] = 1;
      if (m === 'happy' || m === 'wave') { face(1, 0.6, 1, 1, 1, 0.5); hand(1, 4, -15); pole(1, 12, 0); }
      else if (m === 'read') { face(0.2, 0, 0.9, 0.85, 0, 0.2); put('book', 1); handAt(-1, 2, -th * 2 - 7); handAt(1, 12, -th * 2 - 7); }
      else if (m === 'sleep' || m === 'wait') face(0.1, 0.2, 0.45, 0, 0, -0.1);
    } else {           // stand / walk
      const hip = B.standHip;
      put('bx', 0); put('by', hip); put('lean', ps === 'walk' ? 0.05 : 0);
      foot(-1, -B.hw - 0.2, -2.6); foot(1, B.hw + 0.4, -2.6);
      hand(-1, -2.2, 15.6); hand(1, 2.6, 15.4); pole(-1, -4, 2); pole(1, 4, 2);
      put('lha', 0); put('rha', 0);
      L[0] = 0; L[1] = 1;
      if (m === 'happy') { hand(-1, -8.4, -13.4); hand(1, 8.4, -13.4); pole(-1, -16, 2); pole(1, 16, 2); face(1, 0.7, 1.3, 1, 1, 0.6); L[0] = 1; L[1] = 1; }
      else if (m === 'wave') { hand(1, 6.5, -14); pole(1, 14, 2); face(0.85, 0.3, 1, 1, 0, 0.45); }
      else if (m === 'read') {
        put('hy', 1.4); put('tilt', 0.08); put('lean', 0.03);
        put('hy', 2); put('tilt', 0.06); put('lean', 0.04);
        const s = shoulder(1); handAt(-1, s[0] - 14.2 * as, s[1] + 7.6 * as); handAt(1, s[0] + 2.6 * as, s[1] + 7.6 * as);
        pole(-1, -6, 14); pole(1, 8, 14); L[0] = 1; L[1] = 1;
        put('book', 1); face(0.2, 0, 0.9, 0.8, 0, 0.2); put('lky', 1);
      } else if (m === 'sleep') { put('hy', 2.5); put('tilt', 0.3); face(0, 0.2, 0.45, 0, 0, -0.1); }
      else if (m === 'hug') {          // arms round something just in front (a tree trunk), cheek against it
        put('lean', 0.1); put('tilt', 0.16); put('turn', 0.35); put('hx', 1.5);
        hand(-1, 11.5, 3.5); hand(1, 13, 1.5); pole(-1, -2, 10); pole(1, 4, 10); L[0] = 1; L[1] = 1;
        face(1, 0, 1, 1, 1, 0.3);
      } else if (m === 'hold') {       // the near hand forward at the waist, holding something (place it at anchor('hand'))
        hand(1, 6.5, 11.5); pole(1, -2, 12); put('rha', -0.4); face(0.45, 0, 1, 1, 0, 0.1);
      }
    }
    // gaze: towards `look`, else idle glances
    if (this.look && m !== 'sleep') {
      const H = this.G.H, wx = (this.look.x - (this.x + H[0] * this.size * this.dir)) * this.dir, wy = this.look.y - (this.y + H[1] * this.size);
      const d = Math.hypot(wx, wy) || 1;
      put('lkx', (wx / d) * 1.0); put('lky', clamp((wy / d) * 1.0, -1, 1));
      put('turn', clamp(wx / (90 * this.size), -0.6, 0.6)); put('tilt', T[C.tilt] + clamp(wy / d, -1, 1) * 0.06 * Math.sign(wx || 1));
    } else if (m !== 'sleep' && m !== 'read') {
      put('lkx', T[C.lkx] + this._gaze[0]); put('lky', T[C.lky] + this._gaze[1]); put('turn', T[C.turn] + this._gturn);
    }
    if (m0 === 'wonder') {            // amazed: eyes wide, brows up, a small "o", a little lean back, looking up
      face(0.1, 0.45, 0.45, 1, 0, 1); put('wide', 1); put('lean', T[C.lean] - 0.06); put('hy', T[C.hy] - 1); put('tilt', T[C.tilt] - 0.05); put('shr', T[C.shr] + 0.6);
      if (!this.look) { put('lky', -0.7); put('lkx', 0.15); }
    }
    if (m0 === 'wistful') {           // the tale has run out: brows up in the middle, eyes down a while, then out; a sigh
      const wt = this._wistT || 0, down = wt < 1.4;
      face(-0.12, 0, 0.8, down ? 0.62 : 0.88, 0, 0.15); put('sad', 1); put('shr', T[C.shr] - 0.8); put('tilt', T[C.tilt] + 0.07); put('hy', T[C.hy] + 0.8);
      if (!this.look) { put('lky', down ? 0.9 : -0.25); put('lkx', down ? 0 : 0.75); put('turn', down ? 0 : 0.28); }
      if (this._wistBook) {          // a reader keeps the book, lowered (in a window: down onto the sill)
        put('book', 1); L[0] = 1; L[1] = 1;
        if (bust) { handAt(-1, -7.4 * as, -2.2); handAt(1, 7.4 * as, -2.2); pole(-1, -12, 6); pole(1, 12, 6); }
        else { const s = shoulder(1); handAt(-1, s[0] - 14 * as, s[1] + 13 * as); handAt(1, s[0] + 2.6 * as, s[1] + 13 * as); pole(-1, -6, 14); pole(1, 8, 14); }
      }
    }
    if (this.turn !== null && this.turn !== undefined) put('turn', clamp(this.turn, -1, 1));
    // a one-off act blends over everything
    const a = this._act;
    if (a) this._actPose(T, a, put, hand, handAt, pole, shoulder, bust, L);
  }

  _actPose(T, a, put, hand, handAt, pole, shoulder, bust, L) {
    const u = a.t / a.dur, B = this.B, mix = (n, v, w) => { T[C[n]] = lerp(T[C[n]], v, w); };
    if (a.kind === 'yawn') {
      const e = env(u, 0.3, 0.3), mo = env(u, 0.22, 0.32);
      mix('open', 1.25, mo); mix('mw', 0.95, mo); mix('smile', 0, mo); mix('lid', 0, env(u, 0.18, 0.25)); mix('brow', 0.9, e); mix('hap', 0, e);
      mix('tilt', -0.12, e); mix('hy', -1.4, e); mix('shr', 2, e);
      if (bust || this.pose === 'sit') {          // the near hand goes up to the mouth
        const hx = T[C.bx] + T[C.hx] + 1.5, hy = T[C.by] - B.spine - B.neck + T[C.hy] + 9;
        const s = shoulder(1);
        mix('rhx', lerp(s[0], hx + 4, 1), e); mix('rhy', hy + 2, e); mix('rpx', 10, e); mix('rpy', 6, e); mix('rha', -1.9, e);
        if (e > 0.4) L[1] = 2;
      } else if (this.pose === 'stand' || this.pose === 'walk') {     // a stretch
        const s0 = shoulder(-1), s1 = shoulder(1), as = (B.up + B.fore) / ARM0;
        mix('lhx', s0[0] - 5 * as, e); mix('lhy', s0[1] - 15 * as, e); mix('rhx', s1[0] + 5 * as, e); mix('rhy', s1[1] - 15 * as, e);
        mix('lpx', -14, e); mix('lpy', 0, e); mix('rpx', 14, e); mix('rpy', 0, e);
      }
    } else if (a.kind === 'rubEyes') {
      const e = env(u, 0.2, 0.22), H0x = T[C.bx] + T[C.hx], H0y = T[C.by] - B.spine - B.neck + T[C.hy];
      const r = Math.sin(a.t * 13) * 1.1;
      mix('lid', 0, e); mix('smile', 0, e); mix('open', 0.12, e); mix('mw', 0.5, e); mix('tilt', 0.12, e); mix('hap', 0, e); mix('brow', 0.3, e);
      mix('rhx', H0x + 5.5 + r, e); mix('rhy', H0y + 3 + Math.cos(a.t * 13) * 0.8, e); mix('rpx', 12, e); mix('rpy', 8, e); mix('rha', -2.3, e);
      if (e > 0.35) L[1] = 2;
    } else if (a.kind === 'clap') {
      const e = env(u, 0.15, 0.2), c = 0.5 + 0.5 * Math.cos(a.t * 15), s = shoulder(1), as = (B.up + B.fore) / ARM0;
      const cx = T[C.bx] + 2, cy = s[1] + 4 * as;
      mix('lhx', cx - 1.4 - c * 3.6, e); mix('lhy', cy, e); mix('rhx', cx + 1.4 + c * 3.6, e); mix('rhy', cy, e);
      mix('lpx', -10, e); mix('lpy', 8, e); mix('rpx', 10, e); mix('rpy', 8, e); mix('lha', -1.3, e); mix('rha', 1.3, e);
      mix('smile', 0.95, e); mix('open', 0.45, e); mix('hap', 1, e);
      if (e > 0.3) { L[0] = 1; L[1] = 1; }
    } else if (a.kind === 'nod') {
      const e = env(u, 0.1, 0.2);
      T[C.hy] += Math.sin(u * TAU * 2) * 1.8 * e; T[C.tilt] += Math.sin(u * TAU * 2) * 0.06 * e; mix('smile', 0.6, e);
    } else if (a.kind === 'point') {
      const e = env(u, 0.18, 0.22), s = shoulder(1), as = (B.up + B.fore) / ARM0;
      let dx = bust ? 0.38 : 1, dy = bust ? -0.92 : -0.25;
      if (this.look) { const wx = (this.look.x - this.x) * this.dir, wy = this.look.y - (this.y + s[1] * this.size); const d = Math.hypot(wx, wy) || 1; dx = wx / d; dy = wy / d; }
      mix('rhx', bust ? 13.6 : s[0] + dx * 15 * as, e); mix('rhy', bust ? T[C.by] - B.spine - 4 : s[1] + dy * 15 * as, e); mix('rpx', bust ? 4 : 0, e); mix('rpy', 10, e); mix('rha', 0, e);
      mix('brow', 0.6, e); mix('open', 0.3, e); mix('mw', 0.6, e); if (bust) { mix('turn', 0.45, e); mix('lkx', 1, e); }
      if (e > 0.3) L[1] = bust ? 2 : 1;
    } else if (a.kind === 'shrug') {
      const e = env(u, 0.25, 0.3);
      mix('shr', 3, e); mix('brow', 0.8, e); mix('smile', 0.2, e); mix('tilt', 0.1, e);
      if (!bust && (this.pose === 'stand' || this.pose === 'walk')) { const s0 = shoulder(-1), s1 = shoulder(1), as = (B.up + B.fore) / ARM0; mix('lhx', s0[0] - 8 * as, e); mix('lhy', s0[1] + 10 * as, e); mix('rhx', s1[0] + 8 * as, e); mix('rhy', s1[1] + 10 * as, e); mix('lpx', -2, e); mix('lpy', 12, e); mix('rpx', 2, e); mix('rpy', 12, e); mix('lha', 0.8, e); mix('rha', -0.8, e); }
    } else if (a.kind === 'stretch') {
      const e = env(u, 0.3, 0.3), s0 = shoulder(-1), s1 = shoulder(1), as = (B.up + B.fore) / ARM0;
      mix('lhx', s0[0] - 4 * as, e); mix('lhy', s0[1] - 15.5 * as, e); mix('rhx', s1[0] + 4 * as, e); mix('rhy', s1[1] - 15.5 * as, e);
      mix('lpx', -14, e); mix('lpy', 0, e); mix('rpx', 14, e); mix('rpy', 0, e); mix('open', 1.1, e * 0.8); mix('mw', 0.95, e); mix('lid', 0, e); mix('tilt', -0.1, e);
      if (e > 0.3) { L[0] = 0; L[1] = 0; }
    }
  }

  // ── geometry from the current channels + overlays ──
  _solve(t) {
    const B = this.B, c = this.cur, G = this.G, W = this._w, still = isStill(), j = this.joy.x;
    const bust = this._mode === 'bust', ps = this.pose;
    let bx = c[C.bx], by = c[C.by], lean = c[C.lean];
    const em = this._em || this.mood;
    if (em === 'wait' && !still && ps !== 'hang' && ps !== 'lie') {      // small weight shifts
      const q = Math.sin(t * 0.47 + this.seed) + 0.4 * Math.sin(t * 1.13 + this.seed * 2);
      bx += q * (bust ? 0.8 : 0.5); lean += q * (bust ? 0.025 : 0.012);
    }
    // breathing
    const sl = W.sleep, br = still ? 0 : Math.sin(t * TAU / lerp(3.2, 4.6, sl) + this.seed) * lerp(0.32, 0.75, sl) + (this._sighT > 0 ? Math.sin((1 - this._sighT / 1.8) * Math.PI) * 1.2 : 0);
    // walk
    const wk = W.walk, ph = this._phase, S = B.stride;
    if (wk > 0) by -= Math.abs(Math.sin(ph)) * 1.0 * wk * (B.R / 11.2);
    // cheer: a hop (whole figure; not when hanging or lying), and a pump of the arms
    const hop = ps === 'hang' || ps === 'lie' ? 0 : -j * 3;
    if (ps === 'lie') by -= Math.max(0, j) * 1.5;
    let lungs = br;
    if (ps === 'lie' && !bust) lungs = br * 2.2;
    const ux = Math.sin(lean), uy = -Math.cos(lean), rx = Math.cos(lean), ry = Math.sin(lean);
    set2(G.P, bx, by);
    const cx = bx + ux * (B.spine + br * 0.4), cy = by + uy * (B.spine + br * 0.4);
    set2(G.Cc, cx, cy);
    const shr = c[C.shr] + br * 0.35;
    const side = bust ? 1 : lerp(1, 0.22, W.dep);
    for (let i = 0; i < 2; i++) { const sd = i ? side : -side; set2(G.S[i], cx + rx * sd * B.sw - ux * (2.5 - shr), cy + ry * sd * B.sw - uy * (2.5 - shr)); }
    set2(G.H, cx + ux * B.neck + c[C.hx], cy + uy * B.neck + c[C.hy] + j * 0.9);       // the head lags a pop a little
    G.rot = c[C.tilt] + lean * (ps === 'lie' && !bust ? 1 : 0.5) + (still ? 0 : Math.sin(t * 0.8 + this.seed) * 0.025 * (1 - sl));
    for (let i = 0; i < 2; i++) { const sd = i ? side : -side; set2(G.Hp[i], bx + rx * sd * B.hw, by + ry * sd * B.hw); }
    // arms
    const as = (B.up + B.fore) / ARM0;
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, s = G.S[i];
      let wx = c[i ? C.rhx : C.lhx], wy = c[i ? C.rhy : C.lhy];
      if (wk > 0 && this.mood !== 'happy') {            // arm swing opposite to the leg on the same side
        const legPh = ph + (i ? 0 : Math.PI), u = ((legPh / TAU) % 1 + 1) % 1;
        const f = u < 0.5 ? 0.5 - u * 2 : -0.5 + smooth((u - 0.5) * 2);
        wx += -f * 7 * as * wk; wy -= Math.abs(f) * 1.6 * wk;
      }
      if (W.pump > 0 && !still) { wy += Math.sin(t * 7 + i * 0.7) * 1.6 * W.pump; wx += Math.sin(t * 7 + i * 0.7) * 0.6 * W.pump * (i ? 1 : -1); }
      if (this.mood === 'happy' && !bust) wy += hop * 0.3;
      if (W.read > 0 && !still) wy += Math.sin(t * 1.3 + i) * 0.3 * W.read;
      const px = s[0] + c[i ? C.rpx : C.lpx], py = s[1] + c[i ? C.rpy : C.lpy];
      const st = bust ? 1 : 1 + 0.22 * W.hk;
      this._bendTo[i] = ikBend(s, [wx, wy], B.up * st, B.fore * st, px, py, this._bend[i], G.E[i], G.W[i]);
      const wv = i ? W.wave : W.waveL;
      if (wv > 0.01 && !still) {          // wave from the elbow: the forearm swings, the hand turns
        const e = G.E[i], w = G.W[i], a = (bust ? 0.02 + Math.sin(t * 7.6) * 0.55 : 0.18 + Math.sin(t * 7.6) * 0.62) * wv * sd, ca = Math.cos(a), sa = Math.sin(a);   // biased outwards: never across the face
        const vx = w[0] - e[0], vy = w[1] - e[1];
        set2(w, e[0] + vx * ca - vy * sa, e[1] + vx * sa + vy * ca);
      }
    }
    // legs
    const kp = c[C.kp];
    for (let i = 0; i < 2; i++) {
      const sd = i ? 1 : -1, h = G.Hp[i];
      let fx = c[i ? C.rfx : C.lfx], fy = c[i ? C.rfy : C.lfy];
      if (wk > 0) {
        const u = (((ph + (i ? 0 : Math.PI)) / TAU) % 1 + 1) % 1;
        let ox, lift = 0;
        if (u < 0.5) ox = S / 2 - (u / 0.5) * S;
        else { const v = (u - 0.5) / 0.5; ox = -S / 2 + smooth(v) * S; lift = Math.sin(Math.PI * v) * 3.6 * (B.R / 11.2) * (S / 10); }
        fx = lerp(fx, h[0] + ox, wk); fy = lerp(fy, fy - lift, wk);
      }
      if (W.swing > 0 && !still && em !== 'sleep') { const q = Math.sin(t * (i ? 1.72 : 2.07) + i * 2.4 + this.seed); fx += q * 2.3 * W.swing; fy -= Math.max(0, q) * 0.8 * W.swing; }
      if (ps === 'hang') { const d = this._legSw.x - this._sw.x, hcx = G.P[0], hcy = G.P[1], ca = Math.cos(d), sa = Math.sin(d), qx = fx - hcx, qy = fy - hcy; fx = hcx + qx * ca - qy * sa; fy = hcy + qx * sa + qy * ca; }
      if (this.mood === 'happy' && ps === 'hang' && !still) fx += Math.sin(t * 6 + i * Math.PI) * 2.4;
      this._bendTo[2 + i] = ikBend(h, [fx, fy], B.thigh, B.shin, h[0] + Math.cos(kp) * 30, h[1] + Math.sin(kp) * 30, this._bend[2 + i], G.K[i], G.A[i]);
    }
    G.hop = hop; G.br = lungs;
    if (this._needBend || !this._bendInit) { for (let i = 0; i < 4; i++) this._bend[i] = this._bendTo[i]; this._needBend = false; if (!this._bendInit) { this._bendInit = true; this._solve(t); return; } }
    // the fists (mitten centres)
    for (let i = 0; i < 2; i++) {
      const e = G.E[i], w = G.W[i], vx = w[0] - e[0], vy = w[1] - e[1], d = Math.hypot(vx, vy) || 1, r = 2.75 * (B.R / 11.2) * 0.7;
      set2(G.F[i], w[0] + vx / d * r, w[1] + vy / d * r);
    }
  }
  // a local point → world (the same transform as drawing)
  _toWorld(o, px, py) {
    let x = px, y = py;
    if (this._mode === 'full') { const a = this._sw.x; if (a) { const ca = Math.cos(a), sa = Math.sin(a), nx = x * ca - y * sa; y = x * sa + y * ca; x = nx; } }
    y += this.G.hop * (this._mode === 'bust' ? 0.8 : 1);
    o.x = this.x + x * this.dir * this.size; o.y = this.y + y * this.size;
    return o;
  }
  // every joint in world coordinates (tests, scenes that need more than anchor())
  joints() {
    const G = this.G, out = {}, add = (n, p) => { out[n] = this._toWorld({}, p[0], p[1]); };
    add('pelvis', G.P); add('chest', G.Cc); add('head', G.H);
    for (let i = 0; i < 2; i++) { const s = i ? 'R' : 'L'; add('shoulder' + s, G.S[i]); add('elbow' + s, G.E[i]); add('hand' + s, G.F[i]); add('hip' + s, G.Hp[i]); add('knee' + s, G.K[i]); add('ankle' + s, G.A[i]); }
    return out;
  }

  _face(t) {
    const c = this.cur, still = isStill(), W = this._w;
    const f = this._f || (this._f = {});
    f.sad = c[C.sad]; f.wide = c[C.wide]; f.turn = c[C.turn]; f.smile = c[C.smile]; f.open = c[C.open]; f.mw = c[C.mw]; f.hap = c[C.hap]; f.brow = c[C.brow];
    f.lid = this._blinkT > 0 && c[C.hap] < 0.5 ? 0 : c[C.lid];
    if (this._sighT > 0) { const e = Math.sin((1 - this._sighT / 1.8) * Math.PI); f.open = Math.max(f.open, 0.45 * e); f.mw = lerp(f.mw, 0.5, e); }
    f.lkx = c[C.lkx]; f.lky = c[C.lky];
    if (W.read > 0.5 && !still && !this.look && this._peekT <= 0) {     // the eyes travel along the lines
      const L = 1.7, u = (t % L) / L;
      f.lkx = lerp(f.lkx, u < 0.85 ? -0.8 + (u / 0.85) * 1.6 : 0.8 - ((u - 0.85) / 0.15) * 1.6, W.read);
      f.lky = lerp(f.lky, 0.75 + (Math.floor(t / L) % 4) * 0.08, W.read);
    }
    if (this._peekT > 0 && !this.look && !still && (this._em === 'read' || this._em === 'wait')) {   // a glance up (reading) / aside (waiting)
      const e = Math.sin(Math.PI * clamp01(1 - this._peekT / 1.1));
      if (this._em === 'read') f.lky = lerp(f.lky, -0.5, e); else { f.lkx = lerp(f.lkx, 0.9, e); f.turn += 0.2 * e; }
    }
    f.sway = this._hair.x; const gr = this.G.rot + (this._mode === 'full' ? this._sw.x : 0); f.pigL = this._pig[0].x + gr * 0.9; f.pigR = this._pig[1].x - gr * 0.9;   // pigtails hang by gravity, whatever the head and the body do
    f.back = false;
    return f;
  }

  _maybeTick(t) {
    if (this._lastDraw < 0) { this._lastDraw = t; if (!this._upd) this.update(1 / 60); }
    else if (!this._upd) this.update(clamp(t - this._lastDraw, 0, 0.1));
    this._lastDraw = t; this._upd = false;
  }
  _setMode(mode) { if (this._mode !== mode) { this._mode = mode; this._pose(this.tgt, this._t); this.cur.set(this.tgt); } }

  // Head-and-shoulders, (x, y) = bottom centre (sits on a window sill).
  drawBust(ctx, t) {
    if (this.hidden) return;
    this._setMode('bust'); this._maybeTick(t);
    this._paint(ctx, t, true);
  }
  // Whole figure, (x, y) = feet (or hands when pose = 'hang', or the resting line when 'lie').
  // part (optional): 'body' = everything but the arms that are in front of it; 'arms' = only those arms. Draw 'body',
  // then whatever must come between (a tree trunk's edge), then 'arms' — at the same t.
  drawFull(ctx, t, part) {
    if (this.hidden) return;
    this._setMode('full'); this._maybeTick(t);
    this._paint(ctx, t, false, part);
  }

  _paint(ctx, t, bust, part) {
    const k = this.k, B = this.B, s = this.size, still = isStill();
    const m0 = ctx.getTransform(), dpu = Math.hypot(m0.a, m0.b) * s;         // device px per unit
    this._lo = dpu < 1.6;              // small on the screen: the finest strokes and the line boil are left out
    this._solve(t);
    const G = this.G, f = this._face(t), c = this.cur;
    f.lo = this._lo;
    const bs = still ? this.seed : this.seed + Math.floor(t * 6) * 131, amp = still || this._lo ? 0 : 0.17;
    const lw = B.lw, lwL = lw * 0.92;
    ctx.save();
    ctx.translate(this.x, this.y); ctx.scale(this.dir * s, s);
    const ps = this.pose;
    if (!bust && (ps === 'stand' || ps === 'walk')) {
      const k2 = 1 / (1 - G.hop * 0.06);
      ctx.fillStyle = 'rgba(29,21,48,0.12)'; ctx.beginPath(); ctx.ellipse(0, 0.6, 11 * B.tw * k2, 2.4 * k2, 0, 0, TAU); ctx.fill();
    }
    if (!bust && this._sw.x) ctx.rotate(this._sw.x);
    if (G.hop) ctx.translate(0, G.hop * (bust ? 0.8 : 1));
    const hs = B.R / 11.2;
    const head = (part) => { ctx.save(); ctx.translate(G.H[0], G.H[1]); ctx.rotate(G.rot); ctx.scale(hs, hs); paintHead(ctx, k, f, bs, amp, part, lw / hs); ctx.restore(); };
    const L = this._layer, arms = part !== 'body';
    if (part === 'arms') {            // the second pass: only the arms in front
      for (let i = 0; i < 2; i++) if (L[i] >= 1) this._arm(ctx, i, bs, amp, lwL);
      ctx.restore(); return;
    }
    // back hair
    head('back');
    // arms behind
    for (let i = 0; i < 2; i++) if (L[i] === 0) this._arm(ctx, i, bs, amp, lwL);
    // legs (far first)
    if (!bust) { this._leg(ctx, 0, bs, amp, lwL); this._leg(ctx, 1, bs, amp, lwL); }
    // torso + neck
    this._torso(ctx, t, bs, amp, lw, bust);
    // book
    const bk = c[C.book] > 0.5;
    for (let i = 0; i < 2; i++) if (L[i] === 1 && arms) this._arm(ctx, i, bs, amp, lwL);
    const book = () => {
      drawBook(ctx, G.W[0][0], G.W[0][1] - 1.2, G.W[1][0], G.W[1][1] - 1.2, k.book || '#d9483b', this._page, lw, bs, amp, this._lo, this._mode === 'bust');
      for (let i = 0; i < 2; i++) if (L[i] === 1) this._arm(ctx, i, bs, amp, lwL, true);
    };
    if (bk && !bust) book();
    head('front');
    if (bk && bust) book();          // in a window the pages are what one sees: the book in front of the chin
    for (let i = 0; i < 2; i++) if (L[i] === 2 && arms) this._arm(ctx, i, bs, amp, lwL);
    if (!bust && ps === 'hang') for (let i = 0; i < 2; i++) this._arm(ctx, i, bs, amp, lwL, true);
    ctx.restore();
    // anchors (world)
    this._anchors();
  }

  _arm(ctx, i, bs, amp, lw, handOnly) {
    const G = this.G, k = this.k, B = this.B, s = G.S[i], e = G.E[i], w = G.W[i], sd = i ? 1 : -1;
    const sleeve = k.body === 'adult' || k.style === 'mop' ? 0.86 : 0.55;
    const cl = [s.slice(), e.slice(), w.slice()];
    if (amp) boil(cl, bs + 50 + i * 7, amp * 0.6);

    const fx = w[0] - e[0], fy = w[1] - e[1], fd = Math.hypot(fx, fy) || 1;
    const twist = this.cur[i ? C.rha : C.lha] + (i === 1 && this._w.wave > 0.01 && !isStill() ? Math.sin(this._t * 8.5 - 0.6) * 0.35 * this._w.wave : 0);
    const open = i === 1 && this._w.wave > 0.3;
    const mit = mitten(w, fx / fd, fy / fd, twist, -sd * (fy < 0 ? -1 : 1), B.R / 11.2, open);
    const slv = sleeve < 0.7 ? { p: [cl[0], [lerp(cl[0][0], cl[1][0], 0.78), lerp(cl[0][1], cl[1][1], 0.78)]], w: B.armW + 1.7, c: k.shirt }
      : { p: [cl[0], cl[1], [lerp(cl[1][0], cl[2][0], 0.8), lerp(cl[1][1], cl[2][1], 0.8)]], w: B.armW + 1.3, c: k.shirt };
    if (handOnly) { group(ctx, [{ p: [[lerp(e[0], w[0], 0.55), lerp(e[1], w[1], 0.55)], w], w: B.armW - 0.4, c: k.skin }, { s: mit[0], c: k.skin }, { s: mit[1], c: k.skin }], lw); return; }
    group(ctx, [{ p: cl, w: B.armW, c: k.skin }, { s: mit[0], c: k.skin }, { s: mit[1], c: k.skin }, slv], lw);
    if (this._lo) return;
    // the cuff
    const a = sleeve < 0.7 ? [lerp(s[0], e[0], 0.78), lerp(s[1], e[1], 0.78)] : [lerp(e[0], w[0], 0.8), lerp(e[1], w[1], 0.8)];
    const b = sleeve < 0.7 ? e : w, dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1, h = (B.armW + 1.5) / 2;
    line(ctx, [[a[0] - dy / d * h, a[1] + dx / d * h], [a[0] + dy / d * h, a[1] - dx / d * h]], lw * 0.55, INK);
  }

  _leg(ctx, i, bs, amp, lw) {
    const G = this.G, k = this.k, B = this.B, h = G.Hp[i], kn = G.K[i], a = G.A[i];
    const cl = [h.slice(), kn.slice(), a.slice()];
    if (amp) boil(cl, bs + 70 + i * 7, amp * 0.5);

    const lie = this.pose === 'lie';
    // the shoe points forwards (+x), or up when lying
    const sa = lie ? -Math.PI / 2 + 0.25 : (this.pose === 'sit' ? 0.25 : 0.05);
    const sc = B.R / 11.2, sx = a[0] + Math.cos(sa) * 1.9 * sc + (lie ? -1 : 0), sy = a[1] + Math.sin(sa) * 1.9 * sc + (lie ? 0 : 0.9);
    const shoe = oval(sx, sy, 4.5 * sc * (k.body === 'adult' ? 1.15 : 1), 2.6 * sc, sa, 8);
    const legCol = k.shorts || (k.dress && k.body !== 'adult') ? k.skin : k.pants;
    const parts = [{ p: cl, w: B.legW, c: legCol }, { s: shoe, c: k.shoe || '#7a4a36' }];
    if (k.shorts) parts.push({ p: [cl[0], [lerp(cl[0][0], cl[1][0], 0.85), lerp(cl[0][1], cl[1][1], 0.85)]], w: B.legW + 1.4, c: k.pants });
    if (k.dress && k.body !== 'adult') parts.splice(1, 0, { p: [[lerp(cl[1][0], cl[2][0], 0.62), lerp(cl[1][1], cl[2][1], 0.62)], cl[2]], w: B.legW, c: '#fbf8ee' });   // white socks
    group(ctx, parts, lw);
    if (k.dress && k.body !== 'adult' && !this._lo) {
      const p = [lerp(kn[0], a[0], 0.62), lerp(kn[1], a[1], 0.62)], dx = a[0] - kn[0], dy = a[1] - kn[1], d = Math.hypot(dx, dy) || 1, w = B.legW / 2;
      line(ctx, [[p[0] - dy / d * w, p[1] + dx / d * w], [p[0] + dy / d * w, p[1] - dx / d * w]], lw * 0.5, INK);
    }
  }

  _torso(ctx, t, bs, amp, lw, bust) {
    const G = this.G, k = this.k, B = this.B, P = G.P, lean = this.cur[C.lean];
    const rx = Math.cos(lean), ry = Math.sin(lean), dx = -Math.sin(lean), dy = Math.cos(lean);
    const tw = B.tw * (bust ? 1 : lerp(1, 0.62, this._w.dep)), th = B.spine / 18, br = 1 + (G.br || 0) * lerp(0.012, 0.03, this._w.dep);
    const T = (x, y) => [P[0] + rx * x * tw * br + dx * y * th, P[1] + ry * x * tw * br + dy * y * th];
    const sk = this._skirt.x * 2.2;
    let pts;
    if (k.dress && !bust) {
      const ad = k.body === 'adult', hem = ad ? 14 : 8.6, fl = ad ? 9.8 : 10.8;
      pts = [T(-8.4, -1), T(-8.6, -6), T(-8, -13), T(-5.6, -17), T(0, -18), T(5.6, -17), T(8, -13), T(8.6, -6), T(8.4, -1), T(fl + sk, hem - 1.4), T(5 + sk * 0.5, hem), T(0, hem + 0.2), T(-5 + sk * 0.5, hem), T(-fl + sk, hem - 1.4)];
    } else pts = [T(-8, 1.5), T(-8.6, -6), T(-8, -13), T(-5.6, -17), T(0, -18), T(5.6, -17), T(8, -13), T(8.6, -6), T(8, 1.5)];
    const torso = bz(pts, bs + 90, amp);
    // neck
    const H = G.H, Cc = G.Cc, rot = G.rot;
    const nb = [Cc[0] - dx * 1.5, Cc[1] - dy * 1.5 + 1], nt = [H[0] - Math.sin(rot) * -6, H[1] + Math.cos(rot) * 6];
    group(ctx, [{ p: [nb, nt], w: k.body === 'adult' ? 5.8 : 5.2, c: k.skin }, { s: torso, c: k.shirt }], lw);
    // details on the shirt (no clipping: the stripes are cut to the torso's width at their height)
    const half = (y) => (y > -6 ? 8.3 : y > -13 ? 8.6 - (y + 6) * -0.086 : y > -17 ? 8 - (-13 - y) * 0.6 : 5.6 - (-17 - y) * 5.6);
    if (k.stripes) {
      ctx.beginPath();
      for (let y = -14.6; y < 1.5; y += 3.6) { const w = half(y) - 0.9, a = T(-w, y), b = T(w, y); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); }
      ctx.strokeStyle = k.stripes; ctx.lineWidth = 1.7; ctx.lineCap = 'butt'; ctx.stroke(); ctx.lineCap = 'round';
    }
    if (k.dress && !bust) line(ctx, [T(-8, -1.4), T(8, -1.4)], lw * 0.5, 'rgba(29,21,48,0.45)');
    if (k.shawl) {
      const sh = bz([T(-6.6, -17.2), T(6.6, -17.2), T(8.2, -12.4), T(4, -7.4), T(0, -3.6), T(-4, -7.4), T(-8.2, -12.4)], bs + 92, amp * 0.5);
      inked(ctx, [[sh, k.shawl]], lw * 0.6);
      if (!this._lo) { ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); for (let i = 0; i < 5; i++) { const p = T(-6 + i * 3, -12 + Math.abs(i - 2) * 1.4); ctx.moveTo(p[0] + 0.7, p[1]); ctx.arc(p[0], p[1], 0.7, 0, TAU); } ctx.fill(); }
    }
    if (k.collar) {
      const cc = k.collar, a = 0, l = bz([T(-0.4, -16.4), T(-3, -18.6), T(-6.4, -17.8), T(-6.4, -15.4), T(-3.4, -14.2)], bs + 94, amp * 0.5), r = bz([T(0.4, -16.4), T(3, -18.6), T(6.4, -17.8), T(6.4, -15.4), T(3.4, -14.2)], bs + 95, amp * 0.5);
      inked(ctx, [[l, cc]], lw * 0.55); inked(ctx, [[r, cc]], lw * 0.55); void a;
    }
    if (k.pocket) { ctx.beginPath(); const q = [T(2, -12.6), T(6.2, -12.6), T(6.2, -8.6), T(2, -8.6)]; ctx.moveTo(q[0][0], q[0][1]); for (const v of q) ctx.lineTo(v[0], v[1]); ctx.closePath(); ctx.fillStyle = shade(k.shirt, -0.12); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.45; ctx.lineJoin = 'round'; ctx.stroke(); line(ctx, [T(2, -11.2), T(6.2, -11.2)], lw * 0.35, INK); }
    if (k.buttons) { ctx.beginPath(); for (let i = 0; i < 3; i++) { const p = T(0.4, -14 + i * 4.4); ctx.moveTo(p[0] + 0.95, p[1]); ctx.arc(p[0], p[1], 0.95, 0, TAU); } ctx.fillStyle = k.buttons; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.6; ctx.stroke(); }
    if (k.star) { const p = T(-3.4, -10.5); starAt(ctx, p[0], p[1], 2.4, k.star, lw * 0.45); }
    if (k.necklace) { ctx.fillStyle = k.necklace; ctx.beginPath(); for (let i = -3; i <= 3; i++) { const p = T(i * 1.4, -17 + (9 - i * i) * 0.32); ctx.moveTo(p[0] + 0.75, p[1]); ctx.arc(p[0], p[1], 0.75, 0, TAU); } ctx.fill(); }
    // neckline
    const n0 = T(-3.4, -17.7), n1 = T(0, -15.6), n2 = T(3.4, -17.7);
    if (!k.collar && !k.shawl) line(ctx, [n0, n1, n2], lw * 0.5, 'rgba(29,21,48,0.6)');
  }
}

function starAt(ctx, x, y, r, col, lw) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
}

// A head on its own, matching the people's faces and hair — for scenes that paint their own people.
// o: { kind | colors, x, y (head centre), size, dir, turn, tilt, mood ('wait' | 'happy' | 'sleep' | 'sing' | 'yawn'),
//      smile, open, lid, hap, brow, sad (0…1: brows up in the middle), lookX, lookY, back (seen from behind), t, seed,
//      lw (scale of the line weight: a big painted head next to thinner scenery lines, e.g. 0.6) }
export function drawHead(ctx, o) {
  o = o || {};
  const k = Object.assign({}, KIDS[o.kind || 'pigtails'] || KIDS.pigtails, o.colors || {}), B = BODY[k.body || 'kid'];
  const m = o.mood || 'wait', still = isStill(), t = o.t || 0;
  const pre = { wait: [0.35, 0, 1, 1, 0, 0], happy: [1, 0.7, 1.3, 1, 1, 0.6], sleep: [0, 0.2, 0.45, 0, 0, -0.1], sing: [0.2, 0.62, 0.58, 1, 0, 0.5], yawn: [0, 1.25, 0.95, 0, 0, 0.9], wistful: [-0.12, 0, 0.8, 0.85, 0, 0.15], wonder: [0.1, 0.45, 0.45, 1, 0, 1] }[m] || [0.35, 0, 1, 1, 0, 0];
  const f = {
    turn: o.turn || 0, smile: o.smile !== undefined ? o.smile : pre[0], open: o.open !== undefined ? o.open : pre[1], mw: pre[2],
    lid: o.lid !== undefined ? o.lid : pre[3], hap: o.hap !== undefined ? o.hap : pre[4], brow: o.brow !== undefined ? o.brow : pre[5],
    lkx: o.lookX || 0, lky: o.lookY || 0, sway: 0, pigL: o.pig || 0, pigR: o.pig || 0, back: !!o.back,
    sad: o.sad !== undefined ? o.sad : m === 'wistful' ? 1 : 0, wide: o.wide !== undefined ? o.wide : m === 'wonder' ? 1 : 0
  };
  const lwk = o.lw || 1;
  const seed = o.seed || 7, bs = still ? seed : seed + Math.floor(t * 6) * 131, hs = B.R / 11.2, sz = o.size || 1;
  ctx.save(); ctx.translate(o.x || 0, o.y || 0); ctx.scale((o.dir || 1) * sz * hs, sz * hs); ctx.rotate(o.tilt || 0);
  paintHead(ctx, k, f, bs, still ? 0 : 0.17, 'back', B.lw * lwk / hs);
  paintHead(ctx, k, f, bs, still ? 0 : 0.17, 'front', B.lw * lwk / hs);
  ctx.restore();
}
