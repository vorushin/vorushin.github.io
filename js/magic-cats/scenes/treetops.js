// Scene 2 — The treetop road. Leap from crown to crown through the night into morning,
// then grow three trees so the chain reaches a brand-new house ("nobody wants to live in a
// house without fairy tales").
import { Street, Perch } from '../street.js';
import { Leap } from '../leap.js';
import { Cat, Kid, Bird } from '../actors.js';
import { drawBush, drawBench } from '../props.js';
import { lerp, ease, clamp01 } from '../util.js';
import { ZOOM_MAX } from '../view.js';

const T = {
  leap: { en: 'Touch the next treetop', de: 'Tippe auf den nächsten Wipfel', ru: 'Нажми на соседнюю верхушку' },
  grow: { en: 'Hold a sprout to grow a tree', de: 'Halte einen Spross gedrückt, dann wächst ein Baum', ru: 'Подержи росток — и вырастет дерево' },
  deliver: { en: 'Carry the tale to the window', de: 'Bring das Märchen zum Fenster', ru: 'Отнеси сказку к окну' }
};

export default class Treetops extends Street {
  constructor(game, index) {
    super(game, index);
    this.bounds = { l: 60, r: 1610 };
    // houses behind the road
    const kid = (kind, mood) => new Kid({ kind, mood: mood || 'wait' });
    this.addHouse({ x: 96, w: 150, h: 304, style: 'pink', seed: 21, windows: [{ dx: -34, dy: -236 }, { dx: 36, dy: -236, lit: 1, kid: kid('bob') }, { dx: -34, dy: -150, lit: 1 }, { dx: 36, dy: -150 }, { dx: -34, dy: -66 }, { dx: 36, dy: -66 }] });
    this.blueHouse = this.addHouse({ x: 470, w: 196, h: 226, style: 'blue', seed: 22, windows: [{ dx: -46, dy: -152, lit: 1, kid: kid('pigtails') }, { dx: 46, dy: -152 }, { dx: -46, dy: -62 }, { dx: 46, dy: -62, lit: 1 }] });
    this.addHouse({ x: 856, w: 172, h: 176, style: 'brick', seed: 23, windows: [{ dx: -40, dy: -96, lit: 1, kid: kid('curly') }, { dx: 40, dy: -96 }] });
    this.newHouse = this.addHouse({ x: 1716, w: 166, h: 236, style: 'lilac', seed: 27, built: 0, door: false, smoke: false, chimney: true, windows: [{ dx: -18, dy: -150, w: 46, h: 56, lit: 0, ledge: 64, kidDx: 5, kid: kid('spiky', 'wave') }, { dx: 46, dy: -150, lit: 0 }, { dx: -34, dy: -62, lit: 0 }, { dx: 40, dy: -62, lit: 0 }] });
    // the chain of trees
    const spec = [[0, 190, 66, 'big', true], [186, 168, 58, 'round'], [372, 204, 62, 'apple'], [566, 176, 60, 'round'], [762, 196, 66, 'round'], [948, 166, 58, 'apple']];
    this.chain = spec.map((s, i) => this.addTree({ x: s[0], h: s[1], r: s[2], kind: s[3], hollow: !!s[4], seed: 31 + i }));
    this.sprouts = [1142, 1330, 1516].map((x, i) => this.addTree({ x, h: 172 + i * 12, r: 60, kind: i === 1 ? 'apple' : 'round', seed: 41 + i, grow: 0.03 }));
    this.roof = Perch.point(470, -282, { kind: 'roof', hw: 50 });
    this.sill = Perch.sill(this.newHouse, 0, { only: [this.sprouts[2].perch], enabled: false, range: 40 });
    this.cat = this.addCat(new Cat({ kind: 'papa' })); this.cat.carry = 1;
    const perches = this.chain.map((t) => t.perch).concat(this.sprouts.map((t) => t.perch), [this.roof, this.sill]);
    this.leap = new Leap(this, {
      cat: this.cat, perches, start: this.chain[0].perch,
      flies: [{ x: 93, y: -338 }, { x: 280, y: -352 }, { x: 470, y: -338 }, { x: 664, y: -338 }, { x: 762, y: -330, orbit: 44, speed: 1.5 }, { x: 855, y: -326 }, { x: 1236, y: -330 }, { x: 1424, y: -340 }],
      onLand: (q) => this.landed(q), onLeap: (q) => { this._dest = q; }
    });
    this.cam.x = 60;
    this.grown = 0;
    this.expectText = T.leap;
    this.goalFn = null;
    this.expect = () => { if (!this.leap.enabled) return null; if (this.goalFn) this.leap.goal = this.goalFn(); return this.leap.expect(this.expectText); };
    this.audio.play('treetops', { intensity: 0.7 }); this.audio.ambience('night');
    this.skyFixed = true;                                // the moon and the clouds stay put when the camera comes closer
    this.camPhase = 'leap'; this._next = null;
    // acting: what the cat is about ('road' | 'house' | 'sill'), what it keeps an eye on, how long it has stood still
    this.beat = 'road'; this.watch = null; this._lk = { x: 0, y: 0 };
    this._idleT = 2.8;                                   // (it starts the night sitting on the old tree, looking about)
    this.homeWin = this.newHouse.windows[0];
    this.leap.sit = false;                               // (the scene sits the cat down itself, see tick)
    this.kidWins = [];
    for (const h of this.houses) for (const w of h.windows) if (w.kid) this.kidWins.push({ w, h });
  }

  // the next treetop on the way to wherever the player is being led (asked again only when that changes)
  nextPerch() {
    const L = this.leap;
    if (this._npAt !== L.at || this._npGoal !== L.goal) { this._npAt = L.at; this._npGoal = L.goal; this._np = L.enabled ? L.stepToward(L.goal) : null; }
    return this._np;
  }
  // keep an eye on something for a while (or until let go: dur = 0); at(o) writes the point into o
  eye(at, dur) { this.watch = { at, t: dur || 0 }; }

  // The cat's small acting, every frame after the engine: it sits while the player thinks and gets up to
  // aim; it looks at the next treetop, glances at it again now and then; it watches whatever `watch` says
  // (a sprout growing, a bird coming in, a house going up). Its pupils narrow as the morning comes.
  tick(dt) {
    const c = this.cat, L = this.leap;
    c.light = clamp01(1.2 - this.sky.star * 1.35);
    for (const k of this.kidWins) {                      // the children wave while the cat is close, then only watch it go
      if (k.w !== this.homeWin && k.w.kid.mood === 'wave' && Math.abs(k.h.x - c.x) > 300) k.w.kid.mood = 'wait';
    }
    if (this.beat === 'sill') { c.fidget = false; return; }   // (the hand-over directs itself)
    c.fidget = !this.watch;                              // (no glancing about of its own while it watches something)
    if (L.state !== 'idle' || c.jump) { this._idleT = 0; if (c.mode === 'sit') c.mode = 'stand'; return; }
    this._idleT += dt;
    const w = this.watch;
    let at = null;
    if (w) { at = this._lk; w.at(at); if (w.t > 0 && (w.t -= dt) <= 0) this.watch = null; }
    else if (L.enabled && this._idleT > 0.5) {
      const n = this.nextPerch(), u = this._idleT;
      if (n && (u < 3.4 || u % 7.5 < 1.7)) { at = this._lk; at.x = n.x; at.y = n.y - 22; }   // a good look first, then a glance now and then
      else if (!n && this.camPhase === 'grow') {        // nowhere to go: the sprout to be grown, down below
        const s = this.sprouts.find((q) => q.grow < 1);
        if (s && Math.abs(s.x - c.x) < 320) { at = this._lk; at.x = s.x; at.y = -30; }
      }
    }
    c.look = at;
    // sit down while the player thinks it over (and while the house goes up); up again to aim
    c.mode = this.beat === 'house' || (L.enabled && this._idleT > 2.6) ? 'sit' : 'stand';
  }

  // What the camera keeps in the picture (see Scene.track): the cat, where it stands and where it is to
  // go next; while trees are grown, the next sprout from the ground up; then the house going up; then the
  // window the tale is carried to. Whatever the player is asked to touch is always in.
  frame() {
    // (while the cat is in the air the picture already moves on to where it lands and the step after
    // that — the cat flies into it — so the frame keeps its width and nothing breathes)
    const c = this.cat, L = this.leap, air = L.state === 'air' && this._dest;
    const b = air ? { l: 1e9, r: -1e9, t: 1e9, b: -1e9 } : { l: c.x - 60, r: c.x + 60, t: c.y - 82, b: c.y + 14 };
    const add = (l, r, t, bb) => { b.l = Math.min(b.l, l); b.r = Math.max(b.r, r); b.t = Math.min(b.t, t); b.b = Math.max(b.b, bb); };
    const perch = (q) => { if (q) add(q.x - 62, q.x + 62, q.y - 80, q.y + (q.kind === 'tree' ? 64 : 40)); };
    // the next step of the route — also while a caption is up and no goal is set yet (the frame must not
    // close in on the cat alone and pull out again when the hint comes back)
    const step = (q) => (L.enabled && L.goal && L.goal !== q ? L.stepToward(L.goal) : null) || this.ahead(q);
    const after = (q) => { const at = L.at; L.at = q; const n = step(q); L.at = at; return n; };
    if (air) { if (this._destFor !== this._dest) { this._destFor = this._dest; this._next = after(this._dest); } perch(this._dest); }
    else { if (L.state === 'idle') this._next = step(L.at); perch(L.at); }
    const s = this.camPhase === 'grow' && this.sprouts.find((q) => q.grow < 1);
    if (s && Math.abs(s.x - c.x) < 300) add(s.x - 74, s.x + 74, -(s.h + s.r * 1.3) - 10, 4);   // the sprout to grow, from the ground up…
    else if (this.camPhase === 'leap' || s) perch(this._next);   // …or, while it is still far off, the next treetop on the way
    if (this.camPhase === 'house') {
      const h = this.newHouse;
      add(h.x - h.w / 2 - 20, h.x + h.w / 2 + 20, -(h.h + h.w * 0.42) - 26, 4);
    } else if (this.camPhase === 'deliver') {
      const g = this.newHouse.win(this.newHouse.windows[0]);
      add(g.x - g.w / 2 - 60, g.x + g.w / 2 + 30, g.top - 40, g.sillY + 34);
    }
    // on a short landscape screen (where shots come closer) the brick house's waving child would sit under the
    // bottom caption once the cat is on the last tree of the chain: from there on the picture reaches down to
    // that window (one deliberate step back, which leads into the growing). The road before keeps its close frame.
    const on = air ? this._dest : L.at;
    if (this.view.closeK > 1 && (this.camPhase === 'leap' || this.camPhase === 'grow') && on === this.chain[5].perch) b.b = Math.max(b.b, -76);
    const e = this.currentExpect();
    if (e && e.x !== undefined && e.kind !== 'continue') add(e.x - 46, e.x + 46, e.y - 46, e.y + 46);
    return b;
  }
  // the nearest treetop further along the road that can be reached from q (none: null)
  ahead(q) {
    const L = this.leap;
    if (!q || !L.enabled) return null;
    let best = null;
    for (const p of L.perches) if (p.kind === 'tree' && p.x > q.x + 10 && L.reachable(q, p) && (!best || p.x < best.x)) best = p;
    return best;
  }
  // the director's camera: open on the whole street, then come closer to the cat
  async direct() {
    await this.wait(this.reduced ? 1.2 : 2.6);
    this.track(() => this.frame(), { ground: true, max: 1.6, pad: 26, clampX: [-120, 1800], rate: 1.8, zoomIn: 0.75, dead: 0.2 });   // (dead: closes in only when it could come a fifth closer)
  }

  landed(q) {
    for (const k of this.kidWins) {
      const kid = k.w.kid;
      if (k.w.lit > 0.5 && Math.abs(k.h.x - this.cat.x) < 190 && kid.mood === 'wait') { kid.mood = 'wave'; this.audio.sfx.giggle(this.leap.pan(k.h.x)); }
    }
  }

  async run() {
    const L = this.leap, c = this.chain;
    this.spawn(() => this.direct());
    await this.wait(0.7);
    this.say(0);                                         // Nobody knows where the cats live.
    const beyond = (n) => ({ past: c.slice(n + 1).map((t) => t.perch) });   // a fast child may be further along already
    await L.reach(c[1].perch, beyond(1));
    await this.say(1);                                   // …they walk along the tops of the trees.
    await L.reach(c[3].perch, beyond(3));
    let morning = false;
    this.spawn(async () => {
      await this.skyTo('dawn', 5); await this.until(() => morning); this.audio.ambience('day');
      // morning: the lamps go out; the children at the windows have been up all night and it shows
      for (const h of this.houses) for (const w of h.windows) if (h !== this.newHouse && w.lit > 0 && !w.kid) this.spawn(() => this.tween(w, { lit: 0 }, 3));
      this.kidWins.filter((k) => k.w !== this.homeWin).forEach((k, i) => this.spawn(async () => {
        const kid = k.w.kid;
        await this.wait(0.6 + i * 0.9);
        await this.until(() => kid.mood === 'wait' && this.view.visible(k.h.x, 0));      // (when it can be seen, and not while waving)
        await this.wait(kid.act('yawn'));
        if (kid.mood === 'wait') kid.act(i % 2 ? 'stretch' : 'rubEyes');
      }));
      await this.skyTo('day', 5);
    });
    await this.say(2);                                   // That is why this town is so full of trees.
    await L.reach(c[5].perch);
    morning = true;
    await this.say(3);                                   // Before anybody builds a house, they first grow trees…
    this.expectText = null;
    // the hint walks the cat forward to the newest tree whenever the next sprout is out of sight
    this.goalFn = () => { let g = c[5].perch; for (const s of this.sprouts) { if (!s.ready) break; g = s.perch; } return g; };
    this.camPhase = 'grow';
    await Promise.all(this.sprouts.map((s, i) => this.growTree(s, i)));
    await this.wait(0.4);
    await this.buildHouse();
    this.sill.enabled = true;
    this.camPhase = 'deliver';
    this.goalFn = null;
    this.expectText = T.deliver;
    await L.reach(this.sill);
    L.enabled = false;
    await this.handOver();
    // closing shot: back off slowly to the new end of the street, the house among its young trees
    // (as many of the young trees as an upright phone has room for at the usual size; the house always whole)
    const said = this.say(4);                            // For nobody wants to live in a house without fairy tales.
    await this.wait(this.reduced ? 0.6 : 1.8);
    this.spawn(() => this.shot(() => {
      const r = this.newHouse.x + this.newHouse.w / 2 + 50, F = this.freeRect(), room = (F.r - F.l) / this.view.fit - 60;
      return { l: Math.max(this.sprouts[0].x - 70, r - room), r, t: -330, b: 0 };
    }, 5, { ground: true, max: 1.25, min: 0.95 }));
    await said;
    await this.next();
  }

  // The chapter's moment: on the sill, close to. The cat and the child see each other, the bundle is
  // handed over (Street.deliver), the child cheers and then opens the tale; the cat sits down, tail
  // wrapped round its paws, and purrs with its eyes half shut.
  async handOver() {
    const c = this.cat, h = this.newHouse, w = this.homeWin, kid = w.kid, R = this.reduced;
    this.beat = 'sill'; c.wake(); c.mode = 'stand';
    this.shot(() => {
      const g = h.win(w);
      return { l: Math.min(c.x - 46, g.x - g.w / 2 - 40), r: g.x + g.w / 2 + 34, t: g.top - 44, b: g.sillY + 22 };
    }, R ? 0.4 : 1.3, { max: ZOOM_MAX, min: 1, pad: 24 });
    c.look = kid.anchor('head');                         // (a live point: it moves with the child)
    await this.wait(R ? 0.3 : 0.7);
    await this.deliver(c, h, 0);
    c.look = kid.anchor('head');
    await this.wait(R ? 0.2 : 0.35);
    c.mode = 'sit';
    this.audio.sfx.purr(3);
    c.eyes = 'happy';
    await this.wait(R ? 0.6 : 1.3);
    kid.act('clap');
    await this.wait(R ? 0.4 : 1);
    if (c.eyes === 'happy') c.eyes = 'open';
    kid.mood = 'read';                                   // the tale is opened at once
    c.act('slowblink');
    this.spawn(async () => {                             // and the cat stays to listen, now and then a slow blink
      for (;;) { await this.wait(3 + Math.random() * 2.5); if (!c.jump) c.act(Math.random() < 0.7 ? 'slowblink' : 'ears'); }
    });
  }

  async growTree(tree, i) {
    let last = -1;
    // offered only once the framing has the sprout in the free part of the screen (not under a caption or the hint line)
    const target = () => {
      const v = this.view, F = this.freeRect(), x = v.sx(tree.x), y = v.sy(-26), m = 20 * v.scale;
      return x > F.l + m && x < F.r - m && y > F.t + m && y < F.b - m ? { x: tree.x, y: -26, r: 62 } : null;
    };
    const crown = (o) => { o.x = tree.topX; o.y = tree.crownY; };
    await this.holdOn(target, 1.7, {
      keep: true, text: T.grow,
      onStart: () => { this.audio.sfx.rustle(); this.eye(crown); this.cat.act('ears'); },     // the cat watches the sprout come up
      onStop: (f) => { if (f < 1) this.eye(crown, 1.2); },
      onProgress: (f) => {
        tree.grow = lerp(0.03, 1, f);
        const n = Math.floor(f * 8);
        if (n !== last && f > 0) { last = n; this.audio.scaleNote(n + i, { inst: 'pluck', vel: 0.55 }); this.fx.burst('spark', tree.topX, tree.crownY, 2, { speed: 60, life: 0.8, size: 4, colors: ['#fff7c0', '#b6e04a'] }); }
      }
    });
    tree.grow = 1; tree.land(1.2);
    this.grown++;
    if (this.grown === this.sprouts.length) this.camPhase = 'house';     // (straight on to the house: no half-second frame of the cat alone)
    this.audio.sfx.rise();
    this.leaves(tree.topX, tree.crownY, 14);
    this.cat.sq.v += 3;
    // a bird comes to live in the new tree (the cat follows it in) and sings there from time to time
    const b = new Bird({ color: ['red', 'blue', 'yellow'][i], x: tree.x + 300, y: -520 });
    this.birds.push(b);
    this.audio.sfx.flutter(this.leap.pan(tree.x));
    this.eye((o) => { o.x = b.x; o.y = b.y - 10; }, 2.6);
    const sing = (n) => { b.chirp(); this.audio.sfx.chirp(this.leap.pan(b.x)); this.notes(b.x + 8 * b.dir, b.y - 32, n); };
    b.flyTo(tree.topX + 50, tree.perchY + 12, () => {      // (on the crown's shoulder, clear of a cat sitting on top with its bundle)
      sing(2);
      this.spawn(async () => {                         // (sparingly: once every 8-14 s, the three birds out of step, never over the hand-over)
        await this.wait(i * 2.7);
        for (;;) {
          await this.wait(8 + Math.random() * 6);
          if (b.state === 'perch' && this.beat !== 'sill' && this.view.visible(b.x, 40)) sing(1);
        }
      });
    });
  }

  async buildHouse() {
    const h = this.newHouse, top = h.h + h.w * 0.42, v = this.view, c = this.cat;
    let up = false;
    // the camera looks over to where the house is going up (keeping the cat in the picture);
    // the cat sits down to watch it, its ears turning to the hammering
    this.camPhase = 'house';
    this.beat = 'house';
    this.eye((o) => { o.x = h.x; o.y = -top * Math.max(0.15, h.built) - 6; });
    if (!this.directing) { this.follow = false; this.spawn(() => this.camTo(Math.min(h.x - v.width * 0.24, c.x + v.width / 2 - 70), null, null, 1)); }
    await this.wait(this.directing ? 0.9 : 0.5);
    this.spawn(async () => { await this.tween(h, { built: 1 }, this.reduced ? 0.8 : 3, ease.inOutSine); up = true; });
    let n = 0;
    while (!up) {                                        // hammering along the top of the rising walls
      const y = -top * h.built, x = h.x + (Math.random() - 0.5) * h.w * 0.9;
      this.audio.sfx.knock(this.leap.pan(h.x));
      this.fx.burst('puff', x, y, 3, { speed: 34, life: 0.6, size: 8, color: 'rgba(255,255,255,0.75)' });
      this.fx.burst('crumb', x, y, 3, { speed: 80, a0: -Math.PI, a1: 0, life: 0.7, size: 3.4, colors: ['#c99a5a', '#f3dc86'], grav: 320 });
      if (n++ % 4 === 1) c.act('ears');
      await this.wait(0.24);
    }
    this.audio.sfx.fanfare();
    h.smoke = true;
    this.sparkle(h.x, -260, 16);
    c.sq.v += 3;
    const g = h.win(this.homeWin);
    this.eye((o) => { o.x = g.x; o.y = g.y; }, 2.2);    // a light in the new window: somebody lives there now
    await this.tween(this.homeWin, { lit: 1 }, 0.5);
    this.audio.sfx.giggle(this.leap.pan(h.x));
    c.act('tilt');
    await this.wait(0.6);
    this.beat = 'road';
    this.follow = true;
  }

  drawMid(ctx) {
    drawBush(ctx, 280, 0, 38, 81, '#e8505a'); drawBench(ctx, 660, 0); drawBush(ctx, 1040, 0, 34, 82, '#f2c23a'); drawBush(ctx, 1612, 0, 30, 83, '#f08ab0');
  }
}
