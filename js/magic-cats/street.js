// Magic cats — Street: the shared base for scenes set in the town (sky by time of day, far
// houses, ground, trees, houses, cats leaping between perches, deliveries through windows).
// Subclasses build the layout in their constructor and tell the story in run().

import { Scene } from './scene.js';
import { clamp, clamp01, lerp, ease, dist, spring, approach } from './util.js';
import { SKIES, mixSky, mixHex, drawSkyAll, Layer, drawStars, makeStars, drawMoon, drawGround, drawGrassFront, drawCloud, chalk, glow, wind } from './paint.js';
import { Tree, House, drawFarTown } from './props.js';
import { drawLooseBundle, drawFirefly, drawButterfly } from './actors.js';
import { Perch } from './leap.js';

// the two rows of far roofs, each kept as a picture that slides with its own parallax
// (they refresh on different frames while the sky is changing colour, so the work is spread out)
const WATCH = 280, GLANCE = 200;        // how far a child at a window follows a cat with the eyes; a reader looks up at a landing this close
const RINGS_REST = 0.55;               // where the rings round a window settle after a delivery has bloomed (as the title's finished windows)
const FAR_A = new Layer({ par: 0.15, margin: 64, every: 4 }), FAR_B = new Layer({ par: 0.3, margin: 64, every: 5 });

export class Street extends Scene {
  constructor(game, index) {
    super(game, index);
    this.skyFrom = SKIES.night; this.skyGoal = SKIES.night; this.skyK = 0; this.skyName = 'night';
    this.stars = makeStars(index * 13 + 5, 170);
    this.moon = { u: 0.16, y: 118, r: 44 };           // u = fraction of the view width, y below the view top
    this.clouds = [{ u: 0.18, y: 150, w: 250, seed: 4 }, { u: 0.62, y: 110, w: 320, seed: 5 }, { u: 0.9, y: 210, w: 220, seed: 6 }];
    this.trees = []; this.houses = []; this.cats = []; this.birds = []; this.loose = [];
    this.leap = null;
    this.bounds = { l: -1e9, r: 1e9 };
    this.camLead = 70; this.camY = 0; this.follow = true; this.camRate = 2.6;
    this.farSeed = index * 3 + 2; this.far = 0.5;
    this.moonB = { x: 0, v: 0 }; this.moonFace = 0;
    this.skyFixed = false;          // true: moon and clouds keep their size and place on the screen when the camera zooms (they are far away)
  }
  get sky() { return mixSky(this.skyFrom, this.skyGoal, this.skyK); }
  // the moon hangs from the top of the free sky (moon.y below it), unless a scene pins it down (moon.at = {x, y})
  moonPos() { const v = this.view, m = this.moon; return m.at || { x: v.left + v.width * m.u, y: v.free + (m.y - 40) * this.farK() }; }
  // how much of a world unit a sky fixture's unit is right now (1, or 1/zoom when skyFixed)
  farK() { return this.skyFixed && !this.moon.at ? 1 / this.cam.zoom : 1; }
  setSky(name) { this.skyFrom = this.skyGoal = SKIES[name]; this.skyK = 0; this.skyName = name; }
  // slow change of the time of day
  async skyTo(name, dur) {
    this.skyFrom = this.sky; this.skyGoal = SKIES[name]; this.skyK = 0; this.skyName = name;
    await this.tween(this, { skyK: 1 }, dur || 3, ease.inOutSine);
  }
  addTree(o) { const t = new Tree(o); this.trees.push(t); t.perch = Perch.tree(t, { enabled: t.ready }); return t; }
  addHouse(o) { const h = new House(o); this.houses.push(h); return h; }
  addCat(c) { this.cats.push(c); return c; }

  onDown(p) { if (this.onToy(p)) return; if (this.leap) this.leap.down(p); }
  onToy(p) { return !!(this.skyToy(p) || this.worldToy(p)); }   // (also answers while the story waits for "tap to go on")
  // Small answers from the town: a child in a window waves back, a bird chirps, whoever lives in
  // the hollow hoots. (Never where the cat could be sent: a touch near a perch within reach is a leap.)
  worldToy(p) {
    const L = this.leap, v = this.view, pan = (x) => clamp(((x - v.cam.x) / Math.max(1, v.width)) * 1.6, -0.8, 0.8);
    const R = (w, px) => Math.max(w, px / Math.max(0.2, v.scale || 1));     // a toy answers a finger: never under ~22 px on the screen
    if (L && L.enabled && L.state === 'idle') for (const q of L.perches) if (L.reachable(L.at, q) && dist(p.x, p.y, q.x, q.y - 18) < 66) return false;
    for (const b of this.birds) {
      if (b.hidden || b.state !== 'perch' || dist(p.x, p.y, b.x, b.y - 10) > R(26, 22)) continue;
      b.chirp(); this.audio.sfx.chirp(pan(b.x)); this.notes(b.x + 8 * b.dir, b.y - 24, 1);
      return true;
    }
    for (const h of this.houses) {
      if (h.built < 1) continue;
      for (const w of h.windows) {
        if (!w.kid || w.lit < 0.5 || w.kid.mood === 'sleep') continue;
        const g = h.win(w);
        if (Math.abs(p.x - g.x) > g.w / 2 + 6 || Math.abs(p.y - g.y) > g.h / 2 + 6) continue;
        w.kid.joy.v += 9; if (w.kid.mood === 'wait') w.kid.mood = 'wave';
        this.audio.sfx.giggle(pan(g.x)); this.hearts(g.x, g.top - 2, 2);
        return true;
      }
    }
    for (const t of this.trees) {
      if (!t.hollow || !t.ready || t.hollowEmpty) continue;
      if (dist(p.x, p.y, lerp(t.x, t.topX, 0.42), t.groundY - t.h * 0.42) > R(22, 20)) continue;
      t._blink = -0.001; t.land(0.3); this.audio.sfx.owl(pan(t.x));
      return true;
    }
    return false;
  }
  // the moon is ticklish
  skyToy(p) {
    if (this.sky.star < 0.5) return false;
    const m = this.moonPos();
    if (dist(p.x, p.y, m.x, m.y) > this.moon.r * this.farK() * 1.45) return false;
    this.moonB.v += 5; this.moonFace = 2.6;
    this.audio.sfx.twinkle(); this.audio.chordNote(2, { inst: 'glass', vel: 0.45, dur: 0.6 });
    this.fx.burst('spark', m.x, m.y + this.moon.r * 0.5, 9, { speed: 70, a0: 0.2, a1: Math.PI - 0.2, life: 1.3, size: 4.5, colors: ['#fbfdd0', '#ffffff', '#ffe9a8'], grav: 40, drag: 1 });
    return true;
  }
  onMove(p) { if (this.leap) this.leap.move(p); }
  onUp(p) { if (this.leap) this.leap.up(p); }
  onKey(k) { if (this.leap) this.leap.key(k); }

  update(dt) {
    for (const t of this.trees) { t.update(dt); if (t.perch && !t.perch.locked) t.perch.enabled = t.ready; }
    for (const h of this.houses) h.update(dt);
    if (this.leap) { this.leap.day = this.sky.star < 0.3; this.leap.update(dt); }
    for (const c of this.cats) { if (c.walking > 0.01) c.walk += dt * 10; c.update(dt, this.t); }
    for (const b of this.birds) b.update(dt);
    this.watchCats(dt);
    spring(this.moonB, 0, dt, 120, 8);
    if (this.moonFace > 0) this.moonFace -= dt;
    if (this.follow && this.leap && !this.directing) {
      const c = this.leap.cat;
      this.camFollow(clamp(c.x + this.camLead * c.dir, this.bounds.l, this.bounds.r), this.camY, dt, this.camRate);
    }
    if (this.tick) this.tick(dt);
    this.ambient(dt);
  }
  // Children in lit windows watch the cats go by: an awake child whose `look` no scene has set looks
  // at the nearest cat on the screen within WATCH units (and lets go when the cats are gone); a child
  // who is reading only glances up when a cat lands close by, then goes back to the book. The engine
  // only ever takes back the look object it gave (w._eye), so a look set by a scene is never touched.
  watchCats(dt) {
    const v = this.view, L = this.leap, lc = L && this.cats.indexOf(L.cat) < 0 ? L.cat : null;
    for (const h of this.houses) {
      const on = h.built >= 1 && v.visible(h.x, h.w + 300);
      for (const w of h.windows) {
        const k = w.kid;
        if (!k) continue;
        const mine = !!w._eye && k.look === w._eye;
        if (k.look && !mine) { w._glT = 0; continue; }                       // the scene's look
        let best = null;
        if (on && w.lit > 0.5 && !k.hidden && k.mood !== 'sleep') {
          const gx = h.x + w.dx, gy = h.groundY + w.dy;
          let bd = WATCH * WATCH;
          for (let i = -1; i < this.cats.length; i++) {
            const c = i < 0 ? lc : this.cats[i];
            if (!c || c.hidden || !v.visible(c.x, 30)) continue;
            const dx = c.x - gx, dy = c.y - 20 * c.size - gy, d2 = dx * dx + dy * dy;
            if (d2 < bd) { bd = d2; best = c; }
          }
          if (k.mood === 'read') {                                             // a glance up at a landing close by, then the book again
            if (best && best.jump) w._air = best;
            else if (w._air && !w._air.jump) { if (best === w._air && bd < GLANCE * GLANCE) w._glT = 1.3 + Math.random() * 0.5; w._air = null; }
            if (w._glT > 0) w._glT -= dt;
            if (!(w._glT > 0)) best = null;
          } else { w._air = null; w._glT = 0; }
        }
        if (best) {
          const e = w._eye || (w._eye = { x: 0, y: 0 });
          e.x = best.x; e.y = best.y - 24 * best.size;
          k.look = e;
        } else if (mine) k.look = null;
      }
    }
  }
  // little signs of life in the air: drifting sparkles by day, a rare shooting star at night,
  // small creatures going about their business, a leaf or two when a gust comes through
  ambient(dt) {
    if (this.reduced || this.quiet) return;
    const v = this.view, star = this.sky.star, t = this.t;
    if (!this.life) {
      this.life = [];
      for (let i = 0; i < 6; i++) this.life.push({ kind: 'glow', u: (i + Math.random()) / 6, y: -10 - Math.random() * 46, ph: Math.random() * 6.28, sp: 4 + Math.random() * 6, a: 0 });
      for (let i = 0; i < 3; i++) this.life.push({ kind: 'fly', u: (i + Math.random()) / 3, y: -22 - Math.random() * 60, ph: Math.random() * 6.28, sp: 14 + Math.random() * 12, a: 0, seed: 1 + i * 2.3 });
      for (let i = 0; i < 5; i++) this.life.push({ kind: 'seed', u: Math.random(), y: -90 - Math.random() * 330, ph: Math.random() * 6.28, sp: 10 + Math.random() * 10, a: 0 });
    }
    for (const q of this.life) {
      const want = q.kind === 'glow' ? (star > 0.55 ? 1 : 0) : star < 0.3 ? 1 : 0;
      q.a += (want - q.a) * Math.min(1, dt * 1.5);
      if (q.a < 0.01) continue;
      const span = v.width + 160;
      q.u += ((q.kind === 'seed' ? q.sp * (0.5 + wind(v.cam.x, t)) : Math.sin(t * 0.21 + q.ph) * q.sp) * dt) / span;
      q.u -= Math.floor(q.u);
      q.x = v.left - 80 + ((((q.u * span - v.left) % span) + span) % span);       // (a place in the world; it comes round again at the other edge)
    }
    // moths keep to the lit windows
    this.moths = this.moths || [];
    if (star > 0.55) {
      let n = 0;
      for (const h of this.houses) {
        if (h.built < 1 || !v.visible(h.x, h.w)) continue;
        for (const w of h.windows) if (w.lit > 0.8 && !w.kid && n < 3) { const g = h.win(w); if (!this.moths[n]) this.moths[n] = { ph: n * 2.1 }; this.moths[n].x = g.x; this.moths[n].y = g.y; n++; }
      }
      this.moths.length = n;
    } else this.moths.length = 0;
    // a gust takes a few leaves with it
    for (const tr of this.trees) {
      if (!tr.ready || !v.visible(tr.x, tr.r) || Math.random() > dt * 1.6 || wind(tr.x, t) < 1.05) continue;
      this.fx.add({ kind: 'leaf', layer: -1, x: tr.topX + (Math.random() - 0.3) * tr.r, y: tr.crownY + (Math.random() - 0.5) * tr.r, vx: 50 + Math.random() * 60, vy: 14 + Math.random() * 26, life: 2.4 + Math.random(), size: 4 + Math.random() * 2.5, color: ['#5ab04a', '#8fd05a', '#2f8a3f'][Math.floor(Math.random() * 3)], vr: 5, rot: Math.random() * 6.28, sway: 22, drag: 0.2, grav: 22 });
    }
    if (star < 0.4 && Math.random() < dt * 2.2) {
      this.fx.add({ kind: 'spark', layer: -1, x: v.left + Math.random() * v.width, y: v.top + Math.random() * (v.height * 0.62), vx: 6 + Math.random() * 10, vy: 4 + Math.random() * 8, life: 3.5 + Math.random() * 2, size: 2.2 + Math.random() * 2.6, color: '#ffffff', alpha: 0.75, sway: 10, drag: 0 });
    }
    this._shootIn = (this._shootIn === undefined ? 6 : this._shootIn) - dt;
    if (star > 0.7 && this._shootIn < 0) {
      this._shootIn = 7 + Math.random() * 9;
      const d = Math.random() < 0.5 ? -1 : 1;
      this.shooting = { x: v.left + v.width * (0.25 + Math.random() * 0.5), y: v.free + 10 + Math.random() * 110, d, t: 0 };
    }
    if (this.shooting) { this.shooting.t += dt; if (this.shooting.t > 0.9) this.shooting = null; }
  }

  // The cat (standing on the sill) hands its bundle through the window; the window blooms.
  // A small piece of acting (~1.4 s, ~1 s under reduced motion): the cat turns its head to the child
  // (a dark window first lights up a little: someone comes to it), the child looks at the cat and
  // reaches out; the bundle leaves the cat's mouth and floats in a soft arc into the child's hand,
  // the child cheers and holds it up while it unwraps into little pictures; the cat squints with
  // pleasure, tail up. Looks set here are given back afterwards (only if nobody changed them meanwhile).
  async deliver(cat, house, win) {
    const w = typeof win === 'number' ? house.windows[win] : win, g = house.win(w), R = this.reduced;
    const K = w.kid && !w.kid.hidden ? w.kid : null;
    cat.wake();
    const catPrev = cat.look, catLook = { x: g.x, y: g.y };
    cat.look = catLook;
    if (K && w.lit < 0.55) this.spawn(() => this.tween(w, { lit: 0.55 }, 0.3));        // someone comes to the dark window
    // the child, if awake and in the light, looks at the cat and reaches for the bundle
    const seen = () => !!K && w.lit > 0.25 && K.mood !== 'sleep' && (K.x !== 0 || K.y !== 0);     // (a child is placed when first drawn)
    let kidPrev = null, kidLook = null;
    const kidOn = () => {
      if (kidLook || !seen()) return;
      kidPrev = K.look; kidLook = cat.anchor('head', { x: 0, y: 0 }); K.look = kidLook;
      if (K.mood === 'wait' || K.mood === 'read') K.mood = 'wave';
    };
    kidOn();
    if (seen()) { const hd = K.anchor('head'); catLook.x = hd.x; catLook.y = hd.y; }
    if (!R) await this.wait(w.lit < 0.5 ? 0.3 : 0.24);                                // (the head turns; the child comes to the glass)
    kidOn();
    // let go: the bundle leaves the mouth (the jaw opens a little) where it was drawn
    const s = cat.bundleSize * (cat.d ? cat.d.H : 1) * cat.size, m = cat.anchor('mouth');
    cat.carry = Math.max(0, cat.carry - 1);
    if (!R) cat.meow(0.2);
    const b = { x: m.x, y: m.y + 13 * s, rot: 0, size: s, glow: 0.5 };
    this.loose.push(b);
    this.audio.sfx.swish();
    // the arc ends in the child's hand (followed while it moves), or inside the window
    const x0 = b.x, y0 = b.y, end = { x: g.x, y: g.y + 10 };
    const aim = () => {
      if (seen()) { const hd = K.anchor('hand'); end.x = hd.x; end.y = hd.y + 13 * s * 0.85; catLook.x = hd.x; catLook.y = hd.y - 6; }
      else { end.x = g.x; end.y = g.y + 10; }
    };
    aim();
    const ex0 = end.x, ey0 = end.y;          // (where the hand was at the release: a waving hand is only caught up with towards the end)
    const F = R ? 0.34 : 0.52, lift = R ? 4 : clamp(14 + Math.hypot(end.x - x0, end.y - y0) * 0.3, 16, 42), side = end.x >= x0 ? 1 : -1;
    await this.frames((dt, el) => {
      aim();
      const u = clamp01(el / F), e = R ? ease.outQuad(u) : ease.inOutSine(u), k = u * u * (3 - 2 * u);
      b.x = lerp(x0, lerp(ex0, end.x, k), e); b.y = lerp(y0, lerp(ey0, end.y, k), e) - lift * 4 * e * (1 - e);
      b.rot = R ? 0 : Math.sin(Math.PI * u) * 0.3 * side;                                 // it swings a little on its knot
      b.size = s * (1 - 0.15 * e); b.glow = 0.5 + 0.35 * e;
      return u >= 1;
    });
    const caught = seen();
    if (caught) {
      // the child holds it up for a moment, then it opens: it shrinks into the little pictures below
      this.spawn(async () => {
        const hold = R ? 0.15 : 0.42, gone = R ? 0.15 : 0.24;
        await this.frames((dt, el) => {
          const hd = K.anchor('hand'), k = el < hold ? 0 : clamp01((el - hold) / gone);
          b.x = approach(b.x, hd.x, 16, dt); b.y = approach(b.y, hd.y + 13 * b.size * 0.85, 16, dt);
          b.rot *= Math.max(0, 1 - dt * 8);
          b.size = s * 0.85 * (1 - k); b.glow = 0.85 * (1 - k) + 0.3 * Math.sin(Math.PI * k);
          return k >= 1;
        });
        const i = this.loose.indexOf(b); if (i >= 0) this.loose.splice(i, 1);
      });
    } else this.loose.splice(this.loose.indexOf(b), 1);
    this.spawn(() => this.tween(w, { lit: 1 }, 0.4));
    // the rings bloom, then relax to a calm rest (a scene that takes the rings over meanwhile is left alone)
    this.spawn(async () => {
      await this.tween(w, { rings: 1 }, 1.1, ease.outCubic);
      if (w.rings !== 1) return;
      await this.wait(R ? 0.4 : 0.9);
      let v = 1;
      await this.frames((dt, el) => {
        if (w.rings !== v) return true;                      // somebody else is moving them now
        const u = Math.min(1, el / 2.2);
        v = w.rings = lerp(1, RINGS_REST, ease.inOutSine(u));
        return u >= 1;
      });
    });
    if (w.kid) w.kid.cheer();
    this.audio.sfx.bell();
    if (this.game.buzz) this.game.buzz(16);
    this.sparkle(g.x, g.y, 14);
    this.fx.add({ kind: 'star', x: g.x, y: g.y - 10, vx: 14, vy: -170, life: 1.9, size: 9, color: '#ffe36e', drag: 0.5, vr: 3 });
    // the tale is being unwrapped: little pictures drift up out of the window
    const kinds = ['note', 'heart', 'star', 'spark', 'note'], cols = ['#fff3b0', '#f6a9bd', '#ffe36e', '#c9e8ff', '#ffd0e0'];
    this.spawn(async () => {
      for (let i = 0; i < kinds.length; i++) {
        await this.wait(0.16 + i * 0.05);
        this.fx.add({ kind: kinds[i], x: g.x + (i - 2) * 6, y: g.top + 6, vx: (i - 2) * 10, vy: -46 - Math.random() * 26, life: 1.8, size: 6.5, color: cols[i], drag: 0.7, sway: 12, vr: 1.2 });
      }
    });
    // the cat is pleased: a happy squint towards the child, the tail goes up (eyes 'happy' does both)
    cat.eyes = 'happy'; cat.sq.v += R ? 2 : 4;
    await this.wait(R ? 0.6 : 0.62);
    if (cat.eyes === 'happy') cat.eyes = 'open';
    if (cat.look === catLook) cat.look = catPrev;
    if (kidLook && K.look === kidLook) K.look = kidPrev;
  }

  // two rows of far roofs, the farther one paler; their windows are lit at night
  drawFar(ctx, view, sky) {
    const band = { y0: -350, y1: 6 }, pale = mixHex(sky.mid, sky.bot, 0.5), key = this.far.toFixed(2) + sky.star.toFixed(2) + ':' + this.farSeed;
    FAR_A.draw(ctx, view, pale + key, (g, v) => drawFarTown(g, v, this.farSeed + 11, pale, this.far * 0.75, 0.15, -8, sky.star * 0.55, 0.7), band);
    FAR_B.draw(ctx, view, sky.mid + key, (g, v) => drawFarTown(g, v, this.farSeed, sky.mid, this.far, 0.3, 0, sky.star), band);
  }

  drawLife(ctx, t) {
    if (!this.life) return;
    for (const q of this.life) {
      if (q.a < 0.02 || q.x === undefined) continue;
      const x = q.x + Math.sin(t * 0.7 + q.ph) * 14, y = q.y + Math.cos(t * 0.9 + q.ph * 2) * 9;
      if (q.kind === 'glow') { ctx.save(); ctx.translate(x, y); ctx.scale(0.55, 0.55); drawFirefly(ctx, 0, 0, t * 0.6, q.ph * 9, q.a * 0.8); ctx.restore(); }
      else if (q.kind === 'fly') { ctx.save(); ctx.globalAlpha *= q.a; ctx.translate(x, y + Math.sin(t * 2.3 + q.ph) * 8); ctx.scale(0.62, 0.62); drawButterfly(ctx, 0, 0, t, q.seed); ctx.restore(); }
      else {                              // a dandelion seed on the wind
        const sw = Math.sin(t * 1.3 + q.ph) * 0.3;
        ctx.save(); ctx.globalAlpha *= q.a * 0.85; ctx.translate(x, y + Math.sin(t * 0.5 + q.ph) * 22); ctx.rotate(sw);
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.lineCap = 'round'; ctx.beginPath();
        ctx.moveTo(0, 5); ctx.lineTo(0, -1);
        for (let k = -2; k <= 2; k++) { ctx.moveTo(0, -1); ctx.lineTo(k * 2.2, -5.5 + Math.abs(k) * 0.9); }
        ctx.stroke(); ctx.restore();
      }
    }
    for (const m of this.moths || []) {
      const a = t * 3.1 + m.ph, x = m.x + Math.cos(a) * 20 + Math.sin(a * 2.7) * 5, y = m.y + Math.sin(a * 1.3) * 16, f = Math.abs(Math.sin(t * 24 + m.ph));
      ctx.fillStyle = 'rgba(250,244,220,0.9)';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(x + sd * 2.4 * f, y, 2.6 * (0.3 + 0.7 * f), 2, sd * 0.5, 0, 6.2832); ctx.fill(); }
    }
  }

  // hooks for subclasses
  drawBack(ctx, view, t, sky) {}
  drawMid(ctx, view, t, sky) {}
  drawFront(ctx, view, t, sky) {}

  draw(ctx, view, t) {
    const sky = this.sky;
    drawSkyAll(ctx, view, sky, this.farSeed);
    drawStars(ctx, view, this.stars, t, sky.star, this.reduced);
    const sk = this.farK();
    if (sky.star > 0.04) { ctx.save(); ctx.globalAlpha = Math.min(1, sky.star * 1.4); const m = this.moonPos(); drawMoon(ctx, m.x, m.y, this.moon.r * sk * (1 + this.moonB.x * 0.05), t, { face: Math.min(1, this.moonFace * 2) }); ctx.restore(); }
    if (sky.star < 0.7) for (const c of this.clouds) {
      const x = view.left + view.width * c.u + Math.sin(t * 0.05 + c.seed) * 30 * sk, y = view.free + (c.y - 40) * sk;
      if (sk === 1) drawCloud(ctx, x, y, c.w, c.seed, sky.cloud, 0.85 * (1 - sky.star / 0.7));
      else { ctx.save(); ctx.translate(x, y); ctx.scale(sk, sk); drawCloud(ctx, 0, 0, c.w, c.seed, sky.cloud, 0.85 * (1 - sky.star / 0.7)); ctx.restore(); }   // (scaled, not re-sized: the sprite is keyed on its width)
    }
    if (this.shooting) {
      const s = this.shooting, u = s.t / 0.9, x = s.x + s.d * u * 250, y = s.y + u * 86;
      chalk(ctx, [[x - s.d * 68 * (1 - u * 0.4), y - 23 * (1 - u * 0.4)], [x, y]], { width: 2.4, alpha: 0.8 * (1 - u), color: '#fffbe0', rough: 0.4 });
      glow(ctx, x, y, 14, '#fffbe0', 0.9 * (1 - u));
    }
    this.drawBack(ctx, view, t, sky);
    if (this.far > 0) this.drawFar(ctx, view, sky);
    drawGround(ctx, view, sky, { t });
    for (const h of this.houses) if (view.visible(h.x, h.w + 80)) h.draw(ctx, t);
    this.drawMid(ctx, view, t, sky);
    for (const tr of this.trees) if (view.visible(tr.x, tr.r * 2 + 60)) tr.draw(ctx, t);
    drawGrassFront(ctx, view, sky, { t });
    for (const h of this.houses) if (view.visible(h.x, h.w + 160)) h.drawLights(ctx, t, sky.star);
    this.drawLife(ctx, t);
    this.fx.draw(ctx, t, -1);
    // (whoever stands far outside the picture is not painted; they keep living in update())
    for (const b of this.birds) if (view.visible(b.x, 90)) b.draw(ctx, t);
    for (const c of this.cats) if ((!this.leap || c !== this.leap.cat) && view.visible(c.x, 160 * (c.size || 1))) c.draw(ctx, t);
    if (this.leap) this.leap.cat.draw(ctx, t);
    for (const b of this.loose) if (view.visible(b.x, 80 * (b.size || 1))) drawLooseBundle(ctx, b.x, b.y, b.rot, b.size, b.glow);
    if (this.leap) this.leap.draw(ctx, t);
    this.fx.draw(ctx, t, 0);
    this.drawFront(ctx, view, t, sky);
  }
}

export { Tree, House, Perch };
