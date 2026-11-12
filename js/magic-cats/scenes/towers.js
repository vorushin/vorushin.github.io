// Scene 7 — The world of towers. A dream: everything is covered with water, the people live in
// tall round towers, and ropes run between them — fastened up high on one tower and lower on
// the next — so you lay your belt over the rope, and away you roll.
import { Scene } from '../scene.js';
import { TAU, clamp, clamp01, lerp, ease, rng, hash, dist, approach, spring, shade, mixHex, rgba } from '../util.js';
import { INK, PAL, SKIES, ink, wobble, wobblyPoly, sprite, freeSprites, glow, crayonRings, chalk, starPath, circlePts, drawSkyAll, drawStars, makeStars, drawMoon, tube } from '../paint.js';
import { Kid } from '../actors.js';

const T = {
  bubble: { en: 'Touch the dream bubble', de: 'Tippe die Traumblase an', ru: 'Коснись пузырька со сном' },
  wave: { en: 'Swipe across the water', de: 'Wische übers Wasser', ru: 'Проведи пальцем по воде' },
  wind: { en: 'Swipe through the air', de: 'Wische durch die Luft', ru: 'Проведи пальцем по воздуху' },
  rope: { en: 'Pull the rope across to the lower hook', de: 'Zieh das Seil hinüber zum unteren Haken', ru: 'Протяни верёвку к нижнему крюку' },
  go: { en: 'Tap her — and away she rolls', de: 'Tippe sie an — und los geht die Fahrt', ru: 'Нажми на неё — и покатилась' }
};

const BED = 300, DEEP = 530;       // the sea bed, and how deep the towers are dug into it
const GRAV = 430;                  // how eagerly a rider gathers speed on the slope
// One window of the same size frames the rider at her hook, the ride and the landing, so the camera only travels
// along with her and never cuts in or out between them (on every screen shape, short landscape ones included).
const WIN_W = 250, WIN_H = 176, WIN = { max: 1.7, pad: 24 };
const HANG_DY = 8;                 // a hanging child's origin (the hands) below the rope; keeps the pelvis put when she grabs and lands

const SPEC = [
  { id: 'home', x: 0, r: 44, h: 384, roofH: 74, wall: '#eeb9dc', deep: '#c77fb0', roof: '#c9415a', roofDeep: '#8f2a45', top: -300, low: null, seed: 71, flag: '#ffcf5a' },
  { id: 'friend', x: 340, r: 48, h: 352, roofH: 70, wall: '#f3dc86', deep: '#cfa53a', roof: '#3f8f9a', roofDeep: '#2a6570', top: -270, low: -130, seed: 72, flag: '#f08ab0' },
  { id: 'school', x: 724, r: 54, h: 404, roofH: 64, wall: '#9db6ea', deep: '#5f80c6', roof: '#d9783a', roofDeep: '#a8532a', top: -320, low: -112, seed: 73, flag: '#fbfbf6', bell: true },
  { id: 'light', x: 1244, r: 40, h: 250, roofH: 44, lantern: 36, wall: '#f6f3ea', deep: '#b9b3a8', roof: '#c9415a', roofDeep: '#8f2a45', top: null, low: -30, lowOut: 62, seed: 74, flag: '#ffcf5a', stripes: true }
];

function makeTower(o) {
  const tw = Object.assign({ lantern: 0 }, o), r = rng(tw.seed);
  tw.wins = [];
  for (let y = -60, k = 0; y > -tw.h + 36; y -= 60, k++) { const lit = r() < 0.72 ? 1 : 0.12; tw.wins.push({ dx: Math.sin(k * 2.1 + tw.seed) * tw.r * 0.46, y, lit, base: lit, climb: 0 }); }
  tw.topX = tw.x + tw.r + 20; tw.lowX = tw.x - tw.r - (tw.lowOut || 20);
  tw.tip = -(tw.h + tw.lantern + tw.roofH) + 3;
  tw.hit = 0; tw.hold = 0;
  return tw;
}
const hookTop = (tw) => ({ x: tw.topX, y: tw.top - 68 });
const hookLow = (tw) => ({ x: tw.lowX, y: tw.low - 68 });

// Pre-painted tower above the water line (sprite base = sea level).
function towerSprite(tw) {
  const W = tw.r * 2 + 90, H = tw.h + tw.roofH + tw.lantern + 60;
  return sprite('tower:' + tw.id, W, H, (c) => {
    const cx = W / 2, base = H - 22, top = base - tw.h, r0 = tw.r, r1 = tw.r * (tw.stripes ? 0.76 : 0.93);
    const body = () => wobblyPoly(c, [[cx - r0, base + 18], [cx - r1, top], [cx + r1, top], [cx + r0, base + 18]], tw.seed, 1.5, 90);
    body(); c.fillStyle = tw.wall; c.fill();
    c.save(); c.clip();
    if (tw.stripes) {
      c.fillStyle = '#d9483b';
      for (let y = base - 46; y > top - 10; y -= 94) { c.beginPath(); c.moveTo(cx - r0 - 4, y); c.quadraticCurveTo(cx, y + 18, cx + r0 + 4, y); c.lineTo(cx + r0 + 4, y - 44); c.quadraticCurveTo(cx, y - 26, cx - r0 - 4, y - 44); c.closePath(); c.fill(); }
    }
    // the shading that makes it round
    const g = c.createLinearGradient(cx - r0, 0, cx + r0, 0);
    g.addColorStop(0, rgba(tw.deep, 0.92)); g.addColorStop(0.28, 'rgba(255,255,255,0.32)'); g.addColorStop(0.52, 'rgba(255,255,255,0)'); g.addColorStop(1, rgba(tw.deep, 0.96));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.strokeStyle = rgba(shade(tw.deep, -0.3), 0.5); c.lineWidth = 1.5;
    for (let y = base - 22; y > top + 8; y -= 46) { c.beginPath(); c.ellipse(cx, y - 8, r0 + 3, 9, 0, 0.1, Math.PI - 0.1); c.stroke(); }
    c.restore();
    wobblyPoly(c, [[cx - r0, base + 18], [cx - r1, top], [cx + r1, top], [cx + r0, base + 18]], tw.seed, 1.5, 90, false); ink(c, 4);
    let ry = top + 4;
    if (tw.lantern) {
      const lw = r1 * 0.74;
      wobblyPoly(c, [[cx - r1 - 10, top + 5], [cx + r1 + 10, top + 5], [cx + r1 + 8, top - 3], [cx - r1 - 8, top - 3]], tw.seed + 3, 0.8, 60); c.fillStyle = '#5a4a5e'; c.fill(); ink(c, 3);
      wobblyPoly(c, [[cx - lw, top - 3], [cx - lw, top - tw.lantern], [cx + lw, top - tw.lantern], [cx + lw, top - 3]], tw.seed + 4, 0.8, 60); c.fillStyle = '#ffe36e'; c.fill(); ink(c, 3);
      c.beginPath(); c.moveTo(cx - lw / 3, top - 3); c.lineTo(cx - lw / 3, top - tw.lantern); c.moveTo(cx + lw / 3, top - 3); c.lineTo(cx + lw / 3, top - tw.lantern); ink(c, 1.8);
      ry = top - tw.lantern + 3;
    }
    // witch-hat roof with a curved brim
    const rr = tw.lantern ? r1 * 0.9 : r1, ov = 13, tipY = ry - tw.roofH;
    const roof = () => { c.beginPath(); c.moveTo(cx - rr - ov, ry); c.quadraticCurveTo(cx - rr * 0.3, ry - tw.roofH * 0.62, cx + 2, tipY); c.quadraticCurveTo(cx + rr * 0.34, ry - tw.roofH * 0.62, cx + rr + ov, ry); c.quadraticCurveTo(cx, ry + 17, cx - rr - ov, ry); c.closePath(); };
    roof(); c.fillStyle = tw.roof; c.fill();
    c.save(); c.clip();
    c.strokeStyle = rgba(tw.roofDeep, 0.85); c.lineWidth = 1.6;
    for (let y = ry + 8, k = 0; y > tipY; y -= 11, k++) for (let x = cx - rr - 22 + (k & 1) * 8; x < cx + rr + 22; x += 16) { c.beginPath(); c.arc(x, y, 8, 0.2, Math.PI - 0.2); c.stroke(); }
    const hg = c.createLinearGradient(cx - rr, 0, cx + rr, 0);
    hg.addColorStop(0, 'rgba(255,255,255,0)'); hg.addColorStop(0.3, 'rgba(255,255,255,0.24)'); hg.addColorStop(0.6, 'rgba(255,255,255,0)'); hg.addColorStop(1, rgba(tw.roofDeep, 0.55));
    c.fillStyle = hg; c.fillRect(0, 0, W, H);
    c.restore();
    roof(); ink(c, 4);
  });
}

export default class Towers extends Scene {
  constructor(game, index) {
    super(game, index);
    this.fitView();
    this.sky = SKIES.sea;
    this.stars = makeStars(77, 170);
    this.towers = SPEC.map(makeTower);
    const [A, B] = this.towers, r = rng(909);
    // far-off towers with their own ropes and tiny riders
    this.far = [];
    for (let x = -640, i = 0; x < 2700; x += 190 + r() * 150, i++) this.far.push({ x, w: 26 + r() * 16, h: 150 + r() * 190, seed: i, col: ['#3f7fae', '#4a86b4', '#3a76a6'][i % 3], ph: r() });
    this.girl = new Kid({ kind: 'pigtails', colors: { shirt: '#b9a6e8' }, pose: 'lie', mood: 'sleep', x: A.topX + 7, y: A.top - 34 });
    this.friend = new Kid({ kind: 'curly', colors: { shirt: '#7fce8a' }, pose: 'stand', mood: 'wait', dir: -1, x: B.lowX + 22, y: B.low });
    this.bub = { x: A.topX, y: A.top - 52, r: 72, a: 1 };
    this.mist = 1; this.popT = -1;
    this.ropes = []; this.handle = null; this.riders = []; this.mark = null; this.markA = 0;
    this.waves = []; this.waveCount = 0; this.lastSplash = 0;
    this.wind = { x: 0, v: 0 }; this.streaks = []; this.gusts = 0;
    this.swipe = null; this._sw = null;
    this.kite = { x: B.x + 196, y: B.top - 150, rot: { x: 0, v: 0 } };
    this.bell = { x: 0, v: 0 };
    this.lamp = 0.45;
    this.whale = { x: 950, y: 80, rot: 0, state: 'hidden', t: 0, spout: 0, next: 4 };
    this.fish = [];
    for (let i = 0; i < 9; i++) this.fish.push({ x: -300 + r() * 1800, y: 60 + r() * 210, dir: r() < 0.5 ? -1 : 1, sp: 16 + r() * 26, s: 0.7 + r() * 0.7, col: ['#f2a03a', '#f08ab0', '#ffe36e', '#9fd8b4'][i % 4], ph: r() * TAU });
    this.weeds = [];
    for (let i = 0; i < 26; i++) this.weeds.push({ x: -260 + r() * 1760, h: 34 + r() * 70, ph: r() * TAU });
    // the chalk cloud-snail of the night-garden picture
    this.snail = [];
    for (let a = 0; a < 13.6; a += 0.3) { const rr = 5 + a * 3.9; this.snail.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.82]); }
    for (let k = 0; k <= 30; k++) { const u = k / 30; this.snail.push([56 + u * 150, 20 - Math.sin(u * Math.PI) * 60 - Math.abs(Math.sin(u * Math.PI * 4)) * 12]); }
    for (let k = 0; k <= 26; k++) { const u = k / 26; this.snail.push([206 + Math.sin(u * 9) * (12 - u * 6) + u * 14, 20 + u * 96]); }
    this.camReady = false;            // the camera rests on a framing where the sea and the air can be swiped
    const c0 = this.shotFor(this.bubBox(), { pad: 14 });
    this.cam.x = c0.x; this.cam.y = c0.y; this.cam.zoom = c0.zoom;
    this.expect = () => this.swipeExpect();
    this.audio.play('towers', { intensity: 0.35 }); this.audio.ambience('water');
  }
  fitView() { this.view.safeAbove = this.view.H < 500 ? 440 : 500; }
  onResize() { this.fitView(); }
  dispose() { if (this.zip) this.zip.stop(); freeSprites('tower:'); }

  // ───────────────────────── the story ─────────────────────────
  async run() {
    const [A, B, C, D] = this.towers, g = this.girl, f = this.friend, slow = (s) => (this.reduced ? 0.4 : s);
    this.shot(() => this.bubBox(), 0, { pad: 14 });
    await this.wait(0.8);
    await this.tapOn(() => ({ x: this.bub.x, y: this.bub.y, r: 86 }), { text: T.bubble });
    await this.pop();                                     // she wakes up inside the dream, close up
    this.say(0);                                          // …everything is covered with water, and the people live in tall, round towers.
    await this.shot(this.worldBox(), slow(3.6), { min: 0.55, max: 1 });     // the reveal: how tall it all is
    // across the water a friend has seen her
    f.look = g.anchor('head'); f.mood = 'wave';
    this.spawn(async () => { await this.wait(0.8); g.look = f.anchor('head'); g.mood = 'wave'; });
    await this.shot(() => this.pairBox(), slow(2.2), { max: 1.7 });
    await this.wait(1.6);
    g.mood = 'wait'; f.mood = 'wait'; g.look = null; f.look = null;

    let cam = this.shot(this.waveBox(), slow(2), { ground: true, max: 1.5, exact: true });      // the friend's platform and the sea the wave will run over
    await this.say(1);                                    // Tall — because the towers must be dug deep, deep into the ground…
    await cam;
    this.camReady = true; this.swipe = 'wave';
    await this.until(() => this.waveCount > 0);
    this.swipe = null; this.camReady = false;
    await this.wait(0.8);
    await this.shot({ l: A.x - 110, r: B.x + 110, t: -150, b: DEEP + 24 }, slow(2.4), { min: 0.55, max: 1 });   // down to the sea bed
    this.makeWave(-1);
    await this.wait(1.5);
    this.makeWave(1);
    await this.wait(1.7);
    cam = this.shot(this.airBox(), slow(2.2), { max: 1.5 });                       // up into the air: the girl, the kite, the round walls

    await this.say(2);                                    // Round — so that the wind cannot tip them over.
    await cam;
    this.camReady = true; this.swipe = 'wind';
    await this.until(() => this.gusts > 0);
    this.swipe = null; this.camReady = false;
    await this.wait(2.6);

    await this.say(3);                                    // Between the towers ropes are stretched…
    this.audio.setIntensity(1);
    const r1 = await this.stretch(hookTop(A), hookLow(B), 34);
    this.mark = r1;
    // "up high … lower down": she points down the rope; across the water he nods and taps his hook
    this.spawn(async () => { await this.wait(0.4); g.look = { x: r1.b.x, y: r1.b.y }; g.act('point'); await this.wait(1.2); f.look = { x: r1.b.x, y: r1.b.y - 10 }; f.act('nod'); await this.wait(1.4); f.look = g.anchor('head'); f.mood = 'wave'; });
    await this.say(4);                                    // In one tower the rope is fastened up high, and in the next one lower down…
    await this.wait(0.5);
    // the belt: in close on her at the top of the rope; she can hardly wait
    this.shot(this.readyBox(r1), slow(2), WIN);
    this.spawn(async () => { await this.wait(0.6); g.look = null; g.act('clap'); });
    await this.say(5);                                    // Everyone has a special belt to lay over the rope — and away you roll!
    await this.go(r1, [g], B, [{ x: B.lowX - 2, dir: 1 }]);
    f.dir = -1; f.cheer(); this.audio.sfx.giggle(); this.hearts((g.x + f.x) / 2, g.y - 70, 4);
    await this.wait(0.9);
    this.spawn(async () => { await this.wait(1.2); g.mood = 'wait'; f.mood = 'wait'; });

    await this.say(6);                                    // That is how people go visiting, and go to school, and simply go out for a ride.
    await this.climb(B, [g, f]);
    const r2 = await this.stretch(hookTop(B), hookLow(C), 38);
    await this.go(r2, [g, f], C, [{ x: C.lowX + 54, dir: -1 }, { x: C.lowX - 2, dir: 1 }]);
    this.bell.v += 7; this.audio.sfx.bell(); this.audio.sfx.chime(5);
    this.notes(C.x - C.r - 30, -C.h + 40, 4);
    for (const w of C.wins) w.lit = 1;
    const bellAt = { x: C.x - C.r - 26, y: -C.h + 34 };
    for (const k of [g, f]) k.look = bellAt;
    await this.wait(1.3);
    for (const k of [g, f]) { k.look = null; k.mood = 'wait'; }
    await this.climb(C, [g, f]);
    const r3 = await this.stretch(hookTop(C), hookLow(D), 92);
    r3.mid = 0.3;
    await this.go(r3, [g, f], D, [{ x: D.lowX + 54, dir: -1 }, { x: D.lowX - 2, dir: 1 }]);
    // the lighthouse greets them
    this.audio.sfx.fanfare();
    this.shot({ l: D.lowX - 60, r: D.x + D.r + 40, t: D.tip - 50, b: 44 }, slow(2.4), { max: 1.4 });
    this.spawn(() => this.tween(this, { lamp: 1 }, 1.2, ease.outCubic));
    this.sparkle(D.x, D.tip + 60, 18);
    this.whale.spout = 1;
    const lampAt = { x: D.x, y: -D.h - D.lantern / 2 };
    for (const k of [g, f]) { k.dir = 1; k.look = lampAt; }
    for (let i = 0; i < 3; i++) { await this.wait(0.55); g.cheer(); f.cheer(); this.sparkle(g.x + (i - 1) * 40, g.y - 90, 6); }
    await this.wait(0.6);
    g.mood = 'wave'; f.mood = 'wave'; g.look = this.whale; f.look = this.whale;        // and wave to the whale
    await this.next();
  }

  // ── framings (world boxes for the director's camera) ──
  bubBox() { return { x: this.bub.x, y: this.bub.y + 4, w: 200, h: 196 }; }
  worldBox() { const [A, B] = this.towers; return { l: A.x - 70, r: B.x + B.r + 70, t: A.tip - 30, b: 64 }; }
  waveBox() { const [A, B] = this.towers; return { l: A.x - 50, r: B.x + 90, t: A.top - 96, b: 0 }; }   // (both children wholly in: her balcony is high up)   // (framed with ground: true — the sea line where it normally sits)
  airBox() { const [A, B] = this.towers; return { l: A.x - 40, r: B.x + 236, t: A.top - 150, b: -150 }; }   // the girl's balcony, the kite, the air the swipe goes through (y ≈ −210)
  readyBox(rope) { const a = rope.a; return { x: a.x + 40, y: a.y + 30, w: WIN_W, h: WIN_H }; }    // the rider at her hook and where the rope sets off
  pairBox() { const g = this.girl, f = this.friend; return { l: Math.min(g.x, f.x) - 46, r: Math.max(g.x, f.x) + 46, t: Math.min(g.y, f.y) - 84, b: Math.max(g.y, f.y) + 22 }; }
  // the rope's start (with the girl by it) and where it must be dropped — tight at the sides, so a long rope still reads on an upright phone
  spanBox(a, b) { return { l: Math.min(a.x, b.x) - 62, r: Math.max(a.x, b.x) + 28, t: Math.min(a.y, b.y) - 34, b: Math.max(a.y + 80, b.y + 76) }; }
  towerBox(tw) { return { l: tw.x - tw.r - 64, r: tw.x + tw.r + 64, t: tw.top - 96, b: tw.low + 26 }; }
  // a ride: the window travels with the leading rider (a little room ahead of her), and settles on the platform
  // as she arrives. A long rope need not be in one picture on an upright phone.
  rideBox(to) {
    let k = null;
    for (const rd of this.riders) if (!rd.done && (rd.phase === 'grab' || rd.phase === 'ride' || rd.phase === 'swing') && (!k || rd.kid.x > k.x)) k = rd.kid;
    if (!k) { const rd = this.riders.find((q) => !q.done && q.phase === 'wait'); if (!rd) return this.landBox(to); k = rd.kid; return { x: k.x + 40, y: k.y - 38, w: WIN_W, h: WIN_H }; }
    return { x: k.x + Math.max(0, Math.min(110, to.lowX + 20 - k.x)) / 2, y: k.y + 11, w: WIN_W, h: WIN_H };
  }

  // She floats down onto the balcony, still asleep; wakes; gets up; stretches.
  async pop() {
    const g = this.girl, A = this.towers[0], b = this.bub;
    this.popT = this.t;
    this.audio.sfx.pop(); this.audio.sfx.chime(5);
    this.fx.burst('spark', b.x, b.y, 22, { speed: 190, life: 1, size: 6, colors: ['#ffffff', '#cfe6ff', '#fff3a0', '#f6b0c0'] });
    this.fx.burst('ring', b.x, b.y, 1, { speed: 0, life: 0.7, size: 60, grow: 190, color: 'rgba(220,235,255,0.8)' });
    b.a = 0;
    this.spawn(() => this.tween(this, { mist: 0 }, 2.2, ease.outQuad));
    await this.tween(g, { y: A.top }, this.reduced ? 0.3 : 0.8, ease.inOutSine);
    g.mood = 'wait';                                     // eyes open
    await this.wait(0.45);
    // up onto her feet: the lying figure is carried over to a standing one (pelvis kept in place) and rises
    g.pose = 'stand'; g.x -= 7; g.y = A.top + 15;
    await this.tween(g, { y: A.top }, this.reduced ? 0.25 : 0.55, ease.outCubic);
    g.act('stretch');
    g.look = { x: g.x + 300, y: g.y + 60 };
  }

  // Pull a rope from hook a over to hook b.
  async stretch(a, b, sag) {
    const span = this.spanBox(a, b), SO = { max: 1.6, pad: 14 };
    if (this.shotFor(span, SO).zoom < 1) {
      // too long for one close picture (upright phone): first her and the loose end, then out to where it goes —
      // the camera moves before the hint asks for the drag, and is held while the rope is pulled
      await this.shot({ x: a.x, y: a.y + 30, w: WIN_W, h: WIN_H }, this.reduced ? 0.4 : 1.4, WIN);
      this.girl.look = { x: b.x, y: b.y };
      await this.wait(this.reduced ? 0.2 : 0.7);
    }
    await this.shot(span, this.reduced ? 0.4 : 1.8, SO);
    const h = this.handle = { x: a.x + 3, y: a.y + 20, r: 54, a, b, near: 0, held: false };
    const watch = [this.girl, this.friend].filter((k) => !k.hidden);
    for (const k of watch) k.look = h;                   // everyone follows the loose end with their eyes
    await this.dragTo(h, () => ({ x: b.x, y: b.y, r: 74 }), {
      text: T.rope, slow: 1.2,
      onGrab: () => { h.held = true; this.audio.sfx.rustle(); },
      onMove: () => { h.near = dist(h.x, h.y, b.x, b.y) < 74 ? 1 : 0; },
      onDrop: (ok) => { h.held = false; h.near = 0; if (!ok) this.audio.sfx.swish(); }
    });
    this.handle = null;
    const at = { x: b.x, y: b.y };
    for (const k of watch) { k.look = at; k.joy.v += 6; }
    this.spawn(async () => { await this.wait(1.4); for (const k of watch) if (k.look === at) k.look = null; });
    const L = Math.hypot(b.x - a.x, b.y - a.y), rope = { a, b, sag, L, stars: [], mid: 2, born: this.t };
    const n = L > 380 ? 5 : 3;
    for (let i = 1; i <= n; i++) rope.stars.push({ u: i / (n + 1), got: false, ph: i * 1.7 });
    this.ropes.push(rope);
    this.audio.sfx.knock(); this.audio.chordNote(2, { vel: 0.65 }); this.audio.chordNote(4, { vel: 0.5, when: this.audio.now + 0.12 });
    this.sparkle(b.x, b.y, 12);
    return rope;
  }
  ropeAt(r, u) { return [lerp(r.a.x, r.b.x, u), lerp(r.a.y, r.b.y, u) + r.sag * 4 * u * (1 - u)]; }

  // A walk along a platform at a child's pace.
  async walkTo(k, x, sp) {
    sp = sp || 58;
    if (Math.abs(k.x - x) < 1.5) { k.x = x; return; }
    k.dir = x > k.x ? 1 : -1; k.pose = 'walk';
    await this.frames((dt) => { const d = x - k.x, s = sp * dt; if (Math.abs(d) <= s) { k.x = x; return true; } k.x += Math.sign(d) * s; return false; });
    k.pose = 'stand';
  }

  // Tap the child: belt over the rope, a push, and away. slots: where each rider ends up on the platform.
  async go(rope, kids, to, slots) {
    const g = kids[0], end = { x: rope.b.x, y: rope.b.y - 30 };
    const ready = this.shot(this.readyBox(rope), this.reduced ? 0.4 : 1.6, WIN);
    await this.walkTo(g, rope.a.x);
    await ready;
    g.dir = 1; g.look = end;
    const waiting = [this.girl, this.friend].filter((k) => !kids.includes(k) && !k.hidden);
    for (const k of waiting) { k.look = g.anchor('head'); k.mood = 'wave'; }
    this.goReady = g;
    this.spawn(async () => { while (this.goReady === g) { await this.wait(1.8); if (this.goReady === g && !this.reduced) g.joy.v += 7; } });   // can't wait to go
    await this.tapOn(() => ({ x: g.x, y: g.y - 34, r: 56 }), { text: T.go });
    this.goReady = null; this.mark = null;
    g.joy.v += 8; this.audio.sfx.swish();
    for (const k of waiting) k.mood = 'wait';
    kids.forEach((k, i) => this.riders.push({ kid: k, rope, u: 0, v: 0, t: 0, delay: i * 1.5, lead: i === 0, phase: 'wait', to, slot: slots[i], done: false, watchers: waiting }));
    // whoever waits on the far platform sees her coming and steps back to the door to make room
    for (const k of waiting) if (Math.abs(k.x - to.lowX) < 60) this.spawn(async () => { await this.wait(0.5); await this.walkTo(k, to.lowX + 50, 46); k.dir = -1; });
    this.track(() => this.rideBox(to), WIN);
    await this.until(() => this.riders.every((rd) => rd.done));
    this.riders = [];
    await this.shot(this.landBox(to), this.reduced ? 0.4 : 1.2, WIN);          // (the same window: it just comes to rest)
  }
  landBox(to) { return { x: to.lowX + 20, y: to.low - 38, w: WIN_W, h: WIN_H }; }

  // One rider's trip: wait (and step up to the hook) → grab (belt over the rope, lean back) → ride (a push,
  // then gravity) → swing (the rope ends, the body swings on) → land (onto the platform) → walk to the slot.
  setPhase(rd, ph) { rd.phase = ph; rd.t = 0; }
  stepRider(rd, dt) {
    if (rd.done) return;
    const r = rd.rope, k = rd.kid;
    rd.t += dt;
    if (rd.phase === 'wait') {
      rd.delay -= dt;
      if (Math.abs(k.x - r.a.x) > 0.5) {                 // step up to the hook once it is free
        if (rd.delay < 0.75) {
          if (k.pose !== 'walk') { k.pose = 'walk'; k.dir = r.a.x > k.x ? 1 : -1; }
          k.x += clamp(r.a.x - k.x, -60 * dt, 60 * dt);
        }
        return;
      }
      k.x = r.a.x;
      if (rd.delay > 0) { if (k.pose === 'walk') k.pose = 'stand'; return; }
      // belt over the rope: the origin moves from the feet to the hands, keeping the pelvis where it is
      this.setPhase(rd, 'grab');
      k.pose = 'hang'; k.dir = 1; k.mood = 'happy'; k.look = null; k.y = r.a.y + HANG_DY;
      rd.ry = r.a.y;
      this.audio.sfx.rustle();
      return;
    }
    if (rd.phase === 'grab') {                         // a little lean back for the push
      k.x = r.a.x - 5 * Math.sin(Math.PI * clamp01(rd.t / 0.42));
      if (rd.t < 0.42) return;
      k.x = r.a.x;
      this.setPhase(rd, 'ride'); rd.v = 95;
      this.audio.sfx.whoosh(0.5);
      if (rd.lead) { if (this.zip) this.zip.stop(); this.zip = this.audio.loop('zip'); }
      for (const w of rd.watchers) w.look = k.anchor('head');
      return;
    }
    if (rd.phase === 'ride') {
      const dx = r.b.x - r.a.x, dy = r.b.y - r.a.y + r.sag * 4 * (1 - 2 * rd.u), L = Math.hypot(dx, dy);
      rd.v += (GRAV * (dy / L) - 0.75 * rd.v) * dt;
      if (rd.u > 0.84) rd.v -= (rd.v - 46) * 3.2 * dt;  // slowing for the hook
      if (rd.v < 46) rd.v = 46;
      rd.u = Math.min(1, rd.u + (rd.v * dt) / L);
      const p = this.ropeAt(r, rd.u);
      k.x = p[0]; k.y = p[1] + HANG_DY; rd.ry = p[1];
      // wind in the hair
      k.wind = { x: -rd.v * dx / L, y: -rd.v * dy / L };      // the air of the ride (people.js: still under reduced motion)
      const lastOn = this.riders.filter((q) => q.phase === 'ride').pop();
      if (this.zip && rd === lastOn) this.zip.set(clamp01(rd.v / 240), clamp01(rd.v / 430));   // the rope hums for whoever is still riding
      if (rd.lead) {
        for (const s of r.stars) if (!s.got && rd.u >= s.u) {
          s.got = true;
          const q = this.ropeAt(r, s.u);
          this.audio.sfx.sparkle(this.pan(q[0])); this.game.catchFly(1);
          this.fx.burst('spark', q[0], q[1] + 30, 8, { speed: 90, life: 0.7, size: 5, colors: ['#fff7c0', '#ffe36e'] });
        }
        if (rd.u >= r.mid) { r.mid = 2; this.whaleJump(); }
      }
      if (!this.reduced && Math.random() < dt * 22) this.fx.add({ kind: 'spark', x: k.x - 8, y: k.y + 20 + Math.random() * 30, vx: -rd.v * 0.25, vy: 0, life: 0.5, size: 3.4, color: '#fff7c0', drag: 2 });
      if (k.y + 60 > -52 && Math.random() < dt * 30) this.fx.add({ kind: 'drop', x: k.x - 6, y: -4, vx: -40 - Math.random() * 60, vy: -70 - Math.random() * 70, life: 0.6, size: 2.6, color: '#cfeaf7', grav: 420 });
      if (rd.u >= 1) {
        this.setPhase(rd, 'swing'); k.wind = null;             // the hair settles while the body swings
        this.audio.sfx.knock();
        if (this.zip && !this.riders.some((q) => q.phase === 'ride' || q.phase === 'wait' || q.phase === 'grab')) { this.zip.stop(); this.zip = null; }
      }
      return;
    }
    if (rd.phase === 'swing') {                        // the hands stop at the hook, the body swings on and back
      if (rd.t < (this.reduced ? 0.2 : 0.7)) return;
      // feet onto the platform (origin back to the feet, pelvis kept)
      this.setPhase(rd, 'land');
      // feet under the hips where the swing has left them (the rig keeps the pelvis put), then settle onto the boards
      const P = k.joints().pelvis;
      k.pose = 'stand'; k.x = P.x; k.y = Math.min(rd.to.low, P.y - k.B.standHip * k.size);
      k.joy.v -= 5;
      this.audio.sfx.land(this.pan(k.x), true); this.audio.playerNote({ pan: this.pan(k.x) });
      this.fx.burst('puff', k.x, k.y, 5, { speed: 50, a0: -Math.PI, a1: 0, life: 0.5, size: 6, color: 'rgba(255,255,255,0.6)' });
      return;
    }
    if (rd.phase === 'land') {                         // a moment to find her feet, then over to her place
      k.y = approach(k.y, rd.to.low, 14, dt); if (Math.abs(k.y - rd.to.low) < 0.3) k.y = rd.to.low;
      if (rd.t < (rd.lead ? 0.2 : 0.3)) return;
      const s = rd.slot, d = s.x - k.x;
      if (Math.abs(d) > 0.5) {
        if (k.pose !== 'walk') { k.pose = 'walk'; k.dir = d > 0 ? 1 : -1; }
        k.x += clamp(d, -62 * dt, 62 * dt);
        return;
      }
      k.x = s.x; k.pose = 'stand'; k.dir = s.dir;
      k.cheer();
      for (const w of rd.watchers) if (w.look === k.anchor('head')) w.look = null;
      rd.done = true;
    }
  }

  // Up the spiral stairs: in at the lower door, a light climbs from window to window, out at the top.
  async climb(tw, kids) {
    const slow = this.reduced ? 0.4 : 2;
    this.shot(this.towerBox(tw), slow, { min: 0.6, max: 1.3 });
    await this.wait(0.3);
    const door = tw.x - tw.r + 15, out = tw.x + tw.r - 15;
    for (const k of kids) k.look = null;
    await Promise.all(kids.map(async (k, i) => { await this.wait(i * 0.3); await this.walkTo(k, door); k.hidden = true; }));
    this.audio.sfx.knock();
    const ws = tw.wins.filter((w) => w.y < tw.low - 4 && w.y > tw.top - 20).sort((p, q) => q.y - p.y);
    for (const w of ws) { w.climb = 1; this.audio.sfx.step(this.pan(tw.x)); this.audio.scaleNote(ws.indexOf(w), { vel: 0.35 }); await this.wait(0.3); w.climb = 0; w.lit = 1; }
    this.audio.sfx.pop();
    await Promise.all(kids.map(async (k, i) => {
      await this.wait(i * 0.45);
      k.x = out; k.y = tw.top; k.pose = 'stand'; k.dir = 1; k.hidden = false;
      await this.walkTo(k, i ? tw.topX - 40 : tw.topX);
      k.cheer();
    }));
    this.spawn(async () => { await this.wait(1); for (const k of kids) k.mood = 'wait'; });
  }

  // ── water and wind toys ──
  swipeExpect() {
    if (!this.swipe || !this.camReady) return null;
    const v = this.view, F = v.freeRect(), c = v.toWorld((F.l + F.r) / 2, 0).x;
    return this.swipe === 'wave' ? { kind: 'drag', x: c - 120, y: 6, x2: c + 130, y2: 6, r: 40, text: T.wave }
      : { kind: 'drag', x: c - 110, y: -205, x2: c + 150, y2: -215, r: 40, text: T.wind };
  }
  onDown(p) {
    this._sw = { x: p.x, y: p.y, fired: false };
    const w = this.whale;
    if (w.state === 'float' && dist(p.x, p.y, w.x, w.y - 20) < 70) { w.spout = 1; this._sw = null; }
  }
  onMove(p) {
    const s = this._sw;
    if (!s || s.fired) return;
    const dx = p.x - s.x;
    if (Math.abs(dx) < 56) return;
    s.fired = true;
    // (the sea and the sky answer at any time; only a swipe made while the story asks for it moves it on)
    if (s.y > -26) { this.makeWave(dx > 0 ? 1 : -1, s.x); if (this.swipe === 'wave') this.waveCount++; } else { this.gust(dx > 0 ? 1 : -1); if (this.swipe === 'wind') this.gusts++; }
  }
  onUp() { this._sw = null; }
  makeWave(dir, x) {
    this.waves.push({ x: x === undefined ? this.cam.x - dir * 420 : x, dir, age: 0, life: 3.4, px: 0 });
    this.audio.sfx.splash(this.pan(x === undefined ? this.cam.x : x));
  }
  gust(dir) {
    const v = this.view;
    this.wind.v += dir * 4.6;
    this.kite.rot.v += dir * 13;
    this.audio.sfx.whoosh(1.1);
    for (const k of [this.girl, this.friend]) {          // the children on the platforms feel it and look up at the kite
      if (k.hidden || k.pose === 'hang' || this.bub.a > 0) continue;
      const at = this.kite; k.look = at; k.joy.v += 6;
      this.spawn(async () => { await this.wait(2.2); if (k.look === at) k.look = null; });
    }
    for (let i = 0; i < 18; i++) this.streaks.push({ x: dir > 0 ? v.left - Math.random() * 420 : v.right + Math.random() * 420, y: -40 - Math.random() * 430, len: 80 + Math.random() * 140, sp: dir * (480 + Math.random() * 300), age: 0, life: 2.4, sgn: i & 1 ? 1 : -1, front: i % 3 === 0, seed: i * 7 });
  }
  surf(x) {
    const t = this.t;
    let y = Math.sin(x * 0.021 + t * 1.2) * 2.4 + Math.sin(x * 0.05 - t * 0.9) * 1.3;
    for (const w of this.waves) { const d = x - w.x; if (d > -240 && d < 240) y -= w.amp * Math.exp(-(d * d) / 9000); }
    return y;
  }
  splashAt(x, n, k) {
    this.fx.burst('drop', x, -2, n || 10, { speed: 190 * (k || 1), a0: -Math.PI * 0.85, a1: -Math.PI * 0.15, grav: 560, color: '#d6effa', life: 0.9, size: 3.2, drag: 0.4 });
    if (this.t - this.lastSplash > 0.18) { this.lastSplash = this.t; this.audio.sfx.splash(this.pan(x)); }
  }
  whaleJump() { const w = this.whale; if (w.state !== 'hidden') return; w.state = 'jump'; w.t = 0; this.splashAt(930, 16, 1.2); }

  // ── camera ──
  pan(x) { return clamp(((x - this.cam.x) / Math.max(1, this.view.width)) * 1.6, -0.8, 0.8); }

  update(dt) {
    const t = this.t, c = this.cam;
    // riders first: a grab or a landing changes pose and position together, and the rig must see both in the
    // same tick (updated before them, it drew one frame of the new pose at the old origin, ~60 units off)
    for (const rd of this.riders) this.stepRider(rd, dt);
    this.girl.update(dt); this.friend.update(dt);
    // waves
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const w = this.waves[i];
      w.age += dt; w.px = w.x; w.x += w.dir * 300 * dt;
      w.amp = 26 * Math.min(1, w.age * 5) * Math.pow(Math.max(0, 1 - w.age / w.life), 0.7);
      for (const tw of this.towers) if ((w.px - tw.x) * (w.x - tw.x) <= 0 && w.amp > 5) { tw.hit = 1; tw.hold = 1; this.splashAt(tw.x - w.dir * tw.r, 12, w.amp / 26); }
      if (w.age >= w.life) this.waves.splice(i, 1);
    }
    for (const tw of this.towers) { tw.hit = Math.max(0, tw.hit - dt * 1.4); tw.hold = Math.max(0, tw.hold - dt * 0.7); }
    // wind
    spring(this.wind, 0, dt, 6, 2.2);
    for (let i = this.streaks.length - 1; i >= 0; i--) { const s = this.streaks[i]; s.age += dt; s.x += s.sp * dt; if (s.age > s.life) this.streaks.splice(i, 1); }
    const B = this.towers[1], k = this.kite, wx = this.wind.x;
    k.x = approach(k.x, B.x + 196 + Math.sin(t * 0.6) * 16 + wx * 64, 2.4, dt);
    k.y = approach(k.y, B.top - 150 + Math.cos(t * 0.8) * 9 - Math.abs(wx) * 14, 2.4, dt);
    spring(k.rot, wx * 0.5 + Math.sin(t * 1.1) * 0.12, dt, 30, 3);
    spring(this.bell, 0, dt, 60, 2.6);
    // sea life
    for (const f of this.fish) { f.x += f.dir * f.sp * dt; if (f.x > c.x + 760) f.x -= 1500; if (f.x < c.x - 760) f.x += 1500; }
    const w = this.whale;
    if (w.state === 'jump') {
      w.t += dt / 1.75;
      const u = Math.min(1, w.t);
      w.x = lerp(930, 1092, u); w.y = 56 - 170 * Math.sin(Math.PI * u);
      w.rot = Math.atan2(-170 * Math.PI * Math.cos(Math.PI * u), 162) * 0.75;
      if (u >= 1) { w.state = 'float'; w.rot = 0; this.splashAt(w.x + 20, 20, 1.3); w.next = 2.2; }
    } else if (w.state === 'float') {
      w.x = approach(w.x, 1070, 0.8, dt); w.y = approach(w.y, 10 + Math.sin(t * 1.2) * 3, 3, dt);
      w.next -= dt;
      if (w.next < 0) { w.next = 4.5 + Math.random() * 3; w.spout = 1; }
      if (w.spout > 0) {
        if (w.spout === 1) { this.audio.sfx.plip(this.pan(w.x)); this.fx.burst('drop', w.x + 18, w.y - 44, 14, { speed: 150, a0: -Math.PI * 0.72, a1: -Math.PI * 0.28, grav: 420, color: '#e6f4fb', life: 1, size: 3 }); }
        w.spout = Math.max(0, w.spout - dt * 0.9);
      }
    }
    if (this.mist > 0.3 && !this.reduced && Math.random() < dt * 0.8) this.zzz(this.bub.x + 26, this.bub.y - 30);
    this.markA = approach(this.markA, this.mark ? 1 : 0, 4, dt);
    // bubbles drifting up below
    if (c.y > 60 && Math.random() < dt * 5) this.fx.add({ kind: 'ring', x: c.x + (Math.random() - 0.5) * this.view.width, y: BED - Math.random() * 80, vx: 0, vy: -34 - Math.random() * 20, life: 4, size: 2 + Math.random() * 3, color: 'rgba(214,239,250,0.7)', drag: 0, sway: 10, layer: -1 });
  }

  // ───────────────────────── drawing ─────────────────────────
  draw(ctx, view, t) {
    const sky = this.sky, cam = this.cam, top0 = view.top - cam.y;
    drawSkyAll(ctx, view, sky, 7, { air: 0.6 });
    drawStars(ctx, view, this.stars, t, sky.star, this.reduced);
    // (moon and snail-cloud keep their size on screen when the camera comes close)
    const fk = 1 / Math.max(1, cam.zoom), free0 = view.free - Math.max(0, cam.y), mx = view.left + view.width * 0.82, my = Math.max(free0 + 64 * fk, -640);
    drawMoon(ctx, mx, my, 40 * fk, t, { halo: 0.5 });
    // chalk snail-cloud
    ctx.save(); ctx.translate(view.left + view.width * 0.2 - cam.x * 0.05, Math.max(free0 + 110 * fk, -600) + Math.sin(t * 0.3) * 4 * fk); ctx.scale(fk, fk);
    chalk(ctx, this.snail, { width: 2.6, alpha: 0.5, color: '#cfe0ff', seed: Math.floor(t * 3) });
    ctx.restore();
    this.drawFar(ctx, view, t);

    // ── the sea ──
    const x0 = view.left - 20, x1 = view.right + 20, sp = [];
    for (let x = Math.floor(x0 / 18) * 18; x <= x1 + 18; x += 18) sp.push([x, this.surf(x)]);
    const yb = Math.max(view.bottom + 20, 60);
    const wg = ctx.createLinearGradient(0, 0, 0, BED);
    wg.addColorStop(0, '#2c88ad'); wg.addColorStop(0.3, '#1c5f8a'); wg.addColorStop(1, '#0c3158');
    ctx.fillStyle = wg; ctx.beginPath(); ctx.moveTo(x0, yb);
    for (const p of sp) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(x1, yb); ctx.closePath(); ctx.fill();
    if (cam.y > 10 || view.bottom > BED + 40) this.drawDeep(ctx, view, t);
    // moonlight and window light on the water
    ctx.save(); ctx.lineCap = 'round'; ctx.globalAlpha = clamp01(1 - cam.y / 150);
    for (let i = 0; i < 16; i++) {
      const gx = mx + (hash(i * 7 + 1) - 0.5) * (120 + i * 22), gy = 7 + hash(i * 13 + 5) * 60, len = 8 + hash(i * 3) * 22;
      ctx.strokeStyle = 'rgba(238,240,160,' + (0.2 + 0.4 * (0.5 + 0.5 * Math.sin(t * (1.5 + hash(i) * 2) + i))).toFixed(2) + ')';
      ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(gx - len, gy); ctx.lineTo(gx + len, gy); ctx.stroke();
    }
    for (const tw of this.towers) {
      if (!view.visible(tw.x, 120)) continue;
      ctx.fillStyle = rgba(tw.wall, 0.2); ctx.beginPath();
      for (let k = 0; k <= 8; k++) ctx.lineTo(tw.x - tw.r * (1 - k * 0.05) + Math.sin(t * 2 + k * 1.3 + tw.x) * 4, 8 + k * 11);
      for (let k = 8; k >= 0; k--) ctx.lineTo(tw.x + tw.r * (1 - k * 0.05) + Math.sin(t * 2.3 + k * 1.1 + tw.x) * 4, 8 + k * 11);
      ctx.closePath(); ctx.fill();
      for (let k = 0; k < 3; k++) { ctx.strokeStyle = 'rgba(255,227,110,' + (0.28 - k * 0.07).toFixed(2) + ')'; ctx.lineWidth = 3; ctx.beginPath(); const yy = 20 + k * 22, w = 9 - k * 2, ox = Math.sin(t * 2.4 + k + tw.x) * 5; ctx.moveTo(tw.x - w + ox, yy); ctx.lineTo(tw.x + w + ox, yy); ctx.stroke(); }
    }
    ctx.restore();

    for (const s of this.streaks) if (!s.front) this.drawStreak(ctx, s);
    for (const tw of this.towers) if (view.visible(tw.x, 200)) this.drawTower(ctx, tw, t);
    // water in front of the tower feet + the chalky surface line
    const fg = ctx.createLinearGradient(0, -6, 0, 30);
    fg.addColorStop(0, 'rgba(44,136,173,0.95)'); fg.addColorStop(1, 'rgba(36,118,158,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(x0, 30);
    for (const p of sp) ctx.lineTo(p[0], p[1]);
    ctx.lineTo(x1, 30); ctx.closePath(); ctx.fill();
    chalk(ctx, sp, { width: 2.2, alpha: 0.55, color: '#cfeaf7', seed: Math.floor(t * 5), rough: 0.6 });
    for (const tw of this.towers) {
      if (!view.visible(tw.x, 120)) continue;
      ctx.strokeStyle = 'rgba(230,246,252,' + (0.5 + 0.5 * tw.hit).toFixed(2) + ')'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(tw.x, this.surf(tw.x) + 2, tw.r + 9 + tw.hit * 10 + Math.sin(t * 2 + tw.x) * 2, 4 + tw.hit * 3, 0, 0, TAU); ctx.stroke();
    }

    this.drawWhale(ctx, view, t);
    // ropes
    for (const r of this.ropes) this.drawRope(ctx, r, t);
    if (this.markA > 0.02 && this.ropes.length) this.drawMark(ctx, this.mark || this.ropes[0], t);
    if (this.handle) this.drawHandle(ctx, t);
    this.drawKite(ctx, t);

    // the children
    for (const k of [this.friend, this.girl]) {
      if (this.bub.a > 0 && k === this.girl) continue;
      const rd = this.riders.find((q) => q.kid === k && (q.phase === 'grab' || q.phase === 'ride' || q.phase === 'swing'));
      // the belt: a strap laid over the rope, both ends in the fists
      if (rd) { const hl = k.anchor('handL'), hr = k.anchor('handR'); tube(ctx, [[hl.x, hl.y], [k.x - 6, rd.ry - 2], [k.x, rd.ry - 9], [k.x + 6, rd.ry - 2], [hr.x, hr.y]], 3.6, '#e2483b', INK, 2.8); }
      k.drawFull(ctx, t);
    }
    if (this.goReady && !this.goReady.hidden) { const k = this.goReady; ctx.beginPath(); ctx.ellipse(k.x + 12, k.y - 26 + Math.sin(t * 6) * 1.5, 5, 7, 0.3, 0, TAU); ink(ctx, 5); ctx.beginPath(); ctx.ellipse(k.x + 12, k.y - 26 + Math.sin(t * 6) * 1.5, 5, 7, 0.3, 0, TAU); ink(ctx, 2.6, '#e2483b'); }
    for (const s of this.streaks) if (s.front) this.drawStreak(ctx, s);
    this.fx.draw(ctx, t, 0);

    // the dream is still misty until the bubble opens
    if (this.mist > 0.004) {
      ctx.fillStyle = 'rgba(11,16,56,' + (0.62 * this.mist).toFixed(3) + ')';
      ctx.fillRect(view.left - 10, view.top - 10, view.width + 20, view.height + 20);
    }
    if (this.bub.a > 0) this.drawBubble(ctx, t);
  }

  drawFar(ctx, view, t) {
    const par = 0.42, off = this.cam.x * (1 - par), F = this.far;
    ctx.save();
    for (let i = 0; i < F.length; i++) {
      const f = F[i], x = f.x + off;
      if (x < view.left - 400 || x > view.right + 400) continue;
      const n = F[i + 1];
      if (n) {
        const a = [x + f.w / 2, -f.h * 0.82], b = [n.x + off - n.w / 2, -n.h * 0.36], pts = [];
        for (let k = 0; k <= 10; k++) { const u = k / 10; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + 22 * 4 * u * (1 - u)]); }
        chalk(ctx, pts, { width: 1.4, alpha: 0.32, color: '#cfe0ff', rough: 0.3, seed: i });
        const u = ((t * 0.16 + f.ph) % 1), uu = u * u, px = lerp(a[0], b[0], uu), py = lerp(a[1], b[1], uu) + 22 * 4 * uu * (1 - uu);
        ctx.fillStyle = 'rgba(255,243,176,' + (Math.sin(Math.PI * u) * 0.9).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(px, py + 5, 3, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = f.col; ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.moveTo(x - f.w / 2, 4); ctx.lineTo(x - f.w * 0.46, -f.h); ctx.lineTo(x - f.w * 0.62, -f.h); ctx.quadraticCurveTo(x - f.w * 0.1, -f.h - f.w * 0.9, x, -f.h - f.w * 1.5); ctx.quadraticCurveTo(x + f.w * 0.1, -f.h - f.w * 0.9, x + f.w * 0.62, -f.h); ctx.lineTo(x + f.w * 0.46, -f.h); ctx.lineTo(x + f.w / 2, 4); ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
      for (let k = 0; k < 4; k++) { if (hash(f.seed * 9 + k) < 0.3) continue; ctx.fillStyle = 'rgba(255,233,160,' + (0.55 + 0.3 * Math.sin(t * 0.9 + k + f.seed)).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(x + (hash(f.seed + k * 3) - 0.5) * f.w * 0.5, -f.h * (0.2 + k * 0.2), 2.6, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
  }

  // Below the surface: the shafts go down through the water and deep into the sea bed.
  drawDeep(ctx, view, t) {
    const x0 = view.left - 20, x1 = view.right + 20;
    ctx.save();
    if (!this.reduced) for (let i = 0; i < 5; i++) {      // slanting light
      const lx = Math.floor(view.left / 260) * 260 + i * 260 + Math.sin(t * 0.3 + i) * 30;
      ctx.fillStyle = 'rgba(190,235,250,0.05)'; ctx.beginPath(); ctx.moveTo(lx, 4); ctx.lineTo(lx + 70, 4); ctx.lineTo(lx - 60, BED); ctx.lineTo(lx - 190, BED); ctx.closePath(); ctx.fill();
    }
    for (const tw of this.towers) {
      if (!view.visible(tw.x, 120)) continue;
      wobblyPoly(ctx, [[tw.x - tw.r, 8], [tw.x - tw.r, BED + 6], [tw.x + tw.r, BED + 6], [tw.x + tw.r, 8]], tw.seed + 20, 1.4, 90);
      ctx.fillStyle = mixHex(tw.wall, '#1b5a84', 0.62); ctx.fill();
      wobblyPoly(ctx, [[tw.x - tw.r, 8], [tw.x - tw.r, BED + 6], [tw.x + tw.r, BED + 6], [tw.x + tw.r, 8]], tw.seed + 20, 1.4, 90, false); ink(ctx, 3.4, 'rgba(18,22,60,0.75)');
      ctx.strokeStyle = 'rgba(12,30,70,0.3)'; ctx.lineWidth = 1.5;
      for (let y = 40; y < BED; y += 46) { ctx.beginPath(); ctx.ellipse(tw.x, y - 8, tw.r + 2, 9, 0, 0.1, Math.PI - 0.1); ctx.stroke(); }
    }
    for (const w of this.weeds) {
      if (!view.visible(w.x, 40)) continue;
      const sw = Math.sin(t * 1.1 + w.ph) * 10;
      tube(ctx, [[w.x, BED + 4], [w.x + sw * 0.4, BED - w.h * 0.5], [w.x + sw, BED - w.h]], 4.4, '#2f9a6a', 'rgba(18,22,60,0.7)', 3);
    }
    for (const f of this.fish) {
      if (!view.visible(f.x, 40)) continue;
      ctx.save(); ctx.translate(f.x, f.y + Math.sin(t * 1.4 + f.ph) * 6); ctx.scale(f.dir * f.s, f.s);
      wobble(ctx, [[-10, 0], [-22, -9 + Math.sin(t * 8 + f.ph) * 2], [-22, 9 + Math.sin(t * 8 + f.ph) * 2]], 5, 0.3); ctx.fillStyle = shade(f.col, -0.2); ctx.fill(); ink(ctx, 2);
      wobble(ctx, circlePts(0, 0, 13, 9, 8), 7, 0.4); ctx.fillStyle = f.col; ctx.fill(); ink(ctx, 2.2);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(6.5, -2, 1.5, 0, TAU); ctx.fill();
      ctx.restore();
    }
    this.fx.draw(ctx, t, -1);
    // the sea bed, cut open so we can see how deep the towers go
    const eg = ctx.createLinearGradient(0, BED, 0, DEEP + 60);
    eg.addColorStop(0, '#6b5540'); eg.addColorStop(0.25, '#4a3a30'); eg.addColorStop(1, '#2a2126');
    ctx.fillStyle = eg; ctx.beginPath(); ctx.moveTo(x0, view.bottom + 30);
    for (let x = Math.floor(x0 / 40) * 40; x <= x1 + 40; x += 40) ctx.lineTo(x, BED + Math.sin(x * 0.02) * 7 + (hash(x) - 0.5) * 5);
    ctx.lineTo(x1, view.bottom + 30); ctx.closePath(); ctx.fill();
    for (let i = Math.floor(x0 / 46); i * 46 < x1; i++) { ctx.fillStyle = 'rgba(20,14,22,' + (0.18 + hash(i * 5) * 0.2).toFixed(2) + ')'; ctx.beginPath(); ctx.ellipse(i * 46 + hash(i) * 40, BED + 24 + hash(i * 3) * 110, 7 + hash(i * 7) * 9, 4 + hash(i * 11) * 4, 0, 0, TAU); ctx.fill(); }
    for (const tw of this.towers) {
      if (!view.visible(tw.x, 120)) continue;
      const w = tw.r * 0.9, hold = tw.hold;
      wobblyPoly(ctx, [[tw.x - w, BED - 2], [tw.x - w * 0.94, DEEP], [tw.x + w * 0.94, DEEP], [tw.x + w, BED - 2]], tw.seed + 30, 1.4, 50);
      ctx.fillStyle = mixHex('#8f8478', tw.wall, 0.22); ctx.fill();
      ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(29,21,48,0.4)'; ctx.lineWidth = 1.6; ctx.beginPath();
      for (let y = BED + 20, k = 0; y < DEEP; y += 22, k++) { ctx.moveTo(tw.x - w, y); ctx.lineTo(tw.x + w, y); for (let x = tw.x - w + (k & 1) * 16; x < tw.x + w; x += 32) { ctx.moveTo(x, y - 22); ctx.lineTo(x, y); } }
      ctx.stroke(); ctx.restore();
      wobblyPoly(ctx, [[tw.x - w, BED - 2], [tw.x - w * 0.94, DEEP], [tw.x + w * 0.94, DEEP], [tw.x + w, BED - 2]], tw.seed + 30, 1.4, 50); ink(ctx, 3.4);
      // chalk: how deep it goes — and it holds
      const cx = tw.x + w + 16;
      ctx.setLineDash([5, 7]); chalk(ctx, [[cx, BED + 4], [cx, DEEP - 4]], { width: 2.2, alpha: 0.6 + 0.4 * hold, color: '#fff3b8', rough: 0 }); ctx.setLineDash([]);
      chalk(ctx, [[cx - 7, DEEP - 14], [cx, DEEP - 3], [cx + 7, DEEP - 14]], { width: 2.4, alpha: 0.7 + 0.3 * hold, color: '#fff3b8', rough: 0.3 });
      chalk(ctx, [[cx - 7, BED + 14], [cx, BED + 3], [cx + 7, BED + 14]], { width: 2.4, alpha: 0.7 + 0.3 * hold, color: '#fff3b8', rough: 0.3 });
      if (hold > 0.02) crayonRings(ctx, tw.x, (BED + DEEP) / 2 + 6, 40 + 34 * (1 - hold), t, { alpha: hold * 0.7, rings: 3, seed: tw.seed });
    }
    ctx.restore();
  }

  drawTower(ctx, tw, t) {
    const s = towerSprite(tw), wx = this.wind.x;
    // balconies behind the wall line
    if (tw.top !== null) this.drawBalcony(ctx, tw.x + tw.r - 4, tw.x + tw.r + 52, tw.top, tw.x + tw.r, tw.seed + 5);
    if (tw.low !== null) {
      if (tw.lowOut) {                       // the lighthouse has a jetty instead
        for (const px of [tw.lowX - 30, tw.lowX + 28]) tube(ctx, [[px, tw.low + 4], [px, 22]], 5, '#a8743f', INK, 3.2);
        wobblyPoly(ctx, [[tw.lowX - 44, tw.low], [tw.x - tw.r + 6, tw.low], [tw.x - tw.r + 6, tw.low + 8], [tw.lowX - 44, tw.low + 8]], tw.seed + 6, 0.8, 50); ctx.fillStyle = '#d9a866'; ctx.fill(); ink(ctx, 3);
      } else this.drawBalcony(ctx, tw.x - tw.r - 52, tw.x - tw.r + 4, tw.low, tw.x - tw.r, tw.seed + 6);
    }
    ctx.drawImage(s.c, tw.x - s.w / 2, 22 - s.h, s.w, s.h);
    // portholes
    for (const w of tw.wins) {
      const x = tw.x + w.dx, y = w.y, L = Math.max(w.lit, w.climb);
      if (L > 0.3) glow(ctx, x, y, 30 + 16 * w.climb, PAL.winWarm, 0.3 * L + 0.4 * w.climb);
      ctx.beginPath(); ctx.arc(x, y, 9.5, 0, TAU);
      ctx.fillStyle = L > 0.5 ? (w.climb ? '#fff7c0' : PAL.winLit) : '#3a2c58'; ctx.fill(); ink(ctx, 2.6);
      if (w.climb) { ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - 2, y + 2.5, 4.2, 0, TAU); ctx.arc(x + 4, y + 3.5, 3.6, 0, TAU); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x + 9, y); ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9); ink(ctx, 1.4); }
    }
    // doors, hook posts
    if (tw.top !== null) { this.drawDoor(ctx, tw.x + tw.r - 15, tw.top); this.drawPost(ctx, tw.x + tw.r + 46, tw.topX, tw.top, tw.top - 68); }
    if (tw.low !== null) { this.drawDoor(ctx, tw.x - tw.r + 15, tw.low); this.drawPost(ctx, tw.lowX - 26, tw.lowX, tw.low, tw.low - 68); }
    if (tw.id === 'school') {
      // a clock and a bell: this is the school
      const cy = -tw.h + 62;
      ctx.beginPath(); ctx.arc(tw.x, cy, 15, 0, TAU); ctx.fillStyle = '#fbfbf6'; ctx.fill(); ink(ctx, 2.8);
      ctx.beginPath(); ctx.moveTo(tw.x, cy); ctx.lineTo(tw.x, cy - 10); ctx.moveTo(tw.x, cy); ctx.lineTo(tw.x + 7, cy + 3); ink(ctx, 2);
      const bx = tw.x - tw.r - 26, by = -tw.h + 26;
      tube(ctx, [[tw.x - tw.r + 2, by - 6], [bx, by - 6]], 3.4, '#a8743f', INK, 3);
      ctx.save(); ctx.translate(bx, by - 4); ctx.rotate(this.bell.x * 0.5);
      ctx.beginPath(); ctx.moveTo(-11, 22); ctx.quadraticCurveTo(-11, 2, 0, 2); ctx.quadraticCurveTo(11, 2, 11, 22); ctx.closePath(); ctx.fillStyle = '#f2c23a'; ctx.fill(); ink(ctx, 2.8);
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(-this.bell.x * 5, 24, 3, 0, TAU); ctx.fill();
      ctx.restore();
    }
    if (tw.lantern) {
      const ly = -tw.h - tw.lantern / 2, L = this.lamp, sw = Math.sin(t * 0.7);
      glow(ctx, tw.x, ly, 70 + 50 * L, '#ffe9a0', 0.5 + 0.4 * L);
      if (!this.reduced) for (const sd of [-1, 1]) { ctx.fillStyle = 'rgba(255,240,170,' + (0.1 * L * (0.6 + 0.4 * sd * sw)).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(tw.x, ly); ctx.lineTo(tw.x + sd * 420, ly - 70 + sw * 50); ctx.lineTo(tw.x + sd * 420, ly + 60 + sw * 50); ctx.closePath(); ctx.fill(); }
      if (L > 0.5) crayonRings(ctx, tw.x, ly, 30 + 46 * L, t, { alpha: 0.6 * (L - 0.5) * 2, rings: 5, seed: 12 });
    }
    // flag in the wind
    const fx = tw.x + 2, fy = tw.tip, dir = wx < -0.08 ? -1 : 1, pull = Math.min(1, Math.abs(wx)), fl = Math.sin(t * (5 + pull * 9) + tw.x) * (5 - pull * 2);
    tube(ctx, [[fx, fy + 4], [fx, fy - 24]], 2.2, '#8a5a2b', INK, 2.4);
    wobble(ctx, [[fx, fy - 24], [fx + dir * 13, fy - 21 + fl * 0.5 + (1 - pull) * 3], [fx + dir * 25, fy - 17 + fl + (1 - pull) * 7], [fx + dir * 12, fy - 13 + fl * 0.5 + (1 - pull) * 3], [fx, fy - 11]], tw.seed + 9, 0.4);
    ctx.fillStyle = tw.flag; ctx.fill(); ink(ctx, 2.2);
  }
  drawBalcony(ctx, xa, xb, y, wallX, sd) {
    tube(ctx, [[wallX, y + 30], [(xa + xb) / 2 + (xb > wallX + 20 ? 12 : -12), y + 6]], 4, '#a8743f', INK, 3);
    wobblyPoly(ctx, [[xa, y], [xb, y], [xb, y + 8], [xa, y + 8]], sd, 0.8, 50); ctx.fillStyle = '#d9a866'; ctx.fill(); ink(ctx, 3);
  }
  drawDoor(ctx, x, y) {
    ctx.beginPath(); ctx.moveTo(x - 10, y); ctx.lineTo(x - 10, y - 20); ctx.quadraticCurveTo(x, y - 36, x + 10, y - 20); ctx.lineTo(x + 10, y); ctx.closePath();
    ctx.fillStyle = '#6b3f2a'; ctx.fill(); ink(ctx, 2.6);
    ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(x + 4, y - 13, 1.8, 0, TAU); ctx.fill();
  }
  drawPost(ctx, px, hx, floorY, hookY) {
    tube(ctx, [[px, floorY], [px, hookY - 6]], 3.8, '#a8743f', INK, 3);
    tube(ctx, [[px, hookY - 6], [hx, hookY - 6]], 3.4, '#a8743f', INK, 3);
    ctx.beginPath(); ctx.arc(hx, hookY, 5.5, 0, TAU); ink(ctx, 5.4); ctx.beginPath(); ctx.arc(hx, hookY, 5.5, 0, TAU); ink(ctx, 2.6, '#f2c23a');
  }
  drawRope(ctx, r, t) {
    const pts = [], n = 16, pluck = Math.max(0, 1 - (t - r.born) * 2.2);
    for (let i = 0; i <= n; i++) { const u = i / n, p = this.ropeAt(r, u); pts.push([p[0], p[1] + Math.sin(u * Math.PI) * Math.sin(t * 28) * 7 * pluck]); }
    tube(ctx, pts, 2.8, '#ecdcae', INK, 2.6);
    for (const s of r.stars) {
      if (s.got) continue;
      const p = this.ropeAt(r, s.u), y = p[1] + 31 + Math.sin(t * 2.4 + s.ph) * 3;
      glow(ctx, p[0], y, 24, '#ffe36e', 0.55);
      starPath(ctx, p[0], y, 8.5, Math.sin(t * 1.5 + s.ph) * 0.3); ctx.fillStyle = '#ffe36e'; ctx.fill(); ink(ctx, 1.8);
    }
  }
  // "fastened up high … and lower down": chalk marks on the fresh rope
  drawMark(ctx, r, t) {
    const a = this.markA, corner = [r.b.x, r.a.y];
    ctx.setLineDash([4, 8]);
    chalk(ctx, [[r.a.x, r.a.y], corner], { width: 2, alpha: 0.6 * a, color: '#fff3b8', rough: 0 });
    chalk(ctx, [corner, [r.b.x, r.b.y - 12]], { width: 2, alpha: 0.6 * a, color: '#fff3b8', rough: 0 });
    ctx.setLineDash([]);
    chalk(ctx, [[r.b.x - 7, r.b.y - 24], [r.b.x, r.b.y - 12], [r.b.x + 7, r.b.y - 24]], { width: 2.4, alpha: 0.8 * a, color: '#fff3b8', rough: 0.3 });
    for (const [p, ph] of [[r.a, 0], [r.b, Math.PI]]) { const pts = [], rr = 15 + 3 * Math.sin(t * 4 + ph); for (let i = 0; i <= 16; i++) pts.push([p.x + Math.cos(i / 16 * TAU) * rr, p.y + Math.sin(i / 16 * TAU) * rr]); chalk(ctx, pts, { width: 2.4, alpha: 0.85 * a, color: '#fff3b8', seed: Math.floor(t * 6) }); }
  }
  drawHandle(ctx, t) {
    const h = this.handle, a = h.a, b = h.b;
    const ex = h.near ? b.x : h.x, ey = h.near ? b.y : h.y;
    const L = Math.hypot(ex - a.x, ey - a.y), sag = Math.min(40, L * 0.12), n = 14, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push([lerp(a.x, ex, u), lerp(a.y, ey, u) + sag * 4 * u * (1 - u)]); }
    if (h.held) {
      // where it may be fastened: only a lower hook will do
      const ring = [], rr = 22 + 4 * Math.sin(t * 6);
      for (let i = 0; i <= 18; i++) ring.push([b.x + Math.cos(i / 18 * TAU) * rr, b.y + Math.sin(i / 18 * TAU) * rr]);
      chalk(ctx, ring, { width: 2.8, alpha: h.near ? 1 : 0.7, color: h.near ? '#ffe36e' : '#fff3b8', seed: Math.floor(t * 6) });
      if (h.near) glow(ctx, b.x, b.y, 46, '#ffe36e', 0.6);
      const off = Math.floor(t * 10) % 2;
      for (let i = off; i < n; i += 2) chalk(ctx, [pts[i], pts[i + 1]], { width: 3.2, alpha: 0.9, color: h.near ? '#ffe36e' : '#fff3b8', seed: i });
    } else tube(ctx, pts, 2.8, '#ecdcae', INK, 2.6);
    // the loose end: a little loop
    glow(ctx, ex, ey, 30 + 6 * Math.sin(t * 5), '#fff3a0', h.held ? 0.3 : 0.6);
    ctx.beginPath(); ctx.arc(ex, ey + 4, 7.5, 0, TAU); ink(ctx, 6.4); ctx.beginPath(); ctx.arc(ex, ey + 4, 7.5, 0, TAU); ink(ctx, 3, '#ecdcae');
  }
  drawStreak(ctx, s) {
    const pts = [], dir = s.sp > 0 ? 1 : -1, fade = Math.sin(Math.PI * clamp01(s.age / s.life));
    for (let i = 0; i <= 9; i++) {
      const px = s.x - dir * s.len * (i / 9);
      let py = s.y + Math.sin(px * 0.018 + s.seed) * 4;
      for (const tw of this.towers) { const d = px - tw.x; if (d > -130 && d < 130 && s.y > tw.tip) py += s.sgn * 30 * Math.exp(-(d * d) / (2 * tw.r * tw.r)); }
      pts.push([px, py]);
    }
    chalk(ctx, pts, { width: 2.4, alpha: 0.6 * fade, color: '#e6efff', seed: s.seed, rough: 0.5 });
  }
  drawKite(ctx, t) {
    const k = this.kite, B = this.towers[1], ax = B.x + B.r + 46, ay = B.top - 74;
    ctx.save();
    ctx.strokeStyle = 'rgba(236,220,174,0.75)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.quadraticCurveTo((ax + k.x) / 2 + 12, (ay + k.y) / 2 + 26, k.x, k.y + 16); ctx.stroke();
    ctx.translate(k.x, k.y); ctx.rotate(k.rot.x);
    // tail with bows
    const tail = [];
    for (let i = 0; i <= 6; i++) tail.push([Math.sin(t * 3 + i * 0.9) * (3 + i) - this.wind.x * i * 5, 20 + i * 10]);
    ctx.strokeStyle = '#ecdcae'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(tail[0][0], tail[0][1]); for (const p of tail) ctx.lineTo(p[0], p[1]); ctx.stroke();
    for (let i = 2; i <= 6; i += 2) { ctx.fillStyle = i === 4 ? '#f08ab0' : '#ffcf5a'; ctx.beginPath(); ctx.moveTo(tail[i][0] - 6, tail[i][1] - 3); ctx.lineTo(tail[i][0] + 6, tail[i][1] + 3); ctx.lineTo(tail[i][0] + 6, tail[i][1] - 3); ctx.lineTo(tail[i][0] - 6, tail[i][1] + 3); ctx.closePath(); ctx.fill(); }
    wobble(ctx, [[0, -24], [16, -2], [0, 20], [-16, -2]], 44, 0.4, true);
    ctx.fillStyle = '#e2483b'; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = '#ffcf5a'; ctx.fillRect(-20, -30, 20, 28); ctx.fillRect(0, -2, 20, 26); ctx.restore();
    wobble(ctx, [[0, -24], [16, -2], [0, 20], [-16, -2]], 44, 0.4, true); ink(ctx, 2.4);
    ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 20); ctx.moveTo(-16, -2); ctx.lineTo(16, -2); ink(ctx, 1.4);
    ctx.restore();
  }
  drawWhale(ctx, view, t) {
    const w = this.whale;
    if (w.state === 'hidden') return;
    ctx.save();
    ctx.beginPath(); ctx.rect(view.left - 10, view.top - 10, view.width + 20, this.surf(w.x) + 13 - view.top); ctx.clip();
    ctx.translate(w.x, w.y); ctx.rotate(w.rot);
    const b = 3 + Math.floor(t * 6) * 5;
    wobble(ctx, [[-60, -4], [-84, -12], [-108, -32 + Math.sin(t * 5) * 4], [-98, -6], [-110, 16 + Math.sin(t * 5) * 4], [-84, 8], [-60, 10]], b + 1, 0.6); ctx.fillStyle = '#4a74bd'; ctx.fill(); ink(ctx, 3);
    const body = () => wobble(ctx, [[-70, -4], [-46, -27], [-8, -36], [36, -32], [66, -15], [74, 7], [54, 26], [10, 32], [-36, 24], [-62, 10]], b, 0.7);
    body(); ctx.fillStyle = '#5f8fd8'; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#e6eefb'; ctx.beginPath(); ctx.ellipse(18, 30, 66, 17, -0.05, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(95,143,216,0.6)'; ctx.lineWidth = 1.4; ctx.beginPath(); for (let i = 0; i < 5; i++) { ctx.moveTo(-24 + i * 4, 20 + i * 2.4); ctx.quadraticCurveTo(14, 26 + i * 2.2, 52 - i * 3, 17 + i * 2.6); } ctx.stroke();
    ctx.restore();
    body(); ink(ctx, 3.4);
    wobble(ctx, [[8, 12], [-10, 36], [22, 24]], b + 2, 0.5); ctx.fillStyle = '#4a74bd'; ctx.fill(); ink(ctx, 2.6);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(50, -7, 3, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(51, -8, 1, 0, TAU); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(60, 8); ctx.quadraticCurveTo(52, 16, 40, 13); ctx.stroke();
    ctx.fillStyle = 'rgba(240,138,160,0.5)'; ctx.beginPath(); ctx.arc(42, 2, 4.5, 0, TAU); ctx.fill();
    if (w.spout > 0.02) {
      const s = w.spout, h = 56 * Math.sin(Math.PI * Math.min(1, (1 - s) * 1.6 + 0.2));
      for (const sd of [-1, 1]) { const pts = []; for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([18 + sd * u * u * 22, -36 - h * Math.sin(u * Math.PI * 0.75) * 1.2]); } chalk(ctx, pts, { width: 3, alpha: 0.9 * Math.min(1, s * 2), color: '#f1f9ff', seed: Math.floor(t * 8) + sd }); }
    }
    ctx.restore();
  }
  drawBubble(ctx, t) {
    const b = this.bub, g = this.girl, bob = Math.sin(t * 1.3) * 4;
    ctx.save(); ctx.translate(b.x, b.y + bob);
    glow(ctx, 0, 0, b.r * 1.9, '#cfe0ff', 0.4);
    ctx.fillStyle = 'rgba(190,214,255,0.16)'; ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill();
    crayonRings(ctx, 0, 0, b.r + 4, t, { alpha: 0.3, rings: 2, thick: 0.1, colors: ['#f6b0c0', '#8fbdf5', '#ffe36e'], seed: 5 });
    ctx.restore();
    const gy = g.y; g.y = gy + bob; g.drawFull(ctx, t); g.y = gy;
    ctx.save(); ctx.translate(b.x, b.y + bob);
    const ring = []; for (let i = 0; i <= 30; i++) ring.push([Math.cos(i / 30 * TAU) * b.r, Math.sin(i / 30 * TAU) * b.r]);
    chalk(ctx, ring, { width: 2.8, alpha: 0.85, color: '#e6efff', seed: Math.floor(t * 5) });
    const hl = []; for (let i = 0; i <= 8; i++) { const a = -2.5 + i * 0.1; hl.push([Math.cos(a) * (b.r - 12), Math.sin(a) * (b.r - 12)]); }
    chalk(ctx, hl, { width: 4, alpha: 0.75, color: '#ffffff', rough: 0.4 });
    ctx.restore();
  }
}
