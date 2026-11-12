// Magic cats — the cats (rig v2): kinds and colours, the Cat class.
//
// A cat is a skeleton driven by a POSE: a small vector of numbers (hip and shoulder joints, spine
// arch, head offset / turn / nod / tilt, four paw targets with their hock and wrist angles, tail
// shape, ears, lids, mouth…). Everything that asks something of the cat — `mode`, `crouch`,
// `headDown`, `look`, the idle acts, a leap — only builds a TARGET pose; the drawn pose follows it
// on critically damped springs, one stiffness per body part (sitting down: the rear folds first,
// getting up: the front pushes up first), so nothing ever switches. On top of the sprung pose come
// the layers that must be exact: the gait (paws planted on the ground, phase driven by the distance
// actually travelled), the bob, the breath, the landing squash. The skeleton is then solved
// (two-bone IK per leg plus a hock / wrist bone) and painted in one ink line round the union of
// body + neck + near thigh (rig.js `inked`), near legs over it with their own contour, far legs and
// tail behind. The head is a little 3D sphere: features (eyes, ears, muzzle, brow) sit at fixed
// points on it and are projected for any turn (0 = profile … 1 = full face … 1.8 = looking back),
// nod and tilt. `update()` simulates and solves (so `anchor()` works without drawing); `draw()` paints.

import { TAU, clamp, clamp01, lerp, smooth, spring, approach, shade, hash, noise1, rgba } from './util.js';
import { INK, PAL, glow } from './paint.js';
import { blob, oval, limb, trace, inked, line, ik2 } from './rig.js';
import { drawBundle } from './bundle.js';

// fur / furDark / belly / ear / nose: the palette (o.colors overrides any of it).
// size, head, leg, tail: multipliers (scene 3 grows the kitten by changing head, leg and size);
// (optional body = trunk length, girth = trunk depth, paw = paw size: derived from leg when absent); iris = eye colour; coat = 'tabby' | 'point' | 'plain'.
export const CAT_KINDS = {
  papa: { fur: '#c9cfe6', furDark: '#9aa2c6', belly: '#f4f5fb', ear: '#f3a9b8', nose: '#e5788d', iris: '#bccb4e', coat: 'tabby', size: 1, head: 1, leg: 1, tail: 1 },
  kitten: { fur: '#f2ab3e', furDark: '#d07c1f', belly: '#fde6ae', ear: '#f7b7a8', nose: '#e06a6a', iris: '#7fc4e8', coat: 'tabby', size: 0.6, head: 1.22, leg: 0.82, tail: 0.8 },
  mama: { fur: '#f3efe6', furDark: '#c9b9a6', belly: '#ffffff', ear: '#f3a9b8', nose: '#e5788d', iris: '#e9a94a', coat: 'point', size: 0.95, head: 1, leg: 1, tail: 1 },
  night: { fur: '#3a2f52', furDark: '#2a2140', belly: '#7b6ba0', ear: '#a06a8a', nose: '#c0708a', iris: '#f2c94c', coat: 'plain', size: 0.6, head: 1.2, leg: 0.82, tail: 0.8 }
};

// ── the pose vector ──
const HX = 0, HY = 1, SX = 2, SY = 3, ARCH = 4, GIRTH = 5, TUCK = 6, FAR = 7,
  NX = 8, NY = 9, TURN = 10, NOD = 11, TILT = 12,
  NHX = 13, NHY = 14, FHX = 15, FHY = 16, NFX = 17, NFY = 18, FFX = 19, FFY = 20,
  NHK = 21, FHK = 22, NFW = 23, FFW = 24,
  TA = 25, TC = 26, TH = 27, TGND = 28, TZ = 29,
  EAR = 30, LID = 31, HAPPY = 32, MOUTH = 33, TONG = 34, PUP = 35, ARM = 36, CHEST = 37, NP = 38;
// body part of each key → which spring stiffness it follows: 0 rear, 1 front, 2 head, 3 face, 4 trunk, 5 tail
const PART = new Uint8Array(NP);
[HX, HY, NHX, NHY, FHX, FHY, NHK, FHK, TZ].forEach((k) => { PART[k] = 0; });
[TA, TC, TH].forEach((k) => { PART[k] = 5; });
[SX, SY, NFX, NFY, FFX, FFY, NFW, FFW].forEach((k) => { PART[k] = 1; });
[NX, NY, TURN, NOD, TILT].forEach((k) => { PART[k] = 2; });
[EAR, LID, HAPPY, MOUTH, TONG, PUP, TGND].forEach((k) => { PART[k] = 3; });
[ARCH, GIRTH, TUCK, FAR, ARM, CHEST].forEach((k) => { PART[k] = 4; });

const R0 = 13.2;                  // skull radius (papa)
const LW = 2.6;                   // outer ink line at size 1
// The trunk outline, in spine coordinates: [u along the spine hip → shoulder, ds along its tangent
// beyond the ends, w across it (+ = back), extra w where the belly is no longer tucked up].
const PROF = [
  [0, -9, 1, 0], [0, -7.6, 8.4, 0], [0, -2.5, 11.2, 0], [0.3, 0, 11.9, 0], [0.64, 0, 12.3, 0],
  [0.88, 0, 14.4, 0],                                // withers (index 5: the shoulder blade rides here)
  [1, 5, 14, 0], [1, 9.4, 6.5, 0], [1, 10, -2.5, 0], [1, 6, -9.8, 0], [0.8, 0, -12.6, 0],
  [0.52, 0, -11.2, -1], [0.28, 0, -8.2, -3.6], [0.06, 0, -9.2, -2], [0, -6, -6, 0]
];
const SCAP = 5;
// pale bib / belly, same coordinates
const BIB = [[0.5, 0, -12.4], [0.8, 0, -13.5], [1, 6.5, -10.6], [1, 10.5, -2], [1, 11, 6]];
const BIB_IN = [[1, 4, -2], [0.85, 0, -6.5], [0.62, 0, -8.5]];

const ACTS = {
  look: { dur: 2.4 }, ears: { dur: 0.8 }, tilt: { dur: 1.7 }, yawn: { dur: 1.8 }, lick: { dur: 2.4 },
  stretch: { dur: 2.3, pose: true }, slowblink: { dur: 1.8 }, knead: { dur: 2.6 }, pounce: { dur: 1.3, pose: true },
  bow: { dur: 1.2 }
};

// A tube along a polyline (rig.js limb, with fewer resampling steps: legs are short).
function tube(pts, w, steps) {
  const n = pts.length, W = w, ST = steps || 3, P = [];
  for (let i = 0; i < n - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(n - 1, i + 2)];
    for (let s = 0; s < ST; s++) {
      const t = s / ST, t2 = t * t, t3 = t2 * t, h1 = 2 * t3 - 3 * t2 + 1, h2 = t3 - 2 * t2 + t, h3 = -2 * t3 + 3 * t2, h4 = t3 - t2;
      P.push(h1 * p1[0] + h2 * 0.5 * (p2[0] - p0[0]) + h3 * p2[0] + h4 * 0.5 * (p3[0] - p1[0]), h1 * p1[1] + h2 * 0.5 * (p2[1] - p0[1]) + h3 * p2[1] + h4 * 0.5 * (p3[1] - p1[1]));
    }
  }
  P.push(pts[n - 1][0], pts[n - 1][1]);
  const m = P.length / 2, L = [], Rr = [];
  let a0 = 0, a1 = 0;
  for (let i = 0; i < m; i++) {
    const ia = Math.max(0, i - 1) * 2, ib = Math.min(m - 1, i + 1) * 2;
    let dx = P[ib] - P[ia], dy = P[ib + 1] - P[ia + 1];
    const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const f = (i / (m - 1)) * (W.length - 1), k = Math.min(W.length - 2, Math.floor(f)), h = (W[k] + (W[k + 1] - W[k]) * (f - k)) / 2;
    L.push([P[i * 2] - dy * h, P[i * 2 + 1] + dx * h]); Rr.push([P[i * 2] + dy * h, P[i * 2 + 1] - dx * h]);
    if (i === 0) a0 = Math.atan2(dy, dx); if (i === m - 1) a1 = Math.atan2(dy, dx);
  }
  const out = L, cap = (x, y, ang, h) => { for (let i = 1; i < 5; i++) { const u = ang + Math.PI / 2 - (i / 5) * Math.PI; out.push([x + Math.cos(u) * h, y + Math.sin(u) * h]); } };
  cap(P[(m - 1) * 2], P[(m - 1) * 2 + 1], a1, W[W.length - 1] / 2);
  for (let i = m - 1; i >= 0; i--) out.push(Rr[i]);
  cap(P[0], P[1], a0 + Math.PI, W[0] / 2);
  return out;
}

// piecewise smooth key frames: keys = [[u, value], …]
function keyed(keys, u) {
  if (u <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) if (u <= keys[i][0]) { const a = keys[i - 1], b = keys[i]; return lerp(a[1], b[1], smooth((u - a[0]) / (b[0] - a[0]))); }
  return keys[keys.length - 1][1];
}
// the leap, u = 0 take-off … 1 touch-down. Leg directions in the body frame (0 = forwards, π/2 = down, π = backwards), reach = share of the leg's length.
const LEAPK = {
  stretch: [[0, 1.04], [0.45, 1.2], [0.8, 1.06], [1, 0.96]], arch: [[0, -1], [0.5, -3], [0.8, 0.5], [1, 2.5]],
  fa: [[0, 1.95], [0.22, 1.5], [0.5, 0.22], [0.76, 0.72], [1, 1.25]], fr: [[0, 0.62], [0.22, 0.5], [0.5, 0.97], [0.76, 1], [1, 1]],
  fcurl: [[0, 1], [0.25, 1], [0.45, 0.1], [0.85, 0], [1, 0]],
  ha: [[0, 2.2], [0.25, 2.65], [0.5, 2.88], [0.74, 2.15], [1, 1.75]], hr: [[0, 1], [0.25, 0.97], [0.5, 0.93], [0.74, 0.72], [1, 0.74]],
  hbend: [[0, 0.1], [0.5, 0.2], [0.74, 0.65], [1, 0.55]],
  ta: [[0, 3.25], [0.5, 3.15], [0.85, 3.55], [1, 3.85]], tc: [[0, 0.04], [0.5, -0.02], [1, 0.2]], ear: [[0, 0.3], [0.5, 0.55], [1, 0.2]]
};

// One cat's measurements from its kind multipliers (recomputed every frame: c.leg etc. may change).
// A young cat is not a small grown-up: legs shorter, trunk shorter and rounder, head and paws bigger —
// all following c.leg / c.head, so a kitten that grows (scene 3) changes its proportions as it grows.
function dims(c, d) {
  const leg = c.leg || 1, young = 1 - leg, L = Math.pow(leg, 1.5);
  d.L = L; d.B = c.body || 1 - young * 0.9; d.G = c.girth || 1 + young * 0.3; d.H = Math.pow(c.head || 1, 1.3);
  d.PW = c.paw || 1 + young; d.T = c.tail || 1; d.EYE = 1 + young * 0.6;
  d.fem = 11.5 * L; d.tib = 12.5 * L; d.met = 9 * L; d.hum = 10.5 * L; d.rad = 12 * L; d.pas = 3.6 * L;
  d.pawY = 1.8 * d.PW;
  d.hipH = d.pawY + 26.2 * L;              // hip height standing
  return d;
}

// ── base poses (write a full pose into o) ──
function poseStand(d, o) {
  const B = d.B, py = -d.pawY;
  o[HX] = -1.5 - 16 * B; o[HY] = -(d.pawY + 26.2 * d.L);
  o[SX] = -1.5 + 16 * B; o[SY] = -(d.pawY + 25.3 * d.L);
  o[ARCH] = 0; o[GIRTH] = 1; o[TUCK] = 1; o[FAR] = 4; o[ARM] = 1; o[CHEST] = 1;
  o[NX] = 13.5 + 2 * B; o[NY] = -21; o[TURN] = 0.75; o[NOD] = 0.04; o[TILT] = 0;
  o[NHX] = o[HX] + 1.5; o[NHY] = py; o[FHX] = o[HX] + 1.5; o[FHY] = py;
  o[NFX] = o[SX] - 0.5; o[NFY] = py; o[FFX] = o[SX] - 0.5; o[FFY] = py;
  o[NHK] = 0.22; o[FHK] = 0.22; o[NFW] = 0.3; o[FFW] = 0.3;
  o[TA] = 3.58; o[TC] = 0.36; o[TH] = 0.5; o[TGND] = 0; o[TZ] = 0;
  o[EAR] = 0; o[LID] = 0; o[HAPPY] = 0; o[MOUTH] = 0; o[TONG] = 0; o[PUP] = 0;
}
function poseSit(d, o) {
  poseStand(d, o);
  const B = d.B, py = -d.pawY;
  o[HX] = -8 * B; o[HY] = -9.5;
  o[SX] = 11 * B; o[SY] = -(d.pawY + 25.6 * d.L);
  o[ARCH] = 3; o[GIRTH] = 1.08; o[TUCK] = 0; o[FAR] = 3.5; o[CHEST] = 0.3;
  o[NX] = 2.5; o[NY] = -27; o[TURN] = 0.85; o[NOD] = 0.08;
  o[NHX] = 1.5 * B; o[NHY] = py; o[FHX] = 1.5 * B; o[FHY] = py; o[NHK] = 1.42; o[FHK] = 1.42;
  o[NFX] = o[SX] + 1.5; o[FFX] = o[SX] + 1.5; o[NFW] = 0.05; o[FFW] = 0.05;
  o[TA] = 2.0; o[TC] = -0.5; o[TH] = -0.1; o[TGND] = 1; o[TZ] = 1;
}
function poseCurl(d, o) {
  poseStand(d, o);
  const B = d.B, py = -d.pawY;
  o[HX] = -11 * B; o[HY] = -10.5; o[SX] = 8 * B; o[SY] = -10;
  o[ARCH] = 6.5; o[GIRTH] = 0.92; o[TUCK] = 0; o[FAR] = 2;
  o[NX] = 7; o[NY] = 1; o[TURN] = 0.85; o[NOD] = -0.28; o[TILT] = 0.15;
  o[NHX] = -2; o[NHY] = py; o[FHX] = -2; o[FHY] = py; o[NHK] = 1.45; o[FHK] = 1.45;
  o[NFX] = o[SX] + 6; o[FFX] = o[SX] + 5; o[NFY] = py; o[FFY] = py; o[NFW] = 1.4; o[FFW] = 1.4;
  o[TA] = 1.95; o[TC] = -0.3; o[TH] = -0.1; o[TGND] = 1; o[TZ] = 2;
  o[LID] = 1;
}
function poseUpright(d, o) {
  poseStand(d, o);
  const py = -d.pawY;
  o[HX] = -1.5; o[HY] = -26; o[SX] = 1; o[SY] = -41;
  o[ARCH] = -1.5; o[GIRTH] = 0.86; o[TUCK] = 0; o[FAR] = 2; o[ARM] = 0.76;
  o[NX] = 1; o[NY] = -16; o[TURN] = 0.8; o[NOD] = 0.04;
  o[NHX] = 3; o[NHY] = py; o[FHX] = 0.5; o[FHY] = py; o[NHK] = 1.35; o[FHK] = 1.35;
  o[NFX] = 3.5; o[NFY] = -22.5; o[FFX] = 2.5; o[FFY] = -23; o[NFW] = 0.1; o[FFW] = 0.1;
  o[TA] = 2.75; o[TC] = 0.2; o[TH] = 0.5; o[TGND] = 0; o[TZ] = 0;
}
// the leap at u (written over a stand pose in o)
function poseLeap(d, o, u) {
  poseStand(d, o);
  const st = keyed(LEAPK.stretch, u), cx = -1.5, half = 15.5 * d.B * st, y0 = -28 * d.L;
  o[HX] = cx - half; o[SX] = cx + half; o[HY] = y0; o[SY] = y0 + 0.5;
  o[ARCH] = keyed(LEAPK.arch, u); o[TUCK] = 1;
  o[NX] = 15 + d.B; o[NY] = -14; o[TURN] = 0.18;
  const fl = d.hum + d.rad + d.pas, hl = d.fem + d.tib + d.met;
  const legF = (ix, iy, iw, lag) => {
    const a = keyed(LEAPK.fa, clamp01(u - lag)) + lag * 2, r = keyed(LEAPK.fr, clamp01(u - lag)) * fl, curl = keyed(LEAPK.fcurl, clamp01(u - lag));
    o[ix] = o[SX] + Math.cos(a) * r; o[iy] = o[SY] + Math.sin(a) * r; o[iw] = Math.PI / 2 - a - 0.15 - curl * 1.9;
  };
  const legH = (ix, iy, ik, lag) => {
    const a = keyed(LEAPK.ha, clamp01(u - lag)) + lag, r = keyed(LEAPK.hr, clamp01(u - lag)) * hl;
    o[ix] = o[HX] + Math.cos(a) * r; o[iy] = o[HY] + Math.sin(a) * r; o[ik] = Math.PI / 2 - a + keyed(LEAPK.hbend, u);
  };
  legF(NFX, NFY, NFW, 0); legF(FFX, FFY, FFW, 0.13);
  legH(NHX, NHY, NHK, 0); legH(FHX, FHY, FHK, 0.09);
  o[TA] = keyed(LEAPK.ta, u); o[TC] = keyed(LEAPK.tc, u); o[TH] = 0.2;
  o[EAR] = keyed(LEAPK.ear, u); o[PUP] = 0.35;
}

// one paw through a gait cycle: p = the leg's phase (0 = touch-down), duty = share in stance
// → writes [x offset in strides, lift 0..1, swing 0..1 (0 in stance)] into g. In stance the paw goes
// back by exactly duty strides while the body goes forward by as much: it stays planted.
function gaitLeg(p, duty, g) {
  p -= Math.floor(p);
  const h = duty / 2;
  if (p < duty) { g[0] = h - p; g[1] = 0; g[2] = 0; return g; }
  const s = (p - duty) / (1 - duty);
  g[0] = -h + duty * smooth(s * 1.08 - 0.04); g[1] = Math.pow(Math.sin(Math.PI * s), 0.8); g[2] = s;
  return g;
}
const GAITS = {            // touch-down offsets NH, NF, FH, FF and duty factor
  walk: [0, 0.25, 0.5, 0.75, 0.65], trot: [0, 0.5, 0.5, 1, 0.5], bound: [0, 0.38, 0.06, 0.46, 0.3]
};

export class Cat {
  constructor(o) {
    o = o || {};
    const k = CAT_KINDS[o.kind || 'papa'] || CAT_KINDS.papa;
    this.kind = o.kind || 'papa';
    this.c = Object.assign({}, k, o.colors || {});
    this.size = o.size || k.size;
    this.x = o.x || 0; this.y = o.y || 0; this.dir = o.dir || 1;
    this.mode = 'stand';            // 'stand' | 'sit' | 'curl' | 'upright'
    this.crouch = 0;                // 0..1 (aiming / about to leap)
    this.air = 0;                   // 0..1 while leaping
    this.pitch = 0;                 // body pitch in the air
    this.headDown = 0;              // 0..1 (drinking / sniffing)
    this.walk = 0;                  // old walk phase (radians); the gait follows the distance moved instead
    this.walking = 0;               // 0..1: the scene says the cat walks (marks time if it is not moved)
    this.eyes = 'open';             // 'open' | 'happy' | 'closed' | 'wide'
    this.look = null;               // {x, y} world point to look at (turns the head, not only the pupils)
    this.carry = 0;                 // number of bundles in the teeth (0..2)
    this.bundleSize = 1;
    this.bindle = false;            // upright: stick with a bundle over the shoulder
    this.armUp = 0;                 // upright: the near arm raised in a wave (0..1; the paw rocks)
    this.armHold = 0;               // upright: the near arm held out steadily (0..1) …
    this.armReach = 2.3;            // …in this direction: radians from hanging straight down, forwards (π/2 = straight ahead, π = straight up)
    this.tailCurl = 0;              // 0..1: the tip of the tail curls and uncurls slowly, with pleasure
    this.glowing = 0;               // moon-milk glow 0..1
    this.tongue = 0;                // lapping 0..1
    this.light = 0;                 // 0 = dark (wide pupils) … 1 = bright day (narrow)
    this.hidden = false;
    this.fidget = true;             // small signs of life when nothing is asked of the cat
    this.idleSit = false;           // …and may it sit down by itself after a while? (only where a scene allows it)
    this.headTurn = null; this.headNod = null; this.headTilt = null; this.lids = null;   // overrides (null = automatic)
    this.seed = o.seed || Math.floor(Math.random() * 1e5);
    this.sq = { x: 0, v: 0 };       // landing squash spring
    this.swing = { x: 0, v: 0 };    // bundle pendulum
    this.tailA = { x: 0, v: 0 };    // tail lag
    this._px = this.x; this._py = this.y; this.vx = 0; this.vy = 0;
    this._blink = 2 + Math.random() * 3; this._blinkT = 0;
    this._ear = 0;
    this.jump = null;
    this.calm = 0;                  // seconds since anything was asked of the cat
    this._act = null;               // {kind, t, dur, sd}
    this._actIn = 1.5 + Math.random() * 3;
    this._sitting = false;          // settled into a sit by itself (`mode` is left alone)
    this._sitIn = 5 + Math.random() * 4;
    this._gaze = { x: 0, v: 0 }; this._gazeTo = 0; this._gazeIn = 1 + Math.random() * 2;
    this._meow = 0; this._meowDur = 0.3;
    this._d = this.dir;             // drawn facing (-1..1): a turn goes through 0 (seen end-on, head full face)
    this._pre = 0;                  // gathering itself just before a leap, 0..1
    this._ju = 1;                   // progress of the current / last leap
    // rig state
    this.d = dims(this.c, {});
    this.T = new Float64Array(NP); this.P = new Float64Array(NP); this.V = new Float64Array(NP); this.D = new Float64Array(NP);
    this._om = new Float64Array(6).fill(9);
    this._mode = this.mode; this._modeT = 9;
    poseStand(this.d, this.P); this.T.set(this.P); this.D.set(this.P);
    this._gx = this.x; this._phase = 0; this._spd = 0; this._gw = 0; this._g = [0, 0, 0];
    this._lookTurn = 0.75; this._lookNod = 0; this._plx = 0; this._ply = 0;
    this._leapLook = null;
    this._gaitDbg = null;           // lab: {phase, speed} freezes the gait at a phase
    this.J = {
      hip: [0, 0], sh: [0, 0], ctrl: [0, 0], rot: 0, cx: 0, cy: 0,
      nh: [[0, 0], [0, 0], [0, 0], [0, 0]], fh: [[0, 0], [0, 0], [0, 0], [0, 0]],      // joint, knee/elbow, hock/wrist, paw
      nf: [[0, 0], [0, 0], [0, 0], [0, 0]], ff: [[0, 0], [0, 0], [0, 0], [0, 0]],
      head: [0, 0], hrot: 0, neck: [0, 0], tail: [], tw: [], scap: 0,
      nose: [0, 0], mouth: [0, 0], top: [0, 0], ear: [0, 0], st: [false, false, false, false]       // st: in stance (NH, NF, FH, FF)
    };
    for (let i = 0; i < 9; i++) { this.J.tail.push([0, 0]); this.J.tw.push(0); }
    this._m = [0, 0];
    this._fresh = true;
    this._solve(0);
  }

  // ── motion ──
  // Leap along a parabola to (x, y), after a blink of gathering. Returns the whole duration in seconds.
  leapTo(x, y, o) {
    o = o || {};
    const dx = x - this.x, dy = y - this.y, d = Math.hypot(dx, dy);
    const h = o.height !== undefined ? o.height : 34 + d * 0.22 + Math.max(0, -dy) * 0.25;
    const dur = o.dur || clamp(0.34 + d / 620, 0.36, 0.8);
    let pre = o.pre !== undefined ? o.pre : d < 24 ? 0.05 : 0.1;
    if (o.pre === undefined && (this.sitting || this.mode === 'curl' || this._mode === 'sit' || this._mode === 'curl')) pre += 0.14;   // up from a sit first
    this.jump = { x0: this.x, y0: this.y, x1: x, y1: y, h, dur, t: 0, pre, pre0: pre, from: Math.max(this.crouch, this._pre), done: o.done || null, small: d < 24 };
    if (Math.abs(dx) > 2) this.dir = dx > 0 ? 1 : -1;
    this.crouch = 0;
    this.mode = 'stand';
    this.wake();
    return dur + pre;
  }
  land(strength) { this.sq.v += 7 * (strength === undefined ? 1 : strength); }
  hopInPlace(h) {
    if (this.jump) { this.sq.v += 5; return; }        // mid-leap: a squash of delight, never a new jump that would lose the landing
    this.leapTo(this.x, this.y, { height: h || 14, dur: 0.3 });
  }
  // open the mouth for a meow / a mrrp
  meow(dur) { this._meowDur = dur || 0.34; this._meow = this._meowDur; }
  // drop whatever idle business is going on (the cat is needed)
  wake() { this.calm = 0; this._act = null; this._sitIn = 5 + Math.random() * 4; this._sitting = false; }
  // true while the cat sits or is settling into a sit (the scene's mode or a sit of its own accord)
  get sitting() { return this.mode === 'sit' || (this.mode === 'stand' && this._sitting); }
  // ask for a bit of acting: look ears tilt yawn lick stretch slowblink knead pounce bow
  act(kind, o) {
    const a = ACTS[kind];
    if (!a) return false;
    this._act = { kind, t: 0, dur: (o && o.dur) || a.dur, pose: !!a.pose, sd: (o && o.side) || (Math.random() < 0.5 ? -1 : 1) };
    this._actIn = 2 + Math.random() * 3;
    if (Cat.onAct) Cat.onAct(this, kind);
    return true;
  }
  // world point of a part: mouth nose headTop head ear neck back chest pawFront hand tailTip
  anchor(name, out) {
    const p = this._local(name), s = this.size, fs = this._fs();
    out = out || { x: 0, y: 0 };
    out.x = this.x + p[0] * fs * s; out.y = this.y + p[1] * s;
    return out;
  }
  // the same point in the cat's own frame (what is drawn after cat.frame(ctx) — clothes, a flower)
  localAnchor(name, out) {
    const p = this._local(name);
    out = out || { x: 0, y: 0 };
    out.x = p[0]; out.y = p[1];
    return out;
  }
  _local(name) {
    const J = this.J, m = this._m;
    let p;
    switch (name) {
      case 'mouth': p = J.mouth; break;
      case 'nose': p = J.nose; break;
      case 'headTop': p = J.top; break;
      case 'head': p = J.head; break;
      case 'ear': p = J.ear; break;
      case 'neck': p = J.neck; break;
      case 'back': this._map(0.5, 0, 13, m); p = m; break;
      case 'chest': this._map(1, 6, -4, m); p = m; break;
      case 'pawFront': case 'hand': p = J.nf[3]; break;
      case 'tailTip': p = J.tail[J.tail.length - 1]; break;
      default: p = J.head;
    }
    return p;
  }
  _fs() { const d = this._d; return d < 0 ? Math.min(d, -0.22) : Math.max(d, 0.22); }
  // translate + scale to the cat's own frame (feet at the origin, facing +x)
  frame(ctx) {
    ctx.translate(this.x, this.y);
    ctx.scale(this._fs() * this.size, this.size);
  }

  update(dt, t) {
    const j = this.jump;
    if (j) {
      this.calm = 0;
      if (j.pre > 0) {                                   // gather: sink down for a moment, then go
        j.pre -= dt;
        this._pre = lerp(j.from, 1, clamp01(1 - j.pre / j.pre0));
        this.air = approach(this.air, 0, 18, dt);
      } else {
        this._pre = 0;
        j.t += dt;
        const u = clamp01(j.t / j.dur);
        const nx = lerp(j.x0, j.x1, u), ny = lerp(j.y0, j.y1, u) - 4 * j.h * u * (1 - u);
        const sl = (j.y1 - j.y0 - 4 * j.h * (1 - 2 * u)) / j.dur, vxx = (j.x1 - j.x0) / j.dur;
        this.pitch = approach(this.pitch, clamp(Math.atan2(sl, Math.abs(vxx) + 60), -0.9, 0.9) * clamp01(Math.abs(j.x1 - j.x0) / (50 * this.size)), 22, dt);
        this.air = Math.sin(Math.PI * clamp01(u * 1.12));
        this._ju = u;
        this.x = nx; this.y = ny;
        if (u >= 1) {
          this.x = j.x1; this.y = j.y1; this.jump = null; this.air = 0;
          this.land(clamp(j.h / 60, 0.5, 1.4));
          if (j.done) j.done();
        }
      }
    } else {
      this._pre = approach(this._pre, 0, 16, dt);
      this.air = approach(this.air, 0, 18, dt);
      this.pitch = approach(this.pitch, 0, 12, dt);
    }
    // a scene that puts the cat somewhere else (a teleport) moves the whole cat cleanly: no fling, no gait
    if (!j && Math.hypot(this.x - this._px, this.y - this._py) > 60 * this.size) { this._px = this.x; this._py = this.y; this._gx = this.x; }
    if (dt > 1e-4) {                                       // (a redraw with dt = 0 must not read as a fling)
      const idt = 1 / dt;
      this.vx = (this.x - this._px) * idt;
      this.vy = (this.y - this._py) * idt;
      this._px = this.x; this._py = this.y;
    }
    spring(this.sq, 0, dt, 180, 13);
    spring(this.swing, clamp(-this.vx * this.dir * 0.0022, -0.9, 0.9), dt, 60, 5);
    spring(this.tailA, clamp(-this.vy * 0.0016 + this.vx * this.dir * 0.0012, -1, 1), dt, 45, 7);
    // turning round: the drawn facing passes through 0 (end-on)
    if (this._d !== this.dir) { const k = dt * (this.jump ? 18 : 7); this._d = Math.abs(this.dir - this._d) <= k ? this.dir : this._d + Math.sign(this.dir - this._d) * k; }
    this._blink -= dt;
    if (this._blink < 0) { this._blinkT = 0.15; this._blink = 2.2 + Math.random() * 4; if (Math.random() < 0.4) this._ear = 0.25; }
    if (this._blinkT > 0) this._blinkT -= dt;
    if (this._ear > 0) this._ear -= dt;
    if (this._meow > 0) this._meow -= dt;
    if (this._wakeIn > 0 && (this._wakeIn -= dt) <= 0 && this.mode === 'stand' && !this.jump && this.walking < 0.5) this.act('stretch');
    this._idle(dt);
    this.d = dims(this.c, this.d);
    this._curlW = approach(this._curlW || 0, this.mode === 'curl' ? 1 : 0, 6, dt);
    this._gait(dt);
    this._target(t, dt);
    if (this._fresh) { this._fresh = false; this.P.set(this.T); this.V.fill(0); this._mode = this.mode === 'stand' && this._sitting ? 'sit' : this.mode; this._modeT = 9; }   // first frame: start in whatever pose the scene set up
    this._springs(dt);
    this._layers(t);
    this._solve(t);
    this._looks(dt);
  }

  // Nobody is asking anything of the cat: it looks about, tilts its head, yawns, licks a paw…
  _idle(dt) {
    const a = this._act;
    if (a) { a.t += dt; if (a.t >= a.dur) this._act = null; }
    if (Cat.still) { this.calm = 0; return; }
    const still = !this.jump && !this.hidden && this.crouch < 0.05 && this.walking < 0.05 && this.headDown < 0.05 && this.air < 0.05 && this.tongue < 0.05 && Math.abs(this.vx) + Math.abs(this.vy) < 30;
    const awake = still && this.fidget && this.mode !== 'curl' && this.eyes === 'open';
    this.calm = still ? this.calm + dt : 0;
    if (this._act && (!still || (this._act.pose && this.mode !== 'stand'))) this._act = null;
    this._gazeIn -= dt;
    if (this._gazeIn < 0) { this._gazeIn = 1.2 + Math.random() * 3.2; this._gazeTo = awake && !this.look ? [-1, -0.5, 0, 0, 0.6, 1][Math.floor(Math.random() * 6)] : 0; }
    spring(this._gaze, awake && !this.look ? this._gazeTo : 0, dt, 40, 10);
    if (!this._act && awake && this.calm > 1.2) {
      this._actIn -= dt;
      if (this._actIn < 0) {
        const kit = this.c.head > 1.1, r = Math.random(), free = this.carry === 0 && !this.bindle, stand = this.mode === 'stand' && !this._sitting;
        let kind = 'tilt';
        if (r < 0.16 && free) kind = 'yawn';
        else if (r < 0.32 && free && this.mode !== 'upright') kind = 'lick';
        else if (r < 0.42 && stand && free && this.idleSit) kind = 'stretch';
        else if (r < 0.54 && stand && kit) kind = 'pounce';
        else if (r < 0.64) kind = 'ears';
        else if (r < 0.78) kind = 'look';
        else if (r < 0.88) kind = 'slowblink';
        if (this.look && (kind === 'look' || kind === 'tilt' || kind === 'slowblink')) kind = 'ears';    // the scene is directing its gaze: leave the head alone
        this.act(kind);
        this._actIn = (kit ? 1.6 : 2.6) + Math.random() * (kit ? 3 : 4.5);
      }
    }
    // after a good while with nothing to do, sit down (where the scene lets it)
    if (this.idleSit && still && this.mode === 'stand' && !this._sitting && !(this._act && this._act.pose)) {
      this._sitIn -= dt;
      if (this._sitIn < 0) this._sitting = true;
    } else if (this._sitting && (!still || this.mode !== 'stand' || !this.idleSit)) { this._sitting = false; this._sitIn = 5 + Math.random() * 4; }
  }
  // 0..1 envelope of the current act `kind` (rises, holds, falls)
  _doing(kind) { const a = this._act; if (!a || a.kind !== kind) return 0; const p = a.t / a.dur; return smooth(Math.min(1, p * 4, (1 - p) * 4)); }

  // gait phase from the distance actually travelled
  _gait(dt) {
    const d = this.d, onGround = !this.jump && this.air < 0.05;
    const dx = (this.x - this._gx) / this.size; this._gx = this.x;
    const spd = Math.abs(dx) / Math.max(dt, 1e-3);
    this._spd = approach(this._spd, onGround ? spd : 0, 10, dt);
    const upright = this.mode === 'upright';
    const hip = upright ? 20 * d.L : d.hipH;
    const moving = onGround && this._spd > 3;
    this._gw = approach(this._gw, moving || (this.walking > 0.5 && onGround) ? 1 : 0, moving ? 10 : 5, dt);
    const v = this._spd / hip;
    this._stride = hip * (upright ? 1.6 : lerp(1.25, 2.2, clamp01((v - 1) / 6)));
    if (this._gaitDbg) { this._phase = this._gaitDbg.phase; this._spd = this._gaitDbg.speed; this._gw = 1; this._stride = hip * (upright ? 1.6 : lerp(1.25, 2.2, clamp01((this._spd / hip - 1) / 6))); }
    else if (moving) this._phase += Math.abs(dx) / this._stride;
    else if (this.walking > 0.5 && onGround) this._phase += dt * 0.7;          // marking time
    else if (this._gw > 0.02) {                                                  // stopping: finish the step in progress
      const q = this._phase * 2, f = q - Math.floor(q);
      if (f > 0.02 && f < 0.98) this._phase += dt * 1.2;
    }
    if (upright) this.walk = this._phase * TAU;                                  // (garden-art.js reads it for the clothes)
  }

  // ── the target pose ──
  _target(t, dt) {
    const d = this.d, T = this.T, P = this.P;
    const mode = this.mode === 'stand' && this._sitting ? 'sit' : this.mode;
    if (mode !== this._mode) {
      const down = mode === 'sit' || mode === 'curl', up = this._mode === 'sit' || this._mode === 'curl';
      this._om[0] = down ? 10 : up ? 5 : 8; this._om[1] = down ? 5.5 : up ? 10 : 8;
      this._om[2] = 7; this._om[4] = 7;
      if (this._mode === 'curl' && mode === 'stand' && this.fidget && !Cat.still) this._wakeIn = 0.6;     // waking up: a good stretch
      this._mode = mode; this._modeT = 0;
    }
    this._modeT += dt;
    if (this._modeT > 1.4) { this._om[0] = 9; this._om[1] = 9; this._om[2] = 8; this._om[4] = 8; }
    this._om[3] = 14; this._om[5] = this._modeT < 1.3 ? 6.5 : 9;
    const tr = this._modeT < 0.6 ? 1 : Math.max(0, 1 - (this._modeT - 0.6) / 0.7);   // changing pose: the tail sweeps round curled up, off the ground, then settles
    const j = this.jump;
    if (j && j.pre <= 0) {                                    // in the air: the leap's own key poses
      if (j.small) { poseStand(d, T); this._crouchMod(T, 0.15 * Math.sin(Math.PI * this._ju), 0); const fold = Math.sin(Math.PI * this._ju); T[NHY] -= 6 * fold; T[FHY] -= 6 * fold; T[NFY] -= 7 * fold; T[FFY] -= 7 * fold; }
      else poseLeap(d, T, this._ju);
      this._om[0] = 42; this._om[1] = 30; this._om[4] = 30; this._om[2] = 14;
    } else {
      if (mode === 'sit') poseSit(d, T); else if (mode === 'curl') poseCurl(d, T); else if (mode === 'upright') poseUpright(d, T); else poseStand(d, T);
      const cr = Math.max(this.crouch, this._pre);
      if (j) { this._om[0] = 16; this._om[1] = 16; this._om[4] = 16; }       // gathering for a leap: quick
      if (cr > 0 && mode !== 'upright') this._crouchMod(T, cr, this._pre);
      if (this.headDown > 0 && mode !== 'upright') this._headDownMod(T, this.headDown);
      if (mode === 'upright') this._uprightArms(T, t);
      if (this._act) this._actMod(T, t);
    }
    if (tr > 0 && this._mode !== 'upright') { T[TC] = lerp(T[TC], Math.max(T[TC], 0.42), tr); T[TH] = lerp(T[TH], Math.max(T[TH], 0.6), tr); T[TGND] *= 1 - tr; }
    // the tail acts: a slow drift of its own, streaming in a run, a swish while watching, high when content
    if (!j && mode === 'stand') {
      const sd = this.seed, still = Cat.still ? 0 : 1;
      T[TA] += 0.13 * noise1(t * 0.17, sd) * still; T[TC] += 0.07 * noise1(t * 0.12, sd + 7) * still; T[TH] += 0.28 * noise1(t * 0.14, sd + 3) * still;
      const run = smooth((this._spd / d.hipH - 2) / 2.5) * this._gw;
      if (run > 0) { T[TA] = lerp(T[TA], 3.25, run); T[TC] = lerp(T[TC], 0.06, run); T[TH] = lerp(T[TH], 0.18, run); }
      if (this.look && this._gw < 0.3 && this.crouch < 0.2) { T[TA] += 0.2 * Math.sin(t * 1.5 + sd) * still; T[TC] = lerp(T[TC], 0.2, 0.6); T[TH] += 0.2; }
      if (this.eyes === 'happy') { T[TA] = lerp(T[TA], 3.95, 0.8); T[TC] = lerp(T[TC], 0.22, 0.8); T[TH] = 0.75; }
    }
    if (this.tailCurl > 0) {                         // the tip curls in and slowly lets go again
      const k = clamp01(this.tailCurl), w = Cat.still ? 0.6 : 0.55 + 0.45 * Math.sin(t * 1.25 + this.seed);
      T[TH] += k * (0.35 + 0.95 * w); T[TC] += k * 0.06;
    }
    // the head: where it looks
    if (!j || j.pre > 0) T[TURN] = this._lookTurn + (T[TURN] - 0.75);
    if (this.walking > 0.5 || this._gw > 0.5) T[TURN] = lerp(T[TURN], Math.min(T[TURN], 0.28), this._gw);
    if (this.look) T[NOD] += this._lookNod;
    if (j && this._leapLook !== null) T[NOD] += this._leapLook;
    // face
    const happy = this.eyes === 'happy' ? 1 : 0;
    if (happy) { T[TURN] = lerp(T[TURN], 0.95, 0.8); T[HAPPY] = 1; T[LID] = 1; }
    if (this.eyes === 'closed') T[LID] = 1;
    if (this.eyes === 'wide') { T[LID] = -0.12; T[PUP] += 0.25; }
    if (this.lids !== null) T[LID] = this.lids;
    if (this.headTurn !== null) T[TURN] = this.headTurn;
    if (this.headNod !== null) T[NOD] = this.headNod;
    if (this.headTilt !== null) T[TILT] = this.headTilt;
    const meow = this._meow > 0 ? Math.sin(Math.PI * clamp01(1 - this._meow / this._meowDur)) : 0;
    if (meow > 0) { T[MOUTH] = Math.max(T[MOUTH], meow * 0.75); T[NOD] += meow * 0.12; }
    T[TONG] = Math.max(T[TONG], this.tongue);
    if (this.crouch > 0.5) T[PUP] += 0.3;
  }
  _crouchMod(T, k, pre) {
    T[HY] += 7 * k + 4 * pre; T[SY] += 9.5 * k + 2.5 * pre; T[HX] -= 2 * k + 3 * pre; T[SX] -= 2 * pre; T[NHX] += 3 * pre; T[FHX] += 3 * pre;
    T[NY] += 5 * k; T[NX] += 2 * k; T[ARCH] -= 1.5 * k; T[NOD] += 0.12 * k;
    T[NFX] += 3 * k; T[FFX] += 3 * k; T[NHX] -= 1 * k; T[FHX] -= 1 * k; T[NHK] += 0.35 * k; T[FHK] += 0.35 * k;
    T[TA] = lerp(T[TA], 2.95, k); T[TC] = lerp(T[TC], 0.04, k); T[TH] = lerp(T[TH], 0.35, k); T[EAR] += 0.15 * k;
  }
  _headDownMod(T, k) {
    T[NX] += 6 * k; T[NY] += 20 * k; T[NOD] -= 0.7 * k; T[TURN] = lerp(T[TURN], 0.45, k);
    T[SY] += 6.5 * k; T[SX] += 1 * k; T[NFX] += 2 * k; T[FFX] += 2 * k; T[NFW] += 0.25 * k; T[FFW] += 0.25 * k;
    T[HY] -= 2.5 * k; T[TA] = lerp(T[TA], 3.3, k * 0.6); T[LID] = Math.max(T[LID], 0.5 * k);
  }
  _uprightArms(T, t) {
    const up = this.armUp, b = this.bindle ? 1 : 0, hold = clamp01(this.armHold);
    // the bindle: the near paw holds the stick in front of the chest
    if (b) { T[NFX] = 8.5; T[NFY] = -33; T[NFW] = -1.4; }
    // a steady reach / hold: the arm straight out from the shoulder in the asked direction
    if (hold > 0) {
      const a = this.armReach, r = 19 * this.d.L;
      T[NFX] = lerp(T[NFX], T[SX] + Math.sin(a) * r, hold); T[NFY] = lerp(T[NFY], T[SY] + Math.cos(a) * r, hold); T[NFW] = lerp(T[NFW], a - 0.15, hold);
    }
    // a wave: the arm raised from the shoulder, forward of the face, the paw rocking
    if (up > 0) {
      const a = 0.95 + (Cat.still ? 0 : 0.3 * Math.sin(t * 7.5)), r = 19.4 * this.d.L, sx = T[SX], sy = T[SY];
      T[NFX] = lerp(T[NFX], sx + Math.sin(a) * r, up); T[NFY] = lerp(T[NFY], sy - Math.cos(a) * r, up); T[NFW] = lerp(T[NFW], 2.6 - (a - 0.95), up);
    }
  }
  _actMod(T, t) {
    const a = this._act, e = smooth(Math.min(1, (a.t / a.dur) * 4, (1 - a.t / a.dur) * 4)), p = a.t / a.dur, sit = this._mode === 'sit', up = this._mode === 'upright';
    switch (a.kind) {
      case 'look': T[TURN] = lerp(T[TURN], a.sd > 0 ? 1.65 : 0.15, e); T[NOD] += 0.08 * e; break;
      case 'tilt': T[TILT] += 0.34 * a.sd * e; T[TURN] = lerp(T[TURN], 1, e); break;
      case 'bow': {                                  // a bow: from the waist when upright, a dip of the head on all fours
        const b = smooth(Math.min(1, p * 3.2, (1 - p) * 2.4));
        if (up) { T[SX] += 13 * b; T[SY] += 8 * b; T[NX] += 6 * b; T[NY] += 5 * b; T[NOD] -= 0.55 * b; T[TURN] = lerp(T[TURN], 0.55, b); T[NFX] += 9 * b; T[FFX] += 9 * b; T[NFY] += 7 * b; T[FFY] += 7 * b; T[HX] -= 3 * b; T[TA] += 0.25 * b; T[LID] = Math.max(T[LID], 0.6 * b); }
        else { T[NY] += 6 * b; T[NX] += 2 * b; T[NOD] -= 0.5 * b; T[SY] += 2 * b; T[LID] = Math.max(T[LID], 0.6 * b); }
        break;
      }
      case 'ears': T[EAR] += 0.25 * e * Math.sin(p * 14); break;
      case 'yawn': T[MOUTH] = Math.max(T[MOUTH], smooth(Math.min(1, p * 3, (1 - p) * 3.5))); T[LID] = Math.max(T[LID], e); T[NOD] += 0.38 * e; T[EAR] += 0.5 * e; T[TONG] = Math.max(T[TONG], 0.45 * e); break;
      case 'slowblink': { const b = smooth(Math.min(1, p * 2.6, (1 - p) * 2.2)); T[LID] = Math.max(T[LID], b); T[TURN] = lerp(T[TURN], 1, e); break; }
      case 'lick': {
        if (up) break;
        const fx = sit ? T[SX] + 8 : T[SX] + 9, fy = sit ? T[SY] - 13 : T[SY] - 2;
        T[NFX] = lerp(T[NFX], fx, e); T[NFY] = lerp(T[NFY], fy, e); T[NFW] = lerp(T[NFW], -1.4, e);
        T[NX] -= 3 * e; T[NY] += (sit ? 4 : 9) * e; T[NOD] -= 0.45 * e; T[TURN] = lerp(T[TURN], 0.55, e); T[LID] = Math.max(T[LID], 0.85 * e);
        T[TONG] = Math.max(T[TONG], e > 0.6 ? Math.max(0, Math.sin(t * 13)) * 0.9 : 0);
        if (!sit) { T[HX] -= 2 * e; T[SY] += 2 * e; }
        break;
      }
      case 'stretch':
        T[SY] += 11 * e; T[SX] += 3 * e; T[NFX] += 13 * e; T[FFX] += 13 * e; T[NFW] = lerp(T[NFW], 1.3, e); T[FFW] = lerp(T[FFW], 1.3, e);
        T[HY] -= 1.5 * e; T[ARCH] -= 3.5 * e; T[NY] += 8 * e; T[NX] += 3 * e; T[NOD] += 0.3 * e; T[LID] = Math.max(T[LID], 0.75 * e);
        T[TA] = lerp(T[TA], 4.05, e); T[TC] = lerp(T[TC], 0.2, e); break;
      case 'knead': {
        const s1 = Math.max(0, Math.sin(t * 7)), s2 = Math.max(0, -Math.sin(t * 7));
        T[NFY] -= 4 * s1 * e; T[FFY] -= 4 * s2 * e; T[NFW] += 0.6 * s1 * e; T[FFW] += 0.6 * s2 * e; T[LID] = Math.max(T[LID], 0.55 * e); break;
      }
      case 'pounce': {
        const c = p < 0.55 ? smooth(p / 0.3) : 0, hop = p > 0.55 ? Math.sin(Math.PI * clamp01((p - 0.55) / 0.4)) : 0;
        if (c > 0) { this._crouchMod(T, c, 0); T[HX] += Math.sin(t * 26) * 1.2 * c; T[PUP] += 0.4; }
        if (hop > 0) { T[HY] -= 9 * hop; T[SY] -= 12 * hop; T[NHY] -= 6 * hop; T[FHY] -= 6 * hop; T[NFY] -= 9 * hop; T[FFY] -= 9 * hop; T[NFX] += 6 * hop; T[FFX] += 6 * hop; T[NFW] -= 1 * hop; T[FFW] -= 1 * hop; T[TA] = lerp(T[TA], 3.9, hop); }
        break;
      }
    }
  }

  _springs(dt) {
    const T = this.T, P = this.P, V = this.V, om = this._om;
    const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n;
    for (let s = 0; s < n; s++) {
      for (let i = 0; i < NP; i++) {
        const w = i === LID && T[i] > P[i] + 0.02 && T[i] < 0.95 ? 5 : om[PART[i]], z = PART[i] === 5 ? 0.62 : 1, a = w * w * (T[i] - P[i]) - 2 * z * w * V[i];   // drowsy lids come down slowly; the tail follows through
        V[i] += a * h; P[i] += V[i] * h;
      }
    }
  }

  // exact layers over the sprung pose: gait, bob, breath, squash, the crouch wiggle
  _layers(t) {
    const D = this.D, P = this.P, d = this.d;
    D.set(P);
    // in the air the leap's key poses are exact (blended in over the first tenth of the flight)
    const j = this.jump;
    if (j && j.pre <= 0 && !j.small) {
      const Lp = this._L || (this._L = new Float64Array(NP)), w = smooth(this._ju / 0.06);
      poseLeap(d, Lp, this._ju);
      for (let i = 0; i < NP; i++) if (PART[i] < 2 || PART[i] === 4) D[i] = lerp(D[i], Lp[i], w);      // (the tail keeps its lag)
      this._leapW = 1;
    } else if (this._leapW) {          // just landed: the springs carry on from the drawn pose
      this._leapW = 0;
      for (let i = 0; i < NP; i++) if (PART[i] < 2 || PART[i] === 4) { P[i] = this._Dl[i]; this.V[i] *= 0.3; }
      D.set(P);
    }
    const gw = this._gw * (this.jump ? 0 : 1);
    this._scap = 0;
    this.J.st[0] = this.J.st[1] = this.J.st[2] = this.J.st[3] = false;
    if (gw > 0.001) {
      const upright = this._mode === 'upright', v = this._spd / d.hipH, ph = this._phase;
      const S = this._stride * (this.walking > 0.5 && this._spd < 3 && !this._gaitDbg ? 0.12 : 1);
      if (upright) {
        const g = this._g, lift = 0.22 * 20 * d.L, legOff = this._lo || (this._lo = [0, 0]);
        for (let k = 0; k < 2; k++) {
          gaitLeg(ph + k * 0.5, 0.6, g);
          const ix = k ? FHX : NHX, iy = ix + 1, ik = k ? FHK : NHK;
          D[ix] = lerp(D[ix], (k ? -1.5 : 1.5) + g[0] * S, gw); D[iy] = lerp(D[iy], -d.pawY - g[1] * lift, gw); D[ik] += gw * 0.5 * g[1];
          legOff[k] = g[0] * S;
        }
        // each arm swings against the leg on its side (unless it is busy with a bindle or a wave)
        if (!this.bindle && this.armUp < 0.1) { D[NFX] -= gw * legOff[0] * 0.8; D[NFY] -= gw * Math.abs(legOff[0]) * 0.15; D[FFX] -= gw * legOff[1] * 0.8; D[FFY] -= gw * Math.abs(legOff[1]) * 0.15; }
        const bob = gw * Math.abs(Math.sin(ph * TAU)) * 1.2;
        D[HY] -= bob; D[SY] -= bob;
      } else {
        const tw = smooth((v - 2.3) / 0.6), bw = smooth((v - 5.6) / 0.8), ww = 1 - Math.max(tw, bw);
        const off = (i) => GAITS.walk[i] * ww + GAITS.trot[i] * (tw - bw > 0 ? tw - bw : 0) + GAITS.bound[i] * bw;
        const duty = GAITS.walk[4] * ww + GAITS.trot[4] * Math.max(0, tw - bw) + GAITS.bound[4] * bw;
        const g = this._g, lh = 0.2 * (d.fem + d.tib + d.met), lf = 0.2 * (d.hum + d.rad + d.pas);
        const legs = [[NHX, NHK, 0, -1], [NFX, NFW, 1, 1], [FHX, FHK, 2, -1], [FFX, FFW, 3, 1]];
        let stF = 0;
        for (let k = 0; k < 4; k++) {
          const L = legs[k], fore = L[3] > 0, ix = L[0];
          gaitLeg(ph - off(L[2]), duty, g);
          const base = fore ? P[SX] - 0.5 : P[HX] + 1.5;
          D[ix] = lerp(D[ix], base + g[0] * S + (fore ? 1.5 : -0.5) * S * 0.05, gw);
          D[L[1]] += gw * (g[0] * S / d.hipH) * (fore ? 0.5 : 0.9);         // the hock / wrist follow the paw through the step
          this.J.st[k] = g[2] === 0;
          D[ix + 1] = lerp(D[ix + 1], -d.pawY - g[1] * (fore ? lf : lh) * (0.6 + 0.4 * Math.min(1, v)), gw);
          // the paw trails in swing and flicks forward before it is set down
          const fl = Math.sin(Math.PI * g[2]);
          D[L[1]] += gw * (fore ? -1.5 * fl * fl + 0.6 * Math.max(0, g[2] - 0.75) * 4 * (1 - g[2]) : 0.7 * fl);
          if (k === 1 && g[2] === 0) stF = Math.sin(Math.PI * (1 - g[0] - 0.5));
        }
        const fq = ph - Math.floor(ph), fl = Math.max(0, 1 - Math.abs(fq - 0.88) / 0.16);       // the bound's moment of flight (after the forepaws push off)
        const bob = gw * (ww * 0.8 * Math.cos(ph * TAU * 2) + tw * (1 - bw) * 1.4 * Math.abs(Math.sin(ph * TAU * 2)) - bw * 7 * fl * fl * (3 - 2 * fl));
        D[HY] += bob; D[SY] += bob; D[NY] -= bob * 0.8;
        if (bw > 0) { const fx = Math.cos(TAU * (ph - 0.42)) * bw; D[HX] -= 4 * fx; D[SX] += 3 * fx; D[ARCH] -= 6 * fx; D[NY] += 2 * fx; D[TA] -= 0.2 * fx; }   // stretched out when the forepaws land, gathered in the flight
        this._scap = gw * ww * 1.6 * stF;
      }
    }
    // breathing, the landing squash, the wiggle of a held crouch
    const br = Cat.still ? 0 : Math.sin(t * 1.9 + this.seed) * (this._mode === 'curl' ? 0.04 : 0.016);
    D[GIRTH] *= 1 + br;
    const s = clamp(this.sq.x, -0.5, 0.8);
    D[HY] += 5 * s; D[SY] += 6.5 * s; D[NY] += 2 * s;
    if (this.crouch > 0.3 && !this.jump && !Cat.still) D[HX] += Math.sin(t * 24) * 1.1 * (this.crouch - 0.3);
    // the tail lags, waves lazily, twitches in a crouch
    D[TA] += this.tailA.x * 0.6;
    (this._Dl || (this._Dl = new Float64Array(NP))).set(D);
  }

  // the skeleton from the drawn pose D (local frame, facing +x, size 1)
  _solve(t) {
    const D = this.D, d = this.d, J = this.J;
    const rot = this.pitch * 0.85;
    J.rot = rot;
    const cr = Math.cos(rot), sr = Math.sin(rot), cx = (D[HX] + D[SX]) / 2, cy = (D[HY] + D[SY]) / 2;
    J.cx = cx; J.cy = cy;
    const R = (x, y, o) => { const dx = x - cx, dy = y - cy; o[0] = cx + dx * cr - dy * sr; o[1] = cy + dx * sr + dy * cr; return o; };
    R(D[HX], D[HY], J.hip); R(D[SX], D[SY], J.sh);
    // spine control point: bowed by the arch
    const hx = J.hip[0], hy = J.hip[1], sx = J.sh[0], sy = J.sh[1], ln = Math.hypot(sx - hx, sy - hy) || 1;
    J.ctrl[0] = (hx + sx) / 2 + ((sy - hy) / ln) * D[ARCH]; J.ctrl[1] = (hy + sy) / 2 - ((sx - hx) / ln) * D[ARCH];
    const fsa = Math.abs(this._fs()), lat = fsa < 0.95 ? (5 * (1 - fsa)) / fsa : 0, far = D[FAR] + lat;
    // legs
    const leg = (L, jx, jy, px, py, ang, l1, l2, l3, bend) => {
      L[0][0] = jx; L[0][1] = jy;
      R(px, py, L[3]);
      const va = Math.atan2(-Math.cos(ang), -Math.sin(ang)) + rot;
      let ex = L[3][0] + Math.cos(va) * l3, ey = L[3][1] + Math.sin(va) * l3;
      // the shoulder blade / pelvis give a little: the leg root slides towards a paw that is just out of reach
      const ox = ex - L[0][0], oy = ey - L[0][1], od = Math.hypot(ox, oy), over = od - (l1 + l2) * 0.995;
      if (over > 0) { const k = Math.min(over, 4.5) / od; L[0][0] += ox * k; L[0][1] += oy * k; }
      const r = ik2(L[0], [ex, ey], l1, l2, bend);
      L[3][0] += r[1][0] - ex; L[3][1] += r[1][1] - ey;
      L[1][0] = r[0][0]; L[1][1] = r[0][1]; L[2][0] = r[1][0]; L[2][1] = r[1][1];
    };
    leg(J.nh, J.hip[0] - lat, J.hip[1], D[NHX] - lat, D[NHY], D[NHK], d.fem, d.tib, d.met, -1);
    leg(J.fh, J.hip[0] + far, J.hip[1] - 0.6, D[FHX] + far, D[FHY] - 0.6, D[FHK], d.fem, d.tib, d.met, -1);
    const am = D[ARM];
    leg(J.nf, J.sh[0] - lat, J.sh[1], D[NFX] - lat, D[NFY], D[NFW], d.hum * am, d.rad * am, d.pas * am, 1);
    leg(J.ff, J.sh[0] + far, J.sh[1] - 0.6, D[FFX] + far, D[FFY] - 0.6, D[FFW], d.hum * am, d.rad * am, d.pas * am, 1);
    // neck and head
    R(D[SX] + D[NX], D[SY] + D[NY], J.head);
    J.hrot = rot * 0.45 + D[TILT];
    this._map(0.8, 0, 6.5 * D[GIRTH] * d.G, J.neck);
    // the shoulder blade of the weight-bearing foreleg
    J.scap = this._scap || 0;
    // tail
    const T = J.tail, W = J.tw, n = T.length - 1, seg = 6.2 * d.T * (this.c.head > 1.1 ? 1.05 : 1);
    this._map(0, -7.4, lerp(7, -2, clamp01(D[TGND])) * D[GIRTH] * d.G, T[0]);
    let a = D[TA] + rot * 0.7;
    const still = Cat.still ? 0 : 1, wave = still * (this._mode === 'curl' ? 0.3 : 1) * (1 - 0.5 * this.air), crouch = Math.max(this.crouch, this._pre);
    for (let i = 1; i <= n; i++) {
      const u = i / n;
      a += D[TC] + (i > n - 3 ? D[TH] * 0.5 : 0) + wave * 0.07 * Math.sin(t * 2.3 - i * 0.7 + this.seed) * (0.4 + u)
        + still * crouch * 0.12 * Math.sin(t * 20 + i * 0.9) * u + still * this._doing('ears') * 0.15 * Math.sin(t * 15 - i);
      let x = T[i - 1][0] + Math.cos(a) * seg, y = T[i - 1][1] + Math.sin(a) * seg;
      W[i] = lerp(7, 4.4, Math.pow(u, 0.8)) * (0.9 + 0.1 * d.T);
      const gy = -W[i] / 2 - 0.4, gk = smooth(D[TGND]);
      if (gk > 0 && y > gy) y = lerp(y, gy, gk);
      T[i][0] = x; T[i][1] = y;
    }
    W[0] = 7 * (0.9 + 0.1 * d.T);
    // face points (for anchors)
    this._headPts();
  }

  // point on the trunk in spine coordinates → o
  _map(u, ds, w, o) {
    const J = this.J, a = 1 - u, p0 = J.hip, p1 = J.ctrl, p2 = J.sh;
    const x = a * a * p0[0] + 2 * a * u * p1[0] + u * u * p2[0], y = a * a * p0[1] + 2 * a * u * p1[1] + u * u * p2[1];
    let tx = 2 * a * (p1[0] - p0[0]) + 2 * u * (p2[0] - p1[0]), ty = 2 * a * (p1[1] - p0[1]) + 2 * u * (p2[1] - p1[1]);
    const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
    o[0] = x + tx * ds + ty * w; o[1] = y + ty * ds - tx * w;
    return o;
  }

  // head turn / nod from the look target, the pupils
  _looks(dt) {
    let turn = 0.75 + this._gaze.x * 0.25, nod = 0, plx = this._gaze.x * 0.4, ply = 0;
    const tgt = this.jump ? { x: this.jump.x1, y: this.jump.y1 - 24 } : this.look;
    if (tgt) {
      const s = this.size, hx = this.x + this.J.head[0] * this._fs() * s, hy = this.y + this.J.head[1] * s;
      const dx = (tgt.x - hx) * this.dir, dy = tgt.y - hy, r = dx / (Math.abs(dx) + 50 * s);
      turn = r >= 0 ? 1 - 0.75 * r : 1 - 0.8 * r;
      nod = clamp(-Math.atan2(dy, Math.abs(dx) + 25 * s) * 0.7, -0.55, 0.6);
      const l = Math.hypot(dx, dy) || 1; plx = dx / l; ply = dy / l;
    }
    this._lookTurn = turn; this._lookNod = this.look ? nod : 0; this._leapLook = this.jump ? nod * 0.8 : null;
    if (this.headDown > 0.05) { ply = lerp(ply, 1, this.headDown); plx = lerp(plx, 0.3, this.headDown); }
    this._plx = approach(this._plx, plx, 12, dt); this._ply = approach(this._ply, ply, 12, dt);
  }

  // ── the head as a little sphere ──
  // projection of head-local (forward, side, up) in skull radii → this._q = [x, y, z] (screen, relative to the head centre, unrotated)
  _setHead() {
    const D = this.D, R = R0 * this.d.H;
    let turn = D[TURN];
    const fa = Math.abs(this._d);
    if (fa < 1) turn = lerp(1, turn, smooth(fa));            // seen end-on while turning round: full face
    const a = (1 - turn) * Math.PI / 2;
    this._hR = R; this._ca = Math.cos(a); this._sa = Math.sin(a); this._cn = Math.cos(D[NOD]); this._sn = Math.sin(D[NOD]);
  }
  _p(f, s, u, o) {
    const fp = f * this._cn - u * this._sn, up = u * this._cn + f * this._sn, R = this._hR;
    o[0] = R * (fp * this._sa + s * this._ca); o[1] = -R * up; o[2] = fp * this._ca - s * this._sa;
    return o;
  }
  _headPts() {
    this._setHead();
    const J = this.J, q = [0, 0, 0], c = Math.cos(J.hrot), s = Math.sin(J.hrot);
    const put = (o) => { const x = q[0], y = q[1]; o[0] = J.head[0] + x * c - y * s; o[1] = J.head[1] + x * s + y * c; };
    this._p(1.42, 0, -0.17, q); put(J.nose);
    this._p(1.22, 0, -0.56, q); put(J.mouth);
    q[0] = 0; q[1] = -this._hR * 1.25; put(J.top);
    const ez = this._p(0.05, -0.55, 0.85, q)[2] >= this._p(0.05, 0.55, 0.85, [0, 0, 0])[2] ? -0.55 : 0.55;      // the ear turned towards us
    this._p(0.05, ez, 0.85, q); put(J.ear);
  }

  // ── drawing ──
  draw(ctx, t) {
    if (this.hidden) return;
    if (this._fresh) this.update(1 / 60, t || 0);          // drawn without ever being updated (a toy on a shelf): settle into its pose
    const s = this.size;
    if (this.glowing > 0.01) glow(ctx, this.x, this.y - 28 * s, 95 * s, PAL.moon, 0.55 * this.glowing * (0.9 + 0.1 * Math.sin(t * 3)), 'screen');
    this._colors();
    this._bf = Cat.still ? 0 : Math.floor(t * 7);
    // contact shadow on the ground (stays on the line of the leap)
    const j = this.jump, gy = j && j.pre <= 0 ? lerp(j.y0, j.y1, this._ju) : this.y, hgt = Math.max(0, gy - this.y);
    const sa = 0.14 * (1 - clamp01(hgt / 55));
    if (sa > 0.01) {
      const J = this.J, fs = this._fs(), x0 = Math.min(J.nh[3][0], J.fh[3][0], J.nf[3][0], J.ff[3][0]), x1 = Math.max(J.nh[3][0], J.fh[3][0], J.nf[3][0], J.ff[3][0]);
      const w = Math.max(14, (x1 - x0) / 2 + 9) * s * Math.max(0.45, Math.abs(fs)), cxs = this.x + ((x0 + x1) / 2) * fs * s;
      ctx.beginPath(); ctx.ellipse(cxs, gy + 0.6 * s, w * (1 - 0.3 * clamp01(hgt / 55)), 3.2 * s, 0, 0, TAU);
      ctx.fillStyle = 'rgba(29,21,48,' + sa.toFixed(3) + ')'; ctx.fill();
    }
    ctx.save();
    this.frame(ctx);
    const m = ctx.getTransform();
    this._spx = Math.hypot(m.b, m.d) / (window.devicePixelRatio || 1);      // CSS px per unit: fine detail only where it can be seen
    this._paint(ctx, t);
    ctx.restore();
  }

  _colors() {
    const c = this.c, key = c.fur + c.furDark + c.belly + (this.glowing > 0.01 ? Math.round(this.glowing * 20) : '');
    if (this._ck === key) return;
    this._ck = key;
    const fur = this.glowing > 0.01 ? shade(c.fur, this.glowing * 0.35) : c.fur;
    const md = shade(c.furDark, -0.1);
    this._col = { mask0: rgba(md, 0.55), mask1: rgba(md, 0), rim: 'rgba(214,206,255,0.42)', surround: shade(c.fur, 0.16), lid: fur, fur, far: shade(c.fur, -0.2), farDark: shade(c.furDark, -0.2), belly: c.belly, farBelly: shade(c.belly, -0.16), dark: c.furDark, ear: c.ear, nose: c.nose, iris: c.iris || '#bccb4e' };
  }

  // a copy of points, nudged by the line boil
  _boil(src, k, amp, out) {
    if (!this._bf || this._spx < 1.3) return src;          // still, or too small for the boil to show
    out = out || [];
    const f = this._bf, sd = this.seed * 7 + k * 131 + f * 977;
    for (let i = 0; i < src.length; i++) {
      const p = src[i], b = f ? amp : 0;
      out.push([p[0] + (hash(sd + i * 2) - 0.5) * 2 * b, p[1] + (hash(sd + i * 2 + 1) - 0.5) * 2 * b]);
    }
    return out;
  }

  _paint(ctx, t) {
    const J = this.J, D = this.D, d = this.d, C = this._col, c = this.c;
    const lw = LW / Math.sqrt(this.size), lwi = lw * 0.55;
    const tabby = c.coat === 'tabby', point = c.coat === 'point';
    const up = this._mode === 'upright';
    if (up && this._gw > 0.001) {                       // the same sway as garden-art.js applies to the clothes
      const w = this.walking, ph = this.walk;
      ctx.translate(0, -w * Math.abs(Math.sin(ph)) * 2); ctx.rotate(w * Math.sin(ph) * 0.06);
    }
    if (Math.abs(this._d) < 0.5) { this._paintEndOn(ctx, t, lw); return; }
    // legs as shapes
    const wk = Math.pow(1 / Math.abs(this._fs()), 0.85);        // limbs keep their width while the body foreshortens in a turn
    const pawR = 4.3 * d.PW * wk, pawRy = 2.7 * d.PW;
    const pawOval = (L, far) => {
      const w = L[2], p = L[3], a = Math.atan2(p[1] - w[1], p[0] - w[0]) - Math.PI / 2, k = far ? 0.9 : 1;
      return oval(p[0] + Math.cos(a) * 0.9, p[1] + Math.sin(a) * 0.9 - 0.3, pawR * k, pawRy * k, a, 12);
    };
    const hindPts = (L, near) => this._boil(near ? [L[1], L[2], L[3]] : [L[0], L[1], L[2], L[3]], near ? 3 : 4, 0.3);
    const forePts = (L, near) => this._boil(near ? [L[1], L[2], L[3]] : [L[0], L[1], L[2], L[3]], near ? 5 : 6, 0.3);
    const ls = this._spx < 1 ? 2 : 3;                       // fewer curve steps when small
    const hw = [5.8 * wk, 5.1 * wk, 4.8 * wk], hwF = [8 * wk, 5.6 * wk, 5 * wk, 4.6 * wk], fw = [6.4 * wk, 5.4 * wk, 5 * wk, 4.7 * wk], fwN = [5.5 * wk, 5 * wk, 4.7 * wk];
    // far legs
    const fh = tube(hindPts(J.fh, false), hwF, ls), ff = tube(forePts(J.ff, false), fw, ls);
    const tailFirst = D[TZ] < 0.5, tailMid = D[TZ] >= 0.5 && D[TZ] < 1.5;
    inked(ctx, [[fh, C.far], [pawOval(J.fh, true), C.farBelly], [ff, C.far], [pawOval(J.ff, true), C.farBelly]], lw);
    // the bindle hangs behind the back
    if (up && this.bindle) this._bindleBag(ctx, lw);
    if (tailFirst) this._tail(ctx, lw, tabby, point);
    // trunk + neck + near thigh: one silhouette
    const body = blob(this._bodyPts());
    const th = J.nh, tdx = th[1][0] - th[0][0], tdy = th[1][1] - th[0][1], tl = Math.hypot(tdx, tdy) || 1, ta = Math.atan2(tdy, tdx);
    const thR = this._thigh(), thigh = oval(thR[0], thR[1], thR[2], thR[3], ta, 14);
    const ua = J.nf, arm = tube([ua[0], ua[1]], [11 * d.G, 7.4]);
    const nb = this._boil([J.neck, [J.head[0] - 2, J.head[1] + 2]], 7, 0.3);
    const neck = tube(nb, [15 * d.G, 13 * d.H]);
    inked(ctx, [[body, C.fur], [neck, C.fur], [thigh, C.fur], [arm, C.fur]], lw);
    if (c.coat === 'plain') this._rim(ctx, [body, neck, thigh]);
    // markings on the trunk
    ctx.save(); ctx.beginPath(); trace(ctx, body); trace(ctx, neck); trace(ctx, thigh); trace(ctx, arm); ctx.clip();
    const m = this._m, bib = [];
    for (const b of BIB) { this._map(b[0], b[1], b[2] * d.G * D[GIRTH], m); bib.push([m[0], m[1]]); }
    const hR = R0 * d.H;
    bib.push([J.head[0] + hR * 0.45, J.head[1] + hR * 0.8]);
    bib.push([J.head[0] - hR * 0.15, J.head[1] + hR * 0.7]);
    for (const b of BIB_IN) { this._map(b[0], b[1], b[2] * d.G * D[GIRTH], m); bib.push([m[0], m[1]]); }
    ctx.beginPath(); trace(ctx, blob(this._boil(bib, 9, 0.25))); ctx.fillStyle = C.belly; ctx.fill();
    ctx.beginPath(); trace(ctx, arm); ctx.fillStyle = C.fur; ctx.fill();
    if (tabby && this._spx >= 0.9) {
      ctx.strokeStyle = C.dark; ctx.lineWidth = 2.3 * d.G; ctx.lineCap = 'round'; ctx.globalAlpha = 0.85;
      const n = d.B < 0.9 ? 4 : 5, gg = d.G * D[GIRTH], a0 = [0, 0], a1 = [0, 0], a2 = [0, 0];
      for (let i = 0; i < n; i++) {
        const u = 0.05 + i * (0.86 / (n - 1)) * (n === 4 ? 0.95 : 1);
        this._map(u, 0, 16 * gg, a0); this._map(u + 0.04, 0, 9.5 * gg, a1); this._map(u - 0.01, 0, 4 * gg, a2);
        if (!i) ctx.beginPath();
        ctx.moveTo(a0[0], a0[1]); ctx.quadraticCurveTo(a1[0], a1[1], a2[0], a2[1]);
      }
      ctx.stroke();
      // a bar or two across the haunch
      ctx.lineWidth = 2;
      const hx = th[0][0], hy = th[0][1];
      ctx.beginPath();
      for (let i = 0; i < 2; i++) {
        const u = 0.15 + i * 0.25, px = hx + tdx * u, py = hy + tdy * u, nx = -tdy / tl, ny = tdx / tl;
        ctx.moveTo(px - nx * 9, py - ny * 9); ctx.lineTo(px - nx * 4, py - ny * 4);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (point) {        // soft darker points: a shadow on the haunch and shoulders
      ctx.globalAlpha = 0.25; ctx.fillStyle = C.dark;
      ctx.beginPath(); ctx.ellipse(th[0][0], th[0][1] - 4, 9, 7, 0, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    // near hind leg: it comes out from under the thigh (the thigh is filled again over it)
    const nh = tube(hindPts(J.nh, true), hw, ls);
    inked(ctx, [[nh, C.fur], [pawOval(J.nh), C.belly]], lw);
    const curl = this._curlW || 0;
    if (tabby && curl < 0.5) this._bars(ctx, nh, J.nh[1], J.nh[2], 2);
    this._toes(ctx, J.nh);
    ctx.beginPath(); trace(ctx, thigh); ctx.fillStyle = C.fur; ctx.fill();
    if (tabby) { ctx.save(); ctx.clip(); ctx.strokeStyle = C.dark; ctx.lineWidth = 2; ctx.globalAlpha = 0.85; ctx.lineCap = 'round'; const nx = -tdy / tl, ny = tdx / tl; ctx.beginPath(); for (let i = 0; i < 2; i++) { const u = 0.15 + i * 0.25, px = th[0][0] + tdx * u, py = th[0][1] + tdy * u; ctx.moveTo(px - nx * 9, py - ny * 9); ctx.lineTo(px - nx * 4, py - ny * 4); } ctx.stroke(); ctx.restore(); }
    // the haunch: one inner contour line round the front and bottom of the thigh
    const hc = [], hrx = thR[2], hry = thR[3], cA = Math.cos(ta), sA = Math.sin(ta);
    for (let i = 0; i <= 10; i++) { const u = -2.5 + (3.3 * i) / 10, x = Math.cos(u) * hrx, y = Math.sin(u) * hry; hc.push([thR[0] + x * cA - y * sA, thR[1] + x * sA + y * cA]); }
    if (curl < 0.98 && this._spx >= 0.8) line(ctx, hc, lwi * 1.1, 'rgba(29,21,48,' + (0.6 * (1 - curl)).toFixed(2) + ')');
    if (tailMid) this._tail(ctx, lw, tabby, point);
    if (up && this.bindle) this._bindleStick(ctx, lw);
    // near foreleg
    const nf = tube(forePts(J.nf, true), fwN, ls);
    inked(ctx, [[nf, C.fur], [pawOval(J.nf), C.belly]], lw);
    if (tabby && curl < 0.5) this._bars(ctx, nf, J.nf[1], J.nf[2], 2);
    this._toes(ctx, J.nf);
    if (D[TZ] >= 1.5) this._tail(ctx, lw, tabby, point);
    const waving = up && (this.armUp > 0.3 || (this.armHold > 0.3 && this.armReach > 1.9));
    if (waving) { this._head(ctx, t, lw); inked(ctx, [[nf, C.fur], [pawOval(J.nf), C.belly]], lw); return; }      // the waving paw in front of the face
    this._head(ctx, t, lw);
  }

  // seen from the front, half way through turning round: chest disc, forelegs side by side, the rest behind
  _paintEndOn(ctx, t, lw) {
    const J = this.J, d = this.d, C = this._col, D = this.D, G = d.G * D[GIRTH], up = this._mode === 'upright';
    ctx.save(); ctx.scale(1 / Math.abs(this._fs()), 1);
    const sy = J.sh[1], hy = J.hip[1], gy = -d.pawY;
    const tp = [[-1, hy - 3], [-9, hy - 6], [-14, hy - 14], [-13.5, hy - 23], [-9.5, hy - 28]];
    inked(ctx, [[limb(this._boil(tp, 31, 0.3), [6.6, 4.4]), C.fur]], lw);
    if (up) {
      // little biped from the front: legs apart, arms by the sides
      const legs = [];
      for (const sd of [-1, 1]) legs.push([limb([[sd * 4.5 * G, hy + 2], [sd * 4.8 * G, gy - 2], [sd * 5 * G, gy]], [7, 5.4, 5]), sd < 0 ? C.far : C.fur], [oval(sd * 5.5 * G, gy, 4.4, 2.7, 0, 10), C.belly]);
      inked(ctx, legs, lw);
      const torso = oval(0, (sy + hy) / 2 + 1, 10.5 * G, (hy - sy) / 2 + 10, 0, 16);
      inked(ctx, [[torso, C.fur]], lw);
      ctx.save(); ctx.beginPath(); trace(ctx, torso); ctx.clip(); ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(0, (sy + hy) / 2 + 2, 6, (hy - sy) / 2 + 4, 0, 0, TAU); ctx.fill(); ctx.restore();
      const arms = [];
      for (const sd of [-1, 1]) arms.push([limb([[sd * 9 * G, sy + 2], [sd * 11 * G, sy + 12], [sd * 11 * G, sy + 18]], [5.6, 5, 4.8]), C.fur], [oval(sd * 11 * G, sy + 19, 3.4, 3, 0, 10), C.belly]);
      inked(ctx, arms, lw);
    } else {
      inked(ctx, [[oval(-8.5 * G, gy, 4, 2.6, 0, 10), C.farBelly], [oval(8.5 * G, gy, 4, 2.6, 0, 10), C.farBelly], [oval(0, hy - 5, 11 * G, 9 * G, 0, 14), C.far]], lw);
      const chest = oval(0, sy + 1, 11.5 * G, 13 * G, 0, 16);
      inked(ctx, [[chest, C.fur]], lw);
      ctx.save(); ctx.beginPath(); trace(ctx, chest); ctx.clip(); ctx.fillStyle = C.belly; ctx.beginPath(); ctx.ellipse(0, sy + 3, 6.5 * G, 10 * G, 0, 0, TAU); ctx.fill(); ctx.restore();
      const legs = [];
      for (const sd of [-1, 1]) legs.push([limb([[sd * 4.6 * G, sy + 7], [sd * 4.7 * G, gy - 4], [sd * 4.8 * G, gy]], [5.6, 5, 4.8]), C.fur], [oval(sd * 4.9 * G, gy, 4, 2.7, 0, 10), C.belly]);
      inked(ctx, legs, lw);
    }
    this._head(ctx, t, lw, true);
    ctx.restore();
  }

  // the near thigh as an ellipse along the femur: [cx, cy, rx, ry]
  _thigh() {
    const th = this.J.nh, d = this.d, D = this.D, dx = th[1][0] - th[0][0], dy = th[1][1] - th[0][1], l = Math.hypot(dx, dy) || 1;
    const o = this._th || (this._th = [0, 0, 0, 0]);
    o[0] = th[0][0] + dx * 0.38; o[1] = th[0][1] + dy * 0.38; o[2] = l * 0.55 + 4.6; o[3] = 8.8 * d.G * D[GIRTH];
    return o;
  }
  _bodyPts() {
    const D = this.D, d = this.d, g = d.G * D[GIRTH], tuck = clamp01(D[TUCK]), out = [], m = this._m, sc = this.J.scap;
    for (let i = 0; i < PROF.length; i++) {
      const p = PROF[i], front = i >= 7 && i <= 10 ? D[CHEST] : 1;      // CHEST < 1: the chest front comes back over the forelegs (sitting)
      this._map(p[0], p[1] * (0.85 + 0.15 * g) * (i >= 6 && i <= 9 ? 0.6 + 0.4 * front : 1), (p[2] + (1 - tuck) * p[3] + (i === SCAP ? sc : 0)) * g * (p[2] < 0 ? 0.55 + 0.45 * front : 1), m);
      out.push([m[0], m[1]]);
    }
    return this._boil(out, 1, 0.35);
  }

  // stripes across a leg (between two joints), clipped to it
  _bars(ctx, shape, a, b, n) {
    if (this._spx < 1.6) return;
    ctx.save();
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
    ctx.strokeStyle = this._col.dark; ctx.lineWidth = 1.5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.85;
    ctx.beginPath();
    for (let i = 0; i < n; i++) { const u = 0.2 + i * 0.28, x = a[0] + dx * u, y = a[1] + dy * u; ctx.moveTo(x - nx * 2.3, y - ny * 2.3 + 0.6); ctx.lineTo(x + nx * 1, y + ny * 1); }
    ctx.stroke();
    ctx.restore();
  }

  // toe lines on a near paw (only when the cat is shown large enough for them to read); spread in a reach
  _toes(ctx, L) {
    if (this._spx < 2.4) return;
    const w = L[2], p = L[3], a = Math.atan2(p[1] - w[1], p[0] - w[0]) - Math.PI / 2, d = this.d, spread = this.air > 0.4 ? 1.6 : 1;
    const ca = Math.cos(a), sa = Math.sin(a), cx = p[0] + ca * 0.9, cy = p[1] + sa * 0.9 - 0.3, r = 4.3 * d.PW;
    ctx.strokeStyle = 'rgba(29,21,48,0.5)'; ctx.lineWidth = 0.8; ctx.lineCap = 'round'; ctx.beginPath();
    for (const k of spread > 1 ? [0.15, 0.45, 0.75] : [0.3, 0.65]) {
      const x = r * (k * spread * 0.62), y0 = 2.7 * d.PW * 0.95, y1 = y0 * 0.25;
      ctx.moveTo(cx + ca * x - sa * y0 * -0.0, cy + sa * x + ca * y0 * 0.35); ctx.lineTo(cx + ca * x + sa * y1, cy + sa * x - ca * y1);
    }
    ctx.stroke();
  }

  _tail(ctx, lw, tabby, point) {
    const J = this.J, C = this._col, pts = this._boil(J.tail, 11, 0.35), sh = tube(pts, J.tw, 2);
    inked(ctx, [[sh, C.fur]], lw);
    const n = pts.length - 1;
    if (tabby && this._spx >= 1.2) {
      ctx.strokeStyle = C.dark; ctx.lineWidth = 2.2; ctx.lineCap = 'butt'; ctx.beginPath();
      for (let i = 2; i < n; i += 1) {
        if (i % 2) continue;
        const a = pts[i - 1], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, p = pts[i];
        const h = J.tw[i] / 2 - 0.5;
        ctx.moveTo(p[0] - (dy / l) * h, p[1] + (dx / l) * h); ctx.lineTo(p[0] + (dy / l) * h, p[1] - (dx / l) * h);
      }
      ctx.stroke();
    }
    if (tabby || point) {         // dark tip
      const tip = tube(pts.slice(n - (point ? 3 : 1)), J.tw.slice(n - (point ? 3 : 1)));
      ctx.beginPath(); trace(ctx, tip); ctx.fillStyle = C.dark; ctx.fill();
    }
  }

  _bindleBag(ctx, lw) {
    const J = this.J, h = J.head;
    drawBundle(ctx, h[0] - 19, h[1] + 1, this.swing.x + 0.25, this.bundleSize * 1.1, this.seed + 4);
  }
  _bindleStick(ctx, lw) {
    const J = this.J, h = J.head, p = J.nf[3];
    const s = limb([[h[0] - 19, h[1] + 2], [p[0] + 3, p[1] + 1]], 2.6);
    inked(ctx, [[s, '#8a5a2b']], lw * 0.7);
  }

  _head(ctx, t, lw, endOn) {
    const J = this.J, d = this.d, fsa = Math.abs(this._fs());
    this._setHead();
    ctx.save();
    ctx.translate(endOn ? 0 : J.head[0], J.head[1]);
    ctx.rotate(J.hrot);
    if (fsa < 1 && !endOn) ctx.scale(1 / fsa, 1);       // the head stays round while the body foreshortens
    this._face(ctx, t, lw);
    const q = [0, 0, 0], P = (f, s, u) => this._p(f, s, u, q);
    // bundles in the teeth (not cached: they swing): they hang from the front of the muzzle
    if (this.carry > 0) {
      P(1.22, 0, -0.56);
      const mx = q[0], my = q[1], spread = 4 + 5 * Math.abs(this._ca);
      for (let i = 0; i < this.carry; i++) {
        const off = this.carry > 1 ? (i ? spread : -spread) : 0;
        drawBundle(ctx, mx + off, my, this.swing.x * (i ? 0.8 : 1) - J.hrot + (i ? -0.3 : this.carry > 1 ? 0.3 : 0), this.bundleSize * d.H * (this.carry > 1 ? 0.86 : 1), this.seed + i * 9);
      }
    }
    ctx.restore();
  }
  // the face itself (head-local, centred, unrotated)
  _face(ctx, t, lw) {
    const J = this.J, D = this.D, d = this.d, C = this._col, c = this.c;
    const R = this._hR, q = [0, 0, 0];
    const tabby = c.coat === 'tabby', point = c.coat === 'point';
    const P = (f, s, u) => this._p(f, s, u, q);
    // ears (3D triangles); the one turned away goes behind the skull
    const eb = clamp(D[EAR], -0.3, 1), twk = this._ear > 0 ? Math.sin(this._ear * 40) * 0.12 : 0;
    const ears = [];
    for (const sd of [-1, 1]) {
      const sw = (sd > 0 ? twk : 0);
      const tipF = -0.02 - 0.55 * eb + sw, tipS = sd * (0.66 + 0.4 * eb), tipU = 1.72 - 0.6 * eb;
      const e = [P(0.22, sd * 0.25, 0.9).slice(), P(tipF, tipS, tipU).slice(), P(-0.13, sd * 0.85, 0.55).slice()];
      const zc = P(0.05, sd * 0.55, 0.72)[2];
      {                                                    // ears foreshorten less than a flat card would: an ear, not a spike
        const sa = Math.abs(this._sa), k = zc < 0.15 && this._ca > 0 ? 1 + 1.05 * sa * this._ca : 1 + 0.7 * sa * sa, mx = (e[0][0] + e[2][0]) / 2;
        for (const p of e) p[0] = mx + (p[0] - mx) * k;
      }
      const nz = 0.7 * this._ca * this._cn - sd * 0.5 * this._sa;
      ears.push({ sd, e, zc, nz });
    }
    const earShape = (E) => blob(this._boil([[E.e[0][0], E.e[0][1]], [E.e[1][0], E.e[1][1]], [E.e[2][0], E.e[2][1]], [(E.e[0][0] + E.e[2][0]) / 2, (E.e[0][1] + E.e[2][1]) / 2 + 2]], 20 + E.sd, 0.3));
    const pink = (E) => {
      if (E.nz < 0.05) return;
      const cxp = (E.e[0][0] + E.e[1][0] + E.e[2][0]) / 3, cyp = (E.e[0][1] + E.e[1][1] + E.e[2][1]) / 3 + 1;
      const k = 0.62, pts = E.e.map((p) => [cxp + (p[0] - cxp) * k, cyp + (p[1] - cyp) * k + 0.8]);
      ctx.globalAlpha = Math.min(1, E.nz * 3); ctx.beginPath(); trace(ctx, blob(pts)); ctx.fillStyle = C.ear; ctx.fill(); ctx.globalAlpha = 1;
    };
    const earFill = point ? shade(c.furDark, -0.12) : C.fur;
    for (const E of ears) if (E.zc < 0) { inked(ctx, [[earShape(E), point ? earFill : C.far]], lw * 0.95); pink(E); }
    // skull + muzzle + cheeks + the ears in front: one outline
    const s2 = this._sa * this._sa;
    const skull = oval(R * 0.04 * this._sa, 0, R * (1.03 + 0.03 * s2), R * 0.96, 0, 14);
    P(1.02, 0, -0.36); const mz = oval(q[0], q[1], R * (0.36 + 0.08 * s2), R * 0.33, 0, 12);
    const side = Math.abs(this._sa) > 0.45, front = Math.abs(this._ca) > 0.3;
    P(0.86, 0, -0.66); const chin = side ? oval(q[0], q[1], R * 0.26, R * 0.2, 0, 8) : null;
    P(0.86, 0, 0.16); const brg = side ? oval(q[0], q[1], R * 0.36, R * 0.3, -0.5 * this._sa, 8) : null;
    const cheeks = [];
    if (front) for (const sd of [-1, 1]) { P(0.02, sd * 0.8, -0.42); cheeks.push(oval(q[0], q[1], R * 0.3, R * 0.26, 0, 8)); }
    const sb = blob(this._boil(skull, 21, 0.3));
    const parts = [[sb, C.fur], [mz, C.fur]];
    if (side) parts.push([chin, C.fur], [brg, C.fur]);
    for (const ch of cheeks) parts.push([ch, C.fur]);
    for (const E of ears) if (E.zc >= 0) parts.push([earShape(E), earFill]);
    inked(ctx, parts, lw);
    for (const E of ears) if (E.zc >= 0) pink(E);
    // markings, clipped to the skull
    if (c.coat === 'plain') this._rim(ctx, side ? [sb, mz, brg] : [sb, mz]);
    ctx.save(); ctx.beginPath(); for (let i = 0; i < parts.length; i++) if (parts[i][1] === C.fur) trace(ctx, parts[i][0]); ctx.clip();
    if (c.coat === 'plain') { ctx.fillStyle = C.surround; for (const sd of [-1, 1]) { P(0.8, sd * 0.5, 0.08); if (q[2] > 0.05) { ctx.beginPath(); ctx.ellipse(q[0], q[1], R * 0.42 * Math.pow(q[2], 0.5), R * 0.46, 0, 0, TAU); ctx.fill(); } } }
    if (point) {          // the points' mask: soft, centred on the muzzle, no edge
      P(1.05, 0, -0.3); const g = ctx.createRadialGradient(q[0], q[1], R * 0.1, q[0], q[1], R * 0.78);
      g.addColorStop(0, C.mask0); g.addColorStop(1, C.mask1); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q[0], q[1], R * 0.8, 0, TAU); ctx.fill();
    }
    ctx.fillStyle = C.belly;
    ctx.beginPath();
    for (const sd of [-1, 1]) { P(1.12, sd * 0.22, -0.42); if (q[2] > -0.35) { const rx = R * 0.3 * (0.55 + 0.45 * Math.max(0, q[2])); ctx.moveTo(q[0] + rx, q[1]); ctx.ellipse(q[0], q[1], rx, R * 0.25, 0, 0, TAU); } }
    P(0.9, 0, -0.68); ctx.moveTo(q[0] + R * 0.26, q[1]); ctx.ellipse(q[0], q[1], R * 0.26, R * 0.2, 0, 0, TAU); ctx.fill();
    if (tabby && this._spx >= 0.9) {
      ctx.strokeStyle = C.dark; ctx.lineCap = 'round'; ctx.lineWidth = 1.7; ctx.globalAlpha = 0.85;
      const a = [0, 0, 0];
      ctx.beginPath();
      for (const s of [-0.26, 0, 0.26]) {
        P(0.42, s, 0.9); a[0] = q[0]; a[1] = q[1]; a[2] = q[2];
        P(0.7, s * 0.8, s === 0 ? 0.5 : 0.56);
        if (q[2] > 0.05 && a[2] > -0.1) { ctx.moveTo(a[0], a[1]); ctx.lineTo(q[0], q[1]); }
      }
      ctx.stroke();
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (const sd of [-1, 1]) for (const k of [0, 1]) {
        P(0.25, sd * 0.98, -0.02 - k * 0.26); a[0] = q[0]; a[1] = q[1]; a[2] = q[2];
        P(0.5, sd * 0.84, -0.06 - k * 0.24);
        if (a[2] > 0.02) { ctx.moveTo(a[0], a[1]); ctx.lineTo(q[0], q[1]); }
      }
      if (this._spx >= 1.4) ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // eyes
    const lid = clamp(D[LID], -0.2, 1) , happy = D[HAPPY] > 0.5;
    const blink = this._blinkT > 0 ? Math.sin(Math.PI * (1 - this._blinkT / 0.15)) : 0;
    const L = Math.max(lid, blink);
    const pr = clamp(lerp(0.84, 0.5, this.light) + D[PUP] * 0.18, 0.4, 0.92), nose0 = P(1.42, 0, -0.17)[0];
    for (const sd of [-1, 1]) {
      P(0.8, sd * 0.5, 0.08);
      const z = q[2];
      if (z < 0.02) continue;
      const fz = Math.pow(Math.min(1, z / 0.95), 0.6), ex = q[0], ey = q[1], rx = R * 0.27 * fz * d.EYE, ry = R * 0.33 * d.EYE * (0.86 + 0.14 * fz);
      this._eye(ctx, ex, ey, rx, ry, L, happy, pr, lerp(0.15, 0.552, smooth((fz - 0.45) / 0.45)), Math.sign(ex - nose0) || sd);
    }
    if (happy) { ctx.fillStyle = 'rgba(240,120,140,0.28)'; for (const sd of [-1, 1]) { P(0.62, sd * 0.68, -0.32); if (q[2] > 0.1) { ctx.beginPath(); ctx.ellipse(q[0], q[1], R * 0.2 * q[2] + 1, R * 0.13, 0, 0, TAU); ctx.fill(); } } }
    ctx.restore();
    // nose, mouth, whiskers
    const fz = Math.max(0, this._ca * this._cn);
    P(1.42, 0, -0.17); const nx = q[0], ny = q[1], nw = R * 0.17 * (0.45 + 0.55 * fz), nh = R * 0.19;
    ctx.fillStyle = C.nose; ctx.beginPath(); ctx.moveTo(nx - nw, ny - nh * 0.45); ctx.lineTo(nx + nw, ny - nh * 0.45); ctx.lineTo(nx, ny + nh * 0.55); ctx.closePath(); ctx.fill();
    const open = clamp01(D[MOUTH]);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.25; ctx.lineCap = 'round';
    if (open > 0.06) {
      P(1.2, 0, -0.56);
      const mx = q[0], my = q[1] + open * R * 0.08, mrx = R * (0.13 + 0.1 * open) * (0.5 + 0.5 * fz), mry = R * (0.06 + 0.24 * open);
      ctx.beginPath(); ctx.moveTo(nx, ny + nh * 0.55); ctx.lineTo(mx, my - mry); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(mx, my, mrx, mry, 0, 0, TAU); ctx.fillStyle = '#5a2338'; ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
      const tg = Math.max(D[TONG], 0.5);
      ctx.fillStyle = '#f08aa0'; ctx.beginPath(); ctx.ellipse(mx, my + mry * 0.45, mrx * 0.75, mry * 0.45 * tg + 0.4, 0, 0, TAU); ctx.fill();
    } else {
      const a = [0, 0, 0]; P(1.3, 0, -0.44); a[0] = q[0]; a[1] = q[1];
      ctx.beginPath(); ctx.moveTo(nx, ny + nh * 0.55); ctx.lineTo(a[0], a[1]);
      for (const sd of [-1, 1]) { P(1.1, sd * 0.3, -0.5); if (q[2] > -0.15) { ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(lerp(a[0], q[0], 0.3), q[1] + 1, q[0], q[1] - 0.3); } }
      ctx.stroke();
      const tg = D[TONG];
      if (tg > 0.05) { ctx.fillStyle = '#f08aa0'; ctx.beginPath(); ctx.ellipse(a[0] + 0.5, a[1] + 1 + tg * 3, 2.1, 1 + tg * 3, 0, 0, TAU); ctx.fill(); ctx.lineWidth = 0.9; ctx.stroke(); }
    }
    const wt = this._doing('ears') * Math.sin(t * 34) * 0.06;
    ctx.strokeStyle = 'rgba(29,21,48,0.5)'; ctx.lineWidth = 0.85; ctx.beginPath();
    for (const sd of [-1, 1]) {
      P(1.16, sd * 0.32, -0.36);
      const bx = q[0], by = q[1];
      for (const an of [-0.16 + wt, 0.12 - wt]) { ctx.moveTo(bx, by); ctx.lineTo(bx + sd * Math.cos(an) * R * 1.25, by + Math.sin(an) * R * 1.25 * 0.8); }
    }
    ctx.stroke();
  }


  // eye outline: k = roundness of the corners (0.552 ellipse … 0.15 almond)
  _eyePath(ctx, ex, ey, w, ry, k) {
    const c = 0.552;
    ctx.moveTo(ex + w, ey);
    ctx.bezierCurveTo(ex + w, ey - k * ry, ex + c * w, ey - ry, ex, ey - ry);
    ctx.bezierCurveTo(ex - c * w, ey - ry, ex - w, ey - k * ry, ex - w, ey);
    ctx.bezierCurveTo(ex - w, ey + k * ry, ex - c * w, ey + ry, ex, ey + ry);
    ctx.bezierCurveTo(ex + c * w, ey + ry, ex + w, ey + k * ry, ex + w, ey);
    ctx.closePath();
  }
  _eye(ctx, ex, ey, rx, ry, L, happy, pr, k, out) {
    const C = this._col;
    ctx.lineCap = 'round';
    if (happy) { ctx.strokeStyle = INK; ctx.lineWidth = 1.9; ctx.beginPath(); ctx.ellipse(ex, ey + ry * 0.35, Math.max(rx, 1.5) * 1.05, ry * 0.75, 0, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); return; }
    if (L > 0.8) { ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.ellipse(ex, ey - ry * 0.05, Math.max(rx, 1.5) * 1.05, ry * 0.45, 0, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke(); return; }
    const w = Math.max(rx, 0.8), Lc = clamp01(L);
    const lidded = Lc > 0.02;
    ctx.save();
    ctx.beginPath(); this._eyePath(ctx, ex, ey, w, ry, k); ctx.fillStyle = C.iris; ctx.fill();
    if (lidded) ctx.clip();
    const px = ex + this._plx * w * (lidded ? 0.3 : 0.12) + out * w * 0.14 * clamp01(Lc * 2), py = ey + this._ply * ry * 0.22 + ry * 0.3 * Lc;
    ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(px, py, w * pr * (1 - 0.35 * clamp01(Lc * 1.5)), ry * (lidded ? 0.9 : 0.86), 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex + w * 0.3, ey - ry * 0.38 + ry * 0.5 * Lc, Math.max(0.7, ry * 0.3 * (1 - 0.3 * Lc)), 0, TAU); ctx.fill();
    if (this._spx >= 1.1) { ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.arc(ex - w * 0.25, ey + ry * 0.42, Math.max(0.4, ry * 0.12), 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    // the upper lid: a soft arc that follows the eyeball (drowsy, never a straight brow)
    const ly = ey - ry + 2 * ry * Lc, sag = ry * 0.42 * Math.min(1, Lc * 2);
    if (lidded) {
      // the outer end of the lid hangs lower than the inner one: drowsy, never a frown
      const young = this.d.EYE > 1.02, tl = ry * (young ? 0.14 : 0.28) * Math.min(1, Lc * 2), yo = ly - sag * 0.35 + tl * 0.5, yi = ly - sag * 0.35 - tl * 0.5, xo = ex + out * (w + 1), xi = ex - out * (w + 1), cy = ly + sag * 0.9;
      ctx.fillStyle = C.lid; ctx.beginPath(); ctx.moveTo(xi, ey - ry - 2); ctx.lineTo(xo, ey - ry - 2); ctx.lineTo(xo, yo);
      ctx.quadraticCurveTo(ex + out * w * 0.2, cy, xi, yi); ctx.fill();
      ctx.strokeStyle = young ? 'rgba(29,21,48,0.38)' : 'rgba(29,21,48,0.55)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(xi, yi); ctx.quadraticCurveTo(ex + out * w * 0.2, cy, xo, yo); ctx.stroke();
    }
    ctx.restore();
    if (Lc > 0.02) {           // above the lid: no eye outline, and the iris's soft edge painted over
      ctx.save(); ctx.beginPath(); ctx.rect(ex - w - 3, ey - ry - 3, 2 * w + 6, ly - (ey - ry) + 3 - sag * 0.1); ctx.clip();
      ctx.strokeStyle = C.lid; ctx.lineWidth = 1.6; ctx.beginPath(); this._eyePath(ctx, ex, ey, w, ry, k); ctx.stroke(); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(ex - w - 3, ly + sag * 0.3, 2 * w + 6, 2 * ry + 4); ctx.clip();
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.15; ctx.beginPath(); this._eyePath(ctx, ex, ey, w, ry, k); ctx.stroke();
    if (Lc > 0.02) ctx.restore();
  }

  // a pale rim of moonlight on the upper edges (the night cat)
  _rim(ctx, shapes) {
    ctx.save(); ctx.beginPath(); for (const sh of shapes) trace(ctx, sh); ctx.clip();
    ctx.translate(0.6, 2.4); ctx.beginPath(); for (const sh of shapes) trace(ctx, sh);
    ctx.strokeStyle = this._col.rim; ctx.lineWidth = 2.4; ctx.stroke();
    ctx.restore();
  }
}

Cat.still = false;                 // set for readers who asked for reduced motion
Cat.onAct = null;                  // (cat, kind) => … when a cat starts some acting (the shell gives it a voice)
