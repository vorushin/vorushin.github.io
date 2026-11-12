// Magic cats — small math / colour / random helpers shared by every module.

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const remap = (v, a, b, c, d) => lerp(c, d, clamp01(invLerp(a, b, v)));
export const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const sign = (v) => (v < 0 ? -1 : 1);

export const ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t) => {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1;
  },
  outBounce: (t) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  }
};

// Seeded PRNG (mulberry32). rng(seed)() → [0, 1)
export function rng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stateless hash → [0, 1)
export function hash(n) {
  let t = (n | 0) + 0x6D2B79F5;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Smooth 1D value noise in [-1, 1]
export function noise1(x, seed) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i * 374761 + (seed | 0) * 668265), b = hash((i + 1) * 374761 + (seed | 0) * 668265);
  return lerp(a, b, f * f * (3 - 2 * f)) * 2 - 1;
}

// ── Colour ──
const HEX_CACHE = new Map();
export function rgb(hex) {
  let c = HEX_CACHE.get(hex);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  c = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  HEX_CACHE.set(hex, c);
  return c;
}
export function css(c, a) {
  return a === undefined || a >= 1
    ? 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'
    : 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + Math.max(0, a).toFixed(3) + ')';
}
// mix two hex colours → css string
export function mix(a, b, t, alpha) {
  const A = rgb(a), B = rgb(b);
  t = clamp01(t);
  return css([lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t)], alpha);
}
export function mixHex(a, b, t) {
  const A = rgb(a), B = rgb(b);
  t = clamp01(t);
  const h = (v) => ('0' + Math.round(v).toString(16)).slice(-2);
  return '#' + h(lerp(A[0], B[0], t)) + h(lerp(A[1], B[1], t)) + h(lerp(A[2], B[2], t));
}
export const rgba = (hex, a) => css(rgb(hex), a);
export const shade = (hex, k) => (k >= 0 ? mixHex(hex, '#ffffff', k) : mixHex(hex, '#000000', -k));

// Critically-damped-ish spring step. s = {x, v}; returns s.x
export function spring(s, target, dt, stiffness, damping) {
  const k = stiffness === undefined ? 120 : stiffness, d = damping === undefined ? 14 : damping;
  const a = (target - s.x) * k - s.v * d;
  s.v += a * dt;
  s.x += s.v * dt;
  return s.x;
}

// Frame-rate independent exponential approach
export const approach = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

// Quadratic bezier point
export function qbez(p0, p1, p2, t) {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]];
}

export function pick(arr, r) { return arr[Math.floor((r === undefined ? Math.random() : r) * arr.length) % arr.length]; }
