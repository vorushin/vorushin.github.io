// Scene 1 — Evening. Our own window, as in the book's first picture: light the candle,
// wake the windows across the street, play the star lullaby, close your eyes … and when
// you open them, a cat is walking along the treetops.
import { Scene } from '../scene.js';
import { TAU, clamp, clamp01, lerp, ease, rng, mixHex, approach, smooth } from '../util.js';
import { INK, PAL, ink, wobblyPoly, wobble, glow, drawMoon, drawSpeckles, sparklePath, starPath, chalk, tube, circlePts, crayonRings } from '../paint.js';
import { Tree, House, drawCandle } from '../props.js';
import { Cat, Kid } from '../actors.js';
import { drawHead, KIDS } from '../people.js';

const T = {
  candle: { en: 'Light the candle', de: 'Zünde die Kerze an', ru: 'Зажги свечу' },
  windows: { en: 'Wake the windows across the street', de: 'Weck die Fenster gegenüber auf', ru: 'Разбуди окна напротив' },
  stars: { en: 'Touch the stars, one by one', de: 'Tippe die Sterne an, einen nach dem anderen', ru: 'Коснись звёзд, одной за другой' },
  eyes: { en: 'Close your eyes: press and hold', de: 'Augen zu: drücken und halten', ru: 'Закрой глазки: нажми и держи' }
};
const K = 0.46, OY = -136;                // the street outside is drawn at this scale / offset
const WIN = { l: -226, r: 226, t: -448, b: -112 };
const CX = -150, CY = -176;               // candle flame
const TUNE = [78, 81, 83, 81, 78, 76, 74]; // F#5 A5 B5 A5 F#5 E5 D5
const KX = -224, KY = -5;                 // the child's head on the pillow
const HX = 142, HY = -56;                 // Papa's head (garden.js lands the story star just above it)
// where the child looks from the pillow: head turn, tilt, eyes x, eyes y
const LOOK = { papa: [0.55, 0.16, 1, 0.2], window: [0.22, 0.03, 0.4, -1], candle: [0.16, 0.02, 0.6, -0.8], up: [0, 0.06, 0, -0.5] };

export default class Candle extends Scene {
  // o.passive: build the room without touching audio / camera (the finale reuses this room)
  constructor(game, index, o) {
    super(game, index);
    this.passive = !!(o && o.passive);
    if (!this.passive) this.view.safeW = 600;
    this.lit = 0; this.room = 0; this.lids = 0; this.camPh = 0; this._pull = null; this.wind = 0; this.dim = 0;
    this.turn = 1; this.turnTo = 1;          // Papa's head: 1 = turned to the child, 0 = watching the window
    this.par = { x: 0, y: 0 };
    // the two of us in the room (painted here, with people.js heads). In the finale the child is asleep.
    const asleep = this.passive;
    this.ch = { turn: 0.55, tilt: 0.16, lx: 1, ly: 0.2, to: LOOK.papa, sleepy: asleep ? 1 : 0, shut: asleep ? 1 : 0, yawn: 0, smile: asleep ? 0.1 : 0.4,
      blinkIn: 2 + Math.random() * 2, blinkT: 0, blinkD: 0.13, lid: asleep ? 0 : 1, ph: 0 };
    this.pa = { shut: 0, blinkIn: 3 + Math.random() * 2, blinkT: 0, lid: 1, breath: 0, stroke: 0, strokeTo: 0, sph: 0, tilt: 0, tiltTo: 0, sing: 0, smile: 0.72 };
    // the street outside (in its own coordinates; ground y = 0)
    const kid = (kind) => new Kid({ kind, mood: 'read' });
    this.houses = [
      new House({ x: -310, w: 150, h: 244, style: 'pink', seed: 61, windows: [{ dx: 30, dy: -170, skip: true }, { dx: -30, dy: -90, skip: true }] }),
      new House({ x: -40, w: 140, h: 262, style: 'mint', seed: 64, windows: [{ dx: 0, dy: -190, w: 40, h: 52, kid: kid('papa') }] }),
      new House({ x: 190, w: 180, h: 196, style: 'blue', seed: 62, windows: [{ dx: -44, dy: -126, w: 40, h: 52, kid: kid('mama') }, { dx: 44, dy: -126, w: 40, h: 52, kid: kid('bun') }] }),
      new House({ x: 400, w: 140, h: 290, style: 'butter', seed: 63, windows: [{ dx: -4, dy: -215, w: 40, h: 52, kid: kid('cap') }, { dx: -4, dy: -112, w: 40, h: 52, kid: kid('bob') }] })
    ];
    this.wins = [];
    for (const h of this.houses) for (const w of h.windows) { w.lit = 0; w.glowK = 1.3; if (!w.skip) this.wins.push({ h, w, done: false, look: { x: 0, y: 0 } }); }
    this.trees = [[-198, 112, 50, 'round'], [66, 122, 46, 'apple'], [305, 108, 48, 'round'], [530, 120, 50, 'round']].map((s, i) => new Tree({ x: s[0], h: s[1], r: s[2], kind: s[3], seed: 71 + i }));
    this.cat = new Cat({ kind: 'papa', size: 1.3 }); this.cat.hidden = true; this.cat.carry = 1;
    this.catSeen = false;                    // the readers across the street watch the cat once it is there
    this.toy = new Cat({ kind: 'night', size: 0.9, dir: -1 }); this.toy.mode = 'sit'; this.toy.eyes = 'happy';
    // sky inside the window
    const r = rng(505);
    this.sky = [];
    for (let i = 0; i < 80; i++) this.sky.push({ x: lerp(WIN.l, WIN.r, r()), y: lerp(WIN.t, -262, Math.pow(r(), 1.3)), r: 0.6 + r() * 1.4, ph: r() * TAU, sp: 0.6 + r() * 1.6 });
    this.notes = [[-176, -334], [-118, -374], [-56, -398], [8, -382], [70, -350], [122, -392], [172, -344]].map((p, i) => ({ x: p[0], y: p[1], on: 0, show: 0, pulse: 0, i }));
    if (!this.passive) { this.audio.ambience('room'); this.audio.play('candle', { intensity: 0.25 }); }
  }
  winPos(k) { const g = k.h.win(k.w); return { x: this.par.x + g.x * K, y: OY + this.par.y + g.y * K, r: 36, done: k.done }; }

  async run() {
    const ch = this.ch, pa = this.pa;
    const land = this.shape() === 'land', RX = { pad: 0, min: 0.5, exact: true }, LX = { pad: 12, min: 0.5, exact: true };
    // on phones the room is framed to its people from the start; on a landscape phone the window comes first (what is touched),
    // and the two faces get their own moments between the gestures
    if (land) this.shot(() => this.box('lwin'), 0, LX);
    else if (this.shape() !== 'desk') this.shot(() => this.box('room'), 0, RX);
    await this.wait(0.5);
    this.breathe();                                                // Papa draws a breath… and begins
    await this.wait(0.5);
    this.say(0);                                                   // In a certain town…
    await this.tapOn({ x: CX, y: CY + 24, r: 62 }, { text: T.candle });
    await this.strike();
    this.spawn(() => this.tween(this, { lit: 1 }, 1.4, ease.outCubic));
    this.spawn(() => this.tween(this, { room: 1 }, 2.2, ease.outQuad));
    this.audio.chordNote(0, { vel: 0.7 }); this.audio.chordNote(2, { vel: 0.6, when: this.audio.now + 0.15 });
    ch.to = LOOK.candle; pa.tiltTo = -0.12;                        // both look up at the new light
    if (land) this.spawn(() => this.shot(() => this.box('faces'), 1.4, LX));   // landscape: the two faces in the new light
    await this.wait(land ? 2.4 : 1.6);

    await this.say(1);                                             // The children there are put to bed…
    this.turnTo = 0; pa.tiltTo = -0.08; ch.to = LOOK.window;       // …and we look across the street
    const toHouses = this.shot(() => this.box('houses'), 2.6, { pad: 14, max: 1.6 });   // closer to the readers
    if (land) await toHouses;                                      // (landscape: the first target only once the houses are in place, not under the hint)
    for (let n = 0; n < this.wins.length; n++) {
      const i = await this.tapAny(this.wins.map((k) => this.winPos(k)), { text: T.windows, onDone: (j) => { const p = this.winPos(this.wins[j]); this.sparkle(p.x, p.y, 4); this.audio.chordNote(j, { vel: 0.45 }); } });   // a lit window still twinkles when touched
      const k = this.wins[i]; k.done = true;
      this.spawn(() => this.tween(k.w, { lit: 1 }, 0.45));
      this.audio.chordNote(n, { vel: 0.7 });
      const p = this.winPos(k); this.sparkle(p.x, p.y, 7);
    }
    await this.wait(0.9);

    this.turnTo = 1; pa.tiltTo = 0.04;                             // Papa turns back to sing to the child, who watches the stars
    const toSky = this.shot(() => this.box(land ? 'lsky' : 'room'), 2.2, land ? LX : RX);   // …back to the two of us under the sky (landscape: the sky, to touch)
    this.breathe();
    await this.say(2);                                             // …they are sung songs and told the tales…
    ch.sleepy = 0.2;
    this.audio.setIntensity(0.1);
    for (const s of this.notes) { this.spawn(() => this.tween(s, { show: 1 }, 0.5)); await this.wait(0.07); }
    if (land) await toSky;                                         // (landscape: the stars are offered once the sky has arrived)
    const stars = this.notes.map((s) => ({ x: s.x, y: s.y, r: 34, done: false }));   // any star that is still dark will do
    for (let n = 0; n < this.notes.length; n++) {
      const i = await this.tapAny(stars, { text: T.stars, onDone: (j) => this.ring(this.notes[j], j) });   // a lit star sings its note again
      stars[i].done = true;
      this.ring(this.notes[i], n);                                 // the n-th touch sings the n-th note, whichever star it was
    }
    await this.wait(0.7);
    if (land) this.spawn(() => this.shot(() => this.box('faces'), 1.4, LX));   // landscape: Papa sings the tune to her
    for (let n = 0; n < this.notes.length; n++) { this.ring(this.notes[n], n); await this.wait(n === 3 ? 0.5 : 0.34); }
    await this.wait(0.9);

    await this.say(3);                                             // …the tales that were read have all run out —
    ch.sleepy = 0.4; this.turnTo = 0; pa.tiltTo = -0.04;           // Papa looks out at the windows going quiet
    this.spawn(() => this.tween(this, { dim: 1 }, 2.4));
    this.wins.forEach((k, i) => this.spawn(() => this.runOut(k, i)));   // across the street the books are closed, one by one
    for (const s of this.notes) this.spawn(() => this.tween(s, { on: 0, show: 0.35 }, 2));
    this.audio.sfx.fall();
    const ph = ++this.camPh;
    this.spawn(() => this.shot(() => this.box('houses'), 1.6, { pad: 14, max: 1.6 }));   // across the street, closer: the books go down
    this.spawn(async () => {                                       // …and back in our room, Papa turns to the child
      await this.wait(3.1);
      this.turnTo = 1; pa.tiltTo = 0.06; ch.to = LOOK.papa;
      await this.wait(0.5);
      pa.strokeTo = 1;                                             // …and strokes the quilt
    });
    this._pull = this.wait(3.3).then(() => this.camPh === ph && this.shot(() => this.box(land ? 'faces' : 'room'), 2.8, land ? LX : RX)).catch(() => {});
    await this.next();
    await this.say(4);                                             // and new ones have to come from somewhere…
    ch.sleepy = 0.7;
    this.audio.sfx.whoosh(1.4);
    this.spawn(async () => { await this.tween(this, { wind: 1 }, 0.7); await this.tween(this, { wind: 0 }, 2.2); });
    this.spawn(async () => {                                       // a slow push-in to the bed, once the room is whole again
      await this._pull;
      if (this.camPh !== ph) return;
      this.shot(() => this.box('bed'), 5, { pad: 10, max: 1.7, min: 1 });
    });
    this.spawn(async () => { await this.wait(2.2); this.yawn(); });   // …for little ones do so love a bedtime tale
    await this.next();

    await this.say(5);                                             // At our house we lie down very quietly, close our eyes…
    ch.sleepy = 0.85; ch.to = LOOK.up; pa.strokeTo = 0.4;
    this.audio.setIntensity(0.25);
    if (this.shape() === 'phone') { this.camPh++; this.shot(() => this.box('her'), 3.5, { pad: 10, max: 1.8 }); }   // on an upright phone: her shot, Papa's hand coming in from the side
    // a forgiving hold: progress is kept when the finger lifts, and the lids only drift a little apart meanwhile
    const H = this._hold = { f: 0, on: false };
    await this.holdOn({ x: -60, y: 36, r: 64 }, 2.6, { anywhere: true, keep: true, text: T.eyes, onStart: () => { H.on = true; }, onStop: () => { H.on = false; }, onProgress: (f) => { H.f = f; } });
    this._hold = null;
    this.lids = 1; ch.shut = pa.shut = 1; pa.strokeTo = 0;
    this.hint(null);
    // while the eyes are shut: soft steps on the leaves outside
    const tr = this.trees, cat = this.cat;
    cat.hidden = false; cat.x = tr[0].topX; cat.y = tr[0].perchY; cat.dir = 1; cat.wake(); cat.fidget = false;
    for (let i = 0; i < 4; i++) { this.audio.sfx.step((i - 1.5) * 0.3); await this.wait(0.32); }
    this.audio.sfx.rustle();
    await this.wait(0.5);
    this.spawn(() => this.tween(this, { dim: 0 }, 2));
    this.spawn(async () => {                                       // the child's eyes open first — and go straight to the window
      await this.wait(0.5);
      ch.sleepy = 0; ch.to = LOOK.window; await this.tween(ch, { shut: 0 }, 0.5);
      await this.wait(0.5);
      this.turnTo = 0; pa.tiltTo = -0.06; await this.tween(pa, { shut: 0 }, 0.4);   // …and Papa turns to look as well
    });
    await this.tween(this, { lids: 0 }, 1.3, ease.inOutCubic);
    await this.wait(1.1);

    this.catSeen = true; this.camPh++;
    const so = { pad: 22, max: this.zMax(2.6) };
    this.shot(() => this.clear(this.box('street', 0), so), this.reduced ? 0.4 : 2.4, so);   // we look where they look
    this.breathe();
    await this.say(6);                                             // But in that town, the stories are brought by cats.
    this.audio.setIntensity(1);
    for (let i = 1; i < 3; i++) {
      cat.look = { x: tr[i].topX, y: tr[i].perchY - 10 };          // a look at the landing spot first
      this.spawn(() => this.shot(() => this.clear(this.box('street', i), so), this.reduced ? 0.4 : 1.1, so));
      await this.wait(i === 1 ? 0.7 : 0.45);
      this.audio.sfx.hop();
      await new Promise((res) => cat.leapTo(tr[i].topX, tr[i].perchY, { done: res }));
      tr[i].land(1); this.audio.sfx.land(0, true); this.audio.playerNote();
      this.fx.burst('leaf', this.par.x + cat.x * K, OY + cat.y * K, 5, { speed: 60, a0: -Math.PI, a1: 0, life: 1, size: 3.4, colors: ['#5ab04a', '#8fd05a'], grav: 160 });
    }
    // the hero's entrance: it lands, turns its face to our window, meows
    cat.look = null;
    const co = { pad: 18, max: this.zMax(3.2) };
    this.spawn(() => this.shot(() => this.clear(this.box('cat'), co), this.reduced ? 0.4 : 1.3, co));
    await this.wait(0.35);
    cat.headTurn = 1; cat.lids = null;
    await this.wait(0.55);
    cat.meow(0.45); this.audio.sfx.meow();
    for (const k of this.wins) if (k.h.x > 100) k.w.kid.mood = 'wave';   // the readers nearest the cat wave to it
    ch.smile = 0.9;
    await this.wait(0.7);
    if (!this.reduced) cat.act('slowblink');                      // a cat's hello
    await this.next();
    this.spawn(() => this.tween(this, { room: 0.2 }, 1.2));
    const c = this.shotFor(this.clear(this.box('cat'), co), co);
    await this.camTo(c.x, c.y - 4, c.zoom * 1.25, 1.5);
  }

  // Papa's shoulders rise with a breath before he speaks
  breathe() { if (!this.reduced) this.spawn(async () => { await this.tween(this.pa, { breath: 1 }, 0.8, ease.inOutSine); await this.wait(0.15); await this.tween(this.pa, { breath: 0 }, 1.3, ease.inOutSine); }); }
  // a big sleepy yawn on the pillow
  yawn() {
    this.audio.sfx.yawn(true, -0.5);
    this.spawn(async () => { await this.tween(this.ch, { yawn: 1 }, 0.7, ease.inOutSine); await this.wait(0.5); await this.tween(this.ch, { yawn: 0 }, 0.9, ease.inOutSine); });
  }
  // a reader across the street finds the tale is over: the book is lowered, a wistful look down, a sigh, a long look out
  async runOut(k, i) {
    const kid = k.w.kid;
    await this.wait(0.3 + i * 0.42);
    kid.mood = 'wistful';
    await this.wait(1.5);
    k.look.x = kid.x + (kid.x < 120 ? 50 : -50); k.look.y = kid.y - 150;
    kid.look = k.look;
  }
  // screen shape: 'phone' (upright), 'land' (short landscape), 'desk'
  shape() { const v = this.view; return v.portrait ? 'phone' : v.H < 520 ? 'land' : 'desk'; }
  // move a street box up so that the picture it gets ends above Papa's head (no brown disc along the bottom)
  clear(b, o) {
    const v = this.view, F = v.freeRect(), z = this.shotFor(b, o).zoom, pad = o.pad || 0, k = v.fit * z;
    const top = HY - 62;                                            // above his hair, even with a deep breath
    const bottom = (b.t + b.b) / 2 + (v.H - (F.t + F.b) / 2) / k;  // the lowest world y on the screen (beside the caption too)
    const slack = ((F.b - F.t) / k - (b.b - b.t) - 2 * pad) / 2;   // how far the box may rise and still be in the free picture
    const d = Math.min(bottom - top, Math.max(0, slack));
    return d > 0 ? { l: b.l, r: b.r, t: b.t - d, b: b.b - d } : b;
  }
  // the largest zoom that is still sensible for a close-up here (a cat of ≈ 120 px at most)
  zMax(z) { return Math.max(1.6, Math.min(z, 120 / (34 * this.view.fit))); }
  // what the camera frames, in room coordinates
  box(name, i) {
    const sh = this.shape(), P = sh === 'phone';
    if (name === 'room' && sh === 'phone') return { l: -314, r: 236, t: WIN.t - 6, b: 52 };   // window, candle, child and Papa: the whole width
    if (name === 'room' && sh === 'land') return { l: -318, r: 300, t: WIN.t - 6, b: 28 };    // …ending at the faces (the caption takes the rest)
    if (name === 'lwin') return { l: -236, r: 236, t: -424, b: -100 };       // landscape: the window (stars to the candle), the frame's top cut
    if (name === 'lsky') return { l: -214, r: 210, t: -434, b: -300 };       // landscape: the seven stars, large enough to touch one by one
    if (name === 'faces') return { l: -300, r: 196, t: -200, b: 24 };        // landscape: the candle and the two heads
    if (name === 'her') return { l: -292, r: -12, t: -62, b: 132 };
    if (name === 'room') {                                         // the establishing framing (zoom 1, the room lifted on tall screens)
      const v = this.view, F = v.freeRect(), L = this.lift || 0;
      return { l: (F.l - v.ox) / v.fit, r: (F.r - v.ox) / v.fit, t: (F.t - v.oy) / v.fit + L, b: (F.b - v.oy) / v.fit + L };
    }
    if (name === 'window') return { l: -236, r: 236, t: WIN.t - 6, b: WIN.b + 26 };
    if (name === 'houses') return P ? { l: -60, r: 226, t: -276, b: -100 } : { l: -232, r: 232, t: -278, b: -100 };   // (phone: the three lit houses, over Papa's shoulder)
    if (name === 'bed') return P ? { l: -288, r: 184, t: -104, b: 150 } : sh === 'land' ? { l: -330, r: 250, t: -124, b: 80 } : { l: -330, r: 250, t: -124, b: 118 };
    const tr = this.trees, X = (x) => this.par.x + x * K, Y = (y) => OY + this.par.y + y * K;
    if (name === 'street') {                                       // the perch the cat is on and the next one
      const a = tr[Math.max(0, i - 1)], b = tr[Math.min(tr.length - 1, Math.max(1, i))];
      const y = Y(Math.min(a.perchY, b.perchY));
      return { l: X(Math.min(a.topX, b.topX)) - 20, r: X(Math.max(a.topX, b.topX)) + 20, t: y - 34, b: y + 22 };
    }
    const c = this.cat;                                            // 'cat': a close-up
    return { l: X(c.x) - 52, r: X(c.x) + 26, t: Y(c.y) - 36, b: Y(c.y) + 14 };   // (a little more of the street than of the curtain)
  }

  // a match is struck, carried to the wick, and shaken out
  async strike() {
    const m = this.match = { x: CX + 126, y: CY + 66, a: 0, lit: 0 };
    await this.tween(m, { a: 1 }, 0.12);
    this.audio.sfx.strike();
    await this.tween(m, { x: CX + 88, y: CY + 42 }, 0.13, ease.outQuad);
    m.lit = 1;
    this.fx.burst('spark', m.x, m.y, 8, { speed: 100, life: 0.5, size: 3.6, colors: ['#fff7c0', '#ffb648'], layer: 1 });
    await this.wait(0.18);
    await this.tween(m, { x: CX + 6, y: CY + 21 }, 0.44, ease.inOutQuad);
    this.spawn(async () => {
      await this.wait(0.32);
      await this.tween(m, { x: CX + 82, y: CY + 56 }, 0.42, ease.inOutQuad);
      await this.tween(m, { lit: 0 }, 0.12);
      this.fx.burst('puff', m.x, m.y - 8, 3, { speed: 16, a0: -2.2, a1: -0.9, life: 1.1, size: 5, color: 'rgba(220,220,235,0.5)', grow: 6, layer: 1 });
      await this.tween(m, { a: 0 }, 0.4);
      this.match = null;
    });
  }

  ring(s, n) {
    s.on = 1; s.pulse = 1; this.pa.sing = 1;
    this.audio.box(TUNE[n], { vel: 0.8, bus: this.audio.sfxBus, pan: s.x / 300 });
    this.notes_(s.x, s.y);
    this.fx.burst('spark', s.x, s.y, 5, { speed: 46, life: 0.9, size: 4.5, colors: ['#fff7c0', '#ffe36e'] });
  }
  notes_(x, y) { this.fx.add({ kind: 'note', x, y: y + 10, vx: 6, vy: 26, life: 2, size: 8, color: '#fff3b0', sway: 12, drag: 0.4 }); }

  onHover(p) { this.aimPar(p); }
  onMove(p) { this.aimPar(p); }
  aimPar(p) { this._px = clamp01((p.x + 300) / 600) - 0.5; this._py = clamp01((p.y + 440) / 440) - 0.5; }

  update(dt) {
    if (!this.passive) this.frame();
    if (!this.reduced) {                                           // (a pointer parallax, smaller as the camera closes in)
      const z = Math.max(1, this.cam.zoom);
      this.par.x += ((-(this._px || 0) * 16 / z) - this.par.x) * Math.min(1, dt * 3); this.par.y += ((-(this._py || 0) * 6 / z) - this.par.y) * Math.min(1, dt * 3);
    }
    for (const h of this.houses) h.update(dt);
    for (const t of this.trees) t.update(dt);
    this.cat.update(dt, this.t);
    if (this.catSeen && !this.cat.hidden) for (const k of this.wins) { k.look.x = this.cat.x; k.look.y = this.cat.y - 24; k.w.kid.look = k.look; }   // every reader watches the cat
    for (const s of this.notes) if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - dt * 1.6);
    this.turn = approach(this.turn, this.turnTo, 2.6, dt);
    const H = this._hold;
    if (H) { this.lids = approach(this.lids, ease.inOutQuad(H.f) * (H.on ? 1 : 0.7), H.on ? 14 : 1.5, dt); this.ch.shut = this.pa.shut = clamp01(this.lids * 1.7); }
    this.people(dt);
    if (this.lit > 0.5 && Math.random() < dt * 1.2) this.fx.add({ kind: 'dot', x: CX + (Math.random() - 0.5) * 30, y: CY - 14, vx: (Math.random() - 0.5) * 12, vy: -18 - Math.random() * 16, life: 2.6, size: 1.6, color: '#ffd27a', alpha: 0.7, sway: 8, layer: 1 });
  }

  // the child on the pillow and Papa: gaze, blinks that grow slower as sleep comes, a breath, a stroking hand
  people(dt) {
    const ch = this.ch, pa = this.pa, still = this.reduced, L = ch.to;
    ch.turn = approach(ch.turn, L[0], 3, dt); ch.tilt = approach(ch.tilt, L[1], 2.4, dt);
    ch.lx = approach(ch.lx, L[2], 9, dt); ch.ly = approach(ch.ly, L[3], 9, dt);
    ch.ph += dt * lerp(1.3, 0.75, ch.sleepy);                      // breathing slows down
    const bl = (o, base, d) => {                                   // a blink: lids down and up again, the longer the sleepier
      o.blinkIn -= dt;
      if (o.blinkIn < 0 && o.blinkT <= 0) { o.blinkT = d; o.blinkD = d; o.blinkIn = d + lerp(2.6, 1.8, base) + Math.random() * 2.4; }
      let e = 0;
      if (o.blinkT > 0) { o.blinkT -= dt; e = Math.sin(Math.PI * clamp01(1 - o.blinkT / o.blinkD)); }
      return e;
    };
    const s = ch.sleepy, eb = bl(ch, s, lerp(0.14, 0.75, s * s));
    const ye = ch.yawn;
    ch.lid = (1 - 0.42 * s) * (1 - eb) * (1 - ch.shut) * (1 - 0.95 * ye);
    pa.lid = (1 - bl(pa, 0, this.turn > 0.6 ? 0.34 : 0.15)) * (1 - pa.shut);   // (a slow, fond blink while he watches her)
    pa.tilt = approach(pa.tilt, pa.tiltTo, 2.2, dt);
    pa.stroke = approach(pa.stroke, still ? 0 : pa.strokeTo * (this.turn > 0.6 ? 1 : 0), 1.6, dt);
    pa.sph += dt * 1.7 * pa.stroke;
    pa.sing = approach(pa.sing, 0, 3, dt);
  }

  // On tall (portrait) screens there is spare wall above the window: lift the room into the middle.
  frame() {
    const v = this.view, spare = v.height - (WIN.b - WIN.t) - 250 - v.captionInset / v.scale;
    // …but never so far that the shelf slips under the caption when that sits at the top
    this.lift = Math.max(0, Math.min(spare * 0.2, (v.oy - v.topInset - 6) / v.scale + WIN.t - 248));
    if (this.cam.zoom === 1 && !this.directing) this.cam.y = this.lift;
  }

  winPath(ctx) { wobblyPoly(ctx, [[WIN.l, WIN.b], [WIN.l, WIN.t], [WIN.r, WIN.t], [WIN.r, WIN.b]], 17, 2.2, 90); }

  draw(ctx, view, t) {
    const room = this.room, lit = this.lit;
    // wall
    ctx.fillStyle = '#120c24'; ctx.fillRect(view.left - 10, view.top - 10, view.width + 20, view.height + 20);
    const wg = ctx.createRadialGradient(CX, CY, 30, CX, CY, 640);
    wg.addColorStop(0, 'rgba(120,70,96,' + (0.85 * room).toFixed(3) + ')'); wg.addColorStop(0.5, 'rgba(70,44,92,' + (0.7 * room).toFixed(3) + ')'); wg.addColorStop(1, 'rgba(30,20,56,' + (0.4 * room).toFixed(3) + ')');
    ctx.fillStyle = wg; ctx.fillRect(view.left - 10, view.top - 10, view.width + 20, view.height + 20);
    // wallpaper: tiny chalk stars
    ctx.save(); ctx.globalAlpha = 0.1 + 0.16 * room; ctx.fillStyle = '#f3c6d8';
    ctx.beginPath();
    for (let i = Math.floor(view.left / 70) - 1; i * 70 < view.right + 70; i++) for (let j = Math.floor(view.top / 70) - 1; j * 70 < view.bottom + 70; j++) {
      const x = i * 70 + ((j & 1) ? 35 : 0), y = j * 70 + 20;
      for (let q = 0; q < 8; q++) { const a = 0.4 + (q / 8) * TAU, rr = q % 2 ? 1.4 : 5, px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; if (q) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.closePath();
    }
    ctx.fill();
    ctx.restore();

    this.drawWall(ctx, t, room);
    // ── the night outside, seen through the window ──
    ctx.save();
    this.winPath(ctx); ctx.clip();
    const sg = ctx.createLinearGradient(0, WIN.t, 0, WIN.b);
    sg.addColorStop(0, '#0e1447'); sg.addColorStop(0.6, '#1c2a78'); sg.addColorStop(1, '#3350a8');
    ctx.fillStyle = sg; ctx.fillRect(WIN.l - 10, WIN.t - 10, WIN.r - WIN.l + 20, WIN.b - WIN.t + 20);
    drawSpeckles(ctx, WIN.l, WIN.t, WIN.r - WIN.l, 220, 91, 50, PAL.gold, t);
    for (const s of this.sky) { ctx.globalAlpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * s.sp + s.ph)); ctx.fillStyle = '#f4f6ff'; ctx.beginPath(); ctx.arc(s.x + this.par.x * 0.3, s.y, s.r, 0, TAU); ctx.fill(); }
    ctx.globalAlpha = 1;
    drawMoon(ctx, 166 + this.par.x * 0.4, -410, 22, t, { halo: 0.4 });
    for (const s of this.notes) {
      if (s.show <= 0.01) continue;
      const rr = 5 + 5 * s.on + 5 * s.pulse;
      glow(ctx, s.x, s.y, 20 + 30 * s.on + 26 * s.pulse, '#fff3a0', s.show * (0.35 + 0.5 * s.on));
      ctx.globalAlpha = s.show; ctx.fillStyle = s.on > 0.5 ? '#fff7c0' : '#cfd8ff';
      sparklePath(ctx, s.x, s.y, rr * (1 + 0.12 * Math.sin(t * 4 + s.i)), t * 0.3 + s.i); ctx.fill();
      if (s.pulse > 0.02) crayonRings(ctx, s.x, s.y, 14 + 26 * (1 - s.pulse), t, { alpha: s.pulse * 0.8, rings: 3, seed: s.i });
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(this.par.x, OY + this.par.y); ctx.scale(K, K);
    ctx.fillStyle = '#16402e'; ctx.fillRect(-700, -6, 1400, 200);
    for (const h of this.houses) h.draw(ctx, t);
    for (const h of this.houses) h.drawLights(ctx, t);
    for (const tr of this.trees) tr.draw(ctx, t);
    this.cat.draw(ctx, t);
    ctx.restore();
    if (this.dim > 0.01) { ctx.fillStyle = 'rgba(12,16,60,' + (0.42 * this.dim).toFixed(3) + ')'; ctx.fillRect(WIN.l - 10, WIN.t - 10, WIN.r - WIN.l + 20, WIN.b - WIN.t + 20); }
    this.fx.draw(ctx, t, 0);
    ctx.restore();

    // curtains
    const R = WIN.r, top = WIN.t, bot = WIN.b;
    const lk = clamp01((lit - 0.15) / 0.4);                      // the light reaches the cloth gradually, not in one frame
    for (const sd of [-1, 1]) {
      const sway = (this.reduced ? 0 : Math.sin(t * 0.9 + sd) * 5) + this.wind * 46 * (sd < 0 ? 1 : 0.6);
      wobble(ctx, [[sd * (R + 44), top - 24], [sd * (R - 30), top - 20], [sd * (R - 50 - sway * 0.4), top + 110], [sd * (R - 32 - sway), top + 230], [sd * (R - 52 - sway * 1.4), bot - 10], [sd * (R + 50), bot - 6]], 33 + sd, 2);
      ctx.fillStyle = mixHex('#3a2c58', '#8d6aa8', lk); ctx.globalAlpha = 0.93; ctx.fill(); ctx.globalAlpha = 1; ink(ctx, 3.4);
      ctx.strokeStyle = 'rgba(29,21,48,0.35)'; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k < 3; k++) { ctx.moveTo(sd * (R - 12 + k * 18), top - 18); ctx.quadraticCurveTo(sd * (R - 24 + k * 16 - sway * 0.5), top + 180, sd * (R - 14 + k * 18 - sway * 0.8), bot - 14); }
      ctx.stroke();
    }
    // frame + sill
    this.winPath(ctx); ink(ctx, 9, '#3b2a22'); this.winPath(ctx); ink(ctx, 4.5, '#a8743f');
    wobblyPoly(ctx, [[-R - 38, bot - 2], [R + 38, bot - 2], [R + 46, bot + 18], [-R - 46, bot + 18]], 19, 1.6, 90);
    ctx.fillStyle = mixHex('#5a4a5e', '#d9b98a', lk); ctx.fill(); ink(ctx, 3.6);
    // candle (the whole room breathes with its flame)
    const fk = this.reduced ? 1 : 1 + 0.04 * Math.sin(t * 11) + 0.03 * Math.sin(t * 23.7);
    glow(ctx, CX, CY, 280 * lit * fk, '#ffbe5a', 0.5 * lit);
    drawCandle(ctx, CX, bot - 2, t, 1.5, lit, 0.8);
    const m = this.match;
    if (m && m.a > 0.01) {
      ctx.save(); ctx.globalAlpha = m.a;
      ctx.translate(m.x, m.y); ctx.rotate(0.6);
      tube(ctx, [[2, 0], [60, 0]], 4, '#ecd29a', INK, 2.6);
      ctx.beginPath(); ctx.ellipse(0, 0, 5.6, 4.6, 0, 0, TAU); ctx.fillStyle = m.lit > 0.5 ? '#3a2a2a' : '#c0452c'; ctx.fill(); ink(ctx, 2);
      ctx.restore();
      if (m.lit > 0.02) {
        const f = m.lit * (1 + 0.14 * Math.sin(t * 13)), sw = Math.sin(t * 7) * 1.2;
        glow(ctx, m.x, m.y - 8, 34 * m.lit, '#ffd27a', 0.8 * m.a);
        ctx.save(); ctx.globalAlpha = m.a; ctx.translate(m.x, m.y - 3); ctx.scale(f, f);
        ctx.beginPath(); ctx.moveTo(0, 2); ctx.bezierCurveTo(-6, -3, -3.4, -11, sw, -17); ctx.bezierCurveTo(4, -10, 6, -3, 0, 2); ctx.closePath(); ctx.fillStyle = '#ffb02e'; ctx.fill();
        ctx.beginPath(); ctx.moveTo(0, 1); ctx.bezierCurveTo(-3, -2, -1.6, -6, sw * 0.5, -10); ctx.bezierCurveTo(2, -6, 3, -2, 0, 1); ctx.closePath(); ctx.fillStyle = '#fff3b0'; ctx.fill();
        ctx.restore();
      }
    }
    this.fx.draw(ctx, t, 1);
    // us: a small head on the pillow, and papa waiting beside
    this.drawBed(ctx, t, room);
    glow(ctx, CX, CY, 520 * fk, '#ff9f4a', 0.16 * lit);
  }

  // Above the window (seen on tall phone screens): a paper garland and a shelf with books and a toy cat.
  drawWall(ctx, t, room) {
    const a = 0.35 + 0.65 * room, cols = ['#f3a9b8', '#ffd84a', '#8fbdf5', '#9fd8b4', '#f7f0dc'];
    ctx.save(); ctx.globalAlpha = a;
    const gy = WIN.t - 92, pts = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20; pts.push([lerp(-330, 330, u), gy + Math.sin(u * Math.PI) * 44 + Math.sin(t * 0.8 + u * 5) * 1.5]); }
    ctx.strokeStyle = '#d9c9a8'; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.stroke();
    for (let i = 1; i < 20; i += 2) {
      const p = pts[i], sw = Math.sin(t * 1.1 + i) * 0.08;
      ctx.save(); ctx.translate(p[0], p[1]); ctx.rotate(sw);
      wobble(ctx, [[-13, 0], [13, 0], [0, 30]], 200 + i, 0.6); ctx.fillStyle = cols[(i >> 1) % cols.length]; ctx.fill(); ink(ctx, 2.4);
      ctx.restore();
    }
    // shelf (left out where it would only peep out from behind the caption and the top bar)
    const sy = WIN.t - 184;
    if (sy - 66 < this.view.free) { ctx.restore(); return; }
    wobblyPoly(ctx, [[-170, sy], [170, sy], [174, sy + 12], [-174, sy + 12]], 211, 1.2, 80); ctx.fillStyle = '#a8743f'; ctx.fill(); ink(ctx, 3);
    const books = [[-150, 44, '#d9483b'], [-132, 56, '#5f80c6'], [-112, 48, '#f2c23a'], [-94, 60, '#4fb060'], [-72, 42, '#b08ae0'], [-54, 52, '#f08ab0']];
    for (const b of books) { wobblyPoly(ctx, [[b[0], sy], [b[0], sy - b[1]], [b[0] + 16, sy - b[1]], [b[0] + 16, sy]], 220 + b[0], 0.8, 40); ctx.fillStyle = b[2]; ctx.fill(); ink(ctx, 2.4); }
    ctx.save(); ctx.translate(-22, sy - 2); ctx.rotate(-0.28); wobblyPoly(ctx, [[0, 0], [0, -50], [15, -50], [15, 0]], 231, 0.8, 40); ctx.fillStyle = '#7fb3d8'; ctx.fill(); ink(ctx, 2.4); ctx.restore();
    this.toy.x = 96; this.toy.y = sy; this.toy.draw(ctx, t);
    ctx.restore();
  }

  drawBed(ctx, t, room) {
    const k = clamp01(room), L = (dark, lit) => mixHex(dark, lit, k), br = this.reduced ? 0 : Math.sin(this.ch.ph) * 1.5;
    const rim = 'rgba(255,190,110,' + (0.75 * k).toFixed(3) + ')';
    ctx.save();
    // headboard: two turned posts and an arched board with a carved star
    const wood = L('#231733', '#6a4634');
    for (const px of [-336, -114]) {
      tube(ctx, [[px, 700], [px, -34]], 15, wood, INK, 4);
      ctx.beginPath(); ctx.arc(px, -46, 12, 0, TAU); ctx.fillStyle = wood; ctx.fill(); ink(ctx, 3.2);
    }
    wobble(ctx, [[-328, 70], [-328, -14], [-284, -42], [-225, -52], [-166, -42], [-122, -14], [-122, 70]], 51, 1.4);
    ctx.fillStyle = L('#2a1c3a', '#7a543c'); ctx.fill(); ink(ctx, 3.4);
    starPath(ctx, -225, -30, 9, 0); ctx.fillStyle = L('#3a2a4c', '#a57a52'); ctx.fill();
    // pillow
    wobble(ctx, [[-310, 26], [-300, -6], [-230, -15], [-150, -6], [-138, 26], [-226, 36]], 52, 1.5); ctx.fillStyle = L('#4a4266', '#efe7f5'); ctx.fill(); ink(ctx, 3);
    ctx.strokeStyle = 'rgba(29,21,48,0.2)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-292, 2); ctx.quadraticCurveTo(-276, 10, -268, 22); ctx.moveTo(-158, 2); ctx.quadraticCurveTo(-170, 10, -176, 22); ctx.stroke();
    // a knitted toy cat has been tucked in too
    const toy = L('#3a3256', '#f0b76a');
    for (const sd of [-1, 1]) { wobble(ctx, [[-172 + sd * 3, -1], [-172 + sd * 11, -13], [-172 + sd * 12, 2]], 60 + sd, 0.3); ctx.fillStyle = toy; ctx.fill(); ink(ctx, 2); }
    wobble(ctx, circlePts(-172, 8, 12, 8, 10.5), 59, 0.4); ctx.fillStyle = toy; ctx.fill(); ink(ctx, 2.4);
    ctx.strokeStyle = INK; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.arc(-176.5, 7, 2, Math.PI * 0.15, Math.PI * 0.85); ctx.arc(-167.5, 7, 2, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    // the child, the face on the pillow turned up to us (the sheet tucked up to the chin)
    const ch = this.ch, kc = KIDS.pigtails;
    drawHead(ctx, { kind: 'pigtails', x: KX, y: KY + br * 0.3, size: 2.45, dir: 1, turn: ch.turn, tilt: ch.tilt, lookX: ch.lx, lookY: ch.ly, t, seed: 11, lw: 0.66,
      lid: ch.lid, smile: lerp(ch.smile, 0.05, ch.shut), open: Math.max(1.25 * ch.yawn, 0.18 * ch.shut * ch.sleepy), brow: 0.9 * ch.yawn,
      colors: { hair: L('#6a3a20', kc.hair), skin: L('#6a5470', kc.skin), bobble: L('#3a3a6e', kc.bobble) } });
    // the quilt: patches, and the sheet turned down over its edge
    const edge = [[-440, 70], [-330, 22], [-240, 12 + br], [-150, 22 + br], [-70, 44], [-24, 120]];
    const quilt = () => wobblyPoly(ctx, [[-460, 700]].concat(edge, [[30, 700]]), 55, 2.5, 60);
    quilt(); ctx.fillStyle = L('#2f2752', '#7460b4'); ctx.fill();
    ctx.save(); ctx.clip();
    const cols = ['#9a86de', '#e79fc2', '#f3d77a', '#8fd0bd', '#6f8fd8'];
    for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) {
      const cx = -470 + i * 66 + (j & 1) * 33, cy = 62 + j * 44, c = cols[(i * 3 + j * 5) % cols.length];
      ctx.beginPath(); ctx.moveTo(cx, cy - 26); ctx.lineTo(cx + 37, cy); ctx.lineTo(cx, cy + 26); ctx.lineTo(cx - 37, cy); ctx.closePath();
      ctx.fillStyle = mixHex('#2f2752', c, 0.1 + 0.5 * k); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(29,21,48,0.25)'; ctx.lineWidth = 1.4; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.restore();
    quilt(); ink(ctx, 3.4);
    wobblyPoly(ctx, edge.concat(edge.slice().reverse().map((q) => [q[0] + 5, q[1] + 22])), 61, 1.4, 60); ctx.fillStyle = L('#4a4266', '#efe7f5'); ctx.fill(); ink(ctx, 3);
    // Papa, sitting by the bed: his back, a woolly sweater, a hand on the quilt; a breath lifts his shoulders
    const pa = this.pa, kp = KIDS.papa, wool = L('#1f2748', '#3f6c8c'), skin = L('#4a3a52', kp.skin), p = clamp01(this.turn);
    const up = (this.reduced ? 0 : Math.sin(t * 1.05) * 1.2) + 6 * pa.breath, U = (pts) => pts.map((q) => [q[0], q[1] - up * clamp01((170 - q[1]) / 170)]);
    const hx = HX, hy = HY - up + p * 1.5, back = U([[26, 700], [52, 104], [72, 32], [104, -6], [142, -14], [180, -6], [214, 32], [238, 104], [292, 700]]);
    wobblyPoly(ctx, back, 56, 2.5, 60); ctx.fillStyle = wool; ctx.fill();
    ctx.save(); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.05 + 0.07 * k).toFixed(3) + ')'; ctx.lineWidth = 3; ctx.beginPath();
    for (let x = 40; x < 290; x += 17) { ctx.moveTo(x, 30 - up); ctx.lineTo(x - 6 + (x - 150) * 0.1, 700); }
    ctx.stroke(); ctx.restore();
    wobblyPoly(ctx, back, 56, 2.5, 60); ink(ctx, 3.4);
    const sw = Math.sin(pa.sph) * 15 * pa.stroke, hand = [-22 + sw, 104 - Math.abs(sw) * 0.12];   // the hand strokes along the quilt
    tube(ctx, U([[82, 44], [32 + sw * 0.45, 92], [hand[0] + 6, hand[1]]]), 27, wool, INK, 5);   // arm
    ctx.beginPath(); ctx.ellipse(hand[0], hand[1], 13, 10, -0.2 + sw * 0.006, 0, TAU); ctx.fillStyle = skin; ctx.fill(); ink(ctx, 2.8);
    tube(ctx, [[hx, -14 - up], [hx - p * 2, -32 - up]], 25, skin, INK, 4);              // neck
    ctx.beginPath(); ctx.ellipse(hx, -11 - up, 35, 10, 0, 0, TAU); ctx.fillStyle = L('#2a3458', '#5a86a6'); ctx.fill(); ink(ctx, 3);      // collar
    // the head: the back of it while he watches the window; turning to the child shows his face
    const hc = { hair: L('#22171d', kp.hair), skin, beard: false }, f = smooth((p - 0.3) / 0.4);
    const ho = { kind: 'papa', x: hx - 3 * p, y: hy, size: 3.25, dir: -1, t, seed: 23, colors: hc, lw: 0.54 };   // (lw: the room's own line weight)
    if (f < 1) { ho.back = true; ho.turn = 0; ho.tilt = pa.tilt * 0.6 - 0.04 * (1 - p); drawHead(ctx, ho); }
    if (f > 0) {
      ctx.save(); ctx.globalAlpha = f;
      ho.back = false; ho.turn = lerp(0.7, 1, p); ho.tilt = pa.tilt; ho.lid = pa.lid; ho.smile = pa.smile; ho.open = 0.55 * pa.sing; ho.lookX = 0.9; ho.lookY = clamp(pa.tilt * 4 + 0.3, -1, 1);
      if (pa.sing > 0.05) ho.mood = 'sing';
      drawHead(ctx, ho); ctx.restore();
    }
    // warm rim light from the candle
    ctx.strokeStyle = rim; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(74, 36 - up); ctx.quadraticCurveTo(86, 4 - up, 108, -4 - up); ctx.stroke();
    ctx.restore();
  }

  // eyelids, in screen space
  drawOver(ctx, view) {
    if (this.lids <= 0.002) return;
    view.screen(ctx);
    const W = view.W, H = view.H, k = this.lids, mid = clamp(view.sy(-40), H * 0.3, H * 0.62);   // the lids meet across our faces
    ctx.fillStyle = '#0d0716';
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(W + 10, -10); ctx.lineTo(W + 10, mid * k - 40 * (1 - k)); ctx.quadraticCurveTo(W / 2, mid * k + 90 * (1 - k) + 10, -10, mid * k - 40 * (1 - k)); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-10, H + 10); ctx.lineTo(W + 10, H + 10); ctx.lineTo(W + 10, H - (H - mid) * k + 40 * (1 - k)); ctx.quadraticCurveTo(W / 2, H - (H - mid) * k - 90 * (1 - k) - 10, -10, H - (H - mid) * k + 40 * (1 - k)); ctx.closePath(); ctx.fill();
    if (k > 0.9) { ctx.fillStyle = 'rgba(13,7,22,' + clamp01((k - 0.9) * 10).toFixed(2) + ')'; ctx.fillRect(0, 0, W, H); glow(ctx, W * 0.42, H * 0.5, Math.min(W, H) * 0.5, '#ff9f4a', 0.12); }
  }
}
