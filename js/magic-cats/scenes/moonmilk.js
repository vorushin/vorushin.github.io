// Scene 4 — Moon milk. One garden under a full moon, as in the book's picture: set the white
// saucers out, pour moonlight into them with a finger, carry them into the dark room before
// the sun is up, put one on the windowsill in the evening — and let the kitten drink first.
import { Street, Perch } from '../street.js';
import { Leap } from '../leap.js';
import { Cat, Kid, Bird } from '../actors.js';
import { drawSaucer, drawBush, drawFarTown } from '../props.js';
import { TAU, lerp, ease, clamp01, dist, spring, approach } from '../util.js';
import { INK, PAL, ink, wobble, wobblyPoly, glow, tube, circlePts, crayonRings } from '../paint.js';

const T = {
  hello: { en: 'Say hello: tap the mouse and the bird', de: 'Sag hallo: tippe Maus und Vogel an', ru: 'Поздоровайся: нажми на мышку и на птичку' },
  set: { en: 'Drag each saucer into the moonlight', de: 'Zieh jedes Schälchen ins Mondlicht', ru: 'Перетащи каждое блюдечко под лунный свет' },
  pour: { en: 'Touch a saucer and hold: the moon pours her light', de: 'Berühre ein Schälchen und halte: der Mond gießt sein Licht hinein', ru: 'Коснись блюдечка и держи: луна нальёт в него свет' },
  indoors: { en: 'Carry the saucers into the dark room', de: 'Trag die Schälchen ins dunkle Zimmer', ru: 'Отнеси блюдечки в тёмную комнату' },
  sill: { en: 'Put the saucer on the windowsill', de: 'Stell das Schälchen aufs Fensterbrett', ru: 'Поставь блюдечко на подоконник' },
  deliver: { en: 'Carry the tale to the window', de: 'Bring das Märchen zum Fenster', ru: 'Отнеси сказку к окну' },
  lap: { en: 'Tap the kitten: lap, lap, lap', de: 'Tippe das Kätzchen an: schleck, schleck, schleck', ru: 'Нажимай на котёнка: лак-лак-лак' },
  lapPapa: { en: 'Now Papa: tap him', de: 'Jetzt Papa: tippe ihn an', ru: 'Теперь папа: нажми на него' }
};
const MOON = { x: -222, y: -392, r: 56 };
const DOOR = { x: 188, h: 68 };
// The house is a little wider than the window needs: its sill runs far to the left of the window (a long
// board), so that the saucer can stand on it clear of the girl, and papa has a real stretch to pad along.
const HOUSE = { x: 90, w: 260, h: 188 };
const WIN = { dx: 18, dy: -108, w: 54, h: 58, ledge: 120 };   // → window x 81…135, sill board x −45…141
const SILL = { x: -10, y: -80 };        // where the saucer stands on the sill
const LEDGE = -78;                     // the cats' feet on the sill
const GIVE = 70;                       // papa hands the bundle in from here (facing the window)
const KIT_AT = -32;                    // the kitten drinks from here (facing right)
const POUR = 1.5;                      // seconds of moonlight per saucer
const SUNX = -60;
const LIFT = 20;                       // a dragged saucer floats a little above the finger
const NEAR = 120;                      // a saucer let go this near a free place goes there
const PAPA_REST = { dx: -24, dy: 2 }, KIT_REST = { dx: 46, dy: 14 }, KIT_WAIT = { dx: -14, dy: 1 };   // on the apple tree: papa left of the middle, the kitten ahead of him, clear of his bundle and nose

export default class MoonMilk extends Street {
  constructor(game, index) {
    super(game, index);
    this.follow = false; this.cam.x = -18; this.far = 0;      // (the far roofs are painted in drawBack, behind the peeking sun)
    this.skyFixed = true;
    this.tree = this.addTree({ x: -165, h: 205, r: 72, kind: 'apple', lean: 0, seed: 411, trunk: '#b9963f' });
    this.addTree({ x: -490, h: 176, r: 60, kind: 'round', seed: 412 });
    this.addTree({ x: 450, h: 196, r: 66, kind: 'big', seed: 413 });
    this.kid = new Kid({ kind: 'pigtails', mood: 'wave' });
    this.house = this.addHouse({ x: HOUSE.x, w: HOUSE.w, h: HOUSE.h, style: 'brick', seed: 421, door: false, windows: [{ dx: WIN.dx, dy: WIN.dy, w: WIN.w, h: WIN.h, kind: 'square', lit: 1, ledge: WIN.ledge, kid: this.kid, kidDx: 8 }] });
    this.win = this.house.windows[0];
    this.sill = new Perch({ x: GIVE, y: this.house.win(0).sillY, hw: 22, kind: 'sill', enabled: false });
    this.papa = this.addCat(new Cat({ kind: 'papa', x: -600, y: -340 })); this.papa.carry = 1;
    this.kit = this.addCat(new Cat({ kind: 'kitten', x: -660, y: -300 }));
    this.rest = [];
    this.spots = [{ x: -232, y: -27, r: 56, taken: null }, { x: -105, y: -58, r: 56, taken: null }, { x: -28, y: -41, r: 56, taken: null }];
    this.saucers = [0, 1, 2].map((i) => ({ x: DOOR.x - 28 + i * 28, y: -4, r: 38, fill: 0, size: 0, state: 'hidden', spot: null, pulse: 0, note: -1, held: false, i }));
    this.stored = 0;
    this.door = 0;                       // 0 shut … 1 open
    this.beam = { on: false, x: 0, y: 0, a: 0, hit: null };
    this.sun = { peek: -0.4 };
    this.moonPulse = 0;
    this.mouse = { x: 340, y: 0, dir: -1, run: 0, vis: false, hop: { x: 0, v: 0 }, seed: 77, look: 0 };
    this.bird = new Bird({ color: 'blue', x: 420, y: -470 }); this.bird.hidden = true; this.birds.push(this.bird);
    this.tg = { mouse: { x: 0, y: 0, r: 38, done: false }, bird: { x: 0, y: 0, r: 38, done: false } };
    this.swing = { x: -105, y: -56, a: 0 };
    this.phase = 'arrive';
    this.camPhase = null;
    this.pourLoop = null;
    this.job = null;                     // what is being carried about: {items(), dest(s), place(s, d), text}
    this.grab = null;
    this.expect = () => {
      if (this.job && !this.grab) {
        if (!this.camReady || this._camBusy) return null;
        const s = this.nextItem(), d = s ? this.hintDest(s) : null;
        return d ? { kind: 'drag', x: s.x, y: s.y - 4, r: 30, x2: d.x, y2: d.y + LIFT * 0.5, text: this.job.text } : null;
      }
      if (this.phase === 'pour') {
        const b = this.beam, s = (b && b.on && b.hit && b.hit.fill < 1) ? b.hit : this.saucers.find((q) => q.state === 'spot' && q.fill < 1);
        return s ? { kind: 'hold', x: s.x, y: s.y - 6, r: 34, dur: (1 - s.fill) * POUR + 0.25, text: T.pour } : null;
      }
      if (this.phase === 'leap' && this.leap && this.leap.enabled) return this.leap.expect(T.deliver);
      return null;
    };
    this.audio.play('moonmilk', { intensity: 0.8 }); this.audio.ambience('night');
  }

  async hop(cat, x, y, o) { cat.leapTo(x, y, o); await this.until(() => !cat.jump); }
  // walk a cat along at a walking pace (the gait follows the distance), facing where it goes
  async walkTo(cat, x, speed) {
    const d = Math.abs(x - cat.x);
    if (d < 1) return;
    cat.wake();
    cat.dir = x > cat.x ? 1 : -1;
    cat.walking = 1;
    await this.tween(cat, { x }, Math.max(0.35, d / (speed || 60)), ease.inOutSine);
    cat.walking = 0;
  }
  // a step or two backwards, still facing the same way (making room)
  async stepBack(cat, dx, dur) {
    cat.walking = 1;
    await this.tween(cat, { x: cat.x + dx }, dur, ease.inOutSine);
    cat.walking = 0;
  }
  restOn(cat, r) { this.rest = this.rest.filter((q) => q.cat !== cat); if (r) this.rest.push({ cat, tree: this.tree, dx: r.dx, dy: r.dy }); }
  restAt(r) { return { x: this.tree.topX + r.dx, y: this.tree.perchY + r.dy }; }
  freeSpot(s) {
    let best = null, bd = 1e9;
    for (const q of this.spots) { if (q.taken) continue; const d = dist(s.x, s.y, q.x, q.y); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  pet(c) {
    c.eyes = 'happy'; c.sq.v += 4;
    this.audio.sfx.purr(1.1);
    this.hearts(c.x, c.y - 52 * c.size, 3);
    this.spawn(async () => { await this.wait(1.1); if (c.eyes === 'happy' && !this.keepHappy) c.eyes = 'open'; });
  }

  // ── the camera: one box per moment of the story ──
  frame() {
    const P = this.camPhase, up = this.view.portrait, tr = this.tree, ty = tr.perchY, tx = tr.topX, g = this.house.win(0);
    const B = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 };
    const add = (l, r, t, b) => { B.l = Math.min(B.l, l); B.r = Math.max(B.r, r); B.t = Math.min(B.t, t); B.b = Math.max(B.b, b); };
    const crown = () => add(tx - 72, tx + 70, ty - 84, ty + 18);      // (headroom for ears and tails)
    const sill = () => add(SILL.x - 40, g.x + g.w / 2 + 8, g.top - 12, LEDGE + 16);
    switch (P) {
      case 'tree': crown(); if (!up) add(g.x - 30, g.x + g.w / 2 + 6, g.top - 10, g.bottom + 6); break;
      case 'friends': crown(); add(-90, 92, -40, this.short() ? 24 : 0); break;
      case 'carry': {
        if (this.grab) return null;                       // hold still while a saucer is carried: the drop point must not slide away
        const job = this.job;
        if (!job) return null;
        const its = job.items();
        if (up || this.short()) {                          // upright / short screens: just this saucer and where it goes, the ground lifted towards the middle
          // the whole task still to do (the saucers not yet moved and where they go), every saucer, pool and cat in it whole or clearly out
          if (!its.length) return null;
          for (const q of its) add(q.x - 34, q.x + 34, q.y - 46, 46);
          if (job.hint) { for (const q of this.spots) if (!q.taken) add(q.x - 44, q.x + 44, q.y - 46, 46); }
          else for (const q of its) { const d = job.dest(q); add(d.x - 44, d.x + 44, d.y - 46, 46); }
          return this.settle(B);
        } else {
          for (const q of its) add(q.x - 30, q.x + 30, q.y - 40, 0);
          for (const q of this.spots) add(q.x - 40, q.x + 40, q.y - 40, 0);
          add(DOOR.x - 30, DOOR.x + 30, -DOOR.h - 12, 0);
          add(tx - 72, tx + 70, ty - 84, ty);              // (the cats on the tree watch)
        }
        break;
      }
      case 'pour': add(MOON.x - MOON.r - 10, 10, this.short() ? this.tree.perchY - 84 : MOON.y - MOON.r - 6, up ? 30 : 0); break;   // (on a short screen: the saucers, the beam coming down and the cats watching whole; not the disc)
      case 'day': crown(); add(SUNX - 40, SUNX + 40, -330, ty); break;
      case 'evening': crown(); add(-40, g.x + 34, g.top - 10, 0); break;
      case 'sillDrop': sill(); add(DOOR.x - 30, DOOR.x + 30, -DOOR.h - 12, up || this.short() ? 40 : 0); break;
      case 'leap': crown(); sill(); break;
      case 'sill': sill(); break;
      case 'end': sill(); add(SILL.x - 70, g.x + g.w / 2 + 50, g.top - 50, LEDGE + 40); break;   // (a little wider: papa, the kitten asleep beside him, the girl asleep in the window)
      default: return null;
    }
    return B;
  }
  // Move to the phase's framing with a calm shot (the box is re-read while moving), then keep following it.
  direct(P, o, dur) {
    this.camPhase = P;
    const low = this.view.portrait || this.short();
    const ground = (!low && (P === 'carry' || P === 'sillDrop')) || (P === 'pour' && this.short());   // (short screens: the ground line stays low for the pour, the room goes to the cats and the beam)
    const opts = Object.assign({ ground, pad: 26, max: 1.8, min: 0.7 }, o || {});
    let last = null;
    const box = () => { const b = this.frame(); if (b) last = b; return b || last; };
    // every box here is still while it is shown, so the shot is simply held (no tracking: nothing to breathe)
    const id = (this._camMove = (this._camMove || 0) + 1);
    this._camBusy = true;                                // (a move is under way: no drag is offered or taken until it has arrived)
    const moved = this.shot(box, dur === undefined ? 1.7 : dur, opts);
    moved.then(() => { if (this._camMove === id) this._camBusy = false; }, () => {});
    return moved;                                       // (resolves when the picture has arrived)
  }
  // the longest drag is asked for first (the whole task in view), the shortest last (closest)
  hintDest(q) { const j = this.job; return j ? (j.hint ? j.hint(q) : j.dest(q)) : null; }
  nextItem() {
    let best = null, bd = -1;
    for (const q of this.job.items()) { if (q.moving) continue; const d = this.hintDest(q), dd = d ? dist(q.x, q.y, d.x, d.y) : 0; if (dd > bd) { bd = dd; best = q; } }
    return best;
  }
  // Grow a box until every saucer, moonlight pool and watching cat is either wholly inside the picture or clearly
  // outside it — nothing cut in half by an edge (or by the caption / hint line: the free rect counts).
  settle(B) {
    const v = this.view, F = v.freeRect(), o = { pad: 26, max: 1.8, min: 0.7 };
    const things = [];
    for (const q of this.saucers) if (q.state !== 'hidden' && q.state !== 'stored' && q.size > 0.02) things.push([q.x - 22, q.x + 22, q.y - 14, q.y + 6]);
    if (this.job && this.job.hint) for (const q of this.spots) if (!q.taken) things.push([q.x - 36, q.x + 36, q.y - 22, q.y + 14]);   // (free pools matter only while saucers are set out)
    for (const c of [this.papa, this.kit]) if (!c.hidden) { const k = c.size / (c.kind === 'kitten' ? 0.6 : 1); things.push([c.x - 34 * k, c.x + 34 * k, c.y - 62 * c.size - 4, c.y + 2]); }
    for (let n = 0; n < 4; n++) {
      const c = this.shotFor(B, o), s = v.fit * c.zoom;
      const L = c.x + (F.l - v.ox) / s, R = c.x + (F.r - v.ox) / s, T = c.y + (F.t - v.oy) / s, D = c.y + (F.b - v.oy) / s;
      let grew = false;
      for (const r of things) {
        const meets = r[1] > L && r[0] < R && r[3] > T && r[2] < D, whole = r[0] >= L && r[1] <= R && r[2] >= T && r[3] <= D;
        if (meets && !whole && (r[0] < B.l || r[1] > B.r || r[2] < B.t || r[3] > B.b)) { B.l = Math.min(B.l, r[0]); B.r = Math.max(B.r, r[1]); B.t = Math.min(B.t, r[2]); B.b = Math.max(B.b, r[3]); grew = true; }
      }
      if (!grew) break;
    }
    return B;
  }
  short() { const v = this.view; return !v.portrait && v.H < 520; }

  // ── input: the moonbeam follows the finger while the moon is pouring; saucers are carried by hand ──
  onDown(p) {
    if (this.phase === 'pour') { this.beam.on = true; this.beam.x = p.x; this.beam.y = p.y; return; }
    if (this.job && !this.grab && this.camReady && !this._camBusy) {
      let best = null, bd = 56;
      for (const s of this.job.items()) { if (s.moving) continue; const d = dist(p.x, p.y, s.x, s.y - 4); if (d < bd) { bd = d; best = s; } }
      if (best) {
        // (lifted into the fingers, not jumped: an offset from the finger that eases away in tick(); the finger itself is followed at once)
        this.grab = { s: best, hx: best.x, hy: best.y, px: p.x, py: p.y, ox: best.x - p.x, oy: best.y - (p.y - LIFT) };
        best.held = true;
        this.audio.sfx.plip();
        return;
      }
    }
    if (this.leap && this.leap.enabled) { this.leap.down(p); return; }
    if (this.onToy(p)) return;
    for (const c of [this.kit, this.papa]) if (!c.hidden && !c.jump && c.mode !== 'curl' && dist(p.x, p.y, c.x, c.y - 24 * c.size) < 40) { this.pet(c); return; }
  }
  onMove(p) {
    if (this.grab) { const g = this.grab; g.px = p.x; g.py = p.y; g.s.x = p.x + g.ox; g.s.y = p.y - LIFT + g.oy; this.idle = 0; return; }
    if (this.phase === 'pour') { if (this.beam.on) { this.beam.x = p.x; this.beam.y = p.y; } } else if (this.leap) this.leap.move(p);
  }
  onUp(p) {
    this.beam.on = false;
    if (this.grab) {
      const g = this.grab, s = g.s, job = this.job;
      this.grab = null;
      s.x = p.x; s.y = p.y - LIFT;                       // (it goes where the finger let go, whatever was left of the lift)
      // forgiving: let go anywhere reasonably near a free place and the saucer goes there by itself;
      // let go far away and it glides home — no failure sound, no snap
      const d = job ? (job.near ? job.near(s) : job.dest(s)) : null;
      if (d && dist(s.x, s.y, d.x, d.y) <= Math.max(NEAR, d.r || 0)) { this.camReady = false; this.spawn(() => job.place(s, d)); }   // (from this moment until the next drag is framed nothing is offered)
      else {
        s.moving = true;
        this.spawn(async () => { const k = Math.min(1, dist(s.x, s.y, g.hx, g.hy) / 300); await this.tween(s, { x: g.hx, y: g.hy }, 0.45 + 0.35 * k, ease.inOutSine); s.held = false; s.moving = false; });
      }
      return;
    }
    if (this.leap && this.phase !== 'pour') this.leap.up(p);
  }
  // carry things about until `done()`; see this.job
  // The camera frames each drag before it is asked for (on narrow screens it moves on to the next saucer and its place).
  async carry(job, done, P, o) {
    this.job = job; this.placed = this.placed || 0;
    for (;;) {
      this.camReady = false;
      await this.direct(P || 'carry', o, this._camFirst === false ? 1.1 : 1.7);
      this._camFirst = false;
      if (!this._camBusy) this.camReady = true;          // (only where the new shot has really arrived)
      else { await this.until(() => !this._camBusy); this.camReady = true; }
      const n = this.placed;
      await this.until(() => done() || this.placed !== n);
      this.camReady = false;                             // (nothing is offered until the camera has framed the next drag)
      if (done()) break;
      await this.until(() => !this.job.items().some((q) => q.moving) && !this.saucers.some((q) => q.state === 'placing' || q.state === 'storing'));
    }
    this.job = null; this._camFirst = true;
  }
  // glide a let-go saucer to where it belongs (the distance sets the time: a near drop is a nudge, a far one a glide)
  glide(q, x, y, more) { const d = dist(q.x, q.y, x, y); return this.tween(q, Object.assign({ x, y }, more || {}), 0.14 + Math.min(0.4, d / 260), ease.outCubic); }

  async run() {
    const papa = this.papa, kit = this.kit, tree = this.tree, A = this.audio, kid = this.kid;
    const wg = this.house.win(0), girl = { x: wg.x + 8, y: wg.y - 6 };
    // establishing: the whole garden under the full moon; the cats arrive on the apple tree
    await this.wait(0.6);
    this.say(0);                                         // Everyone is glad when the cats come, and everyone puts out a treat for them.
    A.sfx.hop(-0.6);
    const pr = this.restAt(PAPA_REST), kr = this.restAt(KIT_REST);
    await this.hop(papa, pr.x, pr.y, { height: 90, dur: 0.75 });
    tree.land(1); A.sfx.land(-0.4); A.playerNote(); this.leaves(papa.x, papa.y, 8);
    this.restOn(papa, PAPA_REST);
    papa.look = kr;                                      // (a glance back: is the little one coming?)
    A.sfx.hop(-0.6);
    await this.hop(kit, kr.x, kr.y, { height: 84, dur: 0.7 });
    tree.land(0.6); A.sfx.land(-0.3, true); A.playerNote({ octave: 1 }); this.leaves(kit.x, kit.y, 5);
    this.restOn(kit, KIT_REST);
    kit.dir = 1;
    this.direct('tree', {}, 2);
    await this.wait(0.3);
    papa.look = kit.look = girl;
    kid.look = papa; kid.cheer(); A.sfx.giggle();
    this.hearts(wg.x, wg.top - 4, 4);
    this.spawn(async () => { await this.wait(0.9); papa.act('slowblink'); await this.wait(0.5); kit.act('tilt'); });
    await this.next();

    await this.say(1);                                   // These magic cats do not eat mice or little birds — for them, people gather moon milk.
    kid.mood = 'wait'; kid.look = null;
    this.direct('friends');
    const m = this.mouse;
    m.vis = true; m.run = 1;
    this.bird.hidden = false;
    let landed = false;
    A.sfx.flutter(0.5);
    papa.look = this.bird;
    this.bird.flyTo(-66, 0, () => { landed = true; this.bird.chirp(); A.sfx.chirp(); this.bird.look(0.3); });
    await this.tween(m, { x: 66 }, 1.7, ease.outQuad);
    m.run = 0; m.look = 1;                               // the mouse sits up and looks up at the cats
    await this.until(() => landed);
    papa.look = { x: m.x, y: m.y - 10 }; kit.look = { x: this.bird.x, y: this.bird.y - 10 };
    for (let n = 0; n < 2; n++) {
      const i = await this.tapAny([this.tg.mouse, this.tg.bird], { text: T.hello });
      if (i === 0) {
        this.tg.mouse.done = true; m.hop.v -= 90;
        A.blip({ f0: 2300, f1: 3100, dur: 0.07, vel: 0.05 }); A.blip({ f0: 2500, f1: 3300, dur: 0.07, vel: 0.05, when: A.now + 0.12 });
        this.hearts(m.x, m.y - 26, 3);
        papa.act('slowblink'); A.sfx.purr(1);              // a cat's hello: a slow blink
      } else {
        this.tg.bird.done = true; this.bird.chirp(); A.sfx.chirp();
        this.notes(this.bird.x + 8, this.bird.y - 32, 2);
        this.hearts(this.bird.x, this.bird.y - 34, 2);
        kit.act('tilt'); A.sfx.mrrp(true); kit.meow(0.22); kit.sq.v += 5;
      }
    }
    await this.wait(0.9);
    papa.look = kit.look = null;
    A.sfx.flutter(0);
    this.bird.flyTo(this.house.x + 4, this.house.topY + 1);   // they stay to watch: the bird on the roof, the mouse by the stump
    m.dir = -1; m.run = 1; m.look = 0;
    this.spawn(async () => { await this.tween(m, { x: -193 }, 1.9, ease.inOutQuad); m.run = 0; m.dir = 1; });

    await this.say(2);                                   // On full-moon nights… people set out little white saucers in the moonlight.
    const cam2 = this.direct('carry');
    A.sfx.knock();
    await this.tween(this, { door: 1 }, 0.5, ease.outCubic);
    for (const s of this.saucers) { s.state = 'step'; A.sfx.pop(); await this.tween(s, { size: 1 }, 0.22, ease.outBack); }
    await cam2;
    papa.look = kit.look = this.saucers[1];
    const setJob = {
      text: T.set, items: () => this.saucers.filter((q) => q.state === 'step'), dest: (q) => this.freeSpot(q),
      hint: () => { let far = null; for (const q of this.spots) if (!q.taken && (!far || q.x < far.x)) far = q; return far; },   // (the farthest free pool first)
      place: async (q, sp) => {
        if (sp.taken) sp = this.freeSpot(q);
        if (!sp) { q.held = false; return; }
        sp.taken = q; q.spot = sp; q.state = 'placing'; this.placed++;
        await this.glide(q, sp.x, sp.y);
        q.state = 'spot'; q.held = false;
        A.sfx.plip(); A.chordNote(this.spots.filter((z) => z.taken).length, { vel: 0.6 });
        this.sparkle(q.x, q.y - 8, 8);
      }
    };
    await this.carry(setJob, () => this.saucers.every((q) => q.state === 'spot'));
    papa.look = kit.look = null;
    await this.wait(0.4);

    await this.say(3);                                   // The moon pours her light into them,
    await this.direct('pour', { max: 1.5, min: 0.85 });
    this.phase = 'pour';
    this.pourLoop = A.loop('pour');
    papa.look = MOON;
    await this.until(() => this.saucers.every((s) => s.fill >= 1));
    this.phase = 'idle'; this.beam.on = false;
    this.pourLoop.stop(); this.pourLoop = null;
    A.sfx.chime(5);
    this.moonPulse = 1;
    papa.look = null; papa.act('slowblink');
    await this.wait(1.2);

    let dawn = false;                                    // the night is over…
    this.spawn(async () => { await this.skyTo('dawn', 5); dawn = true; });
    this.spawn(() => this.tween(this.sun, { peek: 1 }, 4.5, ease.outCubic));
    await this.say(4);                                   // and early in the morning, before the sun is up, the saucers are carried indoors…
    await this.carry({
      text: T.indoors, items: () => this.saucers.filter((q) => q.state === 'spot'), dest: () => ({ x: DOOR.x, y: -30, r: 64 }),
      place: async (q) => {
        if (q.spot) { q.spot.taken = null; q.spot = null; }
        q.shelf = this.stored++; q.state = 'storing'; this.placed++;
        A.sfx.swish(); A.chordNote(q.shelf, { vel: 0.55, inst: 'glass' });
        await this.glide(q, DOOR.x - 6, -12 - q.shelf * 19, { size: 0.52 });
        q.state = 'stored'; q.held = false;
        this.sparkle(DOOR.x, -34, 6);
      }
    }, () => this.saucers.every((q) => q.state === 'stored'));
    await this.wait(0.5);
    await this.until(() => dawn);
    A.sfx.knock();
    await this.tween(this, { door: 0 }, 0.5, ease.inOutQuad);
    // …the day goes by while the milk waits in the dark, and the cats sleep it away on the tree
    A.ambience('day');
    this.direct('day', { max: 1.7 }, 2.2);
    kit.act('yawn'); A.sfx.yawn();
    this.spawn(async () => { await this.wait(0.9); kit.mode = 'curl'; await this.wait(0.5); kit.eyes = 'closed'; });
    this.spawn(async () => { await this.wait(0.5); papa.act('yawn'); await this.wait(1.3); papa.mode = 'curl'; await this.wait(0.6); papa.eyes = 'closed'; });
    await this.wait(this.reduced ? 0.6 : 1.6);
    this.spawn(() => this.tween(this.sun, { peek: 5.2 }, 2.6, ease.inOutSine));
    await this.skyTo('day', 2.6);
    this.bird.chirp(); A.sfx.chirp(); this.notes(this.bird.x + 6, this.bird.y - 32, 1);
    await this.wait(this.reduced ? 0.4 : 1.1);
    this.spawn(() => this.tween(this.sun, { peek: -0.6 }, 2.6, ease.inOutSine));
    await this.skyTo('dawn', 2.6);
    A.ambience('night');
    this.spawn(() => this.skyTo('night', 3.2));
    // evening: they wake (a good stretch comes by itself when a curled cat stands up)
    papa.eyes = 'open'; papa.mode = 'stand'; papa.wake();
    await this.wait(0.5);
    kit.eyes = 'open'; kit.mode = 'stand'; kit.wake();
    kid.mood = 'wave'; kid.look = papa;
    await this.wait(this.reduced ? 0.3 : 1.2);
    papa.look = kit.look = girl;

    await this.say(5);                                   // Then in the evening, just before bed, you put your saucer of moon milk out on the windowsill.
    this.direct('sillDrop', { max: 1.7 });
    A.sfx.knock();
    await this.tween(this, { door: 1 }, 0.5, ease.outCubic);
    const s = this.saucers.find((q) => q.shelf === 0);
    s.state = 'step'; A.sfx.pop();
    await this.tween(s, { x: DOOR.x - 12, y: -4, size: 1 }, 0.4, ease.outBack);
    kid.look = s;
    await this.carry({
      text: T.sill, items: () => (s.state === 'step' ? [s] : []), dest: () => ({ x: SILL.x, y: SILL.y, r: 64 }),
      place: async () => {
        s.state = 'placing'; this.placed++;
        await this.glide(s, SILL.x, SILL.y);
        s.state = 'sill'; s.held = false; s.goal = 1;
        A.sfx.plip(); A.chordNote(2, { vel: 0.6 }); this.sparkle(s.x, s.y - 8, 10);
        kid.cheer();
      }
    }, () => s.state === 'sill', 'sillDrop', { max: 1.7 });
    const camLeap = this.direct('leap', { max: 1.6 });     // straight on to the cats: the tree and the sill
    this.spawn(() => this.tween(this, { door: 0 }, 0.5, ease.inOutQuad));
    papa.look = kit.look = s;
    kid.look = papa;

    await this.say(6);                                   // And when the cat has handed over its little bundle…, it pads across to the saucer…
    await camLeap;
    const start = new Perch({ at: () => this.restAt(PAPA_REST), owner: tree, hw: 30, kind: 'tree' });
    this.restOn(papa, null);
    const L = this.leap = new Leap(this, { cat: papa, perches: [start, this.sill], start, flies: [{ x: -40, y: -250 }], onLeap: () => { papa.look = null; this.spawn(() => this.kitWaits()); } });
    this.sill.enabled = true; this.phase = 'leap';
    papa.look = { x: this.sill.x, y: this.sill.y - 10 };   // (he eyes the sill before he goes)
    await L.reach(this.sill);
    L.enabled = false; this.phase = 'drink';
    papa.dir = 1;
    this.direct('sill');
    kid.look = papa;
    await this.deliver(papa, this.house, 0);
    this.leap = null;
    papa.look = s;
    await this.wait(0.3);
    await this.walkTo(papa, this.drinkX(papa, s, -1), 58);      // …pads across the sill to the saucer
    papa.look = s;
    await this.tween(papa, { headDown: 0.6 }, 0.4, ease.inOutSine);   // a sniff: moon milk…
    await this.wait(0.8);
    await this.tween(papa, { headDown: 0 }, 0.35, ease.inOutSine);
    papa.act('lick');                                    // …licks his lips, and glances back at the tree: where is the little one?
    await this.wait(1.2);
    papa.look = kit;

    await this.say(7);                                   // If a cat comes with its kitten, the kitten usually gets to the milk first…
    this.restOn(kit, null);
    kit.wake(); kit.look = s; kit.crouch = 1;
    await this.wait(0.5);
    A.sfx.meow(true); kit.meow();
    papa.look = kit; papa.act('ears');
    this.spawn(() => this.tween(papa, { headDown: 0 }, 0.3));
    await this.wait(0.25);
    A.sfx.hop();
    kit.crouch = 0;
    await this.hop(kit, KIT_AT, LEDGE, { height: 70 });
    A.sfx.land(0, true); kit.dir = 1; kit.look = s;
    papa.eyes = 'wide';
    await this.stepBack(papa, 22, 0.6);                  // papa makes room…
    papa.eyes = 'open'; papa.mode = 'sit';
    kid.mood = 'happy'; kid.look = kit;
    this.spawn(async () => {                             // …and gives the viewer a look: what can you do
      await this.wait(0.5);
      papa.look = null; papa.headTurn = 1;
      await this.wait(1.3);
      papa.act('slowblink');
      await this.wait(1.6);
      papa.headTurn = null; papa.look = kit;
    });
    await this.tween(kit, { headDown: 1 }, 0.3);
    this.spawn(() => this.tween(kit, { tailCurl: 1 }, 0.8));       // the tip of the tail curls with pleasure while it laps
    for (let i = 0; i < 3; i++) {
      await this.tapOn(() => { const h = kit.anchor('back'); return { x: h.x - 14 * kit.dir, y: h.y - 2, r: 40 }; }, { text: T.lap });   // (on its back: the paw hint must not cover the face)
      this.lap(kit, s, 0.2, 0.34);
    }
    await this.wait(0.5);
    this.spawn(() => this.tween(kit, { tailCurl: 0 }, 1.2));
    await this.tween(kit, { headDown: 0 }, 0.3);
    kit.eyes = 'happy'; A.sfx.meow(true); kit.meow(); this.hearts(kit.x, kit.y - 40, 3);
    kid.cheer();
    await this.wait(0.7);
    kit.eyes = 'open'; kit.act('lick');
    await this.wait(0.9);
    papa.headTurn = null; papa.look = kit;
    kit.look = null; kit.fidget = false;                 // full and sleepy: a nap right here on the sill, at the far end, out of papa's way
    this.spawn(async () => { kit.act('yawn'); await this.wait(1.2); kit.mode = 'curl'; await this.wait(0.7); kit.eyes = 'closed'; });
    await this.wait(0.6);
    papa.look = s; papa.mode = 'stand';                  // …and papa laps up whatever is left
    await this.wait(0.5);
    await this.walkTo(papa, this.drinkX(papa, s, -1), 50);
    papa.dir = -1;
    await this.tween(papa, { headDown: 1 }, 0.35);
    this.spawn(() => this.tween(papa, { tailCurl: 1 }, 0.8));
    kid.look = papa; kid.mood = 'wait';
    this.spawn(async () => { await this.wait(0.6); kid.act('yawn'); });
    for (let i = 0; i < 2; i++) {
      await this.tapOn(() => { const h = papa.anchor('back'); return { x: h.x, y: h.y - 2, r: 44 }; }, { text: T.lapPapa });
      this.lap(papa, s, 0.2, 0.5);
    }
    await this.wait(0.6);
    this.spawn(() => this.tween(papa, { tailCurl: 0 }, 1.2));
    await this.tween(papa, { headDown: 0 }, 0.35);
    this.keepHappy = true;
    papa.eyes = 'happy'; papa.look = null;
    A.sfx.purr(3);
    this.hearts(papa.x, papa.y - 60, 4);
    kid.act('rubEyes');
    this.direct('end', { max: 1.5 }, 2.6);
    await this.wait(0.9);
    papa.eyes = 'open'; papa.mode = 'sit'; papa.look = girl;
    await this.wait(0.8);
    kid.mood = 'sleep';                                  // she falls asleep on her folded arms
    this.win.rings = 0.3; this.spawn(() => this.tween(this.win, { rings: 1 }, 1.2, ease.outCubic));
    await this.wait(0.7);
    papa.act('slowblink');
    await this.next();
  }
  // Papa has gone: the kitten pads along the treetop to the middle of the crown and waits there (watching the sill),
  // well clear of the edge of the close shot of the sill on an upright phone.
  async kitWaits() {
    const kit = this.kit, W = this.waitSpot(), to = this.restAt(W);
    if (kit.jump) return;
    this.restOn(kit, null);
    kit.wake();
    this.spawn(() => this.tween(kit, { y: to.y }, Math.max(0.5, Math.abs(to.x - kit.x) / 40), ease.inOutSine));
    await this.walkTo(kit, to.x, 40);
    if (!kit.jump) { this.restOn(kit, W); kit.dir = 1; kit.look = { x: SILL.x, y: SILL.y }; }
  }
  // A place along the crown where the waiting kitten is clearly outside the sill shot on this screen (or else wholly inside it).
  waitSpot() {
    const v = this.view, F = v.freeRect(), g = this.house.win(0), k = this.kit;
    const box = { l: SILL.x - 40, r: g.x + g.w / 2 + 8, t: g.top - 12, b: LEDGE + 16 }, c = this.shotFor(box, { pad: 26, max: 1.8, min: 0.7 }), sc = v.fit * c.zoom;
    const L = c.x + (F.l - v.ox) / sc, R = c.x + (F.r - v.ox) / sc, T = c.y + (F.t - v.oy) / sc, D = c.y + (F.b - v.oy) / sc;
    const at = (dx) => ({ dx, dy: Math.max(1, (72 - Math.sqrt(Math.max(0, 72 * 72 - dx * dx))) * 0.85) });
    const rect = (w) => { const p = this.restAt(w); return [p.x - 34, p.x + 34, p.y - 62 * k.size - 4, p.y + 2]; };
    let inside = null;
    for (const dx of [-14, -24, -34, -44, -4, 6]) {
      const w = at(dx), r = rect(w), M = 8;
      if (r[1] < L - M || r[0] > R + M || r[3] < T - M || r[2] > D + M) return w;          // clearly out
      if (!inside && r[0] >= L && r[1] <= R && r[2] >= T && r[3] <= D) inside = w;            // wholly in
    }
    return inside || KIT_WAIT;
  }
  // where a cat must stand (facing `dir`) for its mouth to be over the saucer
  drinkX(cat, s, dir) { return s.x - dir * (cat.kind === 'kitten' ? 22 : 40); }

  // ── the little jobs ──
  lap(cat, s, drink, shine) {
    this.audio.sfx.lap();
    this.spawn(async () => { await this.tween(cat, { tongue: 1 }, 0.1); await this.tween(cat, { tongue: 0 }, 0.14); await this.tween(cat, { tongue: 1 }, 0.1); await this.tween(cat, { tongue: 0 }, 0.14); });
    s.goal = Math.max(0, (s.goal === undefined ? s.fill : s.goal) - drink);
    cat.shine = Math.min(1, (cat.shine || 0) + shine);
    this.fx.burst('drop', s.x, s.y - 8, 4, { speed: 60, a0: -2.4, a1: -0.7, life: 0.5, size: 2.6, color: '#f7f9c0', grav: 300 });
    this.sparkle(cat.x + 10 * cat.size, cat.y - 30 * cat.size, 4);
    cat.sq.v += 2;
  }

  tick(dt) {
    const v = this.view, t = this.t, b = this.beam;
    if (this.grab) { const g = this.grab; g.ox = approach(g.ox, 0, 14, dt); g.oy = approach(g.oy, 0, 14, dt); g.s.x = g.px + g.ox; g.s.y = g.py - LIFT + g.oy; }
    this.moon.r = MOON.r; this.moon.at = MOON;
    for (const r of this.rest) if (!r.cat.jump) { r.cat.x = r.tree.topX + r.dx; r.cat.y = r.tree.perchY + r.dy; }
    // the swing sways a little, and whatever stands on it sways along
    const sw = this.swing; sw.a = this.reduced ? 0 : Math.sin(t * 1.1) * 0.05;
    sw.x = -105 + Math.sin(sw.a) * 112; sw.y = -168 + Math.cos(sw.a) * 112;
    this.spots[1].x = sw.x; this.spots[1].y = sw.y - 3;
    for (const s of this.saucers) {
      if (s.state === 'spot' && !s.held) { s.x = s.spot.x; s.y = s.spot.y; }
      if (s.pulse > 0) s.pulse = Math.max(0, s.pulse - dt * 1.1);
      if (s.state === 'sill' && s.goal !== undefined) s.fill = approach(s.fill, s.goal, 6, dt);
    }
    for (const c of [this.papa, this.kit]) {
      if (c.shine) c.glowing = approach(c.glowing, c.shine, 4, dt);
      if (c.glowing > 0.2 && Math.random() < dt * 5 * c.glowing) this.fx.add({ kind: 'spark', x: c.x + (Math.random() - 0.5) * 60 * c.size, y: c.y - Math.random() * 56 * c.size, vy: -14, life: 1.1, size: 3.4, color: '#fbfdd0', alpha: 0.9 });
    }
    // moonbeam
    b.a = approach(b.a, b.on ? 1 : 0, b.on ? 14 : 7, dt);
    b.hit = null;
    if (this.phase === 'pour' && b.on) {
      this.idle = 0;                                     // the finger is busy pouring: no paw must come and point elsewhere
      for (const s of this.saucers) {
        if (s.state !== 'spot' || s.fill >= 1 || dist(b.x, b.y, s.x, s.y - 5) > 44) continue;
        b.hit = s;
        s.fill = Math.min(1, s.fill + dt / POUR);
        const n = Math.floor(s.fill * 6);
        if (n !== s.note) { s.note = n; this.audio.scaleNote(n + s.i * 2, { inst: 'glass', vel: 0.55, dur: 0.5 }); }
        if (Math.random() < dt * 22) this.fx.add({ kind: 'drop', x: s.x + (Math.random() - 0.5) * 18, y: s.y - 34 - Math.random() * 20, vy: 90, life: 0.35, size: 2.6, color: '#f7f9c0', alpha: 0.9 });
        if (s.fill >= 1) { s.pulse = 1; this.audio.sfx.bell(); this.sparkle(s.x, s.y - 8, 14); }
        break;
      }
    }
    if (this.pourLoop) this.pourLoop.set(b.on ? (b.hit ? 1 : 0.3) : 0, b.hit ? b.hit.fill : 0.1);
    if (this.moonPulse > 0) this.moonPulse = Math.max(0, this.moonPulse - dt * 0.7);
    // small friends
    const m = this.mouse; spring(m.hop, 0, dt, 260, 12); m.lk = approach(m.lk || 0, m.look, 5, dt);
    this.tg.mouse.x = m.x; this.tg.mouse.y = m.y - 10;
    this.tg.bird.x = this.bird.x; this.tg.bird.y = this.bird.y - 10;
    if (this.kit.mode === 'curl' && this.kit.eyes !== 'open' && Math.random() < dt * 0.7) this.zzz(this.kit.x + 14, this.kit.y - 26);
    if (this.papa.mode === 'curl' && Math.random() < dt * 0.5) this.zzz(this.papa.x + 22, this.papa.y - 34);
  }

  // ── painting ──
  drawBack(ctx, view, t, sky) {
    const p = this.sun.peek;
    drawFarTown(ctx, view, this.farSeed, sky.mid, 0.45, 0.3);
    if (p <= -0.35) return;
    const y = 44 - 70 * p + (this.reduced ? 0 : Math.sin(t * 1.4) * 2);
    glow(ctx, SUNX, y, 210, '#ffd27a', 0.5);
    wobble(ctx, circlePts(SUNX, y, 34, 14), 7 + Math.floor(t * 5), 0.7);
    ctx.fillStyle = '#ffd95a'; ctx.fill(); ink(ctx, 3);
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round';      // a sleepy face: it is not time yet
    ctx.beginPath(); ctx.arc(SUNX - 11, y - 8, 4.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
    ctx.beginPath(); ctx.arc(SUNX + 11, y - 8, 4.5, Math.PI * 0.1, Math.PI * 0.9); ctx.stroke();
  }

  drawMid(ctx, view, t, sky) {
    const night = sky.star;
    drawBush(ctx, -340, 0, 34, 431, '#f2c23a'); drawBush(ctx, 300, 0, 38, 432, '#e8505a');
    // the coloured panes beside the window, as in the picture
    const g = this.house.win(0), cols = ['#d9483b', '#3f9a45', '#e06a8a', '#3f6fd0'];
    cols.forEach((c, i) => {
      wobblyPoly(ctx, [[g.x + 33, g.top + 2 + i * 13.5], [g.x + 47, g.top + 2 + i * 13.5], [g.x + 47, g.top + 14 + i * 13.5], [g.x + 33, g.top + 14 + i * 13.5]], 440 + i, 0.5, 30);
      ctx.fillStyle = c; ctx.fill(); ink(ctx, 2);
    });
    this.drawDoor(ctx, t);
    // pools of moonlight where a saucer can stand
    for (const sp of this.spots) glow(ctx, sp.x, sp.y, 62, PAL.moon, (sp.taken ? 0.16 : 0.3 + 0.08 * Math.sin(t * 2 + sp.x)) * night);
    // stump
    wobblyPoly(ctx, [[-254, 3], [-250, -25], [-214, -25], [-210, 3]], 451, 1.2, 40); ctx.fillStyle = PAL.trunk; ctx.fill(); ink(ctx, 3);
    wobble(ctx, circlePts(-232, -25, 19, 10, 6), 452, 0.5); ctx.fillStyle = '#e3bd84'; ctx.fill(); ink(ctx, 2.4);
    ctx.strokeStyle = 'rgba(122,74,38,0.6)'; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.ellipse(-232, -25, 10, 3, 0, 0, TAU); ctx.stroke();
    // garden table
    tube(ctx, [[-36, -36], [-46, 1]], 4, '#8a5a2b', INK, 3); tube(ctx, [[-20, -36], [-10, 1]], 4, '#8a5a2b', INK, 3);
    wobble(ctx, circlePts(-28, -38, 33, 12, 7), 453, 0.5); ctx.fillStyle = '#c98f55'; ctx.fill(); ink(ctx, 2.8);
    // swing (its ropes vanish into the crown, which is painted afterwards)
    const sw = this.swing;
    ctx.save();
    ctx.translate(-105, -168); ctx.rotate(-sw.a);
    tube(ctx, [[-13, 0], [-14, 110]], 2.2, '#d9c07a', INK, 2); tube(ctx, [[13, 0], [14, 110]], 2.2, '#d9c07a', INK, 2);
    wobblyPoly(ctx, [[-19, 109], [19, 109], [19, 116], [-19, 116]], 454, 0.5, 40); ctx.fillStyle = '#e8d24a'; ctx.fill(); ink(ctx, 2.4);
    ctx.restore();    // the saucer on the sill stands behind the cats: a drinking face shows above its rim
    for (const q of this.saucers) if (q.state === 'sill') drawSaucer(ctx, q.x, q.y, q.fill, t, q.size);
  }

  drawDoor(ctx, t) {
    const o = this.door, x0 = DOOR.x - 22, x1 = DOOR.x + 22, top = -DOOR.h;
    const path = () => { ctx.beginPath(); ctx.moveTo(x0, 3); ctx.lineTo(x0, top + 22); ctx.bezierCurveTo(x0, top - 8, x1, top - 8, x1, top + 22); ctx.lineTo(x1, 3); ctx.closePath(); };
    path(); ctx.fillStyle = '#150f22'; ctx.fill();
    ctx.save(); path(); ctx.clip();
    // the dark room: shelves, and whatever is kept on them
    ctx.strokeStyle = 'rgba(160,140,190,0.35)'; ctx.lineWidth = 2;
    for (const y of [-9, -28, -47]) { ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    for (const s of this.saucers) if (s.state === 'stored') drawSaucer(ctx, s.x, s.y, s.fill, t, s.size);
    // the door itself slides away towards its hinges
    const lx = lerp(x0, x1 - 7, o);
    ctx.fillStyle = '#7a4a2a'; ctx.fillRect(lx, top - 10, x1 - lx + 2, DOOR.h + 16);
    ctx.strokeStyle = 'rgba(29,21,48,0.45)'; ctx.lineWidth = 1.5;
    for (let x = lx + 9; x < x1; x += 11) { ctx.beginPath(); ctx.moveTo(x, top - 8); ctx.lineTo(x, 4); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(lx, top - 10); ctx.lineTo(lx, 4); ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.stroke();
    if (o < 0.6) { ctx.fillStyle = PAL.gold; ctx.beginPath(); ctx.arc(lx + 8, -30, 2.6, 0, TAU); ctx.fill(); }
    ctx.restore();
    path(); ink(ctx, 3.2);
    // doorstep
    wobblyPoly(ctx, [[x0 - 16, 5], [x0 - 11, -3], [x1 + 11, -3], [x1 + 16, 5]], 461, 0.8, 60); ctx.fillStyle = '#b9b3c6'; ctx.fill(); ink(ctx, 2.6);
    // moonlight kept in the dark leaks out under the door
    const kept = this.saucers.filter((s) => s.state === 'stored').length;
    if (kept) { glow(ctx, DOOR.x, -3, 34, PAL.moon, 0.2 * kept * (1 - o * 0.6)); if (o < 0.5) glow(ctx, x0 + 9, -30, 9, PAL.moon, 0.5); }
  }

  drawMouse(ctx, t) {
    const m = this.mouse;
    if (!m.vis) return;
    const bob = m.run ? Math.abs(Math.sin(t * 20)) * 2.2 : Math.sin(t * 3) * 0.5, b = m.seed + Math.floor(t * 6) * 5;
    ctx.save();
    ctx.translate(m.x, m.y + Math.min(0, m.hop.x)); ctx.scale(m.dir, 1);
    if (m.lk > 0.01) ctx.rotate(-0.24 * m.lk);             // sitting up, nose to the cats
    tube(ctx, [[-11, -5], [-21, -3], [-27, -10 - bob], [-34, -8]], 2.2, '#e8a9b6', INK, 2.2);
    wobble(ctx, circlePts(0, -9 - bob, 13.5, 10, 9), b, 0.4); ctx.fillStyle = '#b9b3c6'; ctx.fill(); ink(ctx, 2.3);
    for (const [ex, ey] of [[6.5, -20], [13, -21]]) {
      ctx.beginPath(); ctx.arc(ex, ey - bob, 5.4, 0, TAU); ctx.fillStyle = '#b9b3c6'; ctx.fill(); ink(ctx, 2);
      ctx.beginPath(); ctx.arc(ex, ey - bob, 2.8, 0, TAU); ctx.fillStyle = '#f3b9c6'; ctx.fill();
    }
    wobble(ctx, [[5, -15 - bob], [13, -17 - bob], [22, -10 - bob], [14, -5 - bob], [6, -6 - bob]], b + 1, 0.3); ctx.fillStyle = '#c9c4d6'; ctx.fill(); ink(ctx, 2.2);
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(14.5, -12.5 - bob, 1.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e8788d'; ctx.beginPath(); ctx.arc(21.5, -10 - bob, 1.8, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(29,21,48,0.5)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(19, -8 - bob); ctx.lineTo(27, -6 - bob); ctx.moveTo(19, -9 - bob); ctx.lineTo(27, -11 - bob); ctx.stroke();
    if (m.run) { ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineCap = 'round'; const k = Math.sin(t * 20) * 4; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(-5 + k, 1); ctx.moveTo(6, -2); ctx.lineTo(6 - k, 1); ctx.stroke(); }
    ctx.restore();
  }

  drawBeam(ctx, t) {
    const b = this.beam;
    if (b.a <= 0.01) return;
    const dx = b.x - MOON.x, dy = b.y - MOON.y, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const cone = (w0, w1, a) => {
      ctx.fillStyle = 'rgba(240,244,190,' + (a * b.a).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(MOON.x + nx * w0, MOON.y + ny * w0); ctx.lineTo(b.x + nx * w1, b.y + ny * w1); ctx.lineTo(b.x - nx * w1, b.y - ny * w1); ctx.lineTo(MOON.x - nx * w0, MOON.y - ny * w0); ctx.closePath(); ctx.fill();
    };
    cone(20, 40, 0.2); cone(10, 24, 0.24); cone(4, 11, 0.3);
    ctx.restore();
    // motes of light running down the beam
    for (let i = 0; i < 9; i++) {
      const u = (t * 0.9 + i / 9) % 1, wob = Math.sin(i * 2.3 + t * 3) * 9 * u;
      glow(ctx, MOON.x + dx * u + nx * wob, MOON.y + dy * u + ny * wob, 9 + 5 * u, '#fbfdd0', 0.75 * b.a);
    }
    glow(ctx, b.x, b.y, b.hit ? 58 : 40, PAL.moon, (b.hit ? 0.75 : 0.5) * b.a);
  }

  drawFront(ctx, view, t, sky) {
    if (this.moonPulse > 0) { glow(ctx, MOON.x, MOON.y, MOON.r * (3 + 2 * (1 - this.moonPulse)), PAL.moon, 0.5 * this.moonPulse); crayonRings(ctx, MOON.x, MOON.y, MOON.r * (1.3 + 1.2 * (1 - this.moonPulse)), t, { alpha: 0.6 * this.moonPulse, rings: 4, seed: 9 }); }
    this.drawBeam(ctx, t);
    this.drawMouse(ctx, t);
    for (const s of this.saucers) {
      if (s.state === 'hidden' || s.state === 'stored' || s.state === 'sill' || s.size <= 0.02) continue;
      if (s.pulse > 0) crayonRings(ctx, s.x, s.y - 5, 22 + 30 * (1 - s.pulse), t, { alpha: 0.8 * s.pulse, rings: 4, seed: 3 + s.i });
      drawSaucer(ctx, s.x, s.y - (s.held ? 3 : 0), s.fill, t, s.size);
    }
  }
}
