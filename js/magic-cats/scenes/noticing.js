// Scene 6 — Learning to notice. An ordinary garden late in the day. The cat brings a tale
// straight to a child who can read by now; letters turn into pictures; and then every
// ordinary thing in the garden turns out to be something magic, if you only look — while
// the afternoon slides into the lavender dusk of the calf picture, into night, into a dream.
import { Street, Perch } from '../street.js';
import { ABORT } from '../scene.js';
import { Leap } from '../leap.js';
import { Cat, Kid, drawLooseBundle } from '../actors.js';
import { drawBush, drawSmoke, drawFarTown } from '../props.js';
import { TAU, clamp, clamp01, lerp, ease, rng, hash, dist, mixHex, rgba, approach } from '../util.js';
import { INK, SKIES, ink, wobble, wobblyPoly, glow, chalk, tube, circlePts, sparklePath, starPath, crayonRings, drawSkyAll, drawStars, drawMoon, drawCloud, drawGround, drawGrassFront, mixSky } from '../paint.js';

const T = {
  bring: { en: 'Bring the tale to the child', de: 'Bring dem Kind das Märchen', ru: 'Отнеси сказку ребёнку' },
  read: { en: 'Touch the letters to read them', de: 'Tippe die Buchstaben an und lies', ru: 'Коснись букв — прочитай их' },
  notice: { en: 'Look closely. Who is hiding in the garden?', de: 'Schau genau hin. Wer versteckt sich im Garten?', ru: 'Присмотрись. Кто прячется в саду?' },
  sleep: { en: 'Close your eyes: press and hold', de: 'Augen zu: drücken und halten', ru: 'Закрой глазки: нажми и держи' },
  day: { en: 'Pop the daytime bubbles', de: 'Lass die Tagesblasen platzen', ru: 'Лопни дневные пузырьки' },
  rise: { en: 'Touch the dream and let it rise', de: 'Tippe den Traum an und lass ihn steigen', ru: 'Коснись сна — пусть летит' }
};
const AFTERNOON = Object.assign({}, SKIES.green, { top: '#6fb6ea', mid: '#b9dcf2', bot: '#fde3c4' });
const LAVNIGHT = { top: '#2a0f52', mid: '#4a2378', bot: '#7a4aa0', ground: '#5d4290', ground2: '#3f2a70', tuft: ['#a996e0', '#cfc2f2', '#7fa2e0', '#efe6ff'], star: 1, cloud: '#7a4aa0' };
const LETTERS = { en: ['A', 'B', 'C', 'D', 'E'], de: ['A', 'B', 'C', 'D', 'E'], ru: ['А', 'Б', 'В', 'Г', 'Д'] };
const LINE_Y = -196;
// base positions (portrait); on wider screens the garden spreads out (see layout())
const BASE = { bush: -84, puddle: 30, stone: 98, sheet: 60, cloud: -64, snail: 186, calf: 238, pole1: -22, pole2: 140 };
// where the five letters hang while they wait to be read: an arc over the girl's window (offsets from its centre)
const HOMES = [[-80, -62], [-34, -132], [44, -164], [112, -140], [152, -96]];
const HOMES_WIDE = [[-96, -50], [-22, -88], [58, -100], [138, -88], [198, -56]];     // (a short landscape screen: lower and wider)
const ORBIT = 132;                  // how far the daytime bubbles circle round the dream
// the director's camera, per phase (see frame())
const CAM = {
  bring: { ground: true, max: 1.6, pad: 26, rate: 1.6, zoomIn: 0.7 },
  window: { max: 1.8, pad: 24, rate: 1.4, zoomIn: 0.6, zoomOut: 1.4 },
  letters: { max: 1.7, pad: 22, rate: 1.4, zoomIn: 0.6, zoomOut: 1.4 },
  garden: { ground: true, max: 1.5, pad: 22, rate: 1.1, zoomIn: 1.1, zoomOut: 1.1 },
  huntUp: { max: 1.7, pad: 18, rate: 1.6, zoomIn: 0.8, zoomOut: 1.6 },      // (an upright screen: a part of the garden, large, travelling)
  emerge: { max: 1.6, pad: 30, rate: 1.1, zoomIn: 0.5, zoomOut: 1.2 },
  dream: { max: 1.6, pad: 26, rate: 1.0, zoomIn: 0.5, zoomOut: 1.2 },
  mems: { max: 1.6, pad: 22, rate: 1.0, zoomIn: 0.5, zoomOut: 1.4 }
};

// ── tiny pictures (what letters turn into, what daytime bubbles hold) ──
function icon(ctx, kind, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (kind) {
    case 'star': starPath(ctx, 0, 0, 10, 0); ctx.fillStyle = '#ffd85a'; ctx.fill(); ink(ctx, 2); break;
    case 'moon': ctx.rotate(-0.5); ctx.beginPath(); ctx.arc(0, 0, 10, Math.PI / 3, (Math.PI * 5) / 3); ctx.arc(5, 0, 8.66, -Math.PI / 2, Math.PI / 2, true); ctx.closePath(); ctx.fillStyle = '#f6efc9'; ctx.fill(); ink(ctx, 2); break;
    case 'fish':
      wobble(ctx, [[-9, 0], [-3, -6], [6, -4], [10, 0], [6, 4], [-3, 6]], 3, 0.3); ctx.fillStyle = '#6fa8e8'; ctx.fill(); ink(ctx, 2);
      wobble(ctx, [[-8, 0], [-14, -6], [-13, 6]], 4, 0.3); ctx.fillStyle = '#6fa8e8'; ctx.fill(); ink(ctx, 2);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(5.5, -1, 1.2, 0, TAU); ctx.fill(); break;
    case 'crown':
      wobblyPoly(ctx, [[-10, 7], [-11, -6], [-5, 0], [0, -9], [5, 0], [11, -6], [10, 7]], 5, 0.4, 40); ctx.fillStyle = '#ffcf5a'; ctx.fill(); ink(ctx, 2);
      ctx.fillStyle = '#e2553f'; ctx.beginPath(); ctx.arc(0, 2, 1.8, 0, TAU); ctx.fill(); break;
    case 'boat':
      wobblyPoly(ctx, [[-11, 2], [11, 2], [7, 9], [-7, 9]], 6, 0.4, 40); ctx.fillStyle = '#d9483b'; ctx.fill(); ink(ctx, 2);
      wobblyPoly(ctx, [[0, 0], [0, -12], [9, -1]], 7, 0.3, 40); ctx.fillStyle = '#fbfbf6'; ctx.fill(); ink(ctx, 2); break;
    case 'sun':
      ctx.strokeStyle = '#f2a23a'; ctx.lineWidth = 2.4; ctx.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 13.5, Math.sin(a) * 13.5); } ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, TAU); ctx.fillStyle = '#ffd85a'; ctx.fill(); ink(ctx, 2); break;
    case 'ball':
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fillStyle = '#e2553f'; ctx.fill(); ink(ctx, 2);
      ctx.strokeStyle = '#fbfbf6'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.arc(-9, -6, 13, -0.3, 1.1); ctx.stroke(); break;
    case 'swing':
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(-9, -12); ctx.lineTo(9, -12); ctx.moveTo(-6, -12); ctx.lineTo(-7, 5); ctx.moveTo(6, -12); ctx.lineTo(5, 5); ctx.stroke();
      wobblyPoly(ctx, [[-9, 4], [8, 4], [8, 8], [-9, 8]], 8, 0.3, 40); ctx.fillStyle = '#f2c23a'; ctx.fill(); ink(ctx, 1.8); break;
    case 'kite':
      wobblyPoly(ctx, [[0, -12], [8, -2], [0, 9], [-8, -2]], 9, 0.3, 40); ctx.fillStyle = '#7fce8a'; ctx.fill(); ink(ctx, 2);
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(0, 9); ctx.quadraticCurveTo(5, 13, -2, 16); ctx.stroke(); break;
    case 'family':
      for (const [dx, r, c] of [[-6, 6.5, '#8a4a2a'], [6.5, 7.5, '#5a3a26']]) {
        ctx.beginPath(); ctx.arc(dx, -2, r, 0, TAU); ctx.fillStyle = '#f6d2b8'; ctx.fill(); ink(ctx, 1.8);
        ctx.beginPath(); ctx.arc(dx, -2, r, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(dx, -2 - r * 0.45); ctx.closePath(); ctx.fillStyle = c; ctx.fill();
      }
      ctx.fillStyle = '#e2553f'; ctx.beginPath(); ctx.moveTo(0, 9); ctx.bezierCurveTo(-5, 5, -3, 2, 0, 5); ctx.bezierCurveTo(3, 2, 5, 5, 0, 9); ctx.fill(); break;
    default: break;
  }
  ctx.restore();
}
function bubble(ctx, x, y, r, a, t, seed, tint) {
  ctx.save(); ctx.globalAlpha *= a;
  if (tint) { ctx.fillStyle = tint; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(29,21,48,0.28)'; ctx.lineWidth = 2.2; ctx.stroke(); }
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(0.75, 'rgba(255,255,255,0.16)'); g.addColorStop(1, 'rgba(255,255,255,0.5)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = Math.max(1.6, r * 0.05); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = Math.max(1.6, r * 0.07); ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(x, y, r * 0.72, Math.PI * 1.08 + Math.sin(t + seed) * 0.05, Math.PI * 1.36); ctx.stroke();
  ctx.restore();
}

export default class Noticing extends Street {
  constructor(game, index) {
    super(game, index);
    this.skyFrom = AFTERNOON; this.skyGoal = SKIES.dusk; this.skyK = 0;
    this.follow = false; this.far = 0.45;
    this.moon = { u: 0.84, y: 110, r: 34 };
    // the house at the garden's edge, with a low window for a child who has grown a little
    this.girl = new Kid({ kind: 'pigtails', mood: 'wait', size: 1.45 });
    this.house = this.addHouse({ x: -266, w: 190, h: 284, style: 'pink', seed: 121, chimney: true, smoke: true, windows: [
      { dx: 46, dy: -150, w: 76, h: 86, lit: 1, kid: this.girl, glowK: 0.6 }, { dx: -42, dy: -150, w: 40, h: 50, lit: 0 }, { dx: 2, dy: -246, w: 36, h: 36, kind: 'round', lit: 0 }],
      door: { dx: -44, color: '#7a4a6a' } });
    this.win = this.house.windows[0];
    this.addTree({ x: -520, h: 200, r: 74, kind: 'big', seed: 122 });
    this.appleTree = this.addTree({ x: 430, h: 168, r: 62, kind: 'apple', seed: 123 });
    this.farTree = this.addTree({ x: 650, h: 186, r: 60, kind: 'round', seed: 124 });
    // the cat arrives along the clothes line
    this.pPole2 = new Perch({ at: () => ({ x: this.pole2, y: LINE_Y - 8 }), kind: 'pole', hw: 20 });
    this.pPole1 = new Perch({ at: () => ({ x: this.pole1, y: LINE_Y - 8 }), kind: 'pole', hw: 20 });
    this.pLedge = Perch.point(-148, -108, { kind: 'sill', hw: 26 });
    this.papa = this.addCat(new Cat({ kind: 'papa', x: 600, y: -260 })); this.papa.carry = 1; this.papa.hidden = true;
    // the ordinary things (m = how much of their magic is showing)
    const th = (id, x, y, r) => ({ id, x, y, r, m: 0, found: false, t0: 0, seed: Math.floor(x * 3 + 500) });
    this.things = [th('bush', 0, -24, 44), th('puddle', 0, 8, 38), th('stone', 0, -12, 34), th('sheet', 0, -150, 44), th('cloud', 0, -330, 58), th('snail', 0, -14, 30), th('calf', 0, -44, 40)];
    this.by = {}; for (const o of this.things) this.by[o.id] = o;
    this.layout();
    this.cam.x = this.camX;
    this.found = 0; this.lav = 0; this.dream = 0; this.line = { x: 0, v: 0 };
    this.letters = []; this.pics = []; this.mems = []; this.dayStars = [];
    this.bub = null;                 // the dream bubble {x, y, r, a}
    this.sleep = 0; this.flash = 0; this.rising = false; this.shim = 0;
    this.child = new Kid({ kind: 'pigtails', pose: 'lie', size: 1.25 }); this.child.hidden = true;   // (the dream self: only inside the bubble)
    this.skyFixed = true;                                // moon and clouds keep their size when the camera comes closer
    this.camPhase = null; this._cut = 0;
    this.lean = { k: 0, o: null, until: -1 };                // the camera leans towards a thing just noticed
    this.seekT = 0; this.lastFound = -9; this.lastThing = null; this.whaleK = 0;                 // the girl's (and the cat's) eyes searching the garden
    this.expectText = T.bring;
    this.expect = () => (this.leap && this.leap.enabled ? this.leap.expect(this.expectText) : null);
    this.audio.play('noticing', { intensity: 0.3 }); this.audio.ambience('day');
  }
  pan(x) { return clamp(((x - this.cam.x) / Math.max(1, this.view.width)) * 1.6, -0.8, 0.8); }
  // A phone held upright shows a 540-unit slice: everything sits close together. Wider screens
  // get the same garden spread out (S up to 1.8) so that nothing is cramped.
  // (Measured at zoom 1, whatever the camera is doing: the director frames this garden more closely, so
  // wide screens spread it out less than they used to — up to 1.4.)
  layout() {
    const v = this.view; v.update();
    this.S = clamp((v.W / v.fit - 176) / 368, 1, 1.4);
    this.gx = (x) => -130 + (x + 130) * this.S;
    for (const o of this.things) o.x = this.gx(BASE[o.id]);
    this.pole1 = this.gx(BASE.pole1); this.pole2 = this.gx(BASE.pole2);
    this.camX = (-268 + this.gx(BASE.calf) + 38) / 2;
    this.bubX = this.gx(16);
    this.by.cloud.y = Math.max(-270, this.skyTop() + 52);
    this.orbitY = clamp(-292 - this.skyTop(), 62, 96);
    this.appleTree.x = Math.max(430, this.gx(BASE.calf) + 150); this.farTree.x = this.appleTree.x + 230;
  }
  onResize() { this.layout(); }
  // highest usable sky line at zoom 1 (clear of the top bar and hint), never absurdly high on tall phones
  skyTop() { const v = this.view; return Math.max((v.topInset - v.oy + 50) / v.fit, -470); }

  // ───────────── camera ─────────────
  winG() { return this.house.win(this.win); }
  // the girl at her window and the cat on the ledge beside her
  winBox() { const g = this.winG(); return { l: g.x - g.w / 2 - 14, r: this.pLedge.x + 40, t: g.top - 36, b: g.bottom + 16 }; }
  // every ordinary thing in the garden (+ the girl, who watches it all from her window)
  gardenBox(narrow) {
    const g = this.winG();
    let l = narrow ? g.x - 22 : g.x - g.w / 2 - 14, r = -1e9, t = g.top - 20;
    for (const o of this.things) {
      const ex = o.id === 'cloud' ? 150 : o.r + 14;
      l = Math.min(l, o.x - ex); r = Math.max(r, o.x + (o.id === 'cloud' ? 110 : ex)); t = Math.min(t, o.y - o.r - (o.id === 'cloud' ? 26 : 20));
    }
    return { l, r, t, b: 0 };
  }
  // What the camera keeps in the picture, phase by phase.
  frame() {
    const ph = this.camPhase, b = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 };
    const add = (q) => { b.l = Math.min(b.l, q.l); b.r = Math.max(b.r, q.r); b.t = Math.min(b.t, q.t); b.b = Math.max(b.b, q.b); };
    if (ph === 'bring') {                    // the perch the cat stands on (or has just left) and the window it is going to:
      // (not the cat itself, so the frame does not widen for the arc of a leap and then close in again)
      const L = this.leap;
      if (L && L.at && !this.papa.jump) this._from = L.at;
      const q = this._from || this.pPole2;
      add({ l: q.x - 62, r: q.x + 62, t: q.y - 86, b: q.y + 34 }); add(this.winBox());
    } else if (ph === 'window') add(this.winBox());
    else if (ph === 'letters') {
      add(this.winBox()); const g = this.winG();
      for (const h of this.homes()) add({ l: g.x + h[0] - 36, r: g.x + h[0] + 36, t: g.y + h[1] - 38, b: g.y + h[1] + 30 });
    } else if (ph === 'garden') {
      const o = CAM.garden, full = this.gardenBox(false);
      add(this.shotFor(full, o).zoom >= 0.98 ? full : this.gardenBox(true));   // (an upright phone: the girl's face at the edge, the garden whole)
      const L = this.lean;
      if (L.k > 0.001 && L.o) {
        const q = L.o, x = q.x + (q.dx || 0), k = 0.36 * L.k;
        const T = { l: x - 120, r: x + 120, t: Math.min(q.y - q.r - 70, -210), b: 0 };
        b.l += (T.l - b.l) * k; b.r += (T.r - b.r) * k; b.t += (T.t - b.t) * k;
      }
      return b;
    } else if (ph === 'hunt') {
      if (!this.view.portrait) { this.camPhase = 'garden'; const g0 = this.frame(); this.camPhase = 'hunt'; return g0; }
      // Upright screen: no room for the whole garden at a good size. Frame the next thing still hidden (the one
      // the hint will point at) together with the thing just found, while they fit, and the girl at the edge when
      // she is near enough; travel on as things are found. The ground sits higher than usual, so the garden is in
      // the middle of the picture.
      if (!this.hunt && this.found >= this.things.length) {   // all found: back to the girl, looking out over her garden
        const w = this.winBox();
        add({ l: w.l, r: w.l + 340, t: Math.min(w.t, this.by.sheet.y - 70), b: 45 });
        return b;
      }
      const n = this.nextThing(), lt = this.lastThing, hx = this.girl.anchor('head').x;
      const f = n || lt || this.by.bush, x = f.x;
      add({ l: x - 130, r: x + 130, t: Math.min(f.y - f.r - 50, -150), b: 45 });
      if (n && lt && lt !== n && this.t - this.lastFound < 2.2 && Math.max(b.r, lt.x + 90) - Math.min(b.l, lt.x - 90) <= 360) add({ l: lt.x - 90, r: lt.x + 90, t: Math.min(lt.y - lt.r - 40, -150), b: 45 });
      if (Math.max(b.r, hx + 10) - (hx - 34) <= 360) add({ l: hx - 34, r: hx + 10, t: b.t, b: b.b });
      return b;
    } else if (ph === 'emerge') {            // the dream leaves the sleeping girl
      const B = this.bub, h = this.girl.anchor('head');
      add({ l: h.x - 60, r: h.x + 60, t: h.y - 60, b: h.y + 50 });
      if (B) add({ l: B.x - B.r - 24, r: B.x + B.r + 24, t: B.y - B.r - 30, b: B.y + B.r + 24 });
    } else if (ph === 'dream') {             // the dream bubble (all of its slow drift), and the stars of its sky once there are any
      const y = -262, R = 64 + 46 + 44;
      add({ l: this.bubX - R, r: this.bubX + R, t: y - 14 - 64 - 26, b: y + 14 + 64 + 14 });
      for (const st of this.dayStars) add({ l: st.x - 30, r: st.x + 30, t: st.y - 30, b: st.y + 30 });
    } else if (ph === 'mems') {              // …and the daytime bubbles circling round it
      const y = -262, R = ORBIT + 27 + 34;
      add({ l: this.bubX - R, r: this.bubX + R, t: y - 14 - this.orbitY - 27 - 30, b: y + 14 + this.orbitY + 30 });
    }
    // a short landscape screen comes much closer (view.closeK): keep the sleepers at the window in the dream shots
    if ((ph === 'dream' || ph === 'mems') && this.view.closeK > 1) {
      const h = this.girl.anchor('head');
      add({ l: h.x - 40, r: this.pLedge.x + 34, t: h.y - 40, b: this.pLedge.y + 8 });
    }
    const e = this.currentExpect();
    if (e && e.x !== undefined && e.kind !== 'continue') add({ l: e.x - 46, r: e.x + 46, t: e.y - 46, b: e.y + 46 });
    return b.l < b.r ? b : null;
  }
  homes() {
    if (this.letters.length === 5) { const g = this.winG(); return this.letters.map((b) => [b.hx - g.x, b.hy - g.y]); }
    return this.view.portrait ? HOMES : HOMES_WIDE;
  }
  // the thing the hunt's hint points at (tapAny hints the first one not found yet)
  nextThing() { return this.hunt ? this.things.find((o) => !o.found && !(o.id === 'calf' && this.found < this.things.length - 1)) || null : null; }
  // move to a phase: a calm eased shot, then keep following whatever moves in it
  cut(phase, dur, opts) {
    this.camPhase = phase;
    const id = ++this._cut, o = opts || CAM[phase];
    this.spawn(async () => {
      await this.shot(() => this.frame(), dur === undefined ? 2 : dur, o);
      if (id === this._cut) this.track(() => this.frame(), o);
    });
  }

  // ───────────── story ─────────────
  async run() {
    const p = this.papa, A = this.audio, G = this.girl;
    const head = (o, dy) => ({ get x() { return o.x; }, get y() { return o.y - dy; } });   // a live point to look at
    const catHead = head(p, 34 * p.size), girlFace = { get x() { return G.anchor('head').x; }, get y() { return G.anchor('head').y; } };
    // establishing shot: the whole garden, the house with the girl at its big window
    this.camPhase = 'garden'; this.shot(() => this.frame(), 0, CAM.garden);
    G.look = { x: this.pole2, y: LINE_Y - 30 };
    await this.wait(0.7);
    this.spawn(() => this.say(0));                                 // …the magic cats begin to bring the tales to them.
    p.hidden = false; p.x = this.view.right + 90; p.y = -300; p.dir = -1;
    A.sfx.hop(0.6);
    await new Promise((res) => p.leapTo(this.pPole2.x, this.pPole2.y, { done: res, height: 60 }));
    A.sfx.land(0.4, true); this.line.v += 60;
    G.look = catHead; G.mood = 'wave'; A.sfx.giggle(this.pan(G.x));
    p.look = girlFace;                                             // the cat sees who it is bringing the tale to
    this.spawn(async () => { await this.wait(0.9); if (p.look === girlFace) p.look = null; });
    this.cut('bring', 2.4);
    this.leap = new Leap(this, { cat: p, perches: [this.pPole2, this.pPole1, this.pLedge], start: this.pPole2, range: 340, onLand: (q) => { if (q.kind === 'pole') this.line.v += 60; } });
    await this.leap.reach(this.pLedge);
    this.leap.enabled = false; p.dir = -1;
    this.cut('window', 1.4);                                       // close two-shot: the cat and the girl at her window
    G.look = catHead; if (G.mood === 'wave') G.mood = 'wait';
    p.look = girlFace;                                             // a moment face to face while the camera settles…
    await this.wait(this.reduced ? 0.4 : 1.3);                     // …then the hand-over, framed and still
    await this.deliver(p, this.house, 0);
    this.spawn(async () => { await this.wait(1.6); await this.tween(this.win, { rings: 0.32 }, 3); });
    p.mode = 'sit'; p.look = girlFace;
    await this.wait(0.9);                                          // (she holds it up while it unwraps)
    G.look = null; G.mood = 'read';                                // she opens the tale at once
    this.spawn(async () => { await this.wait(1.2); p.act('slowblink'); });

    await this.say(1);                                             // So the children learn to read the tales…
    await this.wait(0.5);
    this.cut('letters', 1.6);
    const kinds = ['star', 'fish', 'crown', 'boat', 'moon'], g = this.winG(), HM = this.homes();
    for (let i = 0; i < 5; i++) {
      // the letters rise out of her book, one by one, and settle in an arc over the window
      const bk = G.anchor('hand'), b = { x: bk.x, y: bk.y - 6, r: 30, a: 0, i, kind: kinds[i], done: false, s: 0.3, seed: i * 2.1 };
      b.hx = g.x + HM[i][0]; b.hy = g.y + HM[i][1];
      this.letters.push(b);
      G.look = b; p.look = b;
      this.spawn(async () => { A.sfx.pop(this.pan(b.x)); A.scaleNote(i, { inst: 'glass', vel: 0.4 }); await this.tween(b, { x: b.hx, y: b.hy, a: 1, s: 1 }, 1.25, ease.outCubic); b.home = true; });
      await this.wait(0.34);
    }
    this.spawn(async () => { await this.wait(1.3); if (this.letters.every((b) => !b.done)) { G.look = null; p.look = null; } });
    let lookTok = 0;
    for (let n = 0; n < 5; n++) {
      const i = await this.tapAny(this.letters, { text: T.read });
      const b = this.letters[i]; b.done = true;
      A.sfx.pop(this.pan(b.x)); A.scaleNote(4 + n, { inst: 'box', vel: 0.7 });
      this.sparkle(b.x, b.y, 8);
      this.fx.burst('ring', b.x, b.y, 1, { speed: 0, life: 0.5, size: b.r, grow: 60, color: 'rgba(255,255,255,0.9)' });
      const pic = { kind: b.kind, x: b.x, y: b.y, s: 0, a: 1 }; this.pics.push(pic);
      this.spawn(async () => { await this.tween(pic, { s: 2.1 }, 0.4, ease.outBack); await this.tween(pic, { s: 1.7 }, 0.2); });
      // she looks up from the page, amazed: the letter has turned into a picture (the cat looks too)
      G.look = pic; G.mood = 'wonder'; p.look = pic; p.wake();
      const tok = ++lookTok;
      this.spawn(async () => { await this.wait(1.5); if (tok === lookTok && n < 4) { G.look = null; G.mood = 'read'; p.look = girlFace; } });
    }
    await this.wait(0.9);
    G.cheer(); A.sfx.giggle(this.pan(G.x)); p.look = girlFace; p.eyes = 'happy';
    this.spawn(async () => { await this.wait(1.2); p.eyes = 'open'; });
    await this.wait(1.1);

    await this.say(2);                                             // …they learn to see them, to notice them.
    G.mood = 'wait'; p.dir = 1; p.look = null;                     // the cat turns round on the ledge to the garden
    const up = this.view.portrait;
    this.cut('garden', up ? 1.8 : 2.6);      // (an upright screen: an establishing look at the whole garden, held, before the hunt comes closer)
    // the little pictures fly off into the garden: something is hiding in each ordinary thing
    this.pics.forEach((pic, i) => {
      const o = this.things[i % this.things.length];
      this.spawn(async () => {
        await this.wait(i * 0.22);
        if (i === 0 || i === 4) { G.look = pic; p.look = pic; }   // (eyes follow the first one out and the last one in)
        await this.tween(pic, { x: o.x, y: o.y, s: 0.3, a: 0 }, 1.5, ease.inOutQuad);
        this.fx.burst('spark', o.x, o.y, 5, { speed: 50, life: 0.8, size: 4, colors: ['#fff7c0', '#ffffff'] }); o.wig = 1;
      });
    });
    A.sfx.chime(5);
    await this.wait(2.4);
    if (up && !this.reduced) await this.wait(1.9);   // (1.8 s move + about 2.5 s at rest)
    this.pics.length = 0;
    this.hunt = true; this.seekT = 0.4;
    if (this.view.portrait) this.cut('hunt', 1.8, CAM.huntUp);
    let p3 = null;
    while (this.found < this.things.length) {
      // live targets: the garden is laid out again when the screen turns, so the hit areas must follow
      const sc = this;
      const targets = this.things.map((o) => ({ r: o.r, get x() { return o.x + (o.dx || 0); }, get y() { return o.y; }, get done() { return o.found || (o.id === 'calf' && sc.found < sc.things.length - 1); } }));
      const i = await this.tapAny(targets, { text: this.found < 2 ? T.notice : null });
      this.reveal(this.things[i]);
      if (this.found === 3) p3 = this.say(3).catch((e) => { if (e !== ABORT) throw e; });   // For the magic worlds … are always all around us…
      await this.wait(0.25);
    }
    this.hunt = false;
    const lastThing = this.by.calf;
    G.look = lastThing; p.look = lastThing;
    await this.wait(2.7);
    await p3;

    await this.say(4);                                             // …begins to dream of them at night.
    A.ambience('night'); A.setIntensity(0.55);
    this.spawn(async () => { this.skyFrom = this.sky; this.skyGoal = LAVNIGHT; this.skyK = 0; await this.tween(this, { skyK: 1 }, 5, ease.inOutSine); });
    this.spawn(() => this.tween(this.win, { lit: 0.85 }, 3));      // (a lamp-lit window: she stays in full colour)
    this.cut('window', 3.2);                                       // back to the two of them, slowly: evening
    await this.wait(0.9);
    G.look = null; G.act('yawn'); A.sfx.yawn(this.pan(G.x));
    await this.wait(1.5);
    p.wake(); p.look = null; p.act('yawn');
    await this.wait(1.3);
    G.act('rubEyes');
    await this.wait(1.7);
    G.mood = 'sleep';                                              // her head goes down on her arms
    await this.wait(0.9);
    p.mode = 'curl'; A.sfx.purr(2.2);                              // and the cat curls up beside her
    await this.wait(1.1);

    await this.say(5);                                             // A child falls asleep, and the tale comes into the dream…
    let last = -1;
    await this.holdOn(() => { const h = G.anchor('head'); return { x: h.x, y: h.y, r: 70 }; }, 2.6, { anywhere: true, text: T.sleep, onProgress: (f) => { this.sleep = ease.inOutQuad(f); const n = Math.floor(f * 5); if (n !== last && f > 0.05) { last = n; A.playerNote({ vel: 0.5, inst: 'glass' }); } } });
    this.sleep = 1; this.hint(null);
    await this.wait(0.6);
    this.spawn(() => this.tween(this, { sleep: 0 }, 2.4, ease.inOutCubic));      // the eyes open again on the dream…
    await this.wait(1.0);
    // …the child slips right into the tale itself: a dream bubble rises out of the sleeping girl, with her
    // dream self inside it, and drifts out over the garden (she herself sleeps on at the window)
    const hd = G.anchor('head');
    this.bub = { x: hd.x + 8, y: hd.y - 14, r: 6, a: 0, done: false };
    this.spawn(() => this.tween(this, { whaleK: 1 }, this.reduced ? 1 : 3, ease.inOutSine));   // the whale goes back to being a cloud, up out of the dream's way
    this.child.hidden = false; this.placeChild();
    this.cut('emerge', 1.2);
    this.spawn(() => this.tween(this.win, { rings: 0 }, 2));
    this.spawn(() => this.tween(this, { dream: 1 }, 3));
    this.spawn(() => this.tween(this.bub, { a: 1 }, 1.2));
    this.spawn(() => this.tween(this.bub, { r: 64 }, 2.8, ease.outBack));
    A.sfx.rise(); A.sfx.chime(6);
    await this.wait(1.2);
    this.bub.path = { x: this.bub.x, y: this.bub.y }; this.bub.u = 0;           // (the curve itself: see tick)
    await this.tween(this.bub, { u: 1 }, this.reduced ? 2.4 : 4.6, (u) => u);
    this.bub.path = null; this.bub.float = true; this.bubT = 0;
    this.cut('dream', 2.4);
    A.setIntensity(0.9);

    await this.tell(6);                                            // …many children come to love going to sleep.

    await this.say(7);                                             // Daytime is lovely, of course…
    this.cut('mems', 1.8); await this.wait(0.5);
    const mk = ['sun', 'swing', 'ball', 'family', 'kite'];
    for (let i = 0; i < 5; i++) {
      const m = { kind: mk[i], ang: (i / 5) * TAU + 0.5, x: this.bub.x, y: this.bub.y, r: 27, a: 0, done: false, k: 0, seed: i * 1.7 };
      this.mems.push(m);
      this.spawn(async () => { A.sfx.plip(0); await this.tween(m, { a: 1, k: 1 }, 1.1, ease.outCubic); });
      await this.wait(0.22);
    }
    await this.wait(0.6);
    for (let n = 0; n < 3; n++) {
      const i = await this.tapAny(this.mems, { text: T.day });
      const m = this.mems[i]; m.done = true;
      A.sfx.pop(this.pan(m.x)); A.scaleNote(6 + n * 2, { inst: 'box', vel: 0.7, octave: 2 });
      this.fx.burst('ring', m.x, m.y, 1, { speed: 0, life: 0.5, size: m.r, grow: 70, color: 'rgba(255,255,255,0.9)' });
      this.fx.burst('spark', m.x, m.y, 8, { speed: 80, life: 0.9, size: 5, colors: ['#fff7c0', '#ffe36e', '#ffffff'] });
      // each daytime joy flies up and becomes a star of the dream sky
      const st = { x: m.x, y: m.y, a: 1, s: 1.6, kind: m.kind };
      this.dayStars.push(st);
      // (into the dream's own sky, over the bubble: always inside the picture the camera keeps)
      this.spawn(() => this.tween(st, { x: this.bubX + [-0.8, 0.8, -0.3][n] * (ORBIT + 40), y: -262 - 14 - this.orbitY - [58, 70, 86][n], s: 1 }, 1.5, ease.inOutQuad));
    }
    for (const m of this.mems) if (!m.done) this.spawn(() => this.tween(m, { a: 0 }, 1.6));
    await this.wait(0.8);

    this.cut('dream', 2.4);
    await this.say(8);                                             // But at night — … a whole new magic fairy-tale world!
    await this.tapOn(() => ({ x: this.bub.x, y: this.bub.y, r: 70 }), { text: T.rise });
    this.hint(null);
    this.rising = true; this.bub.float = false;
    // the camera rises with the dream (same size of picture, a quick follow so it never slips out of the top)
    const zr = this.cam.zoom, bb = this.bub;
    this._cut++; this.track(() => ({ x: bb.x, y: bb.y - 30, w: 2 * bb.r + 60, h: 2 * bb.r + 60 }), { min: zr, max: zr, rate: 5, pad: 0 });
    A.sfx.whoosh(1.6); A.sfx.rise(); A.setIntensity(1);
    // the light grows but never whites the whole screen out: the curtain takes over from a warm glow
    const R = this.reduced;
    this.spawn(async () => { await this.wait(R ? 1 : 2.3); A.sfx.fanfare(); await this.tween(this, { flash: R ? 0.4 : 0.7 }, R ? 0.8 : 1.5, ease.inQuad); });
    await this.tween(this.bub, { y: this.bub.y - 1500 }, R ? 1.9 : 3.9, ease.inCubic);
  }
  placeChild() {
    const b = this.bub; if (!b) return;
    this.child.x = b.x + 6; this.child.y = b.y + 14;      // (drawn scaled with the bubble about its centre)
  }

  reveal(o) {
    if (o.found) return;
    const A = this.audio, pan = this.pan(o.x);
    o.found = true; o.t0 = this.t; this.found++;
    this.spawn(() => this.tween(o, { m: 1 }, 1.1, ease.outCubic));
    this.spawn(() => this.tween(this, { skyK: this.found / this.things.length, lav: this.found / this.things.length }, 2.4, ease.inOutSine));
    A.setIntensity(0.3 + 0.08 * this.found);
    if (this.found === 4) A.ambience('dusk');
    this.sparkle(o.x, o.y - 10, 12);
    this.fx.burst('ring', o.x, o.y, 1, { speed: 0, life: 0.7, size: 10, grow: 110, color: 'rgba(255,243,184,0.9)' });
    A.chordNote(this.found, { vel: 0.7, inst: 'box' }); A.chordNote(this.found + 2, { vel: 0.5, inst: 'glass', when: A.now + 0.12, dur: 0.8 });
    switch (o.id) {
      case 'bush': A.blip({ f0: 150, f1: 96, dur: 0.55, vel: 0.13, type: 'triangle', attack: 0.06, pan }); A.sfx.whoosh(0.5, pan); break;
      case 'puddle': A.sfx.splash(pan); A.sfx.chime(4, pan); break;
      case 'stone': A.sfx.knock(pan); this.spawn(async () => { await this.wait(0.18); A.sfx.knock(pan); await this.wait(0.2); A.sfx.pop(pan); }); break;
      case 'sheet': A.sfx.swish(pan); A.sfx.whoosh(0.7, pan); break;
      case 'cloud': A.blip({ f0: 190, f1: 420, f2: 300, glide: 0.6, dur: 1.1, vel: 0.1, attack: 0.25, pan }); A.glass(57, { vel: 0.5, dur: 1.2, bus: A.sfxBus }); break;
      case 'snail': A.sfx.pop(pan); A.sfx.sparkle(pan); break;
      case 'calf': A.blip({ f0: 215, f1: 178, dur: 0.75, vel: 0.12, type: 'triangle', attack: 0.12, pan }); A.sfx.bell(pan); this.spawn(async () => { await this.wait(0.5); A.sfx.chime(6); }); break;
      default: break;
    }
    // she laughs and keeps her eyes on it; the cat on the ledge looks too; the camera leans in a little
    const G = this.girl, P = this.papa;
    this.lastFound = this.t; this.lastThing = o;
    G.look = o;
    if (this.found === 1) {                                    // the very first: she can hardly believe it — then laughs
      G.mood = 'wonder';
      this.spawn(async () => { await this.wait(1.1); if (G.mood === 'wonder') { G.cheer(); A.sfx.giggle(this.pan(G.x)); } await this.wait(1.2); if (G.mood === 'happy') G.mood = 'wait'; });
    } else {
      G.cheer(); if (this.found % 2) A.sfx.giggle(this.pan(G.x));
      this.spawn(async () => { await this.wait(1.2); if (G.mood === 'happy') G.mood = 'wait'; });
    }
    P.wake(); P.look = o;
    if (this.camPhase === 'garden' && !this.reduced) {
      this.lean.o = o; this.lean.until = this.t + 2.3;      // (eased in tick)
    }
  }

  // things that have been noticed stay alive under the finger
  onDown(p) {
    for (const o of this.things) {
      if (!o.found || o.m < 0.9 || dist(p.x, p.y, o.x + (o.dx || 0), o.y) > o.r * 1.2) continue;
      const A = this.audio, pan = this.pan(o.x);
      o.wig = 1; this.sparkle(o.x + (o.dx || 0), o.y - 8, 5);
      if (o.id === 'bush') A.sfx.whoosh(0.4, pan); else if (o.id === 'puddle') A.sfx.plip(pan); else if (o.id === 'stone') A.sfx.knock(pan);
      else if (o.id === 'sheet') A.sfx.swish(pan); else if (o.id === 'cloud') A.blip({ f0: 200, f1: 380, dur: 0.6, vel: 0.08, attack: 0.15, pan }); else if (o.id === 'snail') A.sfx.sparkle(pan);
      else A.blip({ f0: 215, f1: 180, dur: 0.5, vel: 0.1, type: 'triangle', attack: 0.1, pan });
      return;
    }
    super.onDown(p);
  }

  // ───────────── frame ─────────────
  tick(dt) {
    const t = this.t;
    this.child.update(dt);
    this.line.x += this.line.v * dt; this.line.v += (-this.line.x * 160 - this.line.v * 7) * dt;
    // unfound things betray themselves with a faint shimmer
    if (this.hunt) {
      this.shim -= dt;
      if (this.shim < 0) {
        this.shim = 0.55;
        const left = this.things.filter((o) => !o.found && !(o.id === 'calf' && this.found < this.things.length - 1));
        if (left.length) { const o = left[Math.floor(Math.random() * left.length)]; this.fx.add({ kind: 'spark', x: o.x + (Math.random() - 0.5) * o.r, y: o.y - Math.random() * o.r * 0.7, vy: -12, life: 1, size: 4.5, color: '#fffbe0' }); o.wig = 1; }
      }
    }
    for (const o of this.things) if (o.wig > 0) o.wig = Math.max(0, o.wig - dt * 2);
    if (!this.rising && !this.directing) this.cam.x = approach(this.cam.x, this.camX, 4, dt);
    const L = this.lean;
    L.k = approach(L.k, t < L.until ? 1 : 0, t < L.until ? 1.6 : 1.1, dt);
    // while the garden is searched, the girl's eyes (and the cat's) wander over it — now a bush, now the
    // sky, now something that has just been found — never all on the same spot
    if (this.hunt && !this.reduced) {
      this.seekT -= dt;
      if (this.seekT < 0 && t - this.lastFound > 1.8) {
        this.seekT = 1.3 + Math.random() * 1.7;
        const left = this.things.filter((o) => !o.found), gb = this.gardenBox(true);
        const pick = () => Math.random() < 0.45 && left.length ? left[Math.floor(Math.random() * left.length)] : { x: lerp(gb.l + 80, gb.r, Math.random()), y: -20 - Math.random() * 200 };
        const a = pick(); this.girl.look = { x: a.x + (a.dx || 0), y: a.y };
        if (Math.random() < 0.6) { const c = pick(); this.papa.look = { x: c.x + (c.dx || 0), y: c.y }; }
      }
    }
    // (from the dream on, the whale is a cloud again, drifting high above the dream and its circling bubbles)
    const wh = this.by.cloud, wm = wh.m * (1 - this.whaleK);
    wh.dx = wm * Math.sin(t * 0.3) * 26 * Math.sqrt(this.S);
    wh.lift = this.whaleK * Math.max(0, wh.y - (-262 - 14 - this.orbitY - 27 - 70));
    for (const b of this.letters) if (b.home && !b.done) { b.x = b.hx + Math.sin(t * 0.7 + b.seed) * 9; b.y = b.hy + Math.cos(t * 0.9 + b.seed) * 7; }
    if (this.bub) {
      const b = this.bub;
      if (b.path) {                       // up out of the window first, then across: a soft curve
        const k = b.u || 0;
        b.x = lerp(b.path.x, this.bubX, ease.inOutSine(k)); b.y = lerp(b.path.y, -262, Math.sin(k * Math.PI / 2));
      }
      // (the float starts from where the curve ended: sin(0) = 0, so it eases away without a jump)
      if (b.float) { this.bubT += dt; b.x = this.bubX + Math.sin(this.bubT * 0.45) * 46 * Math.min(1, this.bubT / 3); b.y = -262 + Math.sin(this.bubT * 0.8) * 14 * Math.min(1, this.bubT / 3); }
      for (const m of this.mems) { m.ang += dt * 0.22; if (!m.done) { m.x = b.x + Math.cos(m.ang) * ORBIT * m.k; m.y = b.y + Math.sin(m.ang) * this.orbitY * m.k; } }
      this.placeChild();
      if (this.rising) { if (!this.directing) this.cam.y = approach(this.cam.y, b.y + 262, 6, dt); if (!this.reduced && Math.random() < dt * 30) this.fx.add({ kind: 'spark', x: b.x + (Math.random() - 0.5) * 90, y: b.y + 60 + Math.random() * 40, vy: 120, life: 0.9, size: 5, color: '#fff7c0' }); }
      else if (b.a > 0.5 && Math.random() < dt * 2.5) this.fx.add({ kind: 'spark', x: b.x + (Math.random() - 0.5) * b.r * 2, y: b.y + (Math.random() - 0.5) * b.r * 2, vy: -8, life: 1.2, size: 4, color: '#fff7c0' });
    }
    if (this.dream > 0.5 && this.bub && this.bub.r > 40 && Math.random() < dt * 0.5) { const h = this.child.anchor('head'); this.zzz(h.x + 14, h.y - 22); }
    if (this.girl.mood === 'sleep' && !this.girl.hidden && (!this.bub || this.bub.float) && Math.random() < dt * 0.45) { const h = this.girl.anchor('head'); this.zzz(h.x + 18, h.y - 26); }
    if (this.papa.mode === 'curl' && Math.random() < dt * 0.3) { const h = this.papa.anchor('head'); this.zzz(h.x + 6, h.y - 16); }
  }

  // ── the seven things ──
  drawBushDragon(ctx, o, t) {
    const x = o.x, y = 0, r = 40, k = ease.outBack(clamp01(o.m)), wig = 1 + 0.04 * (o.wig || 0);
    const lift = this.dream * (4 + 3 * Math.sin(t * 1.1));
    ctx.save(); ctx.translate(x, y); ctx.scale(wig, wig); ctx.translate(-x, -y);
    if (k > 0.02) {
      // tail + spikes behind the bush
      tube(ctx, [[x - r * 0.8, y - 8], [x - r * 1.3, y - 4], [x - r * 1.55, y - 20 * k], [x - r * 1.32, y - 36 * k - 3 * Math.sin(t * 2)]], 9 * k, '#3f9a4a', INK, 4.4);
      wobble(ctx, [[x - r * 1.42, y - 34 * k], [x - r * 1.2, y - 50 * k], [x - r * 1.14, y - 32 * k]], 7, 0.4); ctx.fillStyle = '#f2a23a'; ctx.fill(); ink(ctx, 2.2);
      for (let i = -2; i <= 2; i++) {
        const bx = x + i * 14 - 4, by = y - r * 0.5 - Math.sqrt(1 - Math.pow((i * 14) / 52, 2)) * r * 0.72;
        wobble(ctx, [[bx - 7, by + 6], [bx + 1, by - 15 * k], [bx + 8, by + 6]], 20 + i, 0.4); ctx.fillStyle = '#f2a23a'; ctx.fill(); ink(ctx, 2.2);
      }
    }
    drawBush(ctx, x, y, r, 131, '#f2c23a');
    if (k > 0.02) {
      // head resting on the grass
      const hx = x + r * 0.96 + 6 * k, hy = y - r * 0.36 - lift;
      wobble(ctx, circlePts(hx, hy, 21 * k, 9, 13.5 * k), 133, 0.6); ctx.fillStyle = '#3f9a4a'; ctx.fill(); ink(ctx, 3);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + 13 * k, hy - 4 * k, 1.6 * k, 0, TAU); ctx.arc(hx + 15 * k, hy + 1 * k, 1.4 * k, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(hx + 2 * k, hy + 2 * k, 9 * k, 0.5, 1.9); ctx.stroke();
      // eye: wide open when noticed, then sleepy again
      const age = t - o.t0, lid = age < 1.8 ? 0 : 0.5 + 0.12 * Math.sin(t * 0.9), blink = (t * 0.37) % 1 < 0.04 ? 1 : 0;
      const ex = x + r * 0.5, ey = y - r * 0.86 - lift * 0.6;
      ctx.beginPath(); ctx.ellipse(ex, ey, 8.5 * k, 9.5 * k, 0, 0, TAU); ctx.fillStyle = '#fbfbf6'; ctx.fill(); ink(ctx, 2.4);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(ex + 2.5 * k, ey + 1.5 * k, 3.4 * k, 4.4 * k, 0, 0, TAU); ctx.fill();
      const L = Math.max(lid, blink);
      if (L > 0.02) { ctx.save(); ctx.beginPath(); ctx.ellipse(ex, ey, 8.5 * k, 9.5 * k, 0, 0, TAU); ctx.clip(); ctx.fillStyle = '#2f8a4a'; ctx.fillRect(ex - 10, ey - 10 * k, 20, 19 * k * L); ctx.restore(); ctx.beginPath(); ctx.ellipse(ex, ey, 8.5 * k, 9.5 * k, 0, 0, TAU); ink(ctx, 2.4); }
      // a chalk smoke ring now and then
      const ph = (t * 0.3 + 0.2) % 1;
      if (o.m > 0.9 && ph < 0.55) { const u = ph / 0.55, rr = 5 + 13 * u; const pts = []; for (let i = 0; i <= 14; i++) pts.push([hx + 26 + 26 * u + Math.cos((i / 14) * TAU) * rr * 0.6, hy - 8 - 34 * u + Math.sin((i / 14) * TAU) * rr]); chalk(ctx, pts, { width: 2.6, alpha: 0.85 * (1 - u), color: '#ffffff', seed: 5 }); }
    }
    ctx.restore();
  }
  drawPuddle(ctx, o, t) {
    const x = o.x, y = 9, m = clamp01(o.m), wig = 1 + 0.05 * (o.wig || 0);
    const pts = circlePts(x, y, 44 * wig, 12, 10.5 * wig);
    if (m > 0.05) glow(ctx, x, y, 70 * m, '#8fa8ff', 0.45 * m);
    wobble(ctx, pts, 141, 1); ctx.fillStyle = mixHex('#a9cdea', '#141a55', m); ctx.fill();
    ctx.save(); ctx.clip();
    if (m < 0.9) { ctx.strokeStyle = rgba('#ffffff', 0.8 * (1 - m)); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 24, y - 3); ctx.lineTo(x - 6, y - 4.5); ctx.moveTo(x + 6, y + 3); ctx.lineTo(x + 20, y + 2); ctx.stroke(); }
    if (m > 0.02) {
      const r = rng(143);
      for (let i = 0; i < 12; i++) { const sx = x + (r() - 0.5) * 78, sy = y + (r() - 0.5) * 15, tw = 0.5 + 0.5 * Math.sin(t * (1.5 + r() * 2) + i); ctx.globalAlpha = m * tw; ctx.fillStyle = i % 3 ? '#f4f6ff' : '#ffe9a8'; sparklePath(ctx, sx, sy, 1.6 + r() * 2.2, 0); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    wobble(ctx, pts, 141, 1); ink(ctx, 2.6, mixHex('#5f86c0', '#1d1530', m));
    if (m > 0.6) {
      // a fish made of starlight leaps out and dives back
      const ph = (t * 0.42 + 0.1) % 1;
      if (ph < 0.42) {
        const u = ph / 0.42, fx = x - 28 + 56 * u, fy = y - 2 - Math.sin(Math.PI * u) * (56 + 10 * this.dream), rot = Math.atan2(-Math.cos(Math.PI * u) * 56 * Math.PI, 56) * 0.8;
        glow(ctx, fx, fy, 26, '#ffe9a8', 0.7);
        ctx.save(); ctx.translate(fx, fy); ctx.rotate(rot);
        wobble(ctx, [[-10, 0], [-3, -6.5], [7, -4.5], [12, 0], [7, 4.5], [-3, 6.5]], 145, 0.3); ctx.fillStyle = '#ffe36e'; ctx.fill(); ink(ctx, 2);
        wobble(ctx, [[-9, 0], [-17, -7], [-15, 7]], 146, 0.3); ctx.fillStyle = '#ffcf5a'; ctx.fill(); ink(ctx, 2);
        ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(7, -1, 1.3, 0, TAU); ctx.fill();
        ctx.restore();
        for (let i = 1; i <= 3; i++) { const v = Math.max(0, u - i * 0.07), sx = x - 28 + 56 * v, sy = y - 2 - Math.sin(Math.PI * v) * 56; ctx.globalAlpha = 0.7 - i * 0.18; ctx.fillStyle = '#fff7c0'; sparklePath(ctx, sx, sy, 4 - i * 0.7, t); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
    }
  }
  drawStoneTurtle(ctx, o, t) {
    const x = o.x, y = 0, m = clamp01(o.m), k = ease.outBack(m), wig = 1 + 0.05 * (o.wig || 0), walk = this.dream * Math.sin(t * 1.4);
    ctx.save(); ctx.translate(x + this.dream * 10 * Math.sin(t * 0.35), y); ctx.scale(wig, wig);
    if (k > 0.02) {
      for (const [lx, ph] of [[-17, 0], [15, Math.PI]]) { ctx.beginPath(); ctx.ellipse(lx + walk * 3 * Math.cos(ph), 0, 8 * k, 5 * k, 0, 0, TAU); ctx.fillStyle = '#8fd0a0'; ctx.fill(); ink(ctx, 2.2); }
      wobble(ctx, [[-28, -4], [-38 * k, -1], [-28, 3]], 151, 0.3); ctx.fillStyle = '#8fd0a0'; ctx.fill(); ink(ctx, 2);
      const bob = Math.sin(t * 1.3) * 1.5, hx = 26 + 16 * k, hy = -13 - 5 * k + bob;
      tube(ctx, [[24, -8], [hx, hy]], 9 * k, '#8fd0a0', INK, 4);
      ctx.beginPath(); ctx.arc(hx + 3, hy - 1, 9 * k, 0, TAU); ctx.fillStyle = '#8fd0a0'; ctx.fill(); ink(ctx, 2.6);
      if ((t * 0.31) % 1 > 0.05) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(hx + 6, hy - 3, 1.5 * k, 0, TAU); ctx.fill(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(hx + 5, hy + 1, 4 * k, 0.3, 1.6); ctx.stroke();
    }
    const shell = [[-31, 1], [-28, -14], [-12, -25], [10, -26], [27, -15], [31, 1]];
    wobblyPoly(ctx, shell, 153, 1.2, 30); ctx.fillStyle = mixHex('#a3a2b0', '#4f9e7a', m); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba('#7c7b8c', 0.5 * (1 - m)); for (const [dx, dy, rr] of [[-12, -10, 6], [8, -16, 5], [14, -6, 4], [-2, -3, 3]]) { ctx.beginPath(); ctx.ellipse(dx, dy, rr * 1.3, rr, 0.3, 0, TAU); ctx.fill(); }
    if (m > 0.02) {
      ctx.globalAlpha = m; ctx.strokeStyle = '#2f6a50'; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath();
      ctx.moveTo(-8, -25); ctx.lineTo(-12, -13); ctx.lineTo(-2, -5); ctx.lineTo(10, -13); ctx.lineTo(6, -25);
      ctx.moveTo(-12, -13); ctx.lineTo(-29, -8); ctx.moveTo(10, -13); ctx.lineTo(29, -9); ctx.moveTo(-2, -5); ctx.lineTo(-3, 2); ctx.stroke();
      ctx.fillStyle = 'rgba(190,240,200,0.35)'; ctx.beginPath(); ctx.ellipse(-6, -17, 9, 5, -0.3, 0, TAU); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.restore();
    wobblyPoly(ctx, shell, 153, 1.2, 30); ink(ctx, 3);
    ctx.restore();
  }
  drawLine(ctx, t) {
    const sag = 9 + this.line.x * 0.1, y = LINE_Y, POLE1 = this.pole1, POLE2 = this.pole2;
    for (const px of [POLE1, POLE2]) { tube(ctx, [[px, 2], [px, y - 6]], 6, '#b98a55', INK, 3.6); tube(ctx, [[px - 16, y - 2], [px + 16, y - 2]], 5, '#b98a55', INK, 3.4); }
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(POLE1, y - 2); ctx.quadraticCurveTo((POLE1 + POLE2) / 2, y - 2 + sag * 2, POLE2, y - 2); ctx.stroke();
    // the rest of the washing
    const ly = (x) => y - 2 + sag * 2 * 2 * ((x - POLE1) / (POLE2 - POLE1)) * (1 - (x - POLE1) / (POLE2 - POLE1));
    const sw = Math.sin(t * 1.2) * 0.05 + this.line.x * 0.004;
    const sockX = lerp(POLE1, POLE2, 0.14), shirtX = lerp(POLE1, POLE2, 0.835);
    ctx.save(); ctx.translate(sockX, ly(sockX)); ctx.rotate(sw);
    wobblyPoly(ctx, [[-5, 0], [5, 0], [5, 20], [13, 26], [10, 31], [-5, 28]], 161, 0.6, 30); ctx.fillStyle = '#f08ab0'; ctx.fill(); ink(ctx, 2.2);
    ctx.strokeStyle = '#fbfbf6'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-5, 7); ctx.lineTo(5, 7); ctx.moveTo(-5, 13); ctx.lineTo(5, 13); ctx.stroke();
    ctx.restore();
    ctx.save(); ctx.translate(shirtX, ly(shirtX)); ctx.rotate(-sw * 1.2);
    wobblyPoly(ctx, [[-14, 0], [14, 0], [22, 9], [16, 14], [11, 9], [11, 30], [-11, 30], [-11, 9], [-16, 14], [-22, 9]], 162, 0.6, 30); ctx.fillStyle = '#f3d77a'; ctx.fill(); ink(ctx, 2.2);
    ctx.restore();
    return ly;
  }
  drawSheetShip(ctx, o, t, ly) {
    const x = o.x, y0 = ly(x) - 1, m = clamp01(o.m), k = ease.outBack(m), wig = 1 + 0.04 * (o.wig || 0);
    const sway = Math.sin(t * 1.1) * 3 + this.line.x * 0.05, rock = m * Math.sin(t * 1.2) * (0.035 + 0.03 * this.dream);
    ctx.save(); ctx.translate(x, y0); ctx.rotate(rock); ctx.scale(wig, wig);
    const H = 70, belly = 16 * m + sway * 0.5 * m;
    if (k > 0.02) {
      // chalky waves, the hull, the mast
      const wy = H + 26;
      for (let j = 0; j < 2; j++) { const pts = []; for (let i = 0; i <= 16; i++) pts.push([-50 + i * 6.3 + j * 6, wy + j * 8 + Math.sin(i * 0.9 + t * 2.2 + j) * 3.2 * k]); chalk(ctx, pts, { width: 3, alpha: 0.9 * m, color: j ? '#dfeaff' : '#8fb8f0', seed: 3 + j }); }
      tube(ctx, [[0, -8 * k], [0, H + 12]], 3.2, '#8a5a2b', INK, 2.6);
      wobblyPoly(ctx, [[-36 * k, H + 8], [36 * k, H + 8], [26 * k, H + 25], [-24 * k, H + 25]], 165, 1, 40); ctx.fillStyle = '#b9553f'; ctx.fill(); ink(ctx, 3);
      ctx.strokeStyle = '#f3dc86'; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(-30 * k, H + 14); ctx.lineTo(30 * k, H + 14); ctx.stroke();
      const fl = Math.sin(t * 6) * 2;
      wobble(ctx, [[0, -8 * k], [15 * k, -13 * k + fl], [0, -19 * k]], 166, 0.3); ctx.fillStyle = '#e2553f'; ctx.fill(); ink(ctx, 2);
    }
    // the sheet (it becomes the sail)
    ctx.beginPath();
    ctx.moveTo(-29, 0); ctx.lineTo(29, 0);
    ctx.quadraticCurveTo(31 + belly * 1.5, H * 0.5, 27 + sway * (1 - m) - 4 * m, H);
    ctx.quadraticCurveTo(0, H + 5 * Math.sin(t * 1.6) * (1 - m) - 4 * m, -27 + sway * (1 - m) + 6 * m, H);
    ctx.quadraticCurveTo(-31 + belly * 0.5, H * 0.5, -29, 0);
    ctx.closePath();
    ctx.fillStyle = '#fbfbf6'; ctx.fill(); ink(ctx, 3);
    ctx.strokeStyle = 'rgba(29,21,48,0.16)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-10, 4); ctx.quadraticCurveTo(-8 + belly * 0.5, H * 0.5, -10 + sway * 0.5, H - 4); ctx.moveTo(12, 4); ctx.quadraticCurveTo(15 + belly, H * 0.5, 12 + sway * 0.5, H - 4); ctx.stroke();
    for (const px of [-22, 22]) { ctx.fillStyle = '#c99a5a'; ctx.fillRect(px - 2.2, -6, 4.4, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(px - 2.2, -6, 4.4, 10); }
    ctx.restore();
  }
  drawCloudWhale(ctx, o, t) {
    const m = clamp01(o.m) * (1 - this.whaleK), x = o.x + (o.dx || 0), y = o.y - (o.lift || 0) + Math.sin(t * 0.8) * 5 * m, wig = 1 + 0.04 * (o.wig || 0);
    ctx.save(); ctx.translate(x, y + 4); ctx.scale(wig, wig); drawCloud(ctx, 0, 0, 168, 171, '#ffffff', 0.96 * (1 - 0.8 * m)); ctx.restore();
    if (m < 0.02) return;
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha *= m;
    const fl = Math.sin(t * 2.2) * 5;
    // tail
    wobble(ctx, [[-62, 6], [-88, -2], [-112, -26 + fl], [-104, -2 + fl * 0.5], [-116, 18 + fl], [-88, 10]], 173, 0.8); ctx.fillStyle = '#f2f6ff'; ctx.fill(); ink(ctx, 3);
    // body
    const body = [[-70, 2], [-58, -24], [-22, -37], [28, -33], [62, -14], [70, 6], [52, 22], [10, 28], [-36, 23], [-62, 13]];
    wobble(ctx, body, 172, 0.8); ctx.fillStyle = '#f7faff'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(190,214,250,0.55)'; ctx.beginPath(); ctx.ellipse(8, 30, 62, 16, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(120,150,210,0.6)'; ctx.lineWidth = 1.6; ctx.beginPath(); for (let i = 0; i < 4; i++) { ctx.moveTo(22 + i * 9, 14); ctx.quadraticCurveTo(26 + i * 9, 22, 20 + i * 9, 30); } ctx.stroke();
    ctx.restore();
    wobble(ctx, body, 172, 0.8); ink(ctx, 3);
    wobble(ctx, [[2, 22], [-6, 38 + fl * 0.4], [16, 28]], 174, 0.5); ctx.fillStyle = '#e6eeff'; ctx.fill(); ink(ctx, 2.4);
    if ((t * 0.23) % 1 > 0.04) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(42, -6, 2.6, 0, TAU); ctx.fill(); } else { ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(39, -6); ctx.lineTo(45, -6); ctx.stroke(); }
    ctx.fillStyle = 'rgba(240,138,160,0.5)'; ctx.beginPath(); ctx.arc(46, 4, 4.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(56, 2, 9, 0.5, 1.7); ctx.stroke();
    // spout: a chalk fountain of little stars
    const sp = (i) => { const pts = []; for (let j = 0; j <= 10; j++) { const u = j / 10; pts.push([6 + i * u * 20, -37 - 30 * Math.sin(Math.PI * u * 0.75) - u * 4]); } return pts; };
    chalk(ctx, sp(-1), { width: 2.6, alpha: 0.9, color: '#ffffff', seed: 9 }); chalk(ctx, sp(1), { width: 2.6, alpha: 0.9, color: '#ffffff', seed: 10 });
    for (let i = 0; i < 4; i++) { const ph = (t * 0.6 + i * 0.25) % 1, sx = 6 + (i % 2 ? 1 : -1) * (8 + ph * 18), sy = -64 - ph * 22; ctx.globalAlpha = m * (1 - ph); ctx.fillStyle = '#fff3a0'; sparklePath(ctx, sx, sy, 4.5, t + i); ctx.fill(); }
    ctx.restore();
  }
  drawSnail(ctx, o, t) {
    const m = clamp01(o.m), k = ease.outBack(m), wig = 1 + 0.06 * (o.wig || 0), x = o.x + m * Math.sin(t * 0.25) * (5 + 14 * this.dream), y = 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(wig, wig);
    const st = Math.sin(t * 1.6) * 1.5;
    tube(ctx, [[-20, -3], [10, -3.5], [19, -6], [23, -14]], 8, '#edcfa4', INK, 3.6);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(24, -18); ctx.lineTo(27 + st * 0.4, -27); ctx.moveTo(21, -18); ctx.lineTo(20 + st * 0.4, -28); ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(27 + st * 0.4, -28, 1.8, 0, TAU); ctx.arc(20 + st * 0.4, -29, 1.8, 0, TAU); ctx.fill();
    if (m > 0.5) { ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(24, -12, 2.6, 0.4, 1.9); ctx.stroke(); }
    if (m < 0.98) {
      ctx.save(); ctx.globalAlpha *= 1 - m;
      ctx.beginPath(); ctx.arc(-3, -17, 14, 0, TAU); ctx.fillStyle = '#c98a4a'; ctx.fill(); ink(ctx, 2.8);
      ctx.strokeStyle = 'rgba(29,21,48,0.6)'; ctx.lineWidth = 1.8; ctx.beginPath(); for (let i = 0; i <= 26; i++) { const a = i * 0.42, rr = 12 - i * 0.42; const px = -3 + Math.cos(a) * rr, py = -17 + Math.sin(a) * rr; if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); } ctx.stroke();
      ctx.restore();
    }
    if (k > 0.02) {
      // …the shell is a tiny house with a lit window
      ctx.save(); ctx.translate(-3, -6); ctx.scale(k, k); ctx.globalAlpha *= m;
      glow(ctx, 0, -12, 34, '#ffc94d', 0.5);
      wobblyPoly(ctx, [[5, -30], [5, -41], [11, -41], [11, -26]], 181, 0.4, 30); ctx.fillStyle = '#b9553f'; ctx.fill(); ink(ctx, 2);
      wobblyPoly(ctx, [[-13, 0], [-13, -19], [13, -19], [13, 0]], 182, 0.6, 30); ctx.fillStyle = '#eeb9dc'; ctx.fill(); ink(ctx, 2.6);
      wobblyPoly(ctx, [[-17, -18], [0, -36], [17, -18]], 183, 0.6, 30); ctx.fillStyle = '#d9483b'; ctx.fill(); ink(ctx, 2.6);
      ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-8, -10); ctx.quadraticCurveTo(-3.5, -16, 1, -10); ctx.lineTo(1, -3); ctx.closePath(); ctx.fillStyle = '#ffe36e'; ctx.fill(); ink(ctx, 1.8);
      ctx.fillStyle = '#6b3f2a'; ctx.fillRect(5, -10, 5, 10); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(5, -10, 5, 10);
      drawSmoke(ctx, 8, -42, t, 185, 34, 0.8);
      ctx.restore();
    }
    ctx.restore();
  }
  drawCalf(ctx, o, t) {
    const x = o.x, y = 0, m = clamp01(o.m), k = ease.outCubic(m), lav = this.lav, wig = (o.wig || 0);
    const blade = (i, front) => {
      const r = rng(190 + i), bx = x - 40 + r() * 86, len = 46 + r() * 52, lean = (r() - 0.5) * 26 + Math.sin(t * 1.1 + i) * (3 + 5 * wig);
      ctx.moveTo(bx, y + 6); ctx.quadraticCurveTo(bx + lean * 0.3, y - len * 0.6, bx + lean, y - len);
      return front;
    };
    const cols = [mixHex('#58b948', '#b9a6e8', lav), mixHex('#9bd86a', '#e9e0ff', lav)];
    ctx.lineCap = 'round';
    ctx.strokeStyle = rgba(cols[0], 0.9); ctx.lineWidth = 3; ctx.beginPath(); for (let i = 0; i < 9; i++) blade(i); ctx.stroke();
    if (k > 0.02) {
      const up = (1 - k) * 46, ear = Math.sin(t * 2.3) > 0.94 ? 0.25 : 0, hx = x + 2 - this.dream * 16, hy = y - 54 + up - this.dream * 6;
      ctx.save(); ctx.globalAlpha *= clamp01(m * 1.6);
      // shoulders
      wobble(ctx, [[hx - 22, y + 8], [hx - 20, hy + 26], [hx, hy + 16], [hx + 26, hy + 24], [hx + 34, y + 8]], 195, 1); ctx.fillStyle = '#f4eef2'; ctx.fill(); ink(ctx, 3);
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.translate(hx + sd * 19, hy - 9); ctx.rotate(sd * (0.5 + (sd > 0 ? ear : 0)));
        wobble(ctx, circlePts(sd * 8, 0, 13, 8, 7), 196 + sd, 0.5); ctx.fillStyle = '#fbf6f4'; ctx.fill(); ink(ctx, 2.6);
        ctx.fillStyle = '#f6c9cf'; ctx.beginPath(); ctx.ellipse(sd * 8, 0.5, 8, 3.6, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
      wobble(ctx, circlePts(hx, hy, 20, 10, 23), 197, 0.7); ctx.fillStyle = '#fdfaf8'; ctx.fill(); ink(ctx, 3);
      const shut = (t * 0.27) % 1 < 0.04;
      for (const sd of [-1, 1]) { if (shut) { ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(hx + sd * 8 - 3, hy - 4); ctx.lineTo(hx + sd * 8 + 3, hy - 4); ctx.stroke(); } else { ctx.fillStyle = '#3a2f52'; ctx.beginPath(); ctx.ellipse(hx + sd * 8, hy - 4, 2.8, 3.8, 0, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx + sd * 8 + 0.9, hy - 5.4, 1, 0, TAU); ctx.fill(); } }
      ctx.beginPath(); ctx.ellipse(hx, hy + 11, 11.5, 8, 0, 0, TAU); ctx.fillStyle = '#f6c9cf'; ctx.fill(); ink(ctx, 2.2);
      ctx.fillStyle = '#b06a80'; ctx.beginPath(); ctx.ellipse(hx - 4, hy + 10, 1.5, 2.2, 0, 0, TAU); ctx.ellipse(hx + 4, hy + 10, 1.5, 2.2, 0, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.strokeStyle = rgba(cols[1], 0.95); ctx.lineWidth = 2.6; ctx.beginPath(); for (let i = 9; i < 17; i++) blade(i); ctx.stroke();
  }
  // the long pale grass of the calf picture grows in as the dusk comes
  drawDuskGrass(ctx, view, t) {
    const a = this.lav; if (a < 0.03) return;
    ctx.save(); ctx.lineCap = 'round';
    for (let c = 0; c < 2; c++) {
      ctx.beginPath();
      for (let i = Math.floor((view.left - 20) / 17); i * 17 < view.right + 20; i++) {
        if ((hash(i * 7 + 3) < 0.5) !== (c === 0)) continue;
        const bx = i * 17 + hash(i * 13) * 14, row = hash(i * 29), by = 8 + row * 60, len = (26 + hash(i * 41) * 50 + row * 22) * a;
        const lean = (hash(i * 53) - 0.5) * 30 + Math.sin(t * 0.9 + i * 0.6) * 5;
        ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + lean * 0.25, by - len * 0.7, bx + lean, by - len);
      }
      ctx.strokeStyle = rgba(c ? '#f2ecff' : '#a9c4f2', 0.5 * a); ctx.lineWidth = 1.7; ctx.stroke();
    }
    ctx.restore();
  }

  draw(ctx, view, t) {
    const sky = this.sky, cy = this.cam.y;
    drawSkyAll(ctx, view, sky, this.farSeed);
    drawStars(ctx, view, this.stars, t, sky.star * clamp01(this.lav * 1.2), this.reduced);
    const sk = this.farK();          // (moon and clouds keep their size on the screen when the camera comes closer)
    if (sky.star > 0.04 && this.lav > 0.3) { ctx.save(); ctx.globalAlpha = Math.min(1, sky.star * 1.2) * clamp01((this.lav - 0.3) * 2); const m = this.moonPos(); drawMoon(ctx, m.x, m.y, this.moon.r * sk * (1 + this.moonB.x * 0.05), t, { face: Math.min(1, this.moonFace * 2) }); ctx.restore(); }
    for (const c of this.clouds) {
      const x = view.left + view.width * c.u + Math.sin(t * 0.05 + c.seed) * 30 * sk, y = view.free + c.y * sk;
      ctx.save(); ctx.translate(x, y); ctx.scale(sk, sk); drawCloud(ctx, 0, 0, c.w * 0.8, c.seed, sky.cloud, 0.55 * (1 - 0.6 * this.lav)); ctx.restore();
    }
    // clouds the dream passes on its way up
    if (cy < -60) for (let i = 0; i < 7; i++) { const yy = -640 - i * 150, xx = this.cam.x + (hash(i * 17) - 0.5) * view.width * 0.9; if (yy > view.top - 120 && yy < view.bottom + 120) drawCloud(ctx, xx, yy, 220 + hash(i * 5) * 160, 200 + i, '#b99ad8', 0.75); }
    drawFarTown(ctx, view, this.farSeed, sky.mid, this.far, 0.3);
    this.drawCloudWhale(ctx, this.by.cloud, t);
    for (const s of this.dayStars) { glow(ctx, s.x, s.y, 26, '#fff3a0', 0.6); icon(ctx, s.kind, s.x, s.y, s.s * 0.9); }
    if (view.bottom > -40) drawGround(ctx, view, sky, { t });
    // fence along the back of the garden
    if (view.bottom > -60) {
      ctx.fillStyle = mixHex('#fbf3dc', '#b9a6e0', this.lav * 0.7); ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
      for (let x = Math.floor(Math.max(-150, view.left - 20) / 22) * 22; x < view.right + 20; x += 22) { if (x < -150) continue; ctx.beginPath(); ctx.moveTo(x - 6, 3); ctx.lineTo(x - 6, -26); ctx.lineTo(x, -34); ctx.lineTo(x + 6, -26); ctx.lineTo(x + 6, 3); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillRect(-150, -22, view.right + 170, 5); ctx.strokeRect(-150, -22, view.right + 170, 5);
    }
    for (const h of this.houses) h.draw(ctx, t);
    // the ledge under the window where the cat waits
    wobblyPoly(ctx, [[-188, -109], [-120, -109], [-122, -100], [-186, -100]], 127, 0.8, 40); ctx.fillStyle = '#f1f5fb'; ctx.fill(); ink(ctx, 2.6);
    for (const tr of this.trees) if (view.visible(tr.x, tr.r * 2 + 60)) tr.draw(ctx, t);
    if (view.bottom > -30) drawGrassFront(ctx, view, sky, { t });
    const ly = this.drawLine(ctx, t);
    this.drawCalf(ctx, this.by.calf, t);
    this.drawSheetShip(ctx, this.by.sheet, t, ly);
    this.drawBushDragon(ctx, this.by.bush, t);
    this.drawPuddle(ctx, this.by.puddle, t);
    this.drawStoneTurtle(ctx, this.by.stone, t);
    this.drawSnail(ctx, this.by.snail, t);
    this.drawDuskGrass(ctx, view, t);
    for (const h of this.houses) h.drawLights(ctx, t);
    this.fx.draw(ctx, t, -1);
    for (const c of this.cats) c.draw(ctx, t);
    for (const b of this.loose) drawLooseBundle(ctx, b.x, b.y, b.rot, b.size, b.glow);
    // letters and what they turn into
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const L = LETTERS[this.story.lang] || LETTERS.en;
    for (const b of this.letters) {
      if (b.done || b.a <= 0.01) continue;
      glow(ctx, b.x, b.y, b.r * 2 * b.s, '#fff7c0', 0.35 * b.a);
      bubble(ctx, b.x, b.y, b.r * b.s, b.a, t, b.seed, 'rgba(255,247,200,0.82)');
      ctx.save(); ctx.globalAlpha = b.a; ctx.fillStyle = '#2a2440'; ctx.font = '400 ' + Math.round(30 * b.s) + 'px Alice, Georgia, serif'; ctx.fillText(L[b.i], b.x, b.y + 2); ctx.restore();
    }
    for (const pc of this.pics) { ctx.save(); ctx.globalAlpha = pc.a; glow(ctx, pc.x, pc.y, 30, '#fff7c0', 0.5); icon(ctx, pc.kind, pc.x, pc.y, pc.s); ctx.restore(); }
    // the dream
    for (const m of this.mems) { if (m.done || m.a <= 0.01) continue; bubble(ctx, m.x, m.y, m.r, m.a, t, m.seed); ctx.save(); ctx.globalAlpha = m.a; icon(ctx, m.kind, m.x, m.y + 1, 1.25); ctx.restore(); }
    if (this.bub && this.bub.a > 0.01) {
      const b = this.bub;
      glow(ctx, b.x, b.y, b.r * 2.3, '#f3e6ff', 0.5 * b.a, 'screen');
      crayonRings(ctx, b.x, b.y, b.r * 1.22, t, { alpha: 0.4 * b.a, rings: 3, colors: ['#ffe36e', '#f6b0d0', '#9fc8ff'], seed: 31, thick: 0.34, fade: 0.2 });
      if (b.r > 12) {               // the dream self grows with the bubble (scaled about its centre), floating and breathing
        const k = b.r / 64;
        ctx.save(); ctx.globalAlpha = b.a * clamp01((b.r - 12) / 30);
        ctx.translate(b.x, b.y); ctx.scale(k, k); ctx.rotate(Math.sin(t * 0.7) * 0.06); ctx.translate(-b.x, -b.y);
        this.child.drawFull(ctx, t); ctx.restore();
      }
      bubble(ctx, b.x, b.y, b.r, b.a, t, 3);
    }
    if (this.leap) this.leap.draw(ctx, t);
    this.fx.draw(ctx, t, 0);
  }
  // falling asleep (a soft closing iris rather than eyelids) and the final burst of light — screen space
  drawOver(ctx, view) {
    const k = this.sleep, f = this.flash;
    if (k <= 0.003 && f <= 0.003) return;
    view.screen(ctx);
    const W = view.W, H = view.H;
    if (k > 0.003) {
      // (the iris closes on the sleeping girl)
      const h = this.girl.anchor('head'), cx = clamp(view.sx(h.x), W * 0.2, W * 0.8), cy = clamp(view.sy(h.y), H * 0.2, H * 0.8), big = Math.hypot(W, H) * 0.8, r0 = lerp(big, Math.min(W, H) * 0.08, ease.inOutQuad(k));
      const g = ctx.createRadialGradient(cx, cy, Math.max(1, r0 * 0.55), cx, cy, r0 + 40 + 160 * (1 - k));
      g.addColorStop(0, 'rgba(22,8,48,' + (0.1 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(22,8,48,' + Math.min(1, 0.55 + 0.6 * k).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      if (k > 0.86) { ctx.fillStyle = 'rgba(22,8,48,' + clamp01((k - 0.86) / 0.14).toFixed(3) + ')'; ctx.fillRect(0, 0, W, H); }
    }
    if (f > 0.003) {
      // the burst of light is brightest round the bubble and softer towards the edges
      const bx = view.sx(this.bub.x), by = view.sy(this.bub.y), R = Math.hypot(W, H) * 0.7;
      const g = ctx.createRadialGradient(bx, by, 0, bx, by, R);
      g.addColorStop(0, 'rgba(255,250,232,' + clamp01(f).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(255,250,232,' + clamp01(f * 0.55).toFixed(3) + ')');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }
}
