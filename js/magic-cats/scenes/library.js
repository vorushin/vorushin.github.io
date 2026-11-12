// Scene 5 — The tree library. A street of enormous old trees by day: show the trees some
// love, climb branch by branch until the town lies far below, bounce off a hammock, open
// the book bags that hang in the crown, and feed the birds that nobody ever hunts.
import { Street, Perch } from '../street.js';
import { Leap } from '../leap.js';
import { Cat, Kid, Bird } from '../actors.js';
import { Tree, House, drawBag, drawBench, drawBush, drawFarTown } from '../props.js';
import { TAU, clamp, clamp01, lerp, ease, rng, spring, approach, dist, rgba, shade, qbez } from '../util.js';
import { INK, SKIES, ink, wobble, wobblyPoly, blobPath, sprite, glow, tube, wind, drawSkyAll, drawCloud, drawGround, drawGrassFront } from '../paint.js';

const T = {
  love: { en: 'Show the trees some love', de: 'Zeig den Bäumen, wie lieb man sie hat', ru: 'Покажи, как здесь любят деревья' },
  climb: { en: 'Climb: touch the next branch', de: 'Klettere: tippe auf den nächsten Ast', ru: 'Забирайся: нажми на следующую ветку' },
  hammock: { en: 'Hop into the hammock', de: 'Hüpf in die Hängematte', ru: 'Прыгай в гамак' },
  bags: { en: 'Open the book bags', de: 'Öffne die Büchertaschen', ru: 'Открой сумки с книгами' },
  birds: { en: 'Say hello to the birds', de: 'Sag den Vögeln hallo', ru: 'Поздоровайся с птицами' },
  feed: { en: 'Drag a biscuit to a bird', de: 'Zieh einen Keks zu einem Vogel', ru: 'Перетащи печенье птичке' }
};

const BARK = '#9a5428';
const CAN_X = 15, CAN_Y = 1;
const TIN_F = 0.14;                   // the biscuit tin, near the trunk: even the bird behind the reader's shoulder is a little journey away
const KIT_X = 80;
const HUG_X = [-70, -80];             // the girl beside her tree, and stepped in against it (hugging)
const HUG_LEGS = -9;                 // hugging, the girl is hidden behind the trunk's edge from the neck down to here (her legs stay in front of the roots)                     // where the kitten waits on the ground (between the sapling and the bench, clear of the can)          // the watering can's body relative to the hand that holds its handle
// the two great trees the scene is played on, and two more that line the street
const GA = { x: -170, top: 980, b0: 94, b1: 56, b2: 42, cr: 252, cy: -1150, seed: 301, bark: '#9a5428' };
const GB = { x: 230, top: 1000, b0: 90, b1: 54, b2: 40, cr: 262, cy: -1190, seed: 302, bark: '#a35c2b' };
const SIDE = [
  { x: -650, top: 900, b0: 86, b1: 52, b2: 38, cr: 240, cy: -1060, seed: 303, bark: '#915027' },
  { x: 720, top: 1060, b0: 90, b1: 54, b2: 40, cr: 256, cy: -1250, seed: 304, bark: '#9d592a' },
  { x: -1120, top: 990, b0: 88, b1: 52, b2: 40, cr: 250, cy: -1160, seed: 305, bark: '#96532a' },
  { x: 1190, top: 940, b0: 88, b1: 52, b2: 40, cr: 246, cy: -1110, seed: 306, bark: '#9a5428' }
];
const halfW = (g, y) => (y > -130 ? lerp(g.b0, g.b1, clamp01(-y / 130)) : lerp(g.b1, g.b2, clamp01((-y - 130) / (g.top - 130))));
const edge = (g, y, side) => g.x + side * halfW(g, y);

// (painted once: each of these giants is a great many strokes)
function drawTrunk(ctx, g) {
  const PW = g.b0 * 2 + 164, PH = g.top + 42;
  const s = sprite('lib-trunk:' + g.seed, PW, PH, (c) => { c.translate(PW / 2 - g.x, g.top + 14); paintTrunk(c, g); }, 1.3);
  ctx.drawImage(s.c, g.x - PW / 2, -g.top - 14, PW, PH);
}
function trunkPts(g) {
  const x = g.x, m = (g.b0 + g.b1) / 2 - 8;
  return [[x - g.b0 - 30, 9], [x - g.b0 - 4, -12], [x - m, -52], [x - g.b1, -130], [x - g.b2, -g.top], [x + g.b2, -g.top], [x + g.b1, -130], [x + m, -52], [x + g.b0 + 4, -12], [x + g.b0 + 30, 9]];
}
function paintTrunk(ctx, g) {
  const x = g.x, m = (g.b0 + g.b1) / 2 - 8, r = rng(g.seed + 5);
  // the foot spreads into roots
  const pts = trunkPts(g);
  ctx.fillStyle = 'rgba(20,40,20,0.2)'; ctx.beginPath(); ctx.ellipse(x + 10, 8, g.b0 + 62, 11, 0, 0, TAU); ctx.fill();
  wobblyPoly(ctx, pts, g.seed, 2.2, 110);
  ctx.fillStyle = g.bark; ctx.fill();
  ctx.save(); ctx.clip();
  // round: light from the upper left, the far side in shade
  const sh = ctx.createLinearGradient(x - g.b0, 0, x + g.b0, 0);
  sh.addColorStop(0, rgba(shade(g.bark, -0.45), 0.5)); sh.addColorStop(0.2, rgba(shade(g.bark, 0.3), 0.34)); sh.addColorStop(0.42, rgba(shade(g.bark, 0.3), 0)); sh.addColorStop(0.72, rgba(shade(g.bark, -0.4), 0.22)); sh.addColorStop(1, rgba(shade(g.bark, -0.55), 0.62));
  ctx.fillStyle = sh; ctx.fillRect(x - g.b0 - 40, -g.top, g.b0 * 2 + 80, g.top + 14);
  // bark: long furrows that wander, a few knots
  ctx.strokeStyle = rgba(shade(g.bark, -0.5), 0.42); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i < 34; i++) {
    const yy = -16 - r() * (g.top - 50), xx = x + (r() - 0.5) * 2 * (halfW(g, yy) - 10), len = 30 + r() * 70;
    ctx.moveTo(xx, yy); ctx.bezierCurveTo(xx + (r() - 0.5) * 12, yy - len * 0.35, xx + (r() - 0.5) * 12, yy - len * 0.7, xx + (r() - 0.5) * 7, yy - len);
  }
  ctx.stroke();
  ctx.strokeStyle = rgba(shade(g.bark, 0.4), 0.3); ctx.lineWidth = 1.8; ctx.beginPath();
  for (let i = 0; i < 16; i++) {
    const yy = -30 - r() * (g.top - 80), xx = x - halfW(g, yy) * (0.15 + r() * 0.5), len = 24 + r() * 50;
    ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + (r() - 0.5) * 8, yy - len / 2, xx + (r() - 0.5) * 5, yy - len);
  }
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const yy = -90 - r() * (g.top - 220), xx = x + (r() - 0.5) * 1.3 * (halfW(g, yy) - 16), kr = 5 + r() * 5;
    ctx.strokeStyle = rgba(shade(g.bark, -0.55), 0.5); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.ellipse(xx, yy, kr, kr * 1.5, 0, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(xx, yy, kr * 0.4, kr * 0.7, 0, 0, TAU); ctx.stroke();
  }
  // moss creeping up from the grass
  for (let i = 0; i < 26; i++) {
    const e = r() < 0.6 ? (r() < 0.5 ? -1 : 1) * (0.55 + r() * 0.6) : (r() - 0.5) * 1.1;      // mostly on the roots
    const xx = x + e * g.b0, up = r() * r() * (Math.abs(e) > 0.5 ? 44 : 20);
    ctx.fillStyle = rgba(r() < 0.5 ? '#3f9e3a' : '#63bd48', 0.9);
    ctx.beginPath(); ctx.arc(xx, 6 - up, 6 + r() * 7, 0, TAU); ctx.fill();
  }
  ctx.restore();
  wobblyPoly(ctx, pts, g.seed, 2.2, 110); ink(ctx, 5);
  // a couple of toadstools between the roots
  for (const sd of [-1, 1]) {
    if (r() < 0.35) continue;
    const mx = x + sd * (g.b0 + 14 + r() * 16), mh = 9 + r() * 5;
    tube(ctx, [[mx, 6], [mx + sd, 6 - mh]], 3.6, '#fbf3dc', INK, 2.2);
    wobble(ctx, [[mx - 8, 7 - mh], [mx - 5, -1 - mh], [mx + 1, -4 - mh], [mx + 7, -1 - mh], [mx + 9, 7 - mh]], g.seed + sd * 3, 0.4);
    ctx.fillStyle = '#e2553f'; ctx.fill(); ink(ctx, 2.2);
    ctx.fillStyle = '#fbf3dc'; for (const d of [[-3, 1], [2, -1], [5, 3]]) { ctx.beginPath(); ctx.arc(mx + d[0], 2 - mh + d[1], 1.3, 0, TAU); ctx.fill(); }
  }
}
function crownSprite(g) {
  const R = g.cr;
  return sprite('lib-crown2:' + g.seed, R * 2.8, R * 2.36, (c, W, H) => {
    const cx = W / 2, cy = H / 2, rr = rng(g.seed + 9);
    blobPath(c, cx, cy, R, R * 0.8, g.seed, 11, 0.12);
    c.fillStyle = '#27a035'; c.fill();
    c.save(); c.clip();
    const vol = c.createLinearGradient(0, cy - R * 0.8, 0, cy + R * 0.85);
    vol.addColorStop(0, 'rgba(120,214,90,0.5)'); vol.addColorStop(0.45, 'rgba(92,201,74,0)'); vol.addColorStop(1, 'rgba(12,92,36,0.7)');
    c.fillStyle = vol; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 80; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * R, px = cx + Math.cos(a) * d - R * 0.14, py = cy + Math.sin(a) * d * 0.8 - R * 0.16;
      c.fillStyle = rgba('#5cc94a', 0.3 + rr() * 0.35);
      c.beginPath(); c.ellipse(px, py, R * (0.05 + rr() * 0.08), R * (0.035 + rr() * 0.05), rr() * 3, 0, TAU); c.fill();
    }
    for (let i = 0; i < 50; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * R, px = cx + Math.cos(a) * d + R * 0.16, py = cy + Math.sin(a) * d * 0.8 + R * 0.2;
      c.fillStyle = rgba('#15802a', 0.28 + rr() * 0.3);
      c.beginPath(); c.ellipse(px, py, R * (0.06 + rr() * 0.09), R * (0.04 + rr() * 0.05), rr() * 3, 0, TAU); c.fill();
    }
    for (let i = 0; i < 90; i++) {
      const a = rr() * TAU, d = Math.sqrt(rr()) * R * 0.92, px = cx + Math.cos(a) * d, py = cy + Math.sin(a) * d * 0.8;
      c.fillStyle = rgba('#0f6a22', 0.5); c.beginPath(); c.ellipse(px, py, 2.6, 4, rr() * 3, 0, TAU); c.fill();
    }
    c.restore();
    blobPath(c, cx, cy, R, R * 0.8, g.seed, 11, 0.12); ink(c, 6);
  }, 1.3);
}
function tuftSprite(seed, r) {
  return sprite('lib-tuft:' + seed + ':' + r, r * 2.8, r * 2.6, (c, W, H) => {
    const rr = rng(seed);
    blobPath(c, W / 2, H / 2, r, r * 0.82, seed, 6, 0.2); c.fillStyle = '#2aa238'; c.fill();
    c.save(); c.clip();
    for (let i = 0; i < 12; i++) { c.fillStyle = rgba(i % 3 ? '#5cc94a' : '#15802a', 0.4); c.beginPath(); c.ellipse(W / 2 + (rr() - 0.5) * r * 1.6, H / 2 + (rr() - 0.5) * r * 1.3, r * 0.22, r * 0.14, rr() * 3, 0, TAU); c.fill(); }
    c.restore();
    blobPath(c, W / 2, H / 2, r, r * 0.82, seed, 6, 0.2); ink(c, 3.6);
  });
}
// the land far below, seen from high in the tree
function farLand() {
  return sprite('lib-farland', 1400, 240, (c, W, H) => {
    const r = rng(77);
    const hill = (y0, amp, col) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
      for (let x = 0; x <= W; x += 20) c.lineTo(x, y0 + Math.sin((x / W) * TAU * 2 + amp) * amp + Math.sin((x / W) * TAU * 5 + amp * 2) * amp * 0.4);
      c.lineTo(W, H); c.closePath(); c.fill();
    };
    hill(46, 14, '#b9e3bd'); hill(74, 11, '#a2dba2'); hill(108, 9, '#8fd58a');
    c.strokeStyle = 'rgba(190,226,246,0.9)'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath();
    for (let x = -20; x <= W + 20; x += 20) { const y = 150 + Math.sin((x / W) * TAU * 3) * 22 + Math.sin((x / W) * TAU) * 14; if (x < 0) c.moveTo(x, y); else c.lineTo(x, y); }
    c.stroke();
    const cols = ['#eeb9dc', '#8fabe2', '#f3dc86', '#f1f5fb', '#a8473e'];
    for (let i = 0; i < 46; i++) {
      const x = 14 + r() * (W - 28), y = 78 + r() * 130, s = 0.7 + (y / H) * 0.9;
      if (r() < 0.45) {
        const w = 11 * s, h = (9 + r() * 9) * s;
        c.fillStyle = cols[Math.floor(r() * cols.length)]; c.fillRect(x - w / 2, y - h, w, h);
        c.fillStyle = r() < 0.5 ? '#c96a4a' : '#f1f5fb'; c.beginPath(); c.moveTo(x - w / 2 - 1.5, y - h); c.lineTo(x, y - h - 6 * s); c.lineTo(x + w / 2 + 1.5, y - h); c.closePath(); c.fill();
      } else {
        c.fillStyle = r() < 0.5 ? '#4fb85a' : '#3aa24a'; c.beginPath(); c.arc(x, y - 7 * s, (4.5 + r() * 4) * s, 0, TAU); c.fill();
        c.fillStyle = '#8a5a2b'; c.fillRect(x - 0.9 * s, y - 4 * s, 1.8 * s, 4 * s);
      }
    }
  }, 1.5);
}

function drawBook(ctx, x, y, rot, open, color, s) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s || 1, s || 1);
  if (open < 0.5) {
    wobblyPoly(ctx, [[-8, -11], [8, -11], [8, 11], [-8, 11]], 5, 0.5, 40); ctx.fillStyle = color; ctx.fill(); ink(ctx, 2.2);
    ctx.fillStyle = '#fbf8ec'; ctx.fillRect(-4.5, -6.5, 9, 5);
    ctx.strokeStyle = 'rgba(29,21,48,0.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5.6, -11); ctx.lineTo(-5.6, 11); ctx.stroke();
  } else {
    for (const sd of [-1, 1]) { wobblyPoly(ctx, [[0, 6], [sd * 16, 0], [sd * 16, -15], [0, -8]], 7 + sd, 0.4, 40); ctx.fillStyle = color; ctx.fill(); ink(ctx, 2.2); }
    for (const sd of [-1, 1]) {
      wobblyPoly(ctx, [[0, 3.5], [sd * 13.5, -1.5], [sd * 13.5, -14], [0, -9]], 9 + sd, 0.3, 40); ctx.fillStyle = '#fbf8ec'; ctx.fill(); ink(ctx, 1.6);
      ctx.strokeStyle = 'rgba(29,21,48,0.35)'; ctx.lineWidth = 1; ctx.beginPath();
      ctx.moveTo(sd * 3, -5.5); ctx.lineTo(sd * 11, -8.5); ctx.moveTo(sd * 3, -2); ctx.lineTo(sd * 11, -5); ctx.stroke();
    }
  }
  ctx.restore();
}
function drawBiscuit(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s || 1, s || 1);
  wobble(ctx, [[-8, 0], [-6, -6], [0, -8.5], [6, -6], [8, 0], [6, 6], [0, 8.5], [-6, 6]], 13, 0.6); ctx.fillStyle = '#e8b866'; ctx.fill(); ink(ctx, 2.2);
  ctx.fillStyle = '#8a4a22'; for (const [dx, dy] of [[-3, -2], [2.5, 1], [-1, 3.5], [3, -3.5]]) { ctx.beginPath(); ctx.arc(dx, dy, 1.1, 0, TAU); ctx.fill(); }
  ctx.restore();
}

export default class Library extends Street {
  constructor(game, index) {
    super(game, index);
    this.setSky('green');
    this.follow = false; this.far = 0.5;
    this.cam.x = 30;
    this.focusY = 0;                  // (old camera, used only if the director's camera is not running)
    this.zoomGoal = 1;
    this.skyFixed = true;             // the far clouds keep their size when the camera comes closer
    this.camPhase = 'ground';         // what frame() keeps in the picture: ground | arrive | climb | library | feed
    this._dest = null; this._next = null; this._destFor = null;
    // little houses on the street, to show how huge the trees are
    this.addHouse({ x: -410, w: 150, h: 226, style: 'pink', seed: 81 });
    this.addHouse({ x: 480, w: 170, h: 190, style: 'blue', seed: 82 });
    this.addHouse({ x: 950, w: 150, h: 240, style: 'butter', seed: 83, chimney: true });
    this.addHouse({ x: -880, w: 160, h: 200, style: 'mint', seed: 84 });
    this.sapling = new Tree({ x: 6, h: 62, r: 25, kind: 'round', seed: 91, grow: 0.5, lean: 0 });
    this.trees.push(this.sapling);
    // branches: {g, side, y, len, rise, seed}
    const br = (g, side, y, len, rise, seed, tuft) => {
      const b = { g, side, y, len, rise, seed, tuft: tuft !== false, sag: { x: 0, v: 0 } };
      b.land = (v) => { b.sag.v += 70 * (v === undefined ? 1 : v); };
      return b;
    };
    this.bA1 = br(GA, 1, -185, 120, 20, 501); this.bB1 = br(GB, -1, -320, 125, 22, 502); this.bA2 = br(GA, 1, -455, 122, 20, 503);
    this.bL1 = br(GB, -1, -850, 172, 16, 504); this.bA3 = br(GA, 1, -905, 152, 14, 505); this.bBag = br(GB, -1, -985, 176, 10, 506, false);
    this.branches = [this.bA1, this.bB1, this.bA2, this.bL1, this.bA3, this.bBag,
      br(GA, -1, -300, 100, 24, 507), br(GB, 1, -470, 110, 22, 508), br(GA, -1, -700, 105, 20, 509), br(GB, 1, -760, 100, 24, 510)];
    // hammock between the two trunks
    this.ham = { xa: edge(GA, -700, 1) - 4, xb: edge(GB, -700, -1) + 4, y: -700,   // (high enough that a leap B1 → A2 passes under it)
      base: 60, sag: { x: 0, v: 0 } };
    this.ham.land = (v) => { this.ham.sag.v += 230 * (v === undefined ? 1 : v); };
    this.sleeper = new Kid({ kind: 'blond', pose: 'lie', mood: 'sleep', size: 1.15 });
    // perches
    this.pBench = Perch.point(110, -36, { kind: 'bench', hw: 26 });
    this.pA1 = this.perchOn(this.bA1, 0.6); this.pB1 = this.perchOn(this.bB1, 0.6); this.pA2 = this.perchOn(this.bA2, 0.6);
    const hx = lerp(this.ham.xa, this.ham.xb, 0.68);
    this.pHam = new Perch({ at: () => ({ x: hx, y: this.hamY(hx) - 2 }), owner: this.ham, kind: 'hammock', hw: 40 });
    this.pL1 = this.perchOn(this.bL1, 0.72);
    this.road = [this.pBench, this.pA1, this.pB1, this.pA2, this.pHam];   // (the climb in order: the camera looks one step ahead)
    // people who love their trees
    this.hugger = new Kid({ kind: 'pigtails', pose: 'stand', mood: 'wait', dir: -1, x: HUG_X[0], y: 0 });   // (hugging she steps in: her middle on the trunk's edge at chest height)
    this.hugger.look = { x: GA.x + 30, y: -420 };                          // gazing up her tree
    this.waterer = new Kid({ kind: 'curly', pose: 'stand', mood: 'hold', dir: 1, x: -36, y: 0 });
    this.waterer.look = { x: 8, y: -24 };                                  // …and at the little one he waters
    this.pour = 0; this.tip = 0.05; this.hugK = 0; this._hugId = 0;
    this._spout = { x: 0, y: 0 }; this._a = { x: 0, y: 0 };
    const a3 = this.branchPt(this.bA3, 0.5);
    this.boy = new Kid({ kind: 'spiky', pose: 'sit', mood: 'wait', dir: 1, size: 1.1, x: a3.x, y: a3.y });   // (he gets his book from a bag)
    this.kids = [this.hugger, this.waterer, this.boy, this.sleeper];
    this.tin = this.branchPt(this.bA3, TIN_F);
    // book bags in B's crown
    this.bags = [0.3, 0.55, 0.8].map((f, i) => { const q = this.branchPt(this.bBag, f); return { x: q.x, y: q.y + 15 - f * 8, color: ['#f2c23a', '#e2553f', '#6fa8e8'][i], sw: { x: 0, v: 0 }, open: false }; });
    this.books = [];
    this.biscuit = null;
    this.icons = 0;
    // the cats (they stroll in after the first beat)
    this.papa = this.addCat(new Cat({ kind: 'papa', x: -470, y: 0 })); this.kit = this.addCat(new Cat({ kind: 'kitten', x: -540, y: 0 }));
    this.papa.hidden = this.kit.hidden = true;
    this.kitOnHam = false; this.toy = false; this.expectText = T.climb;
    this.skyClouds = [{ x: -260, y: -560, w: 300, s: 21 }, { x: 420, y: -740, w: 260, s: 22 }, { x: -60, y: -980, w: 340, s: 23 }, { x: 560, y: -1180, w: 300, s: 24 }, { x: -520, y: -1260, w: 280, s: 25 }, { x: 120, y: -1420, w: 320, s: 26 }];
    this.zz = 0;
    this.expect = () => (this.leap && this.leap.enabled ? this.leap.expect(this.expectText) : null);
    this.audio.play('library', { intensity: 0.6 }); this.audio.ambience('day');
  }

  // geometry helpers
  branchGeom(b) { const rx = edge(b.g, b.y, b.side) - b.side * 6; return { rx, ry: b.y, tx: rx + b.side * b.len, ty: b.y - b.rise }; }
  branchPt(b, f) { const q = this.branchGeom(b); return { x: lerp(q.rx, q.tx, f), y: lerp(q.ry - 11, q.ty - 4, f) - 1 + b.sag.x * f }; }
  perchOn(b, f) { return new Perch({ at: () => this.branchPt(b, f), owner: b, kind: 'branch', hw: 30 }); }
  hamY(x) { const h = this.ham, u = clamp01((x - h.xa) / (h.xb - h.xa)); return h.y + 4 * (h.base + h.sag.x) * u * (1 - u); }

  // ───────────── camera ─────────────
  // What the director's camera keeps in the picture (Scene.track), by phase: the two tree lovers and the
  // sapling; then the cats coming to the bench; on the climb the cat, where it stands and where it goes
  // next (in the air: where it lands and the step after, so the frame keeps its width); up in the crown the
  // reader, the bags and the cats; while feeding, a close-up of the reader and his birds. Whatever the
  // player is asked to touch is always in.
  frame() {
    const ph = this.camPhase, b = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 }, up = this.view.portrait;
    const add = (l, r, t, bb) => { b.l = Math.min(b.l, l); b.r = Math.max(b.r, r); b.t = Math.min(b.t, t); b.b = Math.max(b.b, bb); };
    if (ph === 'ground') add(this.hugger.x - 34, this.sapling.x + 34, -96, 0);
    else if (ph === 'arrive') {
      add(this.hugger.x - 30, 150, -96, 0);
      for (const c of [this.papa, this.kit]) if (!c.hidden && c.x < 230) add(c.x - 34, c.x + 34, c.y - 60, 0);
    } else if (ph === 'climb') {
      const c = this.papa, L = this.leap, air = L.state === 'air' && this._dest;
      const perch = (q) => { if (q) add(q.x - 58, q.x + 58, q.y - 76, q.y + (q === this.pBench ? 40 : 26)); };
      const after = (q) => { const at = L.at; L.at = q; const n = L.stepToward(L.goal); L.at = at; return n; };
      if (air) { if (this._destFor !== this._dest) { this._destFor = this._dest; this._next = this._dest === this.pHam ? null : (after(this._dest) || this.road[this.road.indexOf(this._dest) + 1] || null); } perch(this._dest); }
      else {
        add(c.x - 50, c.x + 50, c.y - 70, c.y + 20);
        // (the next step on the road, also while the story is still talking and no goal is set yet: the box keeps its size)
        if (L.state === 'idle') this._next = (L.enabled && L.stepToward(L.goal)) || this.road[this.road.indexOf(L.at) + 1] || null;
        perch(L.at);
      }
      perch(this._next);
      // the hammock and its sleeper, once the cats are near it
      if (this._next === this.pHam || this._dest === this.pHam || L.at === this.pHam) add(this.sleeper.x - 44, this.pHam.x + 40, this.ham.y - 50, this.ham.y + 52);
      const k = this.kit;
      if (!k.hidden && Math.abs(k.y - c.y) < 60 && !air) add(k.x - 26, k.x + 26, k.y - 46, k.y + 8);
    } else if (ph === 'library') {
      // (an upright phone is narrow: the reader, the bags and papa; the kitten may be half out; the branch nearer the middle)
      if (up) add(this.boy.x - 30, this.papa.x + 26, this.bags[0].y - 26, this.bL1.y + 60);
      else add(this.boy.x - 36, this.kit.x + 24, this.bags[0].y - 30, this.bL1.y + 6);
      // where the birds will perch (with room for touching them), in the box from the moment they are called: one size for the beat
      if (this.birdSpots) for (const q of this.birdSpots) add(q.x - 40, q.x + 40, q.y - 52, q.y + 20);
    } else if (ph === 'feed') {
      // the close-up: the reader, his tin and the birds round him (one that is wanted elsewhere comes in by the expectation)
      add(this.tin.x - 20, this.boy.x + 46, this.boy.y - 66, this.boy.y + (up ? 60 : 22));
      for (const o of this.birds) if (!up || Math.abs(o.x - this.boy.x) < 90) add(o.x - 20, o.x + 20, o.y - 30, o.y + 6);
    }
    const e = this.currentExpect();
    if (e && e.x !== undefined && e.kind !== 'continue') add(e.x - 40, e.x + 40, e.y - 40, e.y + 40);
    return b;
  }
  direct(o) { this.track(() => this.frame(), Object.assign({ ground: true, max: 1.55, pad: 22, rate: 1.8, zoomIn: 0.8, clampX: [-300, 360] }, o || {})); }

  // ───────────── story ─────────────
  async run() {
    // establishing shot: high in the crown (the library), then down the great trunks to the people below
    const ground = () => ({ l: this.hugger.x - 34, r: this.sapling.x + 34, t: -96, b: 0 });
    if (!this.reduced) {
      this.shot({ l: -150, r: 210, t: -1050, b: -820 }, 0, { max: 1.35 });
      this.boy.look = { x: 60, y: -1000 };
      this.spawn(async () => { await this.wait(0.8); this.say(0); });          // In that town, people love their trees dearly.
      await this.wait(1.1);
      await this.shot(ground, 3.6, { ground: true, max: 1.55, pad: 22, ease: ease.inOutCubic });
    } else {
      this.shot(ground, 0, { ground: true, max: 1.55, pad: 22 });
      await this.wait(0.8);
      this.say(0);
    }
    this.boy.look = null;
    this.direct();
    const love = [{ x: this.hugger.x, y: -30, r: 40, done: false }, { x: this.waterer.x + 16, y: -28, r: 40, done: false }];
    for (let n = 0; n < 2; n++) {
      const i = await this.tapAny(love, { text: T.love });
      love[i].done = true;
      this.loveTree(i);
      await this.wait(0.35);
    }
    this.toy = true;
    await this.wait(0.7);
    await this.arrive();

    const L = this.leap;
    await L.reach(this.pA1);
    await this.say(1);                                                  // …enormously tall and wonderfully wide.
    await L.reach(this.pA2);
    await this.say(2);                                                  // People love to sling hammocks up there…
    this.expectText = T.hammock;
    await L.reach(this.pHam);
    await this.bounce();

    await this.say(3);                                                  // …little libraries — bags full of books…
    const bagT = this.bags.map((b) => ({ x: b.x, y: b.y + 22, r: 30, done: false }));
    const readers = ['boy', 'kit', 'papa'];
    for (let n = 0; n < 3; n++) {
      const i = await this.tapAny(bagT, { text: T.bags, slop: 1.25 });
      bagT[i].done = true;
      this.openBag(this.bags[i], readers[n], n);
      await this.wait(0.25);
    }
    await this.until(() => this.books.length === 3 && this.books.every((b) => b.open));
    await this.wait(1.1);

    await this.say(4);                                                  // All sorts of beautiful birds live in the trees…
    const p = this.papa, k = this.kit, boy = this.boy;
    const tip = this.branchPt(this.bBag, 0.97), tipA = this.branchPt(this.bA3, 0.95);
    const BK = { x: 0, y: 0 }, HT = { x: 0, y: 0 };
    // where each one perches: on papa's back, on the kitten's head (both follow the cat), at the tip of the
    // bag branch, at the tip of the reader's branch
    const spots = [
      { at: () => { p.anchor('headTop', BK); BK.y += 1; return BK; }, d: -1, on: true },     // (he sits facing us: on his head, not his chest)
      { at: () => { k.anchor('headTop', HT); HT.y += 1; return HT; }, d: -1, on: true },
      { at: () => tip, d: 1 }, { at: () => tipA, d: -1 }];
    const cols = ['red', 'blue', 'green', 'yellow'];   // (the one that goes to the reader's shoulder is green: his shirt is yellow)
    for (let i = 0; i < 4; i++) {
      const s = spots[i], q = s.at(), b = new Bird({ color: cols[i], size: 0.9, x: q.x + (i % 2 ? 460 : -460), y: q.y - 300 - i * 30, speed: 300 });
      this.birds.push(b);
      this.audio.sfx.flutter(i % 2 ? 0.6 : -0.6);
      if (i === 0) p.look = { x: b.x, y: b.y };
      b.flyTo(q.x, q.y, () => {
        b.dir = s.d; b.chirp(); this.audio.sfx.chirp(this.pan(b.x));
        if (s.on) b.stick = s.at;
        if (i === 0) { p.look = null; p.act('slowblink'); }
        if (i === 1) { k.eyes = 'wide'; k.look = { x: k.x - 4, y: k.y - 90 }; this.spawn(async () => { await this.wait(1.1); k.eyes = 'happy'; k.look = null; }); }
      });
      await this.wait(0.4);
    }
    // everyone looks up as they come
    boy.look = { x: tip.x, y: tip.y - 30 };
    await this.until(() => this.birds.every((b) => b.state === 'perch'));
    boy.look = null;
    this.audio.sfx.purr(1.6); p.eyes = 'happy';
    const bt = this.birds.map((b) => ({ get x() { return b.x; }, get y() { return b.y - 10; }, r: 32, done: false }));
    for (let n = 0; n < 4; n++) {
      const i = await this.tapAny(bt, { text: T.birds });
      bt[i].done = true;
      this.sing(this.birds[i], n * 2);
      this.hearts(this.birds[i].x, this.birds[i].y - 26, 2);
    }
    await this.wait(0.8);

    await this.say(5);                                                  // They love to flutter down to the people who sit reading…
    p.eyes = 'open'; k.eyes = 'open';
    // two of them flutter down to the reader himself: one onto his book, one onto his shoulder
    const feed = [null, { at: () => this.bookCorner(), d: 1 }, { at: () => this.shoulder(), d: 1 }, null];
    this.camPhase = 'feed'; this.direct({ ground: false, max: 2, pad: 18 });
    this.birds.forEach((b, i) => {
      const s = feed[i]; b.fed = false; b.speed = 200;
      if (!s) { b.chirp(); return; }
      b.stick = null;
      const q = s.at();
      this.audio.sfx.flutter(this.pan(b.x));
      b.flyTo(q.x, q.y, () => { b.dir = s.d; b.chirp(); b.stick = s.at; b.behind = i === 2; this.audio.sfx.chirp(this.pan(b.x)); if (i === 1) { boy.look = b; this.audio.sfx.giggle(this.pan(boy.x)); } });
    });
    await this.until(() => this.birds.every((b) => b.state === 'perch'));
    this.audio.sfx.pop(); this.tinOpen = true;
    for (let n = 0; n < 4; n++) {
      const bis = { x: this.tin.x + 2, y: this.tin.y - 22, r: 34, s: 0 };
      this.biscuit = bis;
      this.spawn(() => this.tween(bis, { s: 1 }, 0.25, ease.outBack));
      await this.dragTo(bis, () => this.hungry(bis), { text: T.feed, onGrab: () => this.audio.sfx.tick() });
      const h = this.hungry(bis);
      this.biscuit = null;
      if (h) this.feed(h.bird, n);
      await this.wait(0.4);
    }
    await this.wait(0.5);
    await this.chorus();
    // closing: back off a little and slowly, the whole little library in its crown — reader, bags, cats
    if (this.directing) this.spawn(() => this.shot({ l: this.boy.x - 60, r: this.kit.x + 40, t: this.bags[0].y - 46, b: this.bL1.y + 16 }, 4.5, { max: 1.55 }));
    await this.next();
  }

  pan(x) { return clamp(((x - this.cam.x) / Math.max(1, this.view.width)) * 1.6, -0.8, 0.8); }

  // where a bird can stand on the reader: the outer top corner of his open book, his far shoulder
  bookCorner() {
    const a = this.boy.anchor('handL'), b = this.boy.anchor('handR'), o = this._bk || (this._bk = { x: 0, y: 0 });
    o.x = Math.max(a.x * this.boy.dir, b.x * this.boy.dir) * this.boy.dir + 7 * this.boy.dir; o.y = Math.max(a.y, b.y) + 1;     // (the outer lower corner, facing out: below his chin and clear of his face)
    return o;
  }
  shoulder() {
    const hd = this.boy.anchor('head'), o = this._sh || (this._sh = { x: 0, y: 0 });
    o.x = hd.x - 21 * this.boy.dir; o.y = hd.y + 19;           // (behind his back, peeking over the shoulder: drawn before him)
    return o;
  }

  // B0: a hug for the tree / water for the sapling
  loveTree(i) {
    if (i === 0) {
      const h = this.hugger, id = ++this._hugId;
      h.mood = 'hug'; h.look = null; h.joy.v += 9; this.hugTree = 1;
      this.hearts(h.x - 14, -52, 4);
      this.audio.sfx.rustle(-0.3); this.audio.chordNote(0, { vel: 0.6 }); this.audio.chordNote(2, { vel: 0.5, when: this.audio.now + 0.12 });
      this.fx.burst('leaf', GA.x + 30, this.view.free + 60, 9, { speed: 60, a0: 0, a1: Math.PI, life: 3, size: 6, colors: ['#5cc94a', '#27a035', '#8fe06a'], grav: 90, drag: 1.2, sway: 30, spread: 160 });
      // a long hug, then she leans back and looks up her tree again
      this.spawn(async () => { await this.wait(3.4); if (id !== this._hugId) return; h.mood = 'wait'; h.look = this.camPhase === 'climb' ? null : { x: GA.x + 30, y: -420 }; });
    } else {
      const w = this.waterer;
      this.pour = 1.3; w.look = { x: this.sapling.x, y: -10 };
      this.audio.sfx.plip(0); this.audio.scaleNote(2 + Math.floor(this.sapling.grow * 6), { inst: 'pluck', vel: 0.55 });
      this.spawn(async () => {
        await this.wait(0.35);
        await this.tween(this.sapling, { grow: Math.min(1, this.sapling.grow + 0.25) }, 0.6, ease.outBack);
        this.sapling.land(0.8); this.sparkle(this.sapling.x, -60, 6, '#b6e04a'); this.audio.sfx.sparkle();
        await this.wait(0.45); w.look = { x: this.sapling.x, y: -60 }; w.act('nod');
        await this.wait(1.2); w.look = { x: 8, y: -24 };
      });
    }
  }

  // a cat walks to x at a walking pace (speeding up and slowing down; the gait follows the distance moved)
  walkTo(c, x, speed, steps) {
    c.wake(); c.mode = 'stand'; c.dir = x > c.x ? 1 : -1; c.walking = 1;
    let v = 0, acc = 0;
    const a = speed * 2.2;
    return this.frames((dt) => {
      const d = x - c.x, rem = Math.abs(d);
      v = Math.min(speed, v + a * dt, Math.sqrt(2 * a * rem) + 6);
      const st = Math.min(rem, v * dt);
      c.x += Math.sign(d) * st;
      if (steps) { acc += st; if (acc > steps) { acc = 0; this.audio.sfx.step(this.pan(c.x)); } }
      if (rem - st < 0.5) { c.x = x; c.walking = 0; return true; }
      return false;
    });
  }

  // the cats come walking down the street from the right, papa hops up on the bench, the kitten sits by the sapling
  async arrive() {
    const p = this.papa, k = this.kit;
    this.camPhase = 'arrive';
    await this.wait(0.9);
    p.hidden = k.hidden = false;
    // the kitten runs ahead, stops, looks back and waits for papa; he never has to pass it
    p.x = Math.max(250, this.view.right + 60); k.x = p.x - 48; p.y = k.y = 0;
    p.dir = k.dir = -1;
    this.hugger.look = this.waterer.look = { x: k.x, y: -24 };
    const kitGo = (async () => {
      await this.walkTo(k, 116, 96, 0);
      k.dir = 1; k.look = p; k.act('tilt');                              // (turns round: where are you?)
      await Promise.all([this.wait(0.8), this.until(() => p.x < 262)]);  // …and waits a moment, until papa has come close
      k.look = null;
      await this.walkTo(k, KIT_X, 84, 0);
    })();
    this.spawn(async () => { await this.wait(1.2); this.hugger.look = this.waterer.look = { x: p.x, y: -30 }; });
    await this.walkTo(p, 156, 66, 24);
    this.hugger.look = this.waterer.look = null;
    // a look at the bench, then the hop
    p.look = { x: this.pBench.x, y: this.pBench.y - 8 };
    await this.wait(0.4);
    p.look = null;
    this.audio.sfx.hop(); p.leapTo(this.pBench.x, this.pBench.y, { done: () => { this.audio.sfx.land(0, true); } });
    await kitGo;
    k.dir = -1; k.mode = 'sit'; k.look = { x: p.x, y: p.y - 30 };
    k.meow(); this.audio.sfx.meow(true);
    await this.until(() => !p.jump);
    p.dir = -1;
    await this.wait(0.3);
    k.look = null; k.mode = 'stand';
    this.camPhase = 'climb';
    this.leap = new Leap(this, {
      cat: p, perches: [this.pBench, this.pA1, this.pB1, this.pA2, this.pHam, this.pL1], start: this.pBench,
      flies: [{ x: 26, y: -268 }, { x: 30, y: -410 }, { x: 28, y: -545 }, { x: 20, y: -676 }, { x: 88, y: -800 }],
      onLeap: (q) => { this._dest = q; },
      onLand: (q) => {
        this._dest = null;
        if (q.kind === 'branch') this.leaves(q.x + q.owner.side * 30, q.y - 6, 5, ['#5cc94a', '#27a035', '#8fe06a']);
        if (q === this.pHam) { this.leap.enabled = false; this.sleeper.mood = 'happy'; this.audio.sfx.thump(); }
      }
    });
    this.kitF = this.leap.addFollower(k, Perch.point(KIT_X, 0), {
      onLand: (q) => { if (q.kind === 'branch') this.leaves(q.x, q.y - 4, 3, ['#5cc94a', '#27a035']); if (q === this.pHam) { this.kitOnHam = true; this.audio.sfx.thump(); } }
    });
    this.focusY = null;
  }

  // the hammock throws the cats up into the crown
  async bounce() {
    const L = this.leap, p = this.papa, k = this.kit, sl = this.sleeper;
    this.zzz(sl.x + 26, sl.y - 30);
    p.look = { x: this.pL1.x, y: this.pL1.y - 20 };                     // (a look up at where the hammock will throw it)
    await this.wait(0.42);
    p.look = null;
    this.ham.sag.v -= 260;
    this.audio.sfx.whoosh(0.5); this.audio.sfx.rise();
    this.birdSpots = [this.branchPt(this.bBag, 0.97), this.branchPt(this.bA3, 0.95)];   // (the library's frame holds the birds' perches from the start)
    this.camPhase = 'library'; this.direct({ ground: false, max: 1.9, pad: 18, zoomIn: 0.6 });
    await L.go(this.pL1);
    p.dir = -1;
    this.boy.mood = 'wave'; this.boy.look = { x: p.x, y: p.y - 24 }; this.audio.sfx.giggle(this.pan(this.boy.x));
    await this.until(() => this.kitOnHam);
    await this.wait(0.42);
    L.removeFollower(k);
    this.ham.sag.v -= 200;
    this.audio.sfx.whoosh(0.45);
    const spot = this.branchPt(this.bL1, 0.3);
    await new Promise((res) => k.leapTo(spot.x, spot.y, { done: res }));
    this.bL1.land(0.6); this.audio.sfx.land(0.2, true); this.audio.playerNote({ octave: 1 });
    k.dir = -1; k.mode = 'sit'; k.eyes = 'happy'; k.look = { x: this.boy.x, y: this.boy.y - 30 };
    this.kitSpot = 0.3;
    p.mode = 'sit';
    await this.wait(0.3);
    sl.mood = 'sleep';                                                   // (the sleeper smiles and drifts off again)
    this.spawn(async () => { await this.wait(1.4); k.eyes = 'open'; k.look = null; this.boy.mood = 'wait'; this.boy.look = { x: this.bags[1].x, y: this.bags[1].y }; });
  }

  // B3: a book flutters out of the bag to one of the readers
  openBag(bag, who, n) {
    bag.open = true; bag.sw.v += 4;
    this.audio.sfx.swish(this.pan(bag.x)); this.audio.chordNote(n, { vel: 0.7 });
    const p = this.papa, k = this.kit, boy = this.boy;
    const to = who === 'boy' ? { x: boy.x + 6, y: boy.y - 19, s: 0.9 } : who === 'kit' ? { x: k.x - 30, y: k.y - 5, s: 0.82 } : { x: p.x - 46, y: p.y - 6, s: 1.05 };
    const bk = { x: bag.x, y: bag.y + 22, rot: 0, open: 0, color: bag.color, s: 0.7, who, flap: 0, gone: false };
    this.books.push(bk);
    const reader = who === 'boy' ? boy : who === 'kit' ? k : p;
    reader.look = bk;                                                    // (the reader watches it come)
    if (who !== 'boy') reader.wake();
    const from = [bk.x, bk.y], mid = [(bk.x + to.x) / 2 + (n - 1) * 30, Math.min(bk.y, to.y) - 70];
    const st = { u: 0 };
    this.spawn(async () => {
      await this.frames((dt) => {
        st.u = Math.min(1, st.u + dt / 0.95);
        const q = qbez(from, mid, [to.x, to.y], ease.inOutQuad(st.u));
        bk.x = q[0]; bk.y = q[1]; bk.rot = Math.sin(st.u * 9) * 0.5 * (1 - st.u); bk.s = lerp(0.7, to.s, st.u); bk.flap = st.u;
        if (Math.random() < dt * 14) this.fx.add({ kind: 'petal', x: bk.x, y: bk.y, vx: (Math.random() - 0.5) * 40, vy: 20, life: 0.9, size: 3.4, color: '#fbf8ec', vr: 6, sway: 16 });
        return st.u >= 1;
      });
      bk.open = 1; bk.rot = 0;
      this.audio.sfx.pop(this.pan(bk.x)); this.audio.scaleNote(4 + n * 2, { inst: 'box', vel: 0.6 });
      this.sparkle(bk.x, bk.y - 12, 6);
      if (who === 'boy') {
        // he catches it: from now on the open book is in his own hands
        bk.gone = true; boy.k.book = bag.color; boy.mood = 'read'; boy.look = null;
        this.audio.sfx.paper(this.pan(boy.x));
      } else if (who === 'kit') {
        k.eyes = 'wide'; k.mode = 'sit'; k.look = { x: bk.x, y: bk.y - 4 };
        this.spawn(async () => { await this.wait(1); k.eyes = 'open'; });
      } else {
        p.mode = 'sit'; p.eyes = 'happy'; p.look = { x: bk.x, y: bk.y - 4 };
        this.spawn(async () => { await this.wait(1.4); p.eyes = 'open'; });
      }
    });
  }

  sing(b, i) {
    b.chirp(); this.audio.sfx.chirp(this.pan(b.x));
    this.audio.scaleNote(5 + i, { inst: 'flute', vel: 0.7, dur: 0.35 });
    this.notes(b.x + 9 * b.dir, b.y - 32 * b.size, 1, '#fff7c0');
  }
  hungry(bis) {
    // (while the biscuit still lies on the tin the hint picks a bird a little way off — a real journey — not the one beside it)
    const home = dist(bis.x, bis.y, this.tin.x + 2, this.tin.y - 22) < 8;
    let best = null, bd = 1e9;
    for (const b of this.birds) { if (b.fed) continue; let d = dist(bis.x, bis.y, b.x, b.y - 10); if (home && d < 30) d += 500; if (d < bd) { bd = d; best = b; } }
    return best ? { x: best.x + 18 * best.dir * best.size, y: best.y - 10, r: 46, bird: best } : null;
  }
  feed(b, n) {
    b.fed = true; b.peck = 0.9;
    this.audio.sfx.plip(this.pan(b.x));
    this.fx.burst('crumb', b.x + 18 * b.dir * b.size, b.y - 6, 8, { speed: 60, life: 0.8, size: 3, colors: ['#e8b866', '#c9903f'], grav: 300, drag: 1 });
    this.hearts(b.x, b.y - 30, 2);
    if (Math.abs(b.x - this.boy.x) < 40) { this.boy.look = b; this.audio.sfx.giggle(this.pan(b.x)); }
    this.spawn(async () => { await this.wait(0.55); this.sing(b, n * 2 + 1); });
  }
  // everybody fed: the birds sing the lullaby together
  async chorus() {
    const tune = [[73, 3], [76, 3], [78, 2], [76, 1], [73, 3], [71, 3], [73, 2], [71, 1], [69, 6]], step = 0.2;
    this.boy.look = null; this.kit.eyes = 'happy'; this.papa.eyes = 'happy';
    this.kit.look = null; this.papa.look = null;
    this.audio.sfx.purr(2.4);
    for (let i = 0; i < tune.length; i++) {
      const b = this.birds[i % this.birds.length], n = tune[i];
      b.chirp(); this.notes(b.x + 9 * b.dir, b.y - 32 * b.size, 1, ['#fff7c0', '#ffd0e0', '#c9e8ff'][i % 3]);
      this.audio.flute(n[0], { vel: 0.8, dur: n[1] * step * 0.85, bus: this.audio.sfxBus, pan: this.pan(b.x) });
      if (i === tune.length - 1) { for (const o of this.birds) o.chirp(); this.audio.flute(n[0] + 4, { vel: 0.5, dur: 1, bus: this.audio.sfxBus }); this.audio.flute(n[0] + 7, { vel: 0.5, dur: 1, bus: this.audio.sfxBus }); }
      await this.wait(n[1] * step);
    }
    this.papa.act('slowblink');
    this.sparkle(this.boy.x + 20, this.boy.y - 70, 14);
  }

  // after the opening, the tree lovers stay touchable as a toy
  onDown(p) {
    if (this.toy && this.cam.y > -160) {
      if (dist(p.x, p.y, this.hugger.x, -30) < 44) { this.loveTree(0); return; }
      if (dist(p.x, p.y, this.waterer.x + 16, -28) < 44) { this.loveTree(1); return; }
    }
    if (dist(p.x, p.y, this.sleeper.x, this.sleeper.y - 8) < 40 && this.view.visible(this.sleeper.x)) { this.zzz(this.sleeper.x + 26, this.sleeper.y - 30); this.ham.sag.v += 60; this.audio.sfx.tick(); return; }
    super.onDown(p);
  }

  // ───────────── frame ─────────────
  tick(dt) {
    const p = this.papa;
    if (!this.directing) {                // (the old camera: only if the director's camera is not running)
      const fy = this.focusY === null ? p.y : this.focusY;
      this.cam.zoom = approach(this.cam.zoom, this.zoomGoal, 1.5, dt);
      let ty = Math.min(0, fy + 205 / this.cam.zoom);
      if (this.zoomGoal > 1) ty = Math.min(ty, -1012 + (this.view.oy - this.view.topInset - 58) / this.view.scale);
      this.cam.y = approach(this.cam.y, ty, 2.3, dt);
      this.cam.x = approach(this.cam.x, this.zoomGoal > 1 ? 26 : 30, 3, dt);
    }
    for (const b of this.branches) spring(b.sag, 0, dt, 170, 9);
    spring(this.ham.sag, 0, dt, 120, 6);
    for (const b of this.bags) spring(b.sw, 0, dt, 60, 4);
    for (const k of this.kids) k.update(dt);
    const sx = lerp(this.ham.xa, this.ham.xb, 0.4);
    this.sleeper.x = sx; this.sleeper.y = this.hamY(sx) + 1;
    const a3 = this.branchPt(this.bA3, 0.5); this.boy.x = a3.x; this.boy.y = a3.y;
    this.tin = this.branchPt(this.bA3, TIN_F);
    if (this.kitSpot && !this.kit.jump) { const s = this.branchPt(this.bL1, this.kitSpot); this.kit.x = s.x; this.kit.y = s.y; }
    // the can is tipped while he pours; the water comes out of the spout
    this.tip = approach(this.tip, this.pour > 0.15 ? 0.62 : 0.05, this.pour > 0.15 ? 6 : 3, dt);
    if (this.pour > 0) {
      this.pour -= dt;
      const sp = this.spout();
      if (this.tip > 0.4 && Math.random() < dt * 40) this.fx.add({ kind: 'drop', x: sp.x, y: sp.y, vx: 22 + Math.random() * 16, vy: 14, life: 0.5, size: 3, color: '#9fd4f5', grav: 420, drag: 0 });
    }
    if (this.hugTree > 0) this.hugTree -= dt * 1.2;
    this.hugK = approach(this.hugK, this.hugger.mood === 'hug' ? 1 : 0, 4, dt);
    this.hugger.x = lerp(HUG_X[0], HUG_X[1], ease.inOutSine(this.hugK));   // (she steps in and out: the trunk's edge slides over her, nothing pops)
    // up the tree the people on the ground watch the cats climb
    if (this.camPhase === 'climb' && this.hugger.mood !== 'hug') this.hugger.look = { x: p.x, y: p.y - 20 };
    // birds sitting on a cat or on the reader ride along with them
    for (const b of this.birds) if (b.stick && b.state === 'perch') { const q = b.stick(); b.x = approach(b.x, q.x, 14, dt); b.y = approach(b.y, q.y, 14, dt); }
    for (const bk of this.books) if (bk.gone) { const q = this.boy.anchor('hand'); bk.x = q.x - 6; bk.y = q.y - 4; }
    this.zz -= dt;
    if (this.zz < 0 && this.view.visible(this.sleeper.x) && this.sleeper.y > this.view.top && this.sleeper.y < this.view.bottom) { this.zz = 2.6; if (this.sleeper.mood !== 'happy') this.zzz(this.sleeper.x + 26, this.sleeper.y - 28); }
    // open books breathe out little pictures
    this.icons -= dt;
    if (this.icons < 0 && this.books.some((b) => b.open)) {
      this.icons = 0.5;
      const o = this.books.filter((b) => b.open), b = o[Math.floor(Math.random() * o.length)];
      this.fx.add({ kind: ['star', 'heart', 'note', 'spark'][Math.floor(Math.random() * 4)], x: b.x + (Math.random() - 0.5) * 14, y: b.y - 12, vx: (Math.random() - 0.5) * 16, vy: -30, life: 1.8, size: 5.5, color: ['#ffe36e', '#f08aa0', '#fff7c0', '#9fd4f5'][Math.floor(Math.random() * 4)], sway: 12, drag: 0.4, vr: 1 });
    }
  }

  drawBranch(ctx, b) {
    const q = this.branchGeom(b), s = b.side, sag = b.sag.x, mx = (q.rx + q.tx) / 2, my = (q.ry + q.ty) / 2;
    wobble(ctx, [[q.rx, q.ry - 12], [mx, my - 9 + sag * 0.5], [q.tx, q.ty - 4 + sag], [q.tx + s * 6, q.ty + 1 + sag], [mx, my + 5 + sag * 0.5], [q.rx, q.ry + 12]], b.seed, 1.2);
    ctx.fillStyle = b.g.bark; ctx.fill(); ink(ctx, 4.2);
    if (b.tuft) {
      const sp = tuftSprite(b.seed, 30), w = wind(q.tx, this.t);
      ctx.save(); ctx.translate(q.tx + s * 16, q.ty - 16 + sag); ctx.rotate(w * 0.05); ctx.scale(1 + w * 0.02, 1 - w * 0.02);
      ctx.drawImage(sp.c, -sp.w / 2, -sp.h / 2, sp.w, sp.h); ctx.restore();
    }
  }
  drawHammock(ctx, t) {
    const h = this.ham, n = 20, u0 = 0.1, u1 = 0.9, ya = h.y;
    const X = (u) => lerp(h.xa, h.xb, u), Y = (u) => this.hamY(X(u));
    // ropes
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.beginPath();
    for (const [ux, ex] of [[u0, h.xa], [u1, h.xb]]) for (const dy of [-3, 5, 12]) { ctx.moveTo(ex, ya - 2); ctx.lineTo(X(ux), Y(ux) + dy * 0.7); }
    ctx.stroke();
    this.sleeper.drawFull(ctx, t);
    // book tent on the sleeper's tummy
    drawBook(ctx, this.sleeper.x - 8, this.sleeper.y - 16, 0.1, 1, '#e2553f', 0.7);
    const top = [], bot = [];
    for (let i = 0; i <= n; i++) { const v = i / n, u = lerp(u0, u1, v), x = X(u), y = Y(u); top.push([x, y - 2]); bot.push([x, y + 5 + 13 * Math.sin(Math.PI * v)]); }
    for (let i = 0; i < n; i++) {
      ctx.beginPath(); ctx.moveTo(top[i][0], top[i][1]); ctx.lineTo(top[i + 1][0], top[i + 1][1]); ctx.lineTo(bot[i + 1][0], bot[i + 1][1]); ctx.lineTo(bot[i][0], bot[i][1]); ctx.closePath();
      ctx.fillStyle = i % 2 ? '#7f9ee0' : '#f6f7fb'; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); for (const q of top) ctx.lineTo(q[0], q[1]); ink(ctx, 3.4);
    ctx.beginPath(); ctx.moveTo(bot[0][0], bot[0][1]); for (const q of bot) ctx.lineTo(q[0], q[1]); ink(ctx, 3.4);
    ctx.beginPath(); ctx.moveTo(top[0][0], top[0][1]); ctx.lineTo(bot[0][0], bot[0][1]); ctx.moveTo(top[n][0], top[n][1]); ctx.lineTo(bot[n][0], bot[n][1]); ink(ctx, 3);
  }
  // somebody knitted the old tree a scarf, and hung a birdhouse where the birds like it
  drawLove(ctx, t) {
    const g = GB, y0 = -150, bands = ['#f08ab0', '#f3dc86', '#8fbdf5', '#fbf3dc'];
    const sw = Math.sin(t * 1.1) * 3;
    wobblyPoly(ctx, [[edge(g, y0 - 14, 1) - 2, y0 - 20], [edge(g, y0 - 14, 1) + 13, y0 - 16], [edge(g, y0, 1) + 15 + sw, y0 + 26], [edge(g, y0, 1) + 3 + sw, y0 + 28]], 41, 0.8, 30);
    ctx.fillStyle = '#f08ab0'; ctx.fill(); ink(ctx, 2.6);
    for (let i = 0; i < 4; i++) {
      const ya = y0 - i * 9, yb = ya - 9;
      ctx.beginPath(); ctx.moveTo(edge(g, ya, -1) - 4, ya); ctx.lineTo(edge(g, ya, 1) + 4, ya); ctx.lineTo(edge(g, yb, 1) + 4, yb); ctx.lineTo(edge(g, yb, -1) - 4, yb); ctx.closePath();
      ctx.fillStyle = bands[i]; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(edge(g, y0, -1) - 4, y0); ctx.lineTo(edge(g, y0, 1) + 4, y0); ctx.lineTo(edge(g, y0 - 36, 1) + 4, y0 - 36); ctx.lineTo(edge(g, y0 - 36, -1) - 4, y0 - 36); ctx.closePath(); ink(ctx, 3);
    ctx.strokeStyle = 'rgba(29,21,48,0.2)'; ctx.lineWidth = 1.4; ctx.beginPath();
    for (let x = edge(g, y0, -1); x < edge(g, y0, 1); x += 9) { ctx.moveTo(x, y0 - 2); ctx.lineTo(x + 4, y0 - 34); }
    ctx.stroke();
    // birdhouse on a low branch
    const b = this.branches[6], q = this.branchPt(b, 0.62), bx = q.x, by = q.y + 20, r = Math.sin(t * 1.3) * 0.05;
    ctx.save(); ctx.translate(bx, by); ctx.rotate(r);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, 12); ctx.stroke();
    wobblyPoly(ctx, [[-13, 36], [-13, 18], [13, 18], [13, 36]], 43, 0.6, 30); ctx.fillStyle = '#f3dc86'; ctx.fill(); ink(ctx, 2.6);
    wobblyPoly(ctx, [[-17, 19], [0, 6], [17, 19]], 44, 0.6, 30); ctx.fillStyle = '#d9483b'; ctx.fill(); ink(ctx, 2.6);
    ctx.fillStyle = '#3a2618'; ctx.beginPath(); ctx.arc(0, 26, 4.6, 0, TAU); ctx.fill();
    tube(ctx, [[-5, 33], [5, 33]], 2, '#8a5a2b', INK, 1.6);
    ctx.restore();
  }
  // the trunk's outline in world coordinates: exactly the path it is painted with (wobblyPoly is seeded, so it repeats)
  trunkPath(ctx, g) { wobblyPoly(ctx, trunkPts(g), g.seed, 2.2, 110); }
  // …and, added to it, the rest of the world + the part above y0 with the opposite winding: as a nonzero clip that is
  // "outside the trunk, or above y0" (trunk +1 clockwise; world −1 and top band −1 counter-clockwise)
  // (and below y1: her legs stand in front of the spreading roots)
  outsideClip(ctx, y0, y1) {
    const B = 1e5;
    ctx.moveTo(-B, -B); ctx.lineTo(-B, B); ctx.lineTo(B, B); ctx.lineTo(B, -B); ctx.closePath();
    ctx.moveTo(-B, -B); ctx.lineTo(-B, y0); ctx.lineTo(B, y0); ctx.lineTo(B, -B); ctx.closePath();
    ctx.moveTo(-B, y1); ctx.lineTo(-B, B); ctx.lineTo(B, B); ctx.lineTo(B, y1); ctx.closePath();
  }
  // the end of the spout in the world (the can hangs from the hand by its handle, tipped by this.tip)
  spout() {
    const k = this.waterer, h = k.anchor('hand'), c = Math.cos(this.tip * k.dir), s = Math.sin(this.tip * k.dir), lx = (CAN_X + 21) * k.dir, ly = CAN_Y - 10;
    this._spout.x = h.x + lx * c - ly * s; this._spout.y = h.y + lx * s + ly * c;
    return this._spout;
  }
  drawCan(ctx, t) {
    const k = this.waterer, h = k.anchor('hand');
    ctx.save(); ctx.translate(h.x, h.y); ctx.rotate(this.tip * k.dir); ctx.scale(k.dir, 1); ctx.translate(CAN_X, CAN_Y);
    tube(ctx, [[8, -4], [20, -10]], 3.2, '#7fa6d8', INK, 2.4);
    wobblyPoly(ctx, [[-8, -9], [8, -9], [10, 7], [-10, 7]], 21, 0.5, 30); ctx.fillStyle = '#7fa6d8'; ctx.fill(); ink(ctx, 2.4);
    ctx.beginPath(); ctx.arc(-9, -2, 7, Math.PI * 0.5, Math.PI * 1.5); ink(ctx, 2.6, '#5f86c0');
    ctx.restore();
  }

  draw(ctx, view, t) {
    const sky = this.sky, cy = this.cam.y, high = clamp01(-cy / 260);
    drawSkyAll(ctx, view, sky, this.farSeed, { spray: '#ffffff', light: 0.4, dark: 0 });
    const sk = this.farK();
    for (const c of this.clouds) {                // (far away: the same size on the screen at any zoom — scaled, not re-sized)
      const x = view.left + view.width * c.u + Math.sin(t * 0.05 + c.seed) * 30 * sk, y = view.top + c.y * sk;
      if (sk === 1) drawCloud(ctx, x, y, c.w, c.seed, '#ffffff', 0.8);
      else { ctx.save(); ctx.translate(x, y); ctx.scale(sk, sk); drawCloud(ctx, 0, 0, c.w, c.seed, '#ffffff', 0.8); ctx.restore(); }
    }
    for (const c of this.skyClouds) { const x = c.x + this.cam.x * 0.5 + Math.sin(t * 0.04 + c.s) * 40, y = c.y - cy * 0.25; if (y > view.top - 120 && y < view.bottom + 120) drawCloud(ctx, x, y, c.w, c.s, '#ffffff', 0.92); }
    // the land spreads out below as we climb
    const base = cy - clamp(-cy * 0.2, 0, 118);
    if (high > 0.01) {
      const g = ctx.createLinearGradient(0, base, 0, base + 420);
      g.addColorStop(0, '#bfe6c2'); g.addColorStop(0.35, '#8fd88a'); g.addColorStop(1, '#58c44a');
      ctx.fillStyle = g; ctx.fillRect(view.left - 10, base, view.width + 20, Math.max(10, view.bottom - base + 20));
      const s = farLand(), W = 1400, off = this.cam.x * 0.85;
      ctx.save(); ctx.globalAlpha = high;
      for (let x = Math.floor((view.left - off) / W) * W + off; x < view.right; x += W) ctx.drawImage(s.c, x, base - 52, W, 240);
      ctx.restore();
    }
    if (high < 0.99) drawFarTown(ctx, view, this.farSeed, sky.mid, 0.5 * (1 - high), 0.3, Math.min(0, base + 40));
    if (view.bottom > -30) drawGround(ctx, view, sky, { t });
    for (const h of this.houses) if (view.visible(h.x, h.w + 80) && view.bottom > -h.h - 120) h.draw(ctx, t);
    if (view.bottom > -80) { drawBush(ctx, -330, 0, 34, 85, '#f2c23a'); drawBush(ctx, 388, 0, 38, 86, '#f08ab0'); }
    // the avenue of giants
    for (const g of SIDE) if (view.visible(g.x, g.cr + 60)) { drawTrunk(ctx, g); const s = crownSprite(g); if (g.cy + s.h / 2 > view.top) ctx.drawImage(s.c, g.x - s.w / 2, g.cy - s.h / 2, s.w, s.h); }
    for (const b of this.branches) { const q = this.branchGeom(b); if (q.ry < view.bottom + 60 && q.ry > view.top - 60) this.drawBranch(ctx, b); }
    for (const g of [GA, GB]) drawTrunk(ctx, g);
    if (view.bottom > -30) drawGrassFront(ctx, view, sky, { t });
    if (view.bottom > -360) this.drawLove(ctx, t);
    // the hollow with eyes (as on the cover) watches the cats go by
    if (view.bottom > -330 && view.top < -230) {
      const hx = GA.x + 4, hy = -280;
      ctx.fillStyle = '#17101f'; ctx.beginPath(); ctx.ellipse(hx, hy, 17, 22, 0, 0, TAU); ctx.fill();
      if ((t % 4.2) > 0.14) {
        const c = this.papa, dx = c.x - hx, dy = c.y - 30 - hy, d = Math.hypot(dx, dy) || 1;
        for (const sd of [-1, 1]) {
          ctx.fillStyle = '#f6f3ea'; ctx.beginPath(); ctx.arc(hx + sd * 6.5, hy - 2, 5, 0, TAU); ctx.fill();
          ctx.fillStyle = '#17101f'; ctx.beginPath(); ctx.arc(hx + sd * 6.5 + (dx / d) * 2.4, hy - 2 + (dy / d) * 2.4, 2.3, 0, TAU); ctx.fill();
        }
      }
    }
    for (const g of [GA, GB]) {
      const s = crownSprite(g);
      if (g.cy + s.h / 2 < view.top) continue;
      const sw = this.reduced ? 0 : Math.sin(t * 0.5 + g.seed) * 0.006 + (g === GA && this.hugTree > 0 ? Math.sin(t * 30) * 0.004 * this.hugTree : 0);
      ctx.save(); ctx.translate(g.x, -g.top); ctx.rotate(sw); ctx.drawImage(s.c, -s.w / 2, g.cy + g.top - s.h / 2, s.w, s.h); ctx.restore();
    }
    // hammock + sleeper
    if (view.bottom > this.ham.y - 40 && view.top < this.ham.y + 140) this.drawHammock(ctx, t);
    // ground: bench, sapling, the people
    if (view.bottom > -120) {
      drawBench(ctx, 104, 0);
      this.sapling.draw(ctx, t);
      const hg = this.hugger, hugging = this.hugK > 0.01, lean = () => { ctx.translate(hg.x, 0); ctx.rotate(-0.08 * this.hugK); ctx.translate(-hg.x, 0); };
      // hugging: her far half goes behind the trunk — the figure (but not the arms in front, and not her head) is simply not drawn
      // inside the trunk's own outline, so the bark and its ink edge run on unbroken; then her arms round it
      ctx.save();
      if (hugging) { this.trunkPath(ctx, GA); this.outsideClip(ctx, hg.anchor('head').y + 10, HUG_LEGS); ctx.clip(); }
      lean(); hg.drawFull(ctx, t, hugging ? 'body' : undefined); ctx.restore();
      if (hugging) {
        // (her body overlapped the outer half of the trunk's ink line: draw that stretch of the line again, then the arms)
        const y0 = hg.anchor('head').y + 10;
        ctx.save(); ctx.beginPath(); ctx.rect(hg.x - 40, y0, 80, HUG_LEGS - y0); ctx.clip(); this.trunkPath(ctx, GA); ink(ctx, 5); ctx.restore();
        ctx.save(); lean(); hg.drawFull(ctx, t, 'arms'); ctx.restore();
      }
      this.waterer.drawFull(ctx, t);
      this.drawCan(ctx, t);
    }
    // library level: bags, the reader, his biscuit tin
    if (view.top < -820) {
      for (const b of this.bags) { ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.sw.x * 0.12); ctx.scale(1.4, 1.4); drawBag(ctx, 0, 0, b.color, t + b.x); ctx.restore(); }
      for (const b of this.birds) if (b.behind) b.draw(ctx, t);          // (the bird on his far shoulder is behind him)
      this.boy.drawFull(ctx, t);
      const tn = this.tin;
      ctx.save(); ctx.translate(tn.x, tn.y);
      wobblyPoly(ctx, [[-13, 0], [-12, -17], [12, -17], [13, 0]], 31, 0.6, 40); ctx.fillStyle = '#d9483b'; ctx.fill(); ink(ctx, 2.6);
      ctx.fillStyle = '#fbf8ec'; ctx.fillRect(-7, -12, 14, 6);
      if (this.tinOpen) { drawBiscuit(ctx, -4, -19, 0.8); drawBiscuit(ctx, 5, -20, 0.8); }
      else { wobblyPoly(ctx, [[-14, -17], [14, -17], [13, -22], [-13, -22]], 32, 0.5, 40); ctx.fillStyle = '#b8352a'; ctx.fill(); ink(ctx, 2.4); }
      ctx.restore();
    }
    this.fx.draw(ctx, t, -1);
    for (const c of this.cats) c.draw(ctx, t);
    for (const bk of this.books) if (!bk.gone) drawBook(ctx, bk.x, bk.y, bk.rot, bk.open, bk.color, bk.s);
    for (const b of this.birds) if (!b.behind || view.top >= -820) b.draw(ctx, t);
    if (this.biscuit) { glow(ctx, this.biscuit.x, this.biscuit.y, 26, '#fff3a0', 0.5); drawBiscuit(ctx, this.biscuit.x, this.biscuit.y, 1.25 * this.biscuit.s); }
    if (this.leap) this.leap.draw(ctx, t);
    this.fx.draw(ctx, t, 0);
  }
}
