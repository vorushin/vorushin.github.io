// Magic cats — drawing helpers for the articulated characters (cats, people, birds).
//
// A character is built from *shapes* (closed outlines given as arrays of [x, y]) that are drawn
// in groups: every shape of a group is stroked in ink first and then every one is filled, so
// the ink line runs round the UNION of the group. Nothing looks assembled from parts — no line
// where a leg meets the body or the neck the head. A part that should show a contour against
// its neighbours (a near leg lying over the body, an arm over the shirt) goes into a later group.
//
//   inked(ctx, [[blob(bodyPts), fur], [limb(tailPts, 6.5, 4.5), fur]], 2.6);
//   within(ctx, blob(bodyPts), () => { …belly patch, stripes… });
//   line(ctx, haunchPts, 1.6, 'rgba(29,21,48,0.55)');

import { rng } from './util.js';
import { INK } from './paint.js';

const TAU = Math.PI * 2;

// ── shapes ──
// Smooth closed outline through points: corners are rounded, as in paint.js `wobble`.
export function blob(pts) { pts.smooth = true; return pts; }

// An oval as a shape.
export function oval(x, y, rx, ry, rot, n) {
  const k = n || 14, c = Math.cos(rot || 0), s = Math.sin(rot || 0), a = [];
  for (let i = 0; i < k; i++) { const u = (i / k) * TAU, px = Math.cos(u) * rx, py = Math.sin(u) * (ry === undefined ? rx : ry); a.push([x + px * c - py * s, y + px * s + py * c]); }
  a.smooth = true;
  return a;
}

// A limb, a tail, a neck: a tube along a polyline with round ends. `w` is the full width — a
// number, [start, end], or one width per point (a thigh that is broad at the hip). The centre
// line is smoothed so joints bend softly; `tension` 0 = straight bones … 0.5 = soft (default).
export function limb(pts, w, tension) {
  const n = pts.length, k = tension === undefined ? 0.5 : tension, W = typeof w === 'number' ? [w, w] : w;
  const wAt = (u) => { const f = u * (W.length - 1), i = Math.min(W.length - 2, Math.floor(f)); return W[i] + (W[i + 1] - W[i]) * (f - i); };
  // resample the centre line (Catmull–Rom)
  const P = [], STEPS = 5;
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < STEPS; s++) {
      const t = s / STEPS, t2 = t * t, t3 = t2 * t;
      const h1 = 2 * t3 - 3 * t2 + 1, h2 = t3 - 2 * t2 + t, h3 = -2 * t3 + 3 * t2, h4 = t3 - t2;
      P.push([h1 * p1[0] + h2 * k * (p2[0] - p0[0]) + h3 * p2[0] + h4 * k * (p3[0] - p1[0]), h1 * p1[1] + h2 * k * (p2[1] - p0[1]) + h3 * p2[1] + h4 * k * (p3[1] - p1[1])]);
    }
  }
  P.push(pts[n - 1]);
  const m = P.length, L = [], R = [];
  let a0 = 0, a1 = 0;
  for (let i = 0; i < m; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(m - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const h = wAt(i / (m - 1)) / 2;
    L.push([P[i][0] - dy * h, P[i][1] + dx * h]); R.push([P[i][0] + dy * h, P[i][1] - dx * h]);
    if (i === 0) a0 = Math.atan2(dy, dx); if (i === m - 1) a1 = Math.atan2(dy, dx);
  }
  const out = L.slice();
  const cap = (c, ang, h) => { for (let i = 1; i < 6; i++) { const u = ang + Math.PI / 2 - (i / 6) * Math.PI; out.push([c[0] + Math.cos(u) * h, c[1] + Math.sin(u) * h]); } };
  cap(P[m - 1], a1, wAt(1) / 2);
  for (let i = m - 1; i >= 0; i--) out.push(R[i]);
  cap(P[0], a0 + Math.PI, wAt(0) / 2);
  return out;
}

// "Line boil": nudge points by a seeded jitter (in place; returns the array). Use it on the
// control points of a blob or on the centre line of a limb — not on a finished limb outline.
export function boil(pts, seed, amp) {
  if (!amp) return pts;
  const r = rng(seed || 1);
  for (let i = 0; i < pts.length; i++) { pts[i][0] += (r() - 0.5) * 2 * amp; pts[i][1] += (r() - 0.5) * 2 * amp; }
  return pts;
}

// Put a shape on the context's current path (a new sub-path; call ctx.beginPath() yourself).
export function trace(ctx, s) {
  const n = s.length;
  if (s.smooth) {
    ctx.moveTo((s[n - 1][0] + s[0][0]) / 2, (s[n - 1][1] + s[0][1]) / 2);
    for (let i = 0; i < n; i++) { const p = s[i], q = s[(i + 1) % n]; ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2); }
  } else {
    ctx.moveTo(s[0][0], s[0][1]);
    for (let i = 1; i < n; i++) ctx.lineTo(s[i][0], s[i][1]);
  }
  ctx.closePath();
}

// One outline round the union of the parts, then the fills. parts: [[shape, fill], …]
// (a part with a falsy fill only takes part in the outline). lw = width of the visible line.
export function inked(ctx, parts, lw, ink) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (lw > 0) {
    ctx.beginPath();
    for (let i = 0; i < parts.length; i++) trace(ctx, parts[i][0]);
    ctx.strokeStyle = ink || INK; ctx.lineWidth = lw * 2; ctx.stroke();
  }
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i][1]) continue;
    ctx.beginPath(); trace(ctx, parts[i][0]); ctx.fillStyle = parts[i][1]; ctx.fill();
  }
}

// Paint inside a shape only (belly patches, stripes, markings).
export function within(ctx, shape, fn) {
  ctx.save(); ctx.beginPath(); trace(ctx, shape); ctx.clip(); fn(); ctx.restore();
}

// An open smooth line through points (contours, stripes, whiskers, mouths).
export function line(ctx, pts, w, color) {
  const n = pts.length;
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
  if (n === 2) ctx.lineTo(pts[1][0], pts[1][1]);
  else { for (let i = 1; i < n - 1; i++) ctx.quadraticCurveTo(pts[i][0], pts[i][1], i === n - 2 ? pts[n - 1][0] : (pts[i][0] + pts[i + 1][0]) / 2, i === n - 2 ? pts[n - 1][1] : (pts[i][1] + pts[i + 1][1]) / 2); }
  ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = w; ctx.strokeStyle = color || INK; ctx.stroke();
}

// ── skeleton helpers ──
// Two-bone IK: the joint between `a` (hip, shoulder) and `b` (paw, hand) for bones l1 and l2.
// bend = +1 or −1 picks the side the joint folds to. If b is out of reach it is pulled in.
// Returns [joint, end].
export function ik2(a, b, l1, l2, bend) {
  let dx = b[0] - a[0], dy = b[1] - a[1], d = Math.hypot(dx, dy) || 1e-3;
  const max = (l1 + l2) * 0.999, min = Math.abs(l1 - l2) * 1.001 + 1e-3;
  if (d > max || d < min) { const k = (d > max ? max : min) / d; b = [a[0] + dx * k, a[1] + dy * k]; dx *= k; dy *= k; d *= k; }
  const x = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  return [[a[0] + (dx / d) * x - (dy / d) * h * bend, a[1] + (dy / d) * x + (dx / d) * h * bend], b];
}

// Point on a rotated ellipse arc as a polyline (a haunch, a cheek) — for `line`.
export function arc(x, y, rx, ry, rot, a0, a1, n) {
  const k = n || 10, c = Math.cos(rot || 0), s = Math.sin(rot || 0), out = [];
  for (let i = 0; i <= k; i++) { const u = a0 + ((a1 - a0) * i) / k, px = Math.cos(u) * rx, py = Math.sin(u) * ry; out.push([x + px * c - py * s, y + px * s + py * c]); }
  return out;
}
