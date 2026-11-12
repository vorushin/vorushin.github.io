// Scene 8 — The world of clouds. Another dream: people live on the clouds, and whenever your
// cloud rains itself out you move house. The clouds wander in from the sea to the shore in the
// morning and out to sea again in the evening — and the views are simply wonderful.
import { Scene } from '../scene.js';
import { TAU, clamp, clamp01, lerp, ease, rng, hash, dist, approach, spring, mixHex, rgba } from '../util.js';
import { INK, PAL, SKIES, mixSky, ink, wobble, wobblyPoly, sprite, freeSprites, glow, crayonRings, chalk, drawSky, drawStars, makeStars, drawCloud, tube } from '../paint.js';
import { Kid } from '../actors.js';

const T = {
  knock: { en: 'Knock on the little house', de: 'Klopf an das Häuschen', ru: 'Постучи в домик' },
  move: { en: 'Carry the house over to a fresh cloud', de: 'Trag das Häuschen hinüber auf eine frische Wolke', ru: 'Перенеси домик на свежее облако' },
  sun: { en: 'Carry the sun across the sky, over to the sea', de: 'Trag die Sonne über den Himmel bis hinüber zum Meer', ru: 'Проведи солнце по небу — к самому морю' },
  look: { en: 'Drag to look around', de: 'Zieh, um dich umzusehen', ru: 'Потяни, чтобы оглядеться' }
};

const HZ = -130;                                   // the horizon, seen from up here
const yOf = (d) => HZ + 14 + d * d * 260;          // depth 0 (horizon) … 1 (right below us) → y
const coastX = (d) => 70 - d * 230 + Math.sin(d * 9) * 14 * d;   // where the sea meets the land
const TW = 900, FH = 420;
const DOOR_X = -11, SEAT_X = 43;
const PAN_PX = 120, PAN_SWIPE = 110;                // the look-around: done after 120 screen px; the paw shows ±110 px                   // the boy's door and his seat at the edge, relative to the house

// ── the land far below (generated once, painted into tiles) ──
const VILLAGES = [[230, 0.72, 5], [430, 0.44, 11], [980, 0.3, 8], [1500, 0.52, 9], [2050, 0.36, 7]];   // x, depth, houses
let LAND = null;
function land() {
  if (LAND) return LAND;
  const r = rng(321), L = { fields: [], trees: [], huts: [], river: [] };
  const cols = ['#e9dc6a', '#6fb85a', '#b8e07a', '#d9c85a', '#8fd08a', '#f0e69a', '#5aa85a'];
  for (let k = 0; k < 210; k++) { const d = 0.07 + r() * 1.18; L.fields.push({ x: coastX(d) + 60 + r() * 2500, d, w: 50 + r() * 120, h: 9 + r() * 20, col: cols[Math.floor(r() * cols.length)], sk: (r() - 0.5) * 0.6 }); }
  L.fields.sort((a, b) => a.d - b.d);
  for (let k = 0; k < 56; k++) { const d = 0.06 + r() * 1.15, x = coastX(d) + 90 + r() * 2500, n = 3 + Math.floor(r() * 7); for (let i = 0; i < n; i++) L.trees.push({ x: x + (r() - 0.5) * 70, d: clamp(d + (r() - 0.5) * 0.06, 0.03, 1.25), s: 0.7 + r() * 0.7 }); }
  L.trees.sort((a, b) => a.d - b.d);
  for (const v of VILLAGES) for (let i = 0; i < v[2]; i++) L.huts.push({ x: v[0] + (r() - 0.5) * 120, d: clamp(v[1] + (r() - 0.5) * 0.09, 0.05, 1), church: i === 0, roof: r() < 0.75 ? '#d9483b' : '#d98a3a' });
  L.huts.sort((a, b) => a.d - b.d);
  for (let u = 0; u <= 1.001; u += 0.04) { const d = 0.03 + u * 0.6; L.river.push({ x: lerp(840, coastX(0.63) + 6, u) + Math.sin(u * 7) * 60 * (1 - u * 0.4), d }); }
  return (LAND = L);
}
function floorTile(i) {
  return sprite('cl-floor2:' + i, TW, FH, (c) => {
    const X0 = i * TW, L = land(), r = rng(500 + i * 7);
    const sg = c.createLinearGradient(0, 0, 0, FH);
    sg.addColorStop(0, '#b4e2ee'); sg.addColorStop(0.22, '#74c4da'); sg.addColorStop(1, '#3a95bc');
    c.fillStyle = sg; c.fillRect(0, 0, TW, FH);
    c.strokeStyle = 'rgba(255,255,255,0.55)'; c.lineCap = 'round';
    for (let k = 0; k < 110; k++) { const d = Math.sqrt(r()) * 1.25, y = 14 + d * d * 260, x = r() * TW, len = 5 + d * 22; c.lineWidth = 1 + d * 1.5; c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y); c.stroke(); }
    const pts = [];
    for (let d = 0; d <= 1.32; d += 0.04) pts.push([coastX(d) - X0, 14 + d * d * 260, d]);
    // land
    const lg = c.createLinearGradient(0, 0, 0, FH);
    lg.addColorStop(0, '#b7dba0'); lg.addColorStop(0.2, '#9bd472'); lg.addColorStop(1, '#78c058');
    c.fillStyle = lg; c.beginPath(); c.moveTo(pts[0][0], 0);
    for (const p of pts) c.lineTo(p[0], p[1]);
    c.lineTo(TW + 40, FH + 40); c.lineTo(TW + 40, 0); c.closePath(); c.fill();
    c.save(); c.clip();
    for (const f of L.fields) {
      const s = 0.28 + f.d * 0.95, x = f.x - X0, y = 14 + f.d * f.d * 260, w = f.w * s, h = f.h * s;
      if (x + w + 30 < 0 || x - 30 > TW) continue;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w + f.sk * h, y + h); c.lineTo(x + f.sk * h, y + h); c.closePath();
      c.fillStyle = f.col; c.globalAlpha = 0.85; c.fill(); c.globalAlpha = 1;
      c.strokeStyle = 'rgba(40,90,50,0.28)'; c.lineWidth = 1 + f.d; c.stroke();
      if (h > 7) {                                 // furrows
        c.strokeStyle = 'rgba(40,90,50,0.15)'; c.lineWidth = 0.6 + f.d * 0.8; c.beginPath();
        for (let q = 1; q < 4; q++) { const yy = y + (h * q) / 4, sx = f.sk * ((h * q) / 4); c.moveTo(x + sx + 2, yy); c.lineTo(x + w + sx - 2, yy); }
        c.stroke();
      }
    }
    // roads from village to village
    c.lineCap = 'round';
    for (let k = 0; k < VILLAGES.length - 1; k++) {
      const a = VILLAGES[k], b = VILLAGES[k + 1];
      for (let q = 0; q < 12; q++) {
        const u0 = q / 12, u1 = (q + 1) / 12, bend = (u) => Math.sin(u * Math.PI) * 40 * (k % 2 ? 1 : -1);
        const d0 = lerp(a[1], b[1], u0), d1 = lerp(a[1], b[1], u1);
        c.strokeStyle = 'rgba(250,240,205,0.85)'; c.lineWidth = 0.8 + d0 * 3.4;
        c.beginPath(); c.moveTo(lerp(a[0], b[0], u0) - X0 + bend(u0), 14 + d0 * d0 * 260); c.lineTo(lerp(a[0], b[0], u1) - X0 + bend(u1), 14 + d1 * d1 * 260); c.stroke();
      }
    }
    // the river
    c.lineJoin = 'round';
    for (let k = 0; k < L.river.length - 1; k++) { const a = L.river[k], b = L.river[k + 1]; c.strokeStyle = '#8fd6ea'; c.lineWidth = 2 + a.d * 16; c.beginPath(); c.moveTo(a.x - X0, 14 + a.d * a.d * 260); c.lineTo(b.x - X0, 14 + b.d * b.d * 260); c.stroke(); }
    for (const tr of L.trees) {
      const s = (0.3 + tr.d * 0.95) * tr.s, x = tr.x - X0, y = 14 + tr.d * tr.d * 260;
      if (x < -20 || x > TW + 20) continue;
      c.fillStyle = '#2f8a4a'; c.beginPath(); c.arc(x, y - 4 * s, 5.5 * s, 0, TAU); c.fill();
      c.fillStyle = 'rgba(120,200,110,0.7)'; c.beginPath(); c.arc(x - 1.5 * s, y - 5.5 * s, 2.6 * s, 0, TAU); c.fill();
    }
    for (const h of L.huts) {
      const s = 0.34 + h.d * 0.95, x = h.x - X0, y = 14 + h.d * h.d * 260;
      if (x < -30 || x > TW + 30) continue;
      const w = 9 * s, hh = (h.church ? 11 : 6) * s;
      c.fillStyle = '#fbfbf6'; c.fillRect(x - w / 2, y - hh, w, hh);
      c.fillStyle = h.roof; c.beginPath(); c.moveTo(x - w / 2 - s, y - hh); c.lineTo(x, y - hh - (h.church ? 12 : 5) * s); c.lineTo(x + w / 2 + s, y - hh); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(29,21,48,0.55)'; c.lineWidth = 0.9; c.strokeRect(x - w / 2, y - hh, w, hh);
    }
    c.restore();
    // beach + foam
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1]; c.strokeStyle = '#f6e7b0'; c.lineWidth = 5 + a[2] * 38; c.beginPath(); c.moveTo(a[0] + 2 + a[2] * 16, a[1]); c.lineTo(b[0] + 2 + b[2] * 16, b[1]); c.stroke(); }
    for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1]; c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = 1 + a[2] * 3.5; c.beginPath(); c.moveTo(a[0] - 2 - a[2] * 5, a[1]); c.lineTo(b[0] - 2 - b[2] * 5, b[1]); c.stroke(); }
  }, 1.25);
}

// ── clouds ──
function cloudSprite(seed, w, kind) {
  const W = w * 1.24, H = w * 0.66;
  return sprite('cl-cloud:' + seed + ':' + Math.round(w) + ':' + kind, W, H, (c) => {
    const r = rng(seed), cx = W / 2, cy = H * 0.6, n = 6, puffs = [];
    for (let i = 0; i < n; i++) { const u = i / (n - 1), rad = w * (0.115 + 0.105 * Math.sin(Math.PI * u) + r() * 0.03); puffs.push([cx + (u - 0.5) * w * 0.72, cy - rad * (0.4 + r() * 0.25), rad]); }
    const path = () => { c.beginPath(); for (const p of puffs) { c.moveTo(p[0] + p[2], p[1]); c.arc(p[0], p[1], p[2], 0, TAU); } c.moveTo(cx + w * 0.4, cy); c.ellipse(cx, cy, w * 0.4, w * 0.085, 0, 0, TAU); };
    const tone = { white: ['#ffffff', '#d3e2f5', '#8fb0dc'], grey: ['#b9c5da', '#8794b2', '#5f6f96'], pink: ['#ffe2cf', '#eea4bd', '#c9779e'] }[kind];
    path(); c.strokeStyle = tone[2]; c.lineWidth = 5; c.lineJoin = 'round'; c.stroke();
    const g = c.createLinearGradient(0, cy - w * 0.3, 0, cy + w * 0.09);
    g.addColorStop(0, tone[0]); g.addColorStop(0.55, tone[0]); g.addColorStop(1, tone[1]);
    path(); c.fillStyle = g; c.fill();
  }, 1.6);
}
class Cloud {
  constructor(o) {
    this.x = o.x; this.y = o.y; this.w = o.w || 200; this.seed = o.seed || 1;
    this.s = 1; this.a = o.a === undefined ? 1 : o.a; this.rain = 0; this.raining = false; this.leaving = false;
    this.snail = !!o.snail; this.follow = null; this.off = o.off || { x: 0, y: 0 }; this.spot = o.spot || 0;
    this.nb = o.nb || null;            // a neighbour's house: {wall, roof, kid, dx}
    this.gone = false; this.ph = (this.seed * 1.7) % TAU; this.bounce = { x: 0, v: 0 };
  }
  get topY() { return this.y - this.w * 0.2 * this.s + this.bounce.x * 5; }
  get botY() { return this.y + this.w * 0.08 * this.s; }
}

export default class Clouds extends Scene {
  constructor(game, index) {
    super(game, index);
    this.dayK = 0; this.night = 0; this.wind = 1; this.haze = 1;
    this.stars = makeStars(88, 150);
    const kid = (kind, o) => new Kid(Object.assign({ kind, pose: 'sit', mood: 'wait', size: 0.86 }, o || {}));
    this.home = new Cloud({ x: -250, y: -232, w: 212, seed: 11, spot: -16 });
    this.targets = [
      new Cloud({ x: 0, y: 0, w: 200, seed: 12, off: { x: 208, y: -46 }, spot: -14, a: 0 }),
      new Cloud({ x: 0, y: 0, w: 206, seed: 13, off: { x: 200, y: 52 }, spot: -22, a: 0 }),
      new Cloud({ x: 0, y: 0, w: 196, seed: 14, off: { x: -196, y: -104 }, spot: 14, a: 0 }),
      new Cloud({ x: 0, y: 0, w: 262, seed: 15, off: { x: -214, y: -66 }, spot: 34, a: 0, snail: true })
    ];
    this.neigh = new Cloud({ x: 0, y: 0, w: 190, seed: 21, off: { x: 400, y: 30 }, a: 0, nb: { wall: '#bfe6cf', roof: '#5f7ab8', kid: kid('bob', { dir: -1 }), dx: 14 } });
    this.neigh2 = new Cloud({ x: 0, y: 0, w: 180, seed: 22, off: { x: -640, y: -44 }, a: 0, nb: { wall: '#d9c9f2', roof: '#e9b23a', kid: kid('blond'), dx: -12 } });
    this.clouds = [this.home, this.neigh, this.neigh2].concat(this.targets);
    for (const c of this.clouds) if (c.a === 0) c.gone = true;
    // far, small clouds that just drift
    const r = rng(77);
    this.deco = [];
    for (let i = 0; i < 9; i++) this.deco.push({ x: -900 + r() * 1800, y: i < 5 ? -175 - r() * 40 : -470 - r() * 260, w: i < 5 ? 70 + r() * 60 : 120 + r() * 120, seed: 30 + i, sp: 0.3 + r() * 0.5 });
    this.house = { x: this.home.x + this.home.spot, y: this.home.topY - 24, r: 58, rot: { x: 0, v: 0 }, sq: { x: 0, v: 0 }, vx: 0, px: 0, lit: 0.5, door: 0 };
    this.boy = new Kid({ kind: 'spiky', pose: 'stand', mood: 'wait', size: 0.9 }); this.boy.hidden = true;
    // where the boy is, relative to the house: on his seat at the edge of the cloud ('seat', the side the
    // wind blows towards) or walked about by a script ('free'); boyIn: indoors, his face at the window
    this.bo = { x: DOOR_X, y: 26 }; this.boyMode = 'free'; this.boyIn = true; this.boyLook = null; this.boyJob = 0; this._hx = null;
    this.hang = { x: { x: 0, v: 0 }, y: { x: 0, v: 0 }, vy: 0, py: 0 };      // a carried house hangs from the finger, heavy
    this.camPhase = 'est'; this.helloC = null;
    this.carry = false; this.target = null; this.moves = 0;
    this.vane = { x: 0, v: 0 };
    this.flowers = []; this.ripples = []; this.rainbows = []; this.rainT = 0;
    this.boats = [{ x: -520, d: 0.5, sp: 5 }, { x: -260, d: 0.24, sp: 3 }, { x: -820, d: 0.75, sp: 7 }, { x: -1250, d: 0.38, sp: 4 }];
    this.flock = { x: -700, y: -420, on: false };
    this.plane = null;
    // mountains: two ranges
    const rr = rng(90);
    this.farPeaks = [];
    for (let x = 240; x < 3600; x += 170 + rr() * 150) this.farPeaks.push({ x, h: 190 + rr() * 150, w: 230 + rr() * 120 });
    this.peaks = [[], []];
    for (let x = 430; x < 3200; x += 120 + rr() * 110) this.peaks[0].push({ x, h: 120 + rr() * 150, w: 150 + rr() * 110 });
    for (let x = 330; x < 3200; x += 90 + rr() * 90) this.peaks[1].push({ x, h: 44 + rr() * 80, w: 130 + rr() * 90 });
    this.panning = false; this.panned = 0; this._pan = null;
    this.camGoal = { x: this.house.x + 40, y: 50, zoom: 1 }; this.camAuto = true;
    this.cam.x = this.camGoal.x; this.cam.y = -150; this.cam.zoom = 1;
    this.sunDrag = false; this._sun = false; this.turned = false;
    this.expect = () => {
      if (this.sunDrag) { const a = this.sunPos(this.dayK), b = this.sunPos(1); return { kind: 'drag', x: a.x, y: a.y, x2: b.x, y2: b.y, r: 56, text: this._sun ? null : T.sun, slow: 2.6 }; }
      if (!this.panning) return null;
      const v = this.view, F = v.freeRect(), y = v.toWorld(0, F.t + (F.b - F.t) * 0.55).y;     // (across the middle of the free picture)
      const d = PAN_SWIPE / v.scale;
      return { kind: 'drag', x: this.cam.x + d, y, x2: this.cam.x - d, y2: y, r: 44, text: T.look, slow: 2.4 };
    };
    for (let i = -2; i <= 1; i++) floorTile(i);            // paint the land below before the curtain rises
    this.audio.play('clouds', { intensity: 0.5 }); this.audio.ambience('sky');
  }
  dispose() { if (this.rainLoop) this.rainLoop.stop(); freeSprites('cl-'); }

  // ───────────────────────── the story ─────────────────────────
  async run() {
    const h = this.house, boy = this.boy;
    // establishing: the little house on its cloud, high over the coast (the haze clears)
    const c0 = this.shotFor(this.frame(), this.camOpts('est'));
    this.cam.x = c0.x; this.cam.y = c0.y; this.cam.zoom = c0.zoom;
    this.direct('est');
    this.spawn(() => this.tween(this, { haze: 0 }, 2.2, ease.outQuad));
    await this.wait(1.6);
    this.direct('close');                                  // in to the door for the knock
    await this.tapOn(() => ({ x: h.x, y: h.y, r: 62 }), { text: T.knock });
    this.audio.sfx.knock(); h.sq.v += 5;
    await this.wait(0.22);
    this.audio.sfx.knock(); h.sq.v += 5;
    await this.wait(0.4);
    h.door = 1; this.audio.sfx.pop();
    this.fx.burst('puff', h.x + DOOR_X, h.y + 14, 6, { speed: 40, life: 0.6, size: 7, color: 'rgba(255,255,255,0.8)' });
    this.spawn(() => this.boyOut(true));                   // out he comes, glad of the visit, and off to his seat
    await this.say(0);                                     // …a world where people live on the clouds.
    await this.wait(0.8);

    await this.say(1);                                     // …whenever your cloud rains itself out, you have to move house again.
    await this.move(this.targets[0]);
    await this.wait(1.4);

    this.enter(this.neigh, 1);
    this.direct('wide');                                   // out wide: the clouds wander between the sea and the mountains
    await this.say(2);                                     // …where the sea meets the mountains … the clouds go wandering to and fro —
    await this.wait(1.2);
    await this.move(this.targets[1]);
    this.neighbourHello(this.neigh);
    await this.wait(2.6);

    this.direct('sun');                                    // (the same wide picture; on a short screen it reaches down to the sun's road)
    await this.say(3);                                     // in from the sea in the morning, and out to sea again in the evening.
    this.sunDrag = true;                                   // the player carries the sun over: morning turns to evening, the wind turns with it
    this.boyLook = null;
    await this.until(() => this.dayK >= 0.93);
    this.sunDrag = false; this._sun = false;
    this.spawn(() => this.tween(this, { dayK: 1 }, 0.9, ease.outQuad));
    this.audio.sfx.fall();
    await this.until(() => this.wind < -0.9);
    this.enter(this.neigh2, -1);
    await this.move(this.targets[2]);
    await this.wait(1.6);
    await this.move(this.targets[3]);
    this.neighbourHello(this.neigh2);
    await this.wait(1.6);

    await this.say(4);                                     // And the views there are simply wonderful!
    this.camAuto = false;
    this.flock.on = true; this.flock.x = this.cam.x + this.view.width * 0.6;
    if (!this.carry && boy.pose === 'sit') { this.boyLook = { x: h.x - 400, y: HZ }; boy.act('point'); }
    if (!this.view.portrait && this.view.closeK === 1) await this.camTo(h.x - 20, -46, 0.8, 2.4);      // (desk: as it always was)
    else {                                                 // (the camera comes to rest, then it is the player's)
      this.direct('views');
      let el = 0, px = this.cam.x, pz = this.cam.zoom;
      await this._task((dt) => { el += dt; const m = Math.abs(this.cam.x - px) + Math.abs(this.cam.zoom - pz) * 300; px = this.cam.x; pz = this.cam.zoom; return el > 4.5 || (el > 1.8 && m < 0.02); });
      this.track(null);
    }
    this.panning = true;
    this._panT = this.t;                                   // (one swipe like the paw's is always enough; the view follows the finger
    await this.until(() => this.panned > PAN_PX && (!this._pan || this.t - this._panT > 1.5));   // until it lifts, or rests 1.5 s)
    this.panning = false; this._pan = null;
    this.direct('night');                                  // home again for the last look, a little closer
    await this.wait(1.2);
    this.boyLook = null;
    await this.wait(1.4);
    // the first stars; the windows light up
    this.spawn(() => this.tween(this, { night: 1 }, 4.5, ease.inOutSine));
    this.spawn(() => this.tween(h, { lit: 1 }, 2));
    this.audio.sfx.chime(6);
    await this.wait(1.4);
    boy.cheer(); this.audio.sfx.fall();
    await this.wait(1.6);
    // a long day of moving house: the neighbours yawn, and so does he
    boy.mood = 'wait';
    for (const c of [this.neigh, this.neigh2]) if (!c.gone) { const k = c.nb.kid; k.mood = 'wait'; this.spawn(async () => { await this.wait(0.3 + (c.seed % 3) * 0.5); k.act('yawn'); }); }
    await this.wait(0.8);
    boy.act('yawn'); this.audio.sfx.yawn();
    await this.wait(2.4);
    boy.act('rubEyes');
    await this.next();
  }

  // ── the camera: what each moment of the chapter looks at ──
  // est: the house high over the coast; close: the house, its door and the boy; move: the house and the
  // fresh cloud it must go to (held still while the house is carried); hello: across to the neighbours;
  // wide: the clouds wandering between the sea and the mountains (with the sun's road); night: the last look.
  frame() {
    const B = this.rawFrame(), v = this.view;
    return B && (v.portrait || v.closeK > 1) && this.camPhase !== 'close' ? this.uncut(B) : B;
  }
  rawFrame() {
    const h = this.house, home = this.home, hx = h.x + 8, P = this.camPhase, up = this.view.portrait;
    const here = (c) => c && !c.gone && c.a > 0.25;
    const settled = (c) => here(c) && c.follow && Math.abs(c.x - (c.follow.x + c.off.x)) < 140;     // (not while still drifting in)
    if (P === 'close') return { l: hx - 92, r: hx + 92, t: h.y - 84, b: h.y + 60 };
    if (P === 'move') {
      if (this.carry) return null;                         // (the camera keeps still under the player's finger)
      const tg = this.target;
      let l = hx - 100, r = hx + 100;
      if (here(tg) && Math.abs(tg.x + tg.spot - h.x) < 380) { const tx = tg.x + tg.spot; l = Math.min(l, tx - 104); r = Math.max(r, tx + 104); }
      else if (tg && !tg.gone) { if (tg.x > h.x) r += 110; else l -= 110; }
      return { l, r, t: h.y - 84, b: Math.max(home.botY, h.y + 60) + 36 };
    }
    if (this.view.closeK > 1 && (P === 'wide' || P === 'hello' || P === 'sun')) {
      // a short landscape screen: the boy's house and the nearest neighbour (or the one being greeted) only,
      // down to the horizon (the sun's road), so the people stay people; the box changes only when a neighbour settles
      let nb = P === 'hello' && here(this.helloC) ? this.helloC : null;
      if (!nb) for (const c of [this.neigh, this.neigh2]) if (settled(c) && (!nb || Math.abs(c.x - h.x) < Math.abs(nb.x - h.x))) nb = c;
      let l = hx - 110, r = hx + 110, t = h.y - 84, b = P === 'sun' ? Math.max(home.botY + 20, HZ + 12) : home.botY + 24;   // (sun: down to its road)
      if (nb) { const nx = nb.x + nb.nb.dx; l = Math.min(l, nx - 92); r = Math.max(r, nx + 92); t = Math.min(t, nb.topY - 108); b = Math.max(b, nb.botY + 20); }
      return { l, r, t, b };
    }
    if (P === 'hello' && here(this.helloC)) {
      const c = this.helloC, nx = c.x + c.nb.dx;
      return { l: Math.min(hx, nx) - 92, r: Math.max(hx, nx) + 92, t: Math.min(h.y, c.topY - 24) - 84, b: Math.max(home.botY, c.botY) + 28 };
    }
    if (P === 'views') return this.view.closeK > 1 ? { l: hx - 200, r: hx + 200, t: h.y - 96, b: home.botY + 40 } : { l: h.x - 170, r: h.x + 130, t: h.y - 130, b: HZ + 150 };
    if (P === 'night') return { l: hx - 150, r: hx + 150, t: h.y - (this.view.closeK > 1 ? 104 : 150), b: home.botY + 50 };
    if (P === 'wide' || P === 'sun') {
      const half = up ? 175 : 290;
      let l = hx - half, r = hx + half;
      if (!up) for (const c of [this.neigh, this.neigh2]) if (settled(c)) { const nx = c.x + c.nb.dx; l = Math.min(l, nx - 90); r = Math.max(r, nx + 90); }
      return { l, r, t: h.y - 130, b: HZ + 120 };
    }
    const half = up ? 190 : 300;
    return { l: hx - half, r: hx + half, t: h.y - 90, b: HZ + 120 };       // est
  }
  camOpts(P) {
    if (P === 'views') return this.view.closeK > 1 ? { pad: 20, rate: 1.5, zoomIn: 0.75, zoomOut: 1.6, max: 1.35, min: 0.9, exact: true } : { pad: 0, rate: 1.5, zoomIn: 0.75, zoomOut: 1.6, max: 0.86, min: 0.86, exact: true };
    if (this.view.closeK > 1 && (P === 'wide' || P === 'hello' || P === 'sun')) return { pad: 20, rate: P === 'hello' ? 0.75 : 1.5, zoomIn: 0.75, zoomOut: P === 'hello' ? 0.8 : 1.6, max: 1.5, min: 0.6, exact: true };
    const o = { close: { max: 1.75, pad: 16 }, move: { max: 1.55 }, hello: { max: 1.45, min: 0.6 }, night: { max: 1.5 }, wide: { max: 1.05, min: 0.72 }, sun: { max: 1.05, min: 0.72 }, est: { max: 1.1, min: 0.75 } }[P] || {};
    return Object.assign({ pad: 24, rate: 1.5, zoomIn: 0.75, zoomOut: 1.6 }, o);
  }
  // On phones: slide the box sideways (never resize it, so the zoom stays) until no neighbour's house is cut in
  // half by the edge of the picture: it is wholly in, or clearly out. The choice is made once per phase per
  // neighbour (so the camera doesn't hop between the two), and the box's own contents always stay in the picture.
  uncut(B) {
    const v = this.view, F = v.freeRect(), z = this.shotFor(B, this.camOpts(this.camPhase)).zoom;
    const half = (F.r - F.l) / 2 / (v.fit * z) - 14, pad = 20, keep = this._keep || (this._keep = {});
    const c0 = (B.l + B.r) / 2;
    let cx = c0;
    for (const n of [this.neigh, this.neigh2]) {
      if (n.gone || n.a < 0.25) continue;
      const nl = n.x + n.nb.dx - 48, nr = n.x + n.nb.dx + 48;
      let k = keep[n.seed];
      if (k === undefined) {
        if (nr < cx - half || nl > cx + half) k = 'out';
        else k = Math.max(B.r + pad, nr) - Math.min(B.l - pad, nl) <= 2 * half ? 'in' : 'out';
        keep[n.seed] = k;
      }
      if (k === 'in') cx = clamp(cx, nr - half, nl + half);
      else if (nr > cx - half && nl < cx + half) cx = nl + nr < 2 * c0 ? Math.max(cx, nr + 30 + half) : Math.min(cx, nl - 30 - half);
    }
    const lo = B.r + pad - half, hi = B.l - pad + half;                    // (what the box holds stays in)
    if (lo <= hi) cx = clamp(cx, lo, hi); else cx = c0;
    const d = cx - c0;
    return d ? { l: B.l + d, r: B.r + d, t: B.t, b: B.b } : B;
  }
  direct(P) { this.camPhase = P; this._keep = null; this.track(() => this.frame(), this.camOpts(P)); }

  // ── the boy: little walks between his seat at the edge and his door ──
  // (each walk is a job; a newer one — or the player grabbing the house — makes the older one give up)
  walkTo(x, speed, id) {
    const bo = this.bo, boy = this.boy;
    boy.dir = x > bo.x ? 1 : -1; boy.pose = 'walk';
    return this._task((dt) => {
      if (id !== this.boyJob) return true;
      const d = x - bo.x, st = speed * dt;
      if (Math.abs(d) <= st) { bo.x = x; boy.pose = 'stand'; return true; }
      bo.x += Math.sign(d) * st;
      return false;
    });
  }
  async boyOut(glad) {
    const id = ++this.boyJob, boy = this.boy, bo = this.bo;
    this.boyMode = 'free'; this.boyIn = false; boy.hidden = false;
    bo.x = DOOR_X; bo.y = 26; boy.pose = 'stand'; boy.mood = 'wait';
    boy.dir = this.wind >= 0 ? 1 : -1;
    if (glad) { boy.cheer(); this.audio.sfx.giggle(); }
    await this.wait(glad ? 0.9 : 0.35);
    if (id !== this.boyJob) return;
    if (glad) boy.mood = 'wait';
    await this.walkTo((this.wind >= 0 ? 1 : -1) * SEAT_X, 46, id);
    if (id !== this.boyJob) return;
    boy.dir = this.wind >= 0 ? 1 : -1;                     // turns to face the view, and sits down on the edge
    await this.wait(0.15);
    if (id !== this.boyJob) return;
    boy.pose = 'sit'; bo.y = 30; this.boyMode = 'seat'; this.boyHop = 0;
  }
  async boyIndoors(id) {
    const boy = this.boy, bo = this.bo;
    if (id !== this.boyJob || this.boyIn) return;
    this.boyMode = 'free'; this.boyHop = 0;
    boy.pose = 'stand'; bo.y = 26;                          // up off the edge…
    await this.wait(0.4);
    if (id !== this.boyJob) return;
    await this.walkTo(DOOR_X, 78, id);                     // …and hurrying in
    if (id !== this.boyJob) return;
    this.boyIn = true; boy.hidden = true; this.audio.sfx.pop();
  }

  // a cloud drifts into the picture and then keeps pace with the home cloud
  enter(c, side) {
    c.gone = false; c.follow = this.home; c.s = 1; c.rain = 0;
    c.x = this.home.x + c.off.x + side * 520; c.y = this.home.y + c.off.y;
    this.spawn(() => this.tween(c, { a: 1 }, 1));
    if (c.nb) {                                            // the neighbour child waves across as it comes
      const k = c.nb.kid;
      this.spawn(async () => { await this.wait(1.4); if (k.mood === 'wait') k.mood = 'wave'; await this.wait(2.4); if (k.mood === 'wave') k.mood = 'wait'; });
    }
  }

  // The home cloud rains itself out — carry the house over to `to`.
  async move(to) {
    const old = this.home, h = this.house, boy = this.boy;
    old.raining = true;
    if (!this.rainLoop) this.rainLoop = this.audio.loop('rain');
    this.enter(to, -this.wind >= 0 ? 1 : -1);
    this.target = to;
    this.direct('move');
    // the boy feels his cloud go soft: a look down at the rain, a point at the fresh cloud, and in he hurries
    this.spawn(async () => {
      await this.until(() => this.carry || this.boyIn || (this.boyMode === 'seat' && old.rain > 0.05));
      if (this.carry || this.boyIn) return;
      const id = ++this.boyJob;
      this.boyLook = { x: boy.x + boy.dir * 30, y: old.botY + 80 }; boy.mood = 'wait'; boy.act('shrug');
      await this.wait(1.1);
      if (id !== this.boyJob) return;
      await this.until(() => id !== this.boyJob || Math.abs(to.x - (old.x + to.off.x)) < 170);
      if (id !== this.boyJob) return;
      this.boyLook = null; boy.act('point');
      await this.wait(1.1);
      await this.boyIndoors(id);
    });
    await this.until(() => old.rain > 0.1 && Math.abs(to.x - (old.x + to.off.x)) < 46);
    await this.dragTo(h, () => ({ x: to.x + to.spot, y: to.topY - 24, r: 90 }), {
      text: T.move, snapBack: false, slow: 1.6,
      onGrab: () => {
        this.carry = true; this.audio.sfx.pop(); h.sq.v -= 5; h.px = h.x; this.hang.py = h.y; this.hang.y.v += 40;
        if (!this.boyIn) { this.boyJob++; this.boyIn = true; boy.hidden = true; this.boyMode = 'free'; }    // (in he hops, just in time)
      },
      onDrop: (ok) => {
        this.carry = false; if (!ok) this.audio.sfx.swish();
        const hg = this.hang; h.x += hg.x.x; h.y += hg.y.x; hg.x.x = hg.y.x = hg.x.v = hg.y.v = 0;     // (it lands where it was seen hanging)
      }
    });
    // settled on the fresh cloud: a heavy, happy bump
    this.home = to; this.target = null; this.moves++;
    to.follow = null; to.bounce.v += 7; h.sq.v += 8;
    for (const c of this.clouds) if (c.follow === old) { c.follow = to; c.off = { x: c.x - to.x, y: c.y - to.y }; }
    old.raining = true; old.leaving = true;
    this.audio.sfx.land(0, true); this.audio.playerNote(); this.audio.chordNote(2, { vel: 0.5, when: this.audio.now + 0.1 });
    this.fx.burst('puff', h.x, h.y + 26, 9, { speed: 80, a0: -Math.PI, a1: 0, life: 0.7, size: 9, color: 'rgba(255,255,255,0.85)' });
    this.sparkle(h.x, h.y - 30, 8);
    this.direct('close');                                  // in close for the arrival
    this.spawn(async () => {
      await this.wait(0.45);
      await this.boyOut(true);
      const id2 = this.boyJob;
      if (id2 !== this.boyJob || old.gone) return;
      this.boyLook = { x: old.x, y: old.y }; boy.mood = 'wave';          // a wave goodbye to the old cloud, raining itself away
      await this.wait(1.3);
      if (id2 !== this.boyJob) return;
      this.boyLook = null; boy.mood = 'wait';
      if (this.moves % 2) boy.act('stretch'); else boy.act('nod');
    });
  }

  neighbourHello(c) {
    const k = c.nb.kid, boy = this.boy;
    this.helloC = c; this.direct('hello');
    k.cheer(); this.audio.sfx.giggle();
    this.hearts(c.x + c.nb.dx, c.topY - 80, 3);
    // a paper plane sails across, into the boy's hand
    const p = this.plane = { x: c.x + c.nb.dx, y: c.topY - 50, x0: c.x + c.nb.dx, y0: c.topY - 50, u: 0, from: c };
    this.spawn(async () => {
      await this.wait(0.5);
      this.audio.sfx.swish();
      await this.tween(p, { u: 1 }, 1.9, ease.inOutQuad);
      this.plane = null; boy.cheer(); this.audio.sfx.sparkle(); const a = boy.anchor('hand'); this.sparkle(a.x, a.y, 6);
      await this.wait(1.2); k.mood = 'wave'; if (!this.carry) boy.mood = 'wave';
      await this.wait(1.6); if (boy.mood === 'wave') boy.mood = 'wait';
    });
  }

  // ── looking around (the last beat) ──
  sunPos(u) {
    // an arc from above the mountains, high over the cloud houses, down to the sea
    const v = this.view, peak = clamp(HZ - (v.free + 40), 210, 360), c2 = 4 * (peak - 54);
    return { x: v.left + v.width * lerp(0.8, 0.2, u), y: HZ - (190 * (1 - u) * (1 - u) + c2 * u * (1 - u) + 26 * u * u) + this.night * 60 };
  }
  onDown(p) {
    if (this.sunDrag) { const a = this.sunPos(this.dayK); if (dist(p.x, p.y, a.x, a.y) < 84) { this._sun = true; this.audio.sfx.pop(); return; } }
    if (this.panning) this._pan = { sx: p.sx, cx: this.cam.x };
  }
  onMove(p) {
    if (this._sun) { const u = clamp01((0.8 - p.sx / this.view.W) / 0.6); if (u > this.dayK) this.dayK = u; return; }
    if (!this._pan) return;
    const lim = 520, nx = clamp(this._pan.cx - (p.sx - this._pan.sx) / this.view.scale, this.house.x - lim, this.house.x + lim);
    this.panned += Math.abs(nx - this.cam.x) * this.view.scale;          // (in screen px)
    if (Math.abs(nx - this.cam.x) > 0.01) this._panT = this.t;
    this.cam.x = nx;
  }
  onUp() { this._pan = null; this._sun = false; }

  update(dt) {
    const t = this.t, h = this.house, home = this.home, boy = this.boy;
    if (this.dayK > 0) {
      const w = 1 - 2 * ease.inOutQuad(clamp01((this.dayK - 0.3) / 0.36));
      this.wind = approach(this.wind, w, 2.6, dt);
      if (!this.turned && this.wind < 0) { this.turned = true; this.audio.sfx.whoosh(1.4); this.vane.v += 12; }
    }
    // the wind carries the home cloud: toward the mountains by morning, back toward the shore by evening
    // (it hurries a little when it has far to go, and dawdles as it arrives)
    const lim = (this.wind > 0 ? [-150, 190, 520, 520, 520] : [500, 500, 500, 280, 40])[Math.min(4, this.moves)];
    const room = (lim - home.x) * (this.wind > 0 ? 1 : -1);
    home.x += this.wind * clamp(room * 0.35, 3, 38) * dt;
    home.y += Math.sin(t * 0.5 + home.ph) * 2 * dt;
    for (const c of this.clouds) {
      if (c.gone) continue;
      spring(c.bounce, 0, dt, 90, 7);
      if (c.follow) {
        c.x = approach(c.x, c.follow.x + c.off.x, 0.95, dt);
        c.y = approach(c.y, c.follow.y + c.off.y + Math.sin(t * 0.6 + c.ph) * 5, 1.5, dt);
      } else if (c !== home) { c.x += this.wind * 9 * dt; }
      if (c.raining) {
        c.rain = Math.min(1, c.rain + dt * (c.leaving ? 0.55 : 0.085));
        c.s = c.leaving ? Math.max(0.12, c.s - dt * 0.42) : lerp(1, 0.46, ease.inOutQuad(clamp01(c.rain / 0.85)));
        if (c.leaving) { c.a = Math.max(0, c.a - dt * 0.55); if (c.a <= 0) { c.gone = true; c.raining = false; for (const rb of this.rainbows) rb.age = Math.max(rb.age, 11); this.rainbows.push({ x: c.x, age: 0, r: 150 + (c.seed % 3) * 26 }); this.audio.sfx.rise(); } }
      }
      if (c.nb) { const k = c.nb.kid; k.look = { x: boy.x, y: boy.y - 24 }; k.update(dt); }
    }
    // rain reaches the world below
    const wet = this.clouds.filter((c) => c.raining && !c.gone);
    let level = 0;
    for (const c of wet) level = Math.max(level, Math.min(1, c.rain * 5) * c.a);
    if (this.rainLoop) this.rainLoop.set(level, 0.5);
    this.rainT -= dt;
    if (wet.length && this.rainT <= 0) {
      this.rainT = 0.07;
      const c = wet[0], d = 0.12 + Math.random() * 0.8, x = c.x + (Math.random() - 0.5) * c.w * 0.7 * c.s;
      const land = x - coastX(d);
      if (land > 44 && this.flowers.length < 170) this.flowers.push({ x, d, born: t, col: ['#f08ab0', '#ffe36e', '#ffffff', '#e2483b', '#b08ae0', '#ffb648'][Math.floor(Math.random() * 6)] });
      else if (land < -6) this.ripples.push({ x, d, age: 0 });
    }
    for (let i = this.ripples.length - 1; i >= 0; i--) { this.ripples[i].age += dt; if (this.ripples[i].age > 1.5) this.ripples.splice(i, 1); }
    for (let i = this.rainbows.length - 1; i >= 0; i--) { this.rainbows[i].age += dt; if (this.rainbows[i].age > 16) this.rainbows.splice(i, 1); }
    // the house rides on its cloud (unless it is in the player's hand)
    if (!this.carry) {
      const k = 1 - Math.exp(-10 * dt), wob = home.raining && home.rain > 0.55 ? Math.sin(t * 7) * 0.05 * (home.rain - 0.55) * 2.2 : 0;
      h.x += (home.x + home.spot - h.x) * k; h.y += (home.topY - 24 - h.y) * k;
      spring(h.rot, wob, dt, 120, 9);
    } else {
      h.vx = lerp(h.vx, (h.x - h.px) / Math.max(dt, 1e-3), 0.3); h.px = h.x;
      const hg = this.hang; hg.vy = lerp(hg.vy, (h.y - hg.py) / Math.max(dt, 1e-3), 0.3); hg.py = h.y;
      spring(h.rot, clamp(-h.vx * 0.0011, -0.4, 0.4), dt, 70, 7);
      if (Math.random() < dt * 14) this.fx.add({ kind: 'spark', x: h.x + (Math.random() - 0.5) * 40, y: h.y + 30, vx: 0, vy: 30, life: 0.6, size: 3.5, color: '#ffffff', drag: 1 });
    }
    spring(h.sq, 0, dt, 160, 9);
    // heavy: while carried the house hangs a little below the finger and trails behind it
    const hg = this.hang, cr = this.carry;
    spring(hg.x, cr ? clamp(-h.vx * 0.02, -14, 14) : 0, dt, 60, 7);
    spring(hg.y, cr ? 8 + clamp(-hg.vy * 0.016, -9, 10) : 0, dt, 60, 7);
    spring(this.vane, this.wind >= 0 ? 0 : Math.PI, dt, 14, 2.6);
    // the boy: on his seat he sits on the side the wind blows towards (when it turns: a hop over the roof)
    const bd = this.wind >= 0 ? 1 : -1, bo = this.bo;
    if (this.boyMode === 'seat') {
      if (bd !== boy.dir) { boy.dir = bd; boy.joy.v += 9; this.boyHop = boy.hidden ? 0 : 1; }
      if (this.boyHop > 0) { this.boyHop = Math.max(0, this.boyHop - dt / 0.55); if (this.boyHop === 0 && !boy.hidden) this.fx.burst('puff', h.x + bd * SEAT_X, h.y + 28, 4, { speed: 40, life: 0.5, size: 6, color: 'rgba(255,255,255,0.8)' }); }
      const hop = ease.inOutQuad(this.boyHop || 0);
      bo.x = boy.dir * SEAT_X * (1 - 2 * hop); bo.y = 30 - Math.sin(Math.PI * hop) * 62;
    }
    boy.x = h.x + bo.x; boy.y = h.y + bo.y;
    // (the cloud carries him along: only his own steps should move his feet)
    if (this._hx !== null && !this.carry) boy.carry(h.x - this._hx, h.y - this._hy);
    this._hx = h.x; this._hy = h.y;
    const look = this.target || (this.neigh.gone ? null : this.neigh);
    boy.look = this.boyLook || (this.plane ? { x: this.plane.x, y: this.plane.y } : look ? { x: look.x, y: look.y - 30 } : null);
    boy.update(dt);
    // little things far below and far away
    for (const b of this.boats) { b.x += b.sp * dt; if (b.x > coastX(b.d) - 40) b.x -= 900 + Math.random() * 300; }
    for (const d of this.deco) { d.x += this.wind * 12 * d.sp * dt; if (d.x > this.cam.x + 1000) d.x -= 2000; if (d.x < this.cam.x - 1000) d.x += 2000; }
    if (this.flock.on) this.flock.x -= 46 * dt;
    if (this.plane) { const p = this.plane, u = p.u, a = boy.anchor('hand'); p.x = lerp(p.x0, a.x, u); p.y = lerp(p.y0, a.y - 4, u) - Math.sin(Math.PI * u) * 46 + Math.sin(u * 14) * 5 * (1 - u); }
    // camera (the old follow, for whenever the director lets go)
    if (this.camAuto && !this.directing) {
      const g = this.camGoal, tg = this.target;
      if (!this.carry) { g.x = h.x + (tg && !tg.gone ? clamp((tg.x - h.x) * 0.36, -90, 90) : 0); g.y = clamp(h.y + 292 + (tg && !tg.gone ? (tg.y - home.y) * 0.3 : 0), -70, 64); }
      this.cam.x = approach(this.cam.x, g.x, 2.2, dt); this.cam.y = approach(this.cam.y, g.y, 1.8, dt);
    }
  }

  // ───────────────────────── drawing ─────────────────────────
  draw(ctx, view, t) {
    const k = this.dayK, n = this.night;
    const sky = n > 0 ? mixSky(SKIES.sunset, SKIES.night, n * 0.62) : mixSky(SKIES.morning, SKIES.sunset, k);
    drawSky(ctx, view, sky);
    drawStars(ctx, view, this.stars, t, Math.max(0, n * 0.9), this.reduced);
    // the sun crosses from the mountains to the sea
    const sun = this.sunPos(k), sx = sun.x, sy = sun.y;
    glow(ctx, sx, sy, 250, mixHex('#fff3b0', '#ffb060', Math.round(k * 6) / 6), 0.55 * (1 - n * 0.6), 'screen');   // quantised: glow sprites are cached per colour
    if (this.sunDrag) crayonRings(ctx, sx, sy, 58 + (this._sun ? 8 : 4 * Math.sin(t * 4)), t, { alpha: this._sun ? 0.8 : 0.55, rings: 3, seed: 3, colors: ['#ffe36e', '#ffb648', '#ffffff'] });
    ctx.fillStyle = mixHex('#fffbe0', '#ffd08a', k); ctx.beginPath(); ctx.arc(sx, sy, 34 + (this._sun ? 3 : 0), 0, TAU); ctx.fill();
    const dcol = mixHex('#ffffff', '#ffd4c4', Math.round(k * 4) / 4);       // quantised: cloud sprites are cached per colour
    for (const d of this.deco) if (d.y < -400 && view.visible(d.x, 200)) drawCloud(ctx, d.x, d.y, d.w, d.seed, dcol, 0.75);
    this.drawMountains(ctx, view, k, n);
    this.drawFloor(ctx, view, t, k, n, sx);
    // far small clouds at the horizon
    for (const d of this.deco) if (d.y >= -400 && view.visible(d.x, 120)) drawCloud(ctx, d.x, d.y, d.w, d.seed, dcol, 0.8);
    for (const rb of this.rainbows) this.drawRainbow(ctx, rb, t, 1 - n);
    if (this.flock.on) this.drawFlock(ctx, t);

    const order = this.clouds.filter((c) => !c.gone).sort((a, b) => a.y - b.y);
    for (const c of order) if (view.visible(c.x, c.w)) { this.drawRain(ctx, c, t); }
    for (const c of order) {
      if (!view.visible(c.x, c.w)) continue;
      this.drawCloudBody(ctx, c, t, k);
      if (c.nb) {
        ctx.save(); ctx.globalAlpha = c.a;
        this.drawHouse(ctx, c.x + c.nb.dx, c.topY - 24, t, { wall: c.nb.wall, roof: c.nb.roof, lit: 0.4 + 0.6 * Math.max(n, k * 0.4), vane: -1 });
        const kd = c.nb.kid; kd.x = c.x + c.nb.dx + kd.dir * 42; kd.y = c.topY + 6; kd.drawFull(ctx, t);
        this.drawLip(ctx, c, c.x + c.nb.dx, k);
        ctx.restore();
      }
      if (c === this.home && !this.carry) this.drawHome(ctx, t, k);
      if (c === this.target && !this.carry) {          // an inviting spot on the fresh cloud
        const pts = [], rr = 30 + 4 * Math.sin(t * 5);
        for (let i = 0; i <= 18; i++) pts.push([c.x + c.spot + Math.cos(i / 18 * TAU) * rr, c.topY - 2 + Math.sin(i / 18 * TAU) * rr * 0.3]);
        chalk(ctx, pts, { width: 2.4, alpha: 0.75 * c.a, color: '#fff3b8', seed: Math.floor(t * 6) });
      }
    }
    if (this.plane) this.drawPlane(ctx, t);
    if (this.carry) {
      const tg = this.target;
      if (tg) { const near = dist(this.house.x, this.house.y, tg.x + tg.spot, tg.topY - 24) < 90; glow(ctx, tg.x + tg.spot, tg.topY - 20, near ? 90 : 60, '#fff3a0', near ? 0.7 : 0.4); }
      this.drawHome(ctx, t, k);
    }
    this.fx.draw(ctx, t, 0);
    if (this.haze > 0.004) { ctx.fillStyle = 'rgba(255,255,255,' + this.haze.toFixed(3) + ')'; ctx.fillRect(view.left - 10, view.top - 10, view.width + 20, view.height + 20); }
  }

  // Three ranges, paler with distance. The flank that faces the sun is lit: the east one while the
  // sun stands over the mountains in the morning, the west one when it sinks towards the sea.
  drawMountains(ctx, view, k, n) {
    const base = HZ + 16, night = n * 0.5;
    const peak = (p, x, col, snow, shadeA) => {
      const top = HZ - p.h, l = x - p.w, r = x + p.w;
      const flankL = () => { ctx.quadraticCurveTo(x - p.w * 0.4, HZ - p.h * 0.55, x - 6, top); };
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(l, base); flankL();
      ctx.quadraticCurveTo(x + 5, top - 5, x + 12, top + 4);
      ctx.quadraticCurveTo(x + p.w * 0.5, HZ - p.h * 0.5, r, base); ctx.closePath(); ctx.fill();
      if (shadeA > 0.01) {
        // the ridge that runs down from the summit divides light from shade
        const ridge = [[x + 3, top + 2], [x - p.w * 0.04, HZ - p.h * 0.66], [x + p.w * 0.13, HZ - p.h * 0.34], [x + p.w * 0.06, base]];
        ctx.fillStyle = 'rgba(24,22,70,' + (shadeA * (1 - k)).toFixed(3) + ')';          // morning: west flank in shade
        ctx.beginPath(); ctx.moveTo(l, base); flankL(); for (const q of ridge) ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(24,22,70,' + (shadeA * k).toFixed(3) + ')';                // evening: east flank
        ctx.beginPath(); ctx.moveTo(x + 12, top + 4); ctx.quadraticCurveTo(x + p.w * 0.5, HZ - p.h * 0.5, r, base);
        for (let i = ridge.length - 1; i >= 0; i--) ctx.lineTo(ridge[i][0], ridge[i][1]); ctx.closePath(); ctx.fill();
      }
      if (snow) {
        ctx.fillStyle = mixHex(mixHex('#ffffff', '#ffd9d0', k), '#8f9ad8', night);
        ctx.beginPath(); ctx.moveTo(x - 6, top); ctx.quadraticCurveTo(x + 5, top - 5, x + 12, top + 4);
        ctx.lineTo(x + 30, top + 40); ctx.lineTo(x + 14, top + 30); ctx.lineTo(x + 2, top + 46); ctx.lineTo(x - 12, top + 32); ctx.lineTo(x - 28, top + 42); ctx.closePath(); ctx.fill();
      }
    };
    const far = mixHex(mixHex('#d3daf4', '#b596c8', k), '#343b7c', night), off = this.cam.x * 0.45;
    for (const p of this.farPeaks) if (view.visible(p.x + off, p.w + 40)) peak(p, p.x + off, far, p.h > 250, 0.07);
    const cols = [mixHex(mixHex('#b9c3ea', '#7a5fa8', k), '#2a2f6a', night), mixHex(mixHex('#86b890', '#4f4a86', k), '#1f2a5a', night)];
    for (let L = 0; L < 2; L++) for (const p of this.peaks[L]) if (view.visible(p.x, p.w + 40)) peak(p, p.x, cols[L], L === 0 && p.h > 170, L ? 0.16 : 0.2);
    // woods along the foot of the hills
    ctx.fillStyle = mixHex(mixHex('#5fa873', '#44447e', k), '#18224e', night);
    for (let x = Math.max(300, Math.floor((view.left - 30) / 26) * 26); x < view.right + 30; x += 26) {
      const h = hash(x * 7 + 3), r = 9 + h * 9;
      ctx.beginPath(); ctx.arc(x + h * 12, base + 3 - r * 0.5, r, 0, TAU); ctx.fill();
    }
  }

  drawFloor(ctx, view, t, k, n, sunX) {
    const x0 = view.left - 10, x1 = view.right + 10, yb = Math.max(view.bottom + 10, HZ + FH);
    for (let i = Math.floor(x0 / TW); i * TW < x1; i++) {
      const s = floorTile(i);
      ctx.drawImage(s.c, i * TW, HZ, TW + 0.6, FH);
    }
    // below the painted strip: just deeper colour (it is hidden by the caption anyway)
    if (yb > HZ + FH) { const cx = coastX(1.25); ctx.fillStyle = '#3a95bc'; ctx.fillRect(x0, HZ + FH - 1, Math.max(0, cx - x0), yb - HZ - FH + 2); ctx.fillStyle = '#78c058'; ctx.fillRect(Math.max(x0, cx), HZ + FH - 1, x1 - Math.max(x0, cx), yb - HZ - FH + 2); }
    ctx.save();
    // sailing boats
    for (const b of this.boats) {
      if (!view.visible(b.x, 40)) continue;
      const s = 0.4 + b.d * 1.1, y = yOf(b.d) + Math.sin(t * 1.6 + b.x) * 1.2;
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(b.x - 16 * s, y + 1, 12 * s, 1.4 * s);
      ctx.fillStyle = '#8a5a2b'; ctx.beginPath(); ctx.moveTo(b.x - 7 * s, y - 3 * s); ctx.lineTo(b.x + 8 * s, y - 3 * s); ctx.lineTo(b.x + 5 * s, y + 1 * s); ctx.lineTo(b.x - 5 * s, y + 1 * s); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fbfbf6'; ctx.beginPath(); ctx.moveTo(b.x, y - 4 * s); ctx.lineTo(b.x, y - 17 * s); ctx.lineTo(b.x + 8 * s, y - 5 * s); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(29,21,48,0.6)'; ctx.lineWidth = 0.9; ctx.stroke();
    }
    // where it has rained: rings on the water, flowers on the land
    for (const r of this.ripples) {
      const s = 0.4 + r.d * 1.1, u = r.age / 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.8 * (1 - u)).toFixed(2) + ')'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.ellipse(r.x, yOf(r.d), (3 + u * 14) * s, (1 + u * 4) * s, 0, 0, TAU); ctx.stroke();
    }
    for (const f of this.flowers) {
      if (!view.visible(f.x, 20)) continue;
      const s = (0.4 + f.d * 1.1) * ease.outBack(clamp01((t - f.born) / 0.5)), y = yOf(f.d);
      ctx.fillStyle = '#3f9a45'; ctx.fillRect(f.x - 0.5 * s, y - 4 * s, 1 * s, 4 * s);
      ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(f.x, y - 5 * s, 2.6 * s, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff7c0'; ctx.beginPath(); ctx.arc(f.x, y - 5 * s, 1 * s, 0, TAU); ctx.fill();
    }
    // every cloud lays its shadow on the world below
    for (const c of this.clouds) {
      if (c.gone || c.a < 0.05 || !view.visible(c.x, c.w)) continue;
      const d = clamp(0.5 + (c.y + 232) / 520, 0.3, 0.85), w = c.w * 0.5 * c.s * (0.45 + d);
      ctx.save(); ctx.translate(c.x + 46 - k * 92, yOf(d)); ctx.scale(1, 0.2);
      glow(ctx, 0, 0, w * 1.5, '#122454', 0.3 * c.a * (1 - n * 0.6), 'source-over');
      ctx.restore();
    }
    // the light of the hour on sea and land
    if (k > 0.01 || n > 0.01) {
      ctx.fillStyle = rgba(mixHex('#7a4a9a', '#141a4a', n), 0.3 * k + 0.25 * n); ctx.fillRect(x0, HZ, x1 - x0, yb - HZ);
      // the sun's road across the sea
      ctx.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        const d = 0.03 + (i / 18) * 0.9, y = yOf(d), w = (5 + d * 44) * (0.6 + 0.4 * Math.sin(t * 2 + i * 1.7));
        const x = sunX + Math.sin(t * 0.8 + i) * 4;
        if (x - w > coastX(d)) continue;
        ctx.strokeStyle = 'rgba(255,205,130,' + (0.75 * k * (1 - n * 0.7)).toFixed(2) + ')'; ctx.lineWidth = 1.4 + d * 3;
        ctx.beginPath(); ctx.moveTo(x - w, y); ctx.lineTo(Math.min(x + w, coastX(d) - 4), y); ctx.stroke();
      }
    }
    // haze at the horizon
    const hg = ctx.createLinearGradient(0, HZ - 4, 0, HZ + 54);
    hg.addColorStop(0, rgba(mixHex(mixHex('#fde6c8', '#ffb86a', k), '#3a4a9a', n * 0.6), 0.85)); hg.addColorStop(1, rgba(mixHex('#fde6c8', '#ffb86a', k), 0));
    ctx.fillStyle = hg; ctx.fillRect(x0, HZ - 4, x1 - x0, 58);
    // village windows after dark
    if (n > 0.05) {
      const L = land();
      for (const h of L.huts) { if (!view.visible(h.x, 20)) continue; const s = 0.34 + h.d * 0.95; glow(ctx, h.x, yOf(h.d) - 3 * s, 9 * s, '#ffe36e', 0.8 * n); }
    }
    ctx.restore();
  }

  drawRainbow(ctx, rb, t, dim) {
    const a = Math.min(1, rb.age / 1.5) * clamp01((16 - rb.age) / 4) * dim, cols = ['#f0705a', '#ffb648', '#ffe36e', '#8fd08a', '#8fbdf5', '#b08ae0'];
    ctx.save();
    ctx.beginPath(); ctx.rect(rb.x - rb.r - 40, HZ - rb.r - 60, rb.r * 2 + 80, rb.r + 60 + 96); ctx.clip();
    ctx.lineCap = 'round';
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = rgba(cols[i], 0.5 * a); ctx.lineWidth = 6.4;
      ctx.beginPath(); ctx.arc(rb.x, HZ + 70, rb.r - i * 6 + Math.sin(t * 2 + i) * 0.6, Math.PI * 1.02, Math.PI * 1.98); ctx.stroke();
    }
    ctx.restore();
  }

  drawFlock(ctx, t) {
    const f = this.flock;
    ctx.save(); ctx.strokeStyle = 'rgba(29,21,48,0.75)'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < 7; i++) {
      const x = f.x + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 26 + Math.ceil(i / 2) * 22, y = f.y + Math.ceil(i / 2) * 15 * (i % 2 ? 1 : -1) * 0.6 + Math.ceil(i / 2) * 9 + Math.sin(t * 2 + i) * 3, fl = Math.sin(t * 9 + i * 1.3) * 5;
      ctx.beginPath(); ctx.moveTo(x - 8, y - 2 + fl); ctx.quadraticCurveTo(x - 3, y - 4, x, y); ctx.quadraticCurveTo(x + 3, y - 4, x + 8, y - 2 + fl); ctx.stroke();
    }
    ctx.restore();
  }

  // rain: slanting chalk strokes under a raining cloud
  drawRain(ctx, c, t) {
    if (!c.raining || c.rain <= 0.01) return;
    const a = Math.min(1, c.rain * 5) * c.a, w = c.w * 0.74 * c.s, top = c.botY - 6, len = yOf(0.5) - top;
    ctx.save(); ctx.strokeStyle = 'rgba(110,150,215,' + (0.75 * a).toFixed(2) + ')'; ctx.lineWidth = 2.1; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      const x = c.x + (hash(i * 7 + c.seed) - 0.5) * w, ph = (t * (1.5 + hash(i) * 0.6) + hash(i * 3 + 1)) % 1, y = top + ph * len;
      ctx.moveTo(x - ph * 26 * this.wind, y); ctx.lineTo(x - ph * 26 * this.wind - 3.4 * this.wind, y + 15);
    }
    ctx.stroke(); ctx.restore();
  }

  drawCloudBody(ctx, c, t, k) {
    const w = c.w, s = c.s * (1 + c.bounce.x * 0.03), old = ctx.globalAlpha;
    const spr = cloudSprite(c.seed, w, 'white');
    ctx.save();
    ctx.translate(c.x, c.y); ctx.scale(s, s * (1 - c.bounce.x * 0.04));
    ctx.globalAlpha = old * c.a; ctx.drawImage(spr.c, -spr.w / 2, -spr.h * 0.6, spr.w, spr.h);
    if (k > 0.02) { ctx.globalAlpha = old * c.a * k * 0.9; const p = cloudSprite(c.seed, w, 'pink'); ctx.drawImage(p.c, -p.w / 2, -p.h * 0.6, p.w, p.h); }
    if (c.rain > 0.02) { ctx.globalAlpha = old * c.a * Math.min(0.85, c.rain * 1.5); const g = cloudSprite(c.seed, w, 'grey'); ctx.drawImage(g.c, -g.w / 2, -g.h * 0.6, g.w, g.h); }
    ctx.globalAlpha = old * c.a;
    if (c.snail) {
      // the chalk spiral of the cloud-snail from the night-garden picture
      const pts = [];
      const sc = k > 0.5 ? '#9a4f86' : '#7f9fd0';
      for (let a = 0; a < 13.2; a += 0.34) { const rr = 3 + a * 2.9; pts.push([-w * 0.19 + Math.cos(a) * rr, -w * 0.075 + Math.sin(a) * rr * 0.72]); }
      chalk(ctx, pts, { width: 3, alpha: 0.85, color: sc, seed: 4 });
      for (const sd of [-1, 1]) chalk(ctx, [[-w * 0.36, -w * 0.11], [-w * 0.43 + sd * 5, -w * 0.21], [-w * 0.44 + sd * 9, -w * 0.25 + Math.sin(t * 2 + sd) * 2]], { width: 2.6, alpha: 0.85, color: k > 0.5 ? '#9a4f86' : '#7f9fd0', seed: 9 + sd });
    }
    ctx.restore();
    ctx.globalAlpha = old;
  }
  // a little bank of cloud in front of a house, so it sits *in* the cloud
  drawLip(ctx, c, x, k) {
    ctx.fillStyle = mixHex(mixHex('#ffffff', '#ffe2cf', k), '#b9c5da', Math.min(0.85, c.rain * 1.5));
    for (const d of [[-30, 5, 13], [-10, 9, 15], [12, 8, 15], [32, 5, 12]]) { ctx.beginPath(); ctx.arc(x + d[0] * c.s, c.topY + d[1], d[2] * Math.max(0.5, c.s), 0, TAU); ctx.fill(); }
  }
  drawHome(ctx, t, k) {
    const h = this.house, c = this.home, boy = this.boy, hg = this.hang;
    this.drawHouse(ctx, h.x + hg.x.x, h.y + hg.y.x, t, { wall: '#fbf3d8', roof: '#d9483b', lit: h.lit, rot: h.rot.x, sq: h.sq.x, vane: this.vane.x, face: this.carry || (this.boyIn && h.door), door: h.door });
    if (!boy.hidden) boy.drawFull(ctx, t);
    if (!this.carry) this.drawLip(ctx, c, h.x, k);
  }
  drawHouse(ctx, x, y, t, o) {
    const sq = o.sq || 0;
    ctx.save(); ctx.translate(x, y + 26); ctx.rotate(o.rot || 0); ctx.scale(1 + sq * 0.1, 1 - sq * 0.12);
    if (o.lit > 0.6) glow(ctx, 11, -17, 34, PAL.winWarm, 0.5 * (o.lit - 0.6) * 2.5);
    wobblyPoly(ctx, [[11, -42], [11, -64], [22, -64], [22, -38]], 3, 0.5, 30); ctx.fillStyle = '#8f3a34'; ctx.fill(); ink(ctx, 2.4);
    wobblyPoly(ctx, [[-25, 0], [-25, -34], [25, -34], [25, 0]], 5, 0.8, 40); ctx.fillStyle = o.wall; ctx.fill(); ink(ctx, 3);
    wobblyPoly(ctx, [[-33, -31], [-1, -62], [33, -31]], 6, 0.8, 40); ctx.fillStyle = o.roof; ctx.fill(); ink(ctx, 3);
    // door
    ctx.beginPath(); ctx.moveTo(-18, 0); ctx.lineTo(-18, -15); ctx.quadraticCurveTo(-11, -25, -4, -15); ctx.lineTo(-4, 0); ctx.closePath();
    ctx.fillStyle = o.door ? '#3a2418' : '#6b3f2a'; ctx.fill(); ink(ctx, 2.2);
    // window
    ctx.beginPath(); ctx.arc(11, -17, 8, 0, TAU); ctx.fillStyle = mixHex('#5a6a9a', PAL.winLit, clamp01(o.lit)); ctx.fill(); ink(ctx, 2.4);
    if (o.face) {
      ctx.save(); ctx.beginPath(); ctx.arc(11, -17, 7, 0, TAU); ctx.clip();
      ctx.fillStyle = '#f3c9a8'; ctx.beginPath(); ctx.arc(11, -13, 6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#f08a2a'; ctx.beginPath(); ctx.arc(11, -19.5, 6, Math.PI, TAU); ctx.fill();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(9, -13.5, 1, 0, TAU); ctx.arc(13, -13.5, 1, 0, TAU); ctx.fill();
      ctx.restore();
    } else { ctx.beginPath(); ctx.moveTo(3, -17); ctx.lineTo(19, -17); ctx.moveTo(11, -25); ctx.lineTo(11, -9); ink(ctx, 1.2); }
    // weathervane
    if (o.vane !== undefined && o.vane !== -1) {
      tube(ctx, [[-1, -60], [-1, -76]], 1.8, '#5a4a5e', INK, 1.8);
      ctx.save(); ctx.translate(-1, -76); ctx.scale(Math.cos(o.vane), 1);
      ctx.beginPath(); ctx.moveTo(-11, 0); ctx.lineTo(11, 0); ctx.moveTo(6, -4.5); ctx.lineTo(12, 0); ctx.lineTo(6, 4.5); ink(ctx, 2.2);
      ctx.restore();
    }
    // smoke puff
    const pf = (t * 0.5) % 1;
    ctx.fillStyle = 'rgba(255,255,255,' + (0.7 * (1 - pf)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(17 + pf * 8 * this.wind, -68 - pf * 22, 3 + pf * 6, 0, TAU); ctx.fill();
    ctx.restore();
  }
  drawPlane(ctx, t) {
    const p = this.plane, dir = this.boy.x > p.x0 ? 1 : -1;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(dir, 1); ctx.rotate(Math.sin(p.u * 14) * 0.2 - 0.1);
    wobble(ctx, [[14, 0], [-12, -8], [-6, 0], [-12, 7]], 8, 0.3); ctx.fillStyle = '#fbfbf6'; ctx.fill(); ink(ctx, 2);
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-6, 0); ink(ctx, 1.2);
    ctx.restore();
  }
}
