// Magic cats — birds, fireflies and butterflies.
//
// Bird: a small songbird in side view, drawn live in the book's ink-and-gouache look (rig.js):
// one ink line round body + head + tail, a folded wing over it, a head that turns in quick snaps.
// Feet at (x, y); faces +x when dir = 1; about 38 × 24 units at size 1.
//
//   const b = new Bird({ color: 'blue', x, y, speed: 240 });
//   b.flyTo(x, y, done)   swoops there (take-off crouch, flap/bound, flare, settle); done on touchdown
//   b.chirp()             beak opens, throat puffs, a little bob        b.peck = 0.9   three quick pecks
//   b.state 'perch' | 'fly'; b.hidden; b.dir; b.size; b.hop {x, v} (a spring: hop.v -= 60 bobs it up)
//   b.look(yaw, tilt)     head: yaw 0 = profile ahead, π/2 = to the viewer, π = over the shoulder,
//                         −π/2 = away; b.preen(), b.fluff(), b.hopAlong(dx); b.fidget = false: no idling
// Perched, a bird idles by itself: snaps its head about, tilts it, flicks its tail, shifts its
// feet, fluffs up, preens under a wing, hops a step and back. Never leaves its spot (x, y stay put,
// so a scene's touch targets stay right); the hop is an offset that comes back.

import { TAU, clamp, clamp01, spring, shade, mixHex, rng } from './util.js';
import { INK, glow, isStill } from './paint.js';
import { blob, oval, inked, trace, line, boil } from './rig.js';

export const BIRD_COLORS = { red: ['#d9483b', '#a8281f'], green: ['#4fb060', '#2f7a3f'], blue: ['#5fa8e0', '#2f6fb0'], yellow: ['#f2cc3a', '#c9961f'], pink: ['#f08ab0', '#c05a85'] };

const BEAK = '#f2a93b', MOUTH = '#7a2433', LEG = '#4a3a3e';
const LW = 1.45;                        // visible ink line (world units)
const PIV = [0, -4.5];                  // hip: the upper body pitches round it
const BASE_PITCH = -0.36;               // perched: chest up
const HEAD_AT = [10.2, -11.6];          // head anchor in the body frame (rel. to the hip)
const HR = 6.1;                         // head radius

const smooth = (t) => { t = clamp01(t); return t * t * (3 - 2 * t); };
const approach = (c, t, r, dt) => c + (t - c) * (1 - Math.exp(-r * dt));
const rot = (p, c, s) => [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
// a short, sharp bump over [0, 1]: quick in, slower out
const bump = (u) => (u <= 0 || u >= 1 ? 0 : u < 0.3 ? smooth(u / 0.3) : 1 - smooth((u - 0.3) / 0.7));

function cubic(p0, p1, p2, p3, u) {
  const v = 1 - u, a = v * v * v, b = 3 * v * v * u, c = 3 * v * u * u, d = u * u * u;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

export class Bird {
  constructor(o) {
    o = o || {};
    this.color = o.color || 'red';
    this.col = BIRD_COLORS[this.color] || BIRD_COLORS.red;
    this.pale = shade(this.col[0], 0.42); this.deep = shade(this.col[1], -0.18); this.covert = mixHex(this.col[1], this.col[0], 0.55);
    this.x = o.x || 0; this.y = o.y || 0; this._dir = o.dir || 1; this.size = o.size || 1;
    this.state = 'perch';           // 'perch' | 'fly'
    this.tx = this.x; this.ty = this.y; this.speed = o.speed || 240;
    this.sing = 0; this.hop = { x: 0, v: 0 }; this.peck = 0;
    this.seed = Math.floor(Math.random() * 1e5); this.onArrive = null; this.hidden = false;
    this.fidget = o.fidget !== false;
    this._r = rng(this.seed + 11);
    this._t = 0;
    // pose
    this.yaw = 0; this.yawT = 0; this.tilt = 0; this.tiltT = 0;
    this.tail = { x: 0, v: 0 }; this.crouch = { x: 0, v: 0 }; this.puff = 0; this.fluffK = 0;
    this.flap = this._r() * TAU; this.wingE = 0; this.wingOpen = 0; this.flare = 0; this.legs = 0;
    this.pitchF = 0; this.yoff = 0; this.ox = 0; this.turn = 1; this.sq = 0; this._tb = null; this.tbY = 0; this._live = false;
    this.act = null; this._next = 0.6 + this._r() * 1.6; this._fl = null; this._land = 0;
    this.pose = null;               // lab: { e, flare } holds the wings in a flight pose
  }

  // facing. Turning a perched bird round (a scene setting dir, or chirp/peck/flyTo while it has
  // hopped round by itself) is a quick hop-turn, never an instant flip.
  get dir() { return this._dir; }
  set dir(v) {
    if (v === this._dir) return;
    if (this.state === 'perch' && !this.hidden && this._live) { this.turn = -this.turn; this._dir = v; if (this.turn < 0) this._turnBack(); }
    else this._dir = v;
  }
  _turnBack() { if (!this._tb) this._tb = { t: 0, d: 0.15, flipped: false }; }

  // ── commands ──
  flyTo(x, y, done) {
    this.tx = x; this.ty = y; this.onArrive = done || null;
    const wasPerched = this.state !== 'fly', shown = this._dir * this.turn;
    this.state = 'fly'; this.act = null; this.ox = 0;
    this._plan(wasPerched ? 0.13 : 0);
    if (wasPerched && this._live && !this.hidden) {                    // facing the wrong way: hop round first
      this.turn = shown * this._dir;
      if (this.turn < 0) { this._turnBack(); this._fl.pre = Math.max(this._fl.pre, 0.17); }
    } else { this.turn = 1; this._tb = null; }
  }
  chirp() { this.sing = 0.5; this.hop.v -= 60; if (this.state !== 'fly') { this.act = null; if (this.turn < 0) this._turnBack(); } }
  look(yaw, tilt) { this.yawT = yaw; if (tilt !== undefined) this.tiltT = tilt; }
  preen() { this._start('preen', 1.5); }
  fluff() { this._start('fluff', 1.3); }
  hopAlong(dx) { this._start('hop', 0.26, { from: this.ox, to: clamp(dx === undefined ? (this.ox ? 0 : 4) : dx, -6, 6) }); }

  _start(k, d, o) { if (this.state === 'fly') return; this.act = Object.assign({ k, t: 0, d }, o || {}); }

  // the swoop: a cubic from here to there that lifts off, dips and comes up into the perch
  _plan(pre) {
    const p0 = [this.x, this.y], p3 = [this.tx, this.ty], dx = p3[0] - p0[0], dy = p3[1] - p0[1], d = Math.hypot(dx, dy);
    if (Math.abs(dx) > 3) this._dir = dx > 0 ? 1 : -1;
    const sag = Math.min(46, 10 + d * 0.16);
    const p1 = [p0[0] + dx * 0.28, p0[1] + dy * 0.18 - Math.min(26, 8 + d * 0.06)];
    // the last stretch levels out (never from below: a roof or the reader's book would be in the way)
    const p2 = [p3[0] - dx * 0.38, p3[1] + (dy < -20 ? Math.min(6, sag * 0.3) : 0) - (dy > 20 ? Math.min(8, dy * 0.05) : 0)];
    let len = 0, q = p0;
    for (let i = 1; i <= 12; i++) { const r = cubic(p0, p1, p2, p3, i / 12); len += Math.hypot(r[0] - q[0], r[1] - q[1]); q = r; }
    const T = d < 2 ? 0 : Math.max(0.55, (len / Math.max(40, this.speed)) * 1.12);
    this._fl = { p0, p1, p2, p3, T, t: 0, pre, len };
  }

  update(dt) {
    this._t += dt;
    const still = isStill();
    spring(this.hop, 0, dt, 300, 14);
    spring(this.tail, 0, dt, 260, 11);
    if (this.sing > 0) this.sing -= dt;
    if (this.peck > 0) this.peck -= dt;
    this._live = true;
    // the quick hop-turn: flips at the top of a small hop, squashed thin as it turns
    this.sq = 0; this.tbY = 0;
    const TB = this._tb;
    if (TB) {
      TB.t += dt; const u = TB.t / TB.d;
      if (u >= 0.5 && !TB.flipped) { TB.flipped = true; this.turn = 1; }
      this.tbY = -Math.sin(Math.PI * clamp01(u)) * 2.6; this.sq = Math.max(0, 1 - Math.abs(u - 0.5) / 0.3);
      if (u >= 1) { this._tb = null; this.crouch.v += 6; }
    }
    if (this.state === 'fly') this._fly(dt);
    else this._perch(dt, still);
    // head: birds move their heads in snaps
    this.yaw = approach(this.yaw, this.yawT, 38, dt);
    this.tilt = approach(this.tilt, this.tiltT, 30, dt);
    this.puff = approach(this.puff, this.sing > 0 ? 1 : 0, this.sing > 0 ? 30 : 10, dt);
  }

  _perch(dt, still) {
    spring(this.crouch, 0, dt, 220, 13);
    this.wingOpen = approach(this.wingOpen, 0, 22, dt);
    this.flare = approach(this.flare, 0, 18, dt); this.legs = approach(this.legs, 0, 20, dt);
    this.pitchF = approach(this.pitchF, 0, 14, dt); this.yoff = approach(this.yoff, 0, 20, dt);
    if (this._land > 0) this._land -= dt;
    const busy = this.sing > 0 || this.peck > 0;
    if (busy) { this.act = null; if (this.turn < 0) this._turnBack(); this.ox = approach(this.ox, 0, 20, dt); }
    if (this.sing > 0) { this.yawT = 0.25; this.tiltT = -0.22; }
    else if (this.peck > 0) { this.yawT = 0.15; this.tiltT = 0; }
    // the current action
    const A = this.act;
    if (A) {
      A.t += dt; const u = A.t / A.d;
      if (A.k === 'hop' || A.k === 'turn') {
        if (u < 0.25) this.crouch.x = Math.max(this.crouch.x, smooth(u / 0.25) * 0.7);
        if (A.k === 'hop') this.ox = A.from + (A.to - A.from) * smooth((u - 0.2) / 0.7);
        if (A.k === 'turn' && u > 0.52 && !A.flipped) { A.flipped = true; this.turn = -this.turn; }
        if (A.k === 'turn') this.sq = Math.max(0, 1 - Math.abs(u - 0.525) / 0.14);
        this.yoff = -Math.sin(Math.PI * clamp01((u - 0.2) / 0.65)) * 4.5;
        if (u >= 1) { this.crouch.v += 9; this.tail.v -= 3; }
      } else if (A.k === 'preen') {
        const e = smooth(u / 0.16) * (1 - smooth((u - 0.84) / 0.16));
        this.yawT = e > 0.5 ? 3.0 : this.yawT; this.tiltT = e > 0.5 ? -0.5 : 0;
        // two or three quick nibbles at the shoulder while the head is round
        const hold = clamp01((u - 0.2) / 0.6);
        A.e = e; A.nib = e > 0.9 && hold > 0 && hold < 1 ? Math.max(0, Math.sin(hold * Math.PI * 6)) ** 2 : 0;
      } else if (A.k === 'fluff') {
        this.fluffK = Math.sin(Math.PI * clamp01(u / 0.75)) ** 0.6;
        if (u > 0.72 && u < 0.95) this.fluffK = Math.max(this.fluffK, 0.25 * Math.abs(Math.sin(A.t * 40)));
      } else if (A.k === 'shift') {
        A.foot = Math.sin(Math.PI * u);
      }
      if (u >= 1) { if (A.k === 'preen') { this.yawT = 0; this.tiltT = 0; } this.fluffK = 0; this.act = null; }
    } else this.fluffK = approach(this.fluffK, 0, 8, dt);
    if (still || !this.fidget || busy) { if (still) { this.yawT = this.sing > 0 ? 0.25 : 0; this.tiltT = 0; } return; }
    // idling: something small every second or so
    this._next -= dt;
    if (this._next > 0 || this.act) return;
    let r = this._r(); const R = this._r;
    // the nicest bits should not be left to chance for long: a fluff or a preen at least every ~7 s
    if (this._t - (this._cared || 0) > 6.5 + R() * 2) r = R() < 0.5 ? 0.8 : 0.9;
    if (r >= 0.78 && r < 0.97) this._cared = this._t;
    if (this.turn < 0 && r < 0.3) { this._start('turn', 0.3); this._next = 0.8 + R(); return; }
    if (r < 0.44) {                                                   // a head snap
      const looks = [0, 0, 0, 0, 0.45, 0.8, 0.8, 1.35, 2.8, -0.5, -1.5];
      this.yawT = looks[Math.floor(R() * looks.length)];
      this.tiltT = R() < 0.35 ? (R() - 0.5) * 0.8 : 0;
      this._next = Math.abs(this.yawT) > 1.2 ? 0.3 + R() * 0.5 : 0.25 + R() * 0.9;
      if (Math.abs(this.yaw) > 1.2 && Math.abs(this.yawT) > 1.2) this.yawT = 0;
    } else if (r < 0.56) { this.tiltT = (R() < 0.5 ? -1 : 1) * (0.3 + R() * 0.25); this._next = 0.4 + R() * 0.7; }
    else if (r < 0.68) { this.tail.v -= 14 + R() * 8; this._next = 0.3 + R() * 0.6; }
    else if (r < 0.74) { this.hopAlong(this.ox ? 0 : (R() < 0.5 ? -4 : 4)); this._next = 0.8 + R(); }
    else if (r < 0.78) { this._start('shift', 0.45, { side: R() < 0.5 ? 0 : 1 }); this._next = 0.6 + R(); }
    else if (r < 0.87) { this.fluff(); this._next = 1.6 + R(); }
    else if (r < 0.97) { this.preen(); this._next = 1.8 + R(); }
    else { this._start('turn', 0.3); this._next = 1.2 + R() * 2; }
  }

  _fly(dt) {
    const F = this._fl;
    if (!F) { this._plan(0); return; }
    if (F.p3[0] !== this.tx || F.p3[1] !== this.ty) { this._plan(0); return; }   // retargeted mid-air
    this.yawT = 0; this.tiltT = 0; this.fluffK = 0;
    if (F.pre > 0) {                                                  // take-off: a small crouch…
      F.pre -= dt; this.crouch.x = approach(this.crouch.x, 1, 40, dt); this.crouch.v = 0;
      this.wingOpen = approach(this.wingOpen, 0.6, 30, dt); this.wingE = 0.9;
      return;
    }
    if (F.T <= 0) return this._arrive();
    spring(this.crouch, 0, dt, 400, 18);
    F.t += dt;
    const u = clamp01(F.t / F.T);
    // ease: quick off the perch, slowing into the flare
    const sv = this._ease(u);
    const p = cubic(F.p0, F.p1, F.p2, F.p3, sv), p2 = cubic(F.p0, F.p1, F.p2, F.p3, Math.min(1, sv + 0.02)), p1 = cubic(F.p0, F.p1, F.p2, F.p3, Math.max(0, sv - 0.02));
    this.x = p[0]; this.y = p[1];
    const tdx = p2[0] - p1[0], tdy = p2[1] - p1[1];
    if (Math.abs(F.p3[0] - F.p0[0]) <= 3 && Math.abs(tdx) > 0.5) this._dir = tdx > 0 ? 1 : -1;
    // pitch: bank into the path (nose down when diving, up when climbing)
    const ang = Math.atan2(tdy, Math.abs(tdx) + 1e-3);
    const fl = smooth((u - 0.78) / 0.2);
    this.flare = fl;
    this.pitchF = approach(this.pitchF, clamp(ang * 0.8, -0.6, 0.55) * (1 - fl) - 0.56 * fl, 16, dt);
    this.legs = fl;
    // wings: a strong beat off the perch, bounding (flap–flap–fold) on longer flights, a flared back-beat at the end
    const tc = (F.t + 0.1) % 0.82, bound = F.T > 1.15 && u > 0.22 && u < 0.7 && tc > 0.56;
    const hz = u < 0.18 ? 7.5 : fl > 0.2 ? 9 : 6.2;
    this.flap += dt * TAU * hz;
    this.wingOpen = approach(this.wingOpen, bound ? 0 : 1, bound ? 28 : 36, dt);
    const sw = Math.sin(this.flap + 0.4 * Math.sin(this.flap));      // a quicker downstroke
    this.wingE = fl > 0 ? sw * (1 - 0.7 * fl) + 0.7 * fl : sw;
    // a gentle undulation on top of the swoop (rises while flapping, sinks while folded)
    const win = Math.sin(Math.PI * u) ** 2;
    this.yoff = F.T > 1.15 ? -Math.sin((tc / 0.82) * TAU) * 3.5 * win : 0;
    if (u >= 1) this._arrive();
  }
  _ease(u) {
    // speed profile: accelerate over the first 15 %, cruise, brake over the last 25 % (the flare)
    const a = 0.15, b = 0.75, vmax = 1 / (1 - a / 2 - (1 - b) / 2);
    if (u < a) return vmax * u * u / (2 * a);
    if (u < b) return vmax * (a / 2 + (u - a));
    const w = u - b, L = 1 - b;
    return vmax * (a / 2 + (b - a) + w - (w * w) / (2 * L));
  }
  _arrive() {
    this.x = this.tx; this.y = this.ty; this.state = 'perch'; this._fl = null;
    this.yoff = 0; this.crouch.v += 16; this.tail.v -= 18; this._land = 0.4; this.wingE = 0.6;
    this._next = 0.8 + this._r();
    const f = this.onArrive; this.onArrive = null; if (f) f();
  }

  // ── drawing ──
  draw(ctx, t) {
    if (this.hidden) return;
    const still = isStill(), s = this.size, D = this._dir * this.turn;
    const amp = still ? 0 : 0.32, bs = this.seed + (still ? 0 : Math.floor(t * 6) * 7);
    const fly = this.state === 'fly' && this._fl && this._fl.pre <= 0;
    const P = this.pose;
    let wingOpen = this.wingOpen, wingE = this.wingE, flare = this.flare, legs = this.legs, pitchF = this.pitchF;
    if (P) { wingOpen = P.open === undefined ? 1 : P.open; wingE = P.e || 0; flare = P.flare || 0; legs = P.legs === undefined ? flare : P.legs; pitchF = P.pitch === undefined ? -0.56 * flare : P.pitch; }
    const inAir = fly || !!P;
    // peck: three quick dips in 0.9 s
    let pk = 0;
    if (this.peck > 0) { const ph = (0.9 - this.peck) % 0.3; pk = ph < 0.07 ? smooth(ph / 0.07) : ph < 0.12 ? 1 : 1 - smooth((ph - 0.12) / 0.12); }
    const cr = Math.max(0, this.crouch.x), sing = this.puff, fluff = this.fluffK;
    const A = this.act, preen = A && A.k === 'preen' ? A.e || 0 : 0, nib = A && A.k === 'preen' ? A.nib || 0 : 0;
    const breathe = still ? 0 : Math.sin(this._t * 2.6 + this.seed) * 0.22;

    ctx.save();
    ctx.translate(this.x + this.ox * this._dir * s, this.y + (Math.min(0, this.hop.x) + this.yoff + this.tbY) * s);
    ctx.scale(D * s * (1 - 0.5 * this.sq), s * (1 + 0.08 * this.sq));

    // body frame: rotate round the hip
    const pitch = (inAir ? -0.08 + pitchF : BASE_PITCH + pk * 0.75 + cr * 0.22 - sing * 0.08);
    const drop = inAir ? -2 : cr * 2.4 - (this._land > 0 ? 0 : 0);
    const hip = [PIV[0], PIV[1] + drop];
    const c = Math.cos(pitch), sn = Math.sin(pitch);
    const B = (x, y) => { const r = rot([x, y], c, sn); return [hip[0] + r[0], hip[1] + r[1]]; };
    const fk = 1 + fluff * 0.14;

    // legs (under everything)
    this._legs(ctx, hip, B, inAir, legs, cr, A);

    // body outline in the body frame (egg: round chest, tapering rump)
    const body = [];
    for (let i = 0; i < 12; i++) {
      const u = (i / 12) * TAU, cu = Math.cos(u), su = Math.sin(u);
      const rx = (cu > 0 ? 9.4 : 10.6) * fk, ry = 7.3 * fk * (cu < 0 ? 1 - 0.32 * -cu : 1) + (su > 0 ? breathe : 0);
      body.push(B(0.4 + cu * rx, -6.4 + su * ry + (cu < 0 ? -cu * 1.2 : 0)));
    }
    boil(body, bs + 1, amp); blob(body);
    // tail: a little fan off the rump, flicks up
    const ta = (inAir ? 0.05 + flare * -0.12 : 0.12) + this.tail.x * -0.06 + pk * -0.25 - (this._land > 0 ? 0 : 0);
    const tc = Math.cos(Math.PI + ta), ts = Math.sin(Math.PI + ta), tf = 1 + flare * 1.25;
    const T0 = B(-8.6, -6.2), TL = 11.5 - flare * 2;
    const tailPts = [[0, -2.6], [TL * 0.6, -3.2 * tf], [TL, -3.4 * tf], [TL - 1.3, 0], [TL, 3.4 * tf], [TL * 0.6, 3.2 * tf], [0, 2.6]].map((q) => {
      const r = rot(q, Math.cos(pitch + Math.PI + ta) * 1, Math.sin(pitch + Math.PI + ta));
      return [T0[0] + r[0], T0[1] + r[1]];
    });
    void tc; void ts;
    boil(tailPts, bs + 2, amp * 0.8); blob(tailPts);
    // head
    let H = B(HEAD_AT[0], HEAD_AT[1]);
    if (!inAir) {
      // keep the head over the chest whatever the body does; peck reaches down-forward, singing lifts it
      H = [H[0] - pk * 1 + preen * -7 - nib * 1.2, H[1] + pk * 4 - sing * 1.2 + preen * 3.6 + nib * 1.2 + cr * 0.5];
    } else H = [H[0] + 0.8, H[1] + 0.4];
    const hr = HR * (1 + fluff * 0.05);
    const head = oval(H[0], H[1], hr, hr * 0.94, 0, 12); boil(head, bs + 3, amp * 0.7);
    // throat: swells when singing
    const thr = B(7.4, -9.2), throat = oval(thr[0] + sing * 0.6, thr[1] + 0.6, 3.6 + sing * 1.8, 3.2 + sing * 1.6, 0, 10);

    const yaw = this.yaw, beakBehind = Math.sin(yaw) < -0.05;
    const open = this.sing > 0 ? Math.abs(Math.sin((0.5 - this.sing) * Math.PI * 4)) * 0.55 : 0;
    // far wing (flight): behind the body, a shade darker
    if (inAir && wingOpen > 0.5) this._wing(ctx, B, wingE, flare, true, bs, pitch);
    if (beakBehind) this._beak(ctx, H, hr, yaw, this.tilt + pk * 0.95 - nib * 0.35, open);
    // ONE line round tail, body, throat and head
    inked(ctx, [[tailPts, this.col[1]], [body, this.col[0]], [throat, this.col[0]], [head, this.col[0]]], LW);
    // pale breast and throat
    ctx.save(); ctx.beginPath(); trace(ctx, body); trace(ctx, throat); ctx.clip();
    const bp = B(4.6, -1.6);
    ctx.beginPath(); ctx.ellipse(bp[0], bp[1], 8.5 * fk, 6.2 * fk, pitch - 0.5, 0, TAU); ctx.fillStyle = this.pale; ctx.fill();
    const tp = thr; ctx.beginPath(); ctx.ellipse(tp[0] + sing, tp[1] + 1.6, 2.8 + sing * 2, 2.8 + sing * 1.6, 0, 0, TAU); ctx.fill();
    ctx.restore();
    // a belly line under the chest, a feather mark on the rump
    // folded wing (or the wing tucked in a bound)
    if (!inAir || wingOpen <= 0.5) this._foldedWing(ctx, B, bs, preen, fluff, wingOpen);
    // head again on top when preening (the face buried in the wing) / or just its features
    if (preen > 0.5) inked(ctx, [[head, this.col[0]]], LW);
    this._face(ctx, H, hr, yaw, this.tilt + pk * 0.95 - nib * 0.35, open, beakBehind);
    if (inAir && wingOpen > 0.5) this._wing(ctx, B, wingE, flare, false, bs, pitch);
    ctx.restore();
  }

  _legs(ctx, hip, B, inAir, legs, cr, A) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (inAir) {
      // tucked in flight; reaching forward for the landing
      for (let i = 0; i < 2; i++) {
        const k = B(1 + i * 1.5, -1.5), off = i * 1.6;
        const tuck = [k[0] - 3.5 - off, k[1] + 1.5], reach = [k[0] + 3.5 + off * 0.6, k[1] + 5.8];
        const f = [tuck[0] + (reach[0] - tuck[0]) * legs, tuck[1] + (reach[1] - tuck[1]) * legs];
        line(ctx, [k, f], 1.55, LEG);
        if (legs > 0.3) { line(ctx, [f, [f[0] + 2.4, f[1] + 0.6]], 1.3, LEG); line(ctx, [f, [f[0] + 1.2, f[1] + 1.9]], 1.3, LEG); line(ctx, [f, [f[0] - 1.6, f[1] + 0.8]], 1.3, LEG); }
      }
      return;
    }
    // both legs in one stroke (cheap): shank, toes gripping the perch (forward and curled, one back)
    ctx.beginPath();
    for (let i = 0; i < 2; i++) {
      const fx = i ? 2.6 : -1.2, lift = A && A.k === 'shift' && A.side === i ? (A.foot || 0) * 1.6 : 0;
      const top = B(i ? 2.2 : -0.6, -1.2), f0 = fx, f1 = -lift;
      // the "knee" (really the ankle) bends forward as the bird crouches
      ctx.moveTo(top[0], top[1]); ctx.quadraticCurveTo((top[0] + f0) / 2 + 1.2 + cr * 3.2, (top[1] + f1) / 2, f0, f1);
      ctx.quadraticCurveTo(f0 + 1.9, f1 + 0.1, f0 + 2.9, f1 + 1.2);
      ctx.moveTo(f0, f1); ctx.lineTo(f0 - 1.8, f1 + 0.4);
    }
    ctx.lineWidth = 1.55; ctx.strokeStyle = LEG; ctx.stroke();
  }

  _foldedWing(ctx, B, bs, preen, fluff, wingOpen) {
    // a teardrop from the shoulder back over the rump; lifts a little when preened under
    const lift = preen * 0.32, k = 1 + fluff * 0.1;
    const sh = B(3.6, -6.8), c = Math.cos(lift), s = Math.sin(lift);
    const W = (x, y) => { const r = B(x * k, y * k - 6.4 + 6.4), q = [r[0] - sh[0], r[1] - sh[1]]; return [sh[0] + q[0] * c - q[1] * s, sh[1] + q[0] * s + q[1] * c]; };
    const pts = [W(4.6, -7.4), W(1, -9.4), W(-5.5, -9.0), W(-10.8, -6.6), W(-13.6, -4.8), W(-9.2, -2.8), W(-2.5, -2.0), W(3, -3.6)];
    boil(pts, bs + 5, 0.25); blob(pts);
    inked(ctx, [[pts, this.col[1]]], LW * 0.85);
    // wing coverts a touch lighter, and the long feathers as ink strokes
    const cv = W(0.6, -6.6); ctx.beginPath(); ctx.ellipse(cv[0], cv[1], 4.2, 2.1, 0, 0, TAU); ctx.fillStyle = this.covert; ctx.fill();
    const fc = 'rgba(29,21,48,0.6)';
    line(ctx, [W(-3.2, -5.2), W(-8, -4.6), W(-11.8, -4.6)], 0.8, fc);
    line(ctx, [W(-2.2, -3.4), W(-6.5, -3.0), W(-9.4, -3.4)], 0.8, fc);
    void wingOpen;
  }

  // An open wing in flight, as a fan about as long as the body. In 3D it spans out sideways
  // (towards the viewer for the near wing, away for the far one), raised by e·72°; seen from a
  // little above, so at "level" the near wing hangs as a foreshortened fan below the shoulder and
  // the far one shows above the back: two wings bracket the body. Flare swings both forward.
  _wing(ctx, B, e, flare, far, bs, pitch) {
    const th = e * 1.25, side = far ? -1 : 1, PV = 0.6;
    const up = Math.sin(th) * Math.cos(PV) - side * Math.cos(th) * Math.sin(PV);
    const span = far ? 19 : 21.5, C = 11.5;
    const sh = B(2.2 + (far ? -1.4 : 0), -10.6 + (far ? -0.8 : 0));
    // the wing's direction in the body frame (back-swept; cupped forward in the flare), turned with the body
    const bx = span * (-0.34 + flare * 0.42) * (0.55 + 0.45 * Math.abs(up)), by = -span * up;
    const cp = Math.cos(pitch), sp = Math.sin(pitch), vx = bx * cp - by * sp, vy = bx * sp + by * cp;
    const cx = cp * C, cy = sp * C;                                   // chord along the body axis
    const W = (u, w) => [sh[0] + vx * u + cx * w, sh[1] + vy * u + cy * w];
    // leading edge, the tip, four primaries fanning along the trailing edge, the secondaries
    const pts = [W(0, 0.3), W(0.4, 0.36), W(0.76, 0.27), W(1.0, 0.1), W(1.07, -0.03), W(0.95, -0.06), W(1.01, -0.2), W(0.88, -0.22),
      W(0.92, -0.38), W(0.78, -0.37), W(0.8, -0.54), W(0.64, -0.5), W(0.46, -0.64), W(0.22, -0.68), W(0, -0.6)];
    boil(pts, bs + (far ? 8 : 9), 0.22); blob(pts);
    inked(ctx, [[pts, far ? this.deep : this.col[1]]], LW * 0.9);
    const fc = far ? 'rgba(29,21,48,0.35)' : 'rgba(29,21,48,0.5)';
    // lighter coverts near the shoulder (near wing), the primaries as ink strokes
    if (!far) {
      ctx.save(); ctx.beginPath(); trace(ctx, pts); ctx.clip();
      const a = W(0, 0.3), b = W(0.5, 0.33), c2 = W(0.42, -0.18), d = W(0, -0.3);
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(b[0], b[1], c2[0], c2[1]); ctx.lineTo(d[0], d[1]); ctx.closePath();
      ctx.fillStyle = this.covert; ctx.fill();
      ctx.restore();
    }
    line(ctx, [W(0.38, -0.1), W(0.95, -0.12)], 0.75, fc);
    line(ctx, [W(0.36, -0.28), W(0.84, -0.33)], 0.75, fc);
    line(ctx, [W(0.32, -0.45), W(0.7, -0.5)], 0.75, fc);
  }

  // eyes and (unless behind the head) the beak. yaw: 0 profile ahead, π/2 at the viewer, π over the shoulder
  _face(ctx, H, hr, yaw, tilt, open, beakBehind) {
    const ct = Math.cos(tilt), st = Math.sin(tilt), R = (dx, dy) => [H[0] + dx * ct - dy * st, H[1] + dx * st + dy * ct];
    for (const side of [-1, 1]) {
      const e = yaw + side * 1.08, z = Math.sin(e);
      if (z <= 0.08) continue;
      const p = R(hr * 0.7 * Math.cos(e), -1.1), w = 1.55 * (0.45 + 0.55 * z), h = 1.65;
      ctx.beginPath(); ctx.ellipse(p[0], p[1], w, h, tilt, 0, TAU); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(p[0] + 0.45 * Math.cos(yaw) + 0.2, p[1] - 0.6, 0.55, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
    }
    if (!beakBehind) this._beak(ctx, H, hr, yaw, tilt, open);
  }

  // Profile: a triangle. Turning to the viewer it becomes a short orange diamond pointing down
  // (never a dark mark: the outline is thin and the fill stays large).
  _beak(ctx, H, hr, yaw, tilt, open) {
    const ct = Math.cos(tilt), st = Math.sin(tilt), R = (q) => [H[0] + q[0] * ct - q[1] * st, H[1] + q[0] * st + q[1] * ct];
    const cy = Math.cos(yaw), sy = Math.abs(Math.sin(yaw)), sg = cy >= 0 ? 1 : -1, L = 5.8, hb = 2.0;
    const bx = hr * 0.84 * cy, by = 0.5 + sy * 1.1;
    const U = [bx, by - hb * (1 - 0.3 * sy)];
    const T = [bx + L * cy * (1 - 0.3 * sy), by + 0.15 + sy * 2.5 - (1 - sy) * 0.3];
    const Lo0 = [bx, by + hb], Lo = [Lo0[0] + (T[0] - Lo0[0]) * sy * 0.8, Lo0[1] + (T[1] - Lo0[1]) * sy * 0.8];
    const mUT = [(U[0] + T[0]) / 2, (U[1] + T[1]) / 2], mB = [bx, by];
    const w = 2.1 * sy, Ri = [mUT[0] + (bx + sg * w - mUT[0]) * sy, mUT[1] + (by + 0.4 - mUT[1]) * sy], Le = [mB[0] + (bx - sg * w - mB[0]) * sy, mB[1] + (by + 0.4 - mB[1]) * sy];
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (open > 0.05) {
      const mid = [bx, by + 0.1], ang = open * 0.9 * sg;
      const rp = (p, a) => { const dx = p[0] - mid[0], dy = p[1] - mid[1], c = Math.cos(a), s = Math.sin(a); return [mid[0] + dx * c - dy * s, mid[1] + dx * s + dy * c]; };
      const tu = rp(T, -ang * 0.6), tl = rp(T, ang * 0.55);
      poly(ctx, [mid, tu, tl].map(R), MOUTH, 0.7);
      poly(ctx, [U, tu, mid].map(R), BEAK, 0.7);
      poly(ctx, [mid, tl, Lo0].map(R), BEAK, 0.7);
    } else {
      poly(ctx, [U, Ri, T, Lo, Le].map(R), BEAK, 0.7);
      if (sy < 0.6) line(ctx, [R([bx, by + 0.1]), R([T[0] - cy * 1.3, T[1] - 0.15])], 0.55, 'rgba(29,21,48,0.5)');
      else line(ctx, [R([bx, by + 0.5]), R([bx + (T[0] - bx) * 0.7, by + 0.5 + (T[1] - by - 0.5) * 0.7])], 0.5, 'rgba(29,21,48,0.45)');
    }
  }
}

function poly(ctx, pts, fill, lw) {
  ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke();
}

// ── A firefly / wandering light ──
// A small dark beetle with a soft, slowly breathing light and a faint trail. Stateless for the
// caller; the trail remembers the last few places where the light was drawn, in device pixels,
// keyed by seed (a jump or a pause forgets it).
const TRAILS = new Map();
export function drawFirefly(ctx, x, y, t, seed, a) {
  a = a === undefined ? 1 : a;
  if (a <= 0.003) return;
  const still = isStill();
  const ph = t * 2.2 + seed * 1.7, pulse = 0.5 + 0.5 * Math.sin(ph) * Math.abs(Math.sin(ph * 0.5 + 0.7)) ** 0.5;
  const lit = 0.45 + 0.55 * pulse;
  // trail
  if (!still) {
    const m = ctx.getTransform(), dx = m.a * x + m.c * y + m.e, dy = m.b * x + m.d * y + m.f, k = Math.hypot(m.a, m.b);
    let tr = TRAILS.get(seed);
    if (!tr || t < tr.t || t - tr.t > 0.25 || Math.hypot(dx - tr.p[0][0], dy - tr.p[0][1]) > 60 * k) { tr = { t, p: [[dx, dy]] }; TRAILS.set(seed, tr); if (TRAILS.size > 200) TRAILS.clear(); }
    else if (t - tr.t > 0.035) { tr.p.unshift([dx, dy]); if (tr.p.length > 7) tr.p.length = 7; tr.t = t; }
    if (tr.p.length > 2) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (let i = 1; i < tr.p.length; i++) {
        const f = 1 - i / tr.p.length;
        ctx.beginPath(); ctx.moveTo(tr.p[i - 1][0], tr.p[i - 1][1]); ctx.lineTo(tr.p[i][0], tr.p[i][1]);
        ctx.strokeStyle = 'rgba(255,240,150,' + (0.22 * f * a * lit).toFixed(3) + ')'; ctx.lineWidth = 2.6 * k * f; ctx.stroke();
      }
      ctx.restore();
    }
  }
  glow(ctx, x, y, 14 + 10 * pulse, '#fff3a0', a * 0.8 * lit);
  // body: a dot of a beetle, its tail end the light
  const wob = still ? 0 : Math.sin(t * 40 + seed) * 0.5;
  ctx.fillStyle = 'rgba(40,32,40,' + (0.75 * a).toFixed(2) + ')';
  ctx.beginPath(); ctx.ellipse(x - 2, y - 1.2, 1.7, 1.3, -0.4, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,' + (0.28 * a).toFixed(2) + ')';
  ctx.beginPath(); ctx.ellipse(x - 2.2, y - 3 + wob, 2.2, 1, -0.9, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(255,250,' + Math.round(170 + 60 * pulse) + ',' + (a * (0.7 + 0.3 * pulse)).toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(x + 0.6, y + 0.4, 2.2 + 0.5 * pulse, 0, TAU); ctx.fill();
}

// ── By day the wandering lights are butterflies ──
// Wings really open and close: each wing is turned about the body's long axis in 3D and seen from
// a little above; the body tilts and bobs with the beat, and now and then it glides wings-open.
const BF_COLS = [['#f08ab0', '#b84f7c'], ['#ffb648', '#c4741f'], ['#8fbdf5', '#4a7cc0'], ['#ffffff', '#8a8fb0']];
const FORE = [[1.2, 0], [4.5, 4.5], [7.5, 10.5], [6.5, 14.5], [1.5, 15], [-2.2, 10], [-1.8, 1]];
const HIND = [[0.2, 0.5], [-0.6, 7], [-2.8, 11], [-6.8, 10.8], [-9, 6.5], [-7.2, 1.8], [-3.5, 0.2]];
export function drawButterfly(ctx, x, y, t, seed, opts) {
  const col = BF_COLS[Math.floor(seed * 3.1) % BF_COLS.length], still = isStill();
  // beat: fast flaps with a glide every few seconds
  const cyc = (t * 0.35 + seed * 0.37) % 1, glide = cyc > 0.78 ? Math.sin(Math.PI * (cyc - 0.78) / 0.22) : 0;
  let beat = 0.5 + 0.5 * Math.sin(t * 13 + seed * 5);
  beat = beat * (1 - glide) + 0.75 * glide;
  let open = opts && opts.open !== undefined ? opts.open : (still ? 0.7 : beat);        // 0 closed up … 1 flat
  const th = 0.12 + open * 1.42;                                                         // wing angle from vertical
  const tilt = (opts && opts.tilt !== undefined ? opts.tilt : Math.sin(t * 1.7 + seed) * 0.25) - 0.35 + (still ? 0 : (open - 0.5) * 0.18);
  const bob = still ? 0 : (0.5 - open) * 2;
  const pv = 0.7 + 0.65 * open, cp = Math.cos(pv), sp = Math.sin(pv), ct = Math.cos(tilt), stt = Math.sin(tilt);
  // (u along the body, v out along the wing) → screen
  const P = (u, v, side) => {
    const X = u, Y = v * Math.cos(th), Z = side * v * Math.sin(th);
    const sx = X, sy = -(Y * cp - Z * sp);                // seen from a little above: nearer is lower
    return [x + sx * ct - sy * stt, y + bob + sx * stt + sy * ct];
  };
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const wing = (side) => {
    const shade_ = side < 0 ? 0.82 : 1;
    for (const [shape, sc] of [[HIND, 1], [FORE, 1]]) {
      const pts = shape.map((q) => P(q[0] * sc, q[1] * sc, side)); blob(pts);
      ctx.beginPath(); trace(ctx, pts);
      ctx.fillStyle = col[0]; ctx.fill();
      if (shade_ < 1) { ctx.fillStyle = 'rgba(29,21,48,0.16)'; ctx.fill(); }
      ctx.lineWidth = 1.5; ctx.strokeStyle = INK; ctx.stroke();
    }
    // a spot and an edge mark on the forewing
    const sp1 = P(2.4, 10.5, side), sp2 = P(-5.4, 7, side), f = Math.max(0.25, Math.abs(Math.sin(th) * Math.sin(pv)) + Math.abs(Math.cos(th)) * 0.9);
    ctx.fillStyle = col[1];
    ctx.beginPath(); ctx.ellipse(sp1[0], sp1[1], 2, 2 * Math.min(1, f), tilt, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(sp2[0], sp2[1], 1.5, 1.5 * Math.min(1, f), tilt, 0, TAU); ctx.fill();
  };
  wing(-1);
  // body and feelers
  const h = P(4, 0, 1), tl = P(-6.5, 0, 1), a1 = P(10.5, 3.6, 1), a2 = P(10.8, 1, -1);
  ctx.strokeStyle = INK; ctx.lineWidth = 0.9;
  ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo((h[0] + a1[0]) / 2, (h[1] + a1[1]) / 2 - 1, a1[0], a1[1]); ctx.moveTo(h[0], h[1]); ctx.quadraticCurveTo((h[0] + a2[0]) / 2, (h[1] + a2[1]) / 2 - 1, a2[0], a2[1]); ctx.stroke();
  ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(tl[0], tl[1]); ctx.stroke();
  wing(1);
  ctx.restore();
}
