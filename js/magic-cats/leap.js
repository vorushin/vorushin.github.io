// Magic cats — the cats' way of travelling: leaping from treetop to treetop.
// Touch where the cat should land (or drag to aim, then let go): a chalk arc previews the
// leap. There is no falling — a spot that is out of reach simply isn't offered.

import { TAU, clamp, clamp01, lerp, dist } from './util.js';
import { chalk } from './paint.js';
import { drawFirefly, drawButterfly } from './actors.js';

export class Perch {
  // o: {x, y} or {at: () => ({x, y})}, hw (half width), owner (Tree…), id, enabled, only: [perch…] (reachable only from these)
  constructor(o) {
    this.at = o.at || null; this._x = o.x || 0; this._y = o.y || 0;
    this.hw = o.hw || 36; this.owner = o.owner || null; this.id = o.id || '';
    this.enabled = o.enabled !== false; this.only = o.only || null; this.kind = o.kind || 'tree';
    this.range = o.range || 0;      // extra reach granted when leaping *to* this perch
  }
  get x() { return this.at ? this.at().x : this._x; }
  get y() { return this.at ? this.at().y : this._y; }
  static tree(tree, o) { return new Perch(Object.assign({ at: () => ({ x: tree.topX, y: tree.perchY }), owner: tree, hw: tree.r * 0.6, kind: 'tree' }, o || {})); }
  static sill(house, win, o) {
    const w = typeof win === 'number' ? house.windows[win] : win;
    return new Perch(Object.assign({ at: () => { const g = house.win(w); return { x: w.ledge ? g.x - g.w / 2 - w.ledge * 0.5 + 2 : g.x, y: g.sillY }; }, owner: house, hw: 24, kind: 'sill' }, o || {}));
  }
  static point(x, y, o) { return new Perch(Object.assign({ x, y }, o || {})); }
}

// How near a touch must be to a perch to count for it (world units round the spot just above the perch;
// scaled ×1.15 for the hinted perch, ×0.6 for one behind the cat; never under PICK.px screen px)
const PICK = { rx: 125, up: 140, down: 230, px: 44 };

export class Leap {
  // o: {cat, perches, start, range, onLand(perch, prev), onLeap(to, from), flies: [{x, y}], followers}
  constructor(scene, o) {
    this.scene = scene; this.audio = scene.audio;
    this.cat = o.cat; this.perches = o.perches || []; this.at = o.start || this.perches[0];
    this.range = o.range || 265; this.upMax = o.upMax || 190; this.downMax = o.downMax || 330;
    this.enabled = true; this.state = 'idle'; this.aim = null; this.goal = null;
    this.onLand = o.onLand || null; this.onLeap = o.onLeap || null;
    this.followers = [];          // [{cat, at, queue, wait}]
    this.flies = (o.flies || []).map((f, i) => Object.assign({ seed: i * 7.3 + 1, got: false, r: 30 }, f));
    this.caught = 0;
    this.day = false;             // butterflies instead of fireflies
    this._waiters = [];
    this.petT = 0;
    this._lk = { x: 0, y: 0 };       // (reused look targets: no garbage per frame)
    if (this.at) { this.cat.x = this.at.x; this.cat.y = this.at.y; }
  }
  addFollower(cat, perch, o) {
    const f = Object.assign({ cat, at: perch || null, queue: [], wait: 0, delay: 0.22, offset: 0 }, o || {});
    if (perch) { cat.x = perch.x + f.offset; cat.y = perch.y; }
    this.followers.push(f);
    return f;
  }
  removeFollower(cat) { this.followers = this.followers.filter((f) => f.cat !== cat); }

  reachable(a, b) {
    if (!b || !b.enabled || a === b) return false;
    if (b.only && b.only.indexOf(a) < 0) return false;
    if (a.only && a.only.indexOf(b) < 0) return false;
    const dx = Math.abs(b.x - a.x), dy = b.y - a.y;
    return dx <= this.range + b.range && dy >= -this.upMax && dy <= this.downMax;
  }
  // Best perch for a pointer position: the nearest reachable one on the side that was touched — but only
  // if the touch is reasonably near it (round the treetop: a little sky above, the crown below). Generous
  // for the perch the story is hinting at and for perches ahead (towards the goal), stricter for perches
  // behind, so a stray tap in the empty sky is a "no perch" (a mrrp, the cat stays) and never sends the
  // cat back; a deliberate tap on the previous treetop still goes back. `any`: no distance check (keys).
  pick(p, any) {
    const cx = this.cat.x, v = this.scene.view, px = 1 / Math.max(0.2, (v && v.scale) || 1);
    const hint = this.goal ? this.stepToward(this.goal) : null;
    const fwd = hint ? Math.sign(hint.x - cx) : this.goal ? Math.sign(this.goal.x - cx) : 0;   // 0: no road to follow, every side is "ahead"
    let best = null, bs = 1e9;
    for (const q of this.perches) {
      if (!this.reachable(this.at, q)) continue;
      const side = q.x - cx, ps = p.x - cx;
      if (Math.abs(ps) > 24 && Math.abs(side) > 8 && side * ps < 0) continue;
      if (!any) {
        const ahead = q === hint || !fwd || side * fwd > 0, k = q === hint ? 1.15 : ahead ? 1 : 0.6;
        const rx = Math.max(PICK.rx * k, PICK.px * px), up = Math.max(PICK.up * k, PICK.px * px), down = Math.max(PICK.down * k, PICK.px * px);
        const dx = (p.x - q.x) / rx, dy = p.y - (q.y - 18), ny = dy < 0 ? dy / up : dy / down;
        if (dx * dx + ny * ny > 1) continue;
      }
      const sc = Math.abs(q.x - p.x) + 0.45 * Math.abs(q.y - 20 - p.y);
      if (sc < bs) { bs = sc; best = q; }
    }
    return best;
  }
  // First step of the shortest path from the current perch to `goal` (for hints / keyboard / tests).
  stepToward(goal) {
    if (!goal || goal === this.at) return null;
    const prev = new Map([[this.at, null]]), q = [this.at];
    while (q.length) {
      const a = q.shift();
      if (a === goal) break;
      for (const b of this.perches) if (!prev.has(b) && this.reachable(a, b)) { prev.set(b, a); q.push(b); }
    }
    if (!prev.has(goal)) return null;
    let n = goal;
    while (prev.get(n) !== this.at) n = prev.get(n);
    return n;
  }
  // Expectation object for the scene (tap the next perch on the way to the goal).
  expect(text) {
    // (also while a press is "aiming" at nothing — a thumb resting on the screen: the hint stays, the next touch takes over)
    if (!this.enabled || !(this.state === 'idle' || (this.state === 'aim' && this.aim && !this.aim.perch))) return null;
    const n = this.stepToward(this.goal);
    return n ? { kind: 'tap', x: n.x, y: n.y - 18, r: 44, text } : null;
  }

  // ── input (call from the scene's onDown/onMove/onUp) ──
  down(p) {
    if (!this.enabled || this.state !== 'idle') return false;
    const c = this.cat;
    if (dist(p.x, p.y, c.x, c.y - 26 * c.size) < 40 * Math.max(0.8, c.size)) { this.pet(c); return true; }
    for (const f of this.followers) if (!f.cat.hidden && !f.cat.jump && dist(p.x, p.y, f.cat.x, f.cat.y - 22 * f.cat.size) < 34) { this.pet(f.cat); return true; }
    this.state = 'aim';
    c.wake();
    this.aim = { perch: this.pick(p), x: p.x, y: p.y };
    return true;
  }
  move(p) {
    if (this.state !== 'aim') return false;
    this.aim.perch = this.pick(p); this.aim.x = p.x; this.aim.y = p.y;
    return true;
  }
  up(p) {
    if (this.state !== 'aim') return false;
    const q = this.aim.perch;
    this.aim = null; this.cat.look = null;
    if (!this.enabled) { this.state = 'idle'; this.cat.crouch = 0; return true; }      // the road closed while aiming: no jump
    if (q) this.go(q);
    else { this.state = 'idle'; this.cat.crouch = 0; this.audio.sfx.mrrp(this.cat.kind === 'kitten'); this.cat.meow(0.22); this.cat.hopInPlace(8); this.puzzled(); }
    return true;
  }
  key(k) {
    if (!this.enabled || this.state !== 'idle') return;
    const dir = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0;
    if (!dir) return;
    const q = this.pick({ x: this.cat.x + dir * 150, y: this.cat.y }, true);
    if (q && (q.x - this.cat.x) * dir > 0) this.go(q);
  }
  // nothing in reach that way: after the little hop, a puzzled tilt of the head
  puzzled() {
    const c = this.cat, sc = this.scene;
    if (sc.reduced) return;
    sc.spawn(async () => { await sc.wait(0.36); if (this.state === 'idle' && !c.jump && !c.look) c.act('tilt', { dur: 1.1 }); });
  }
  // Petted: a purring squint with the head turned to whoever stroked it (eyes 'happy' turns the face
  // to the viewer and lifts the tail), a little dip into the hand and a knead of the forepaws.
  // (Short: the cat is free to leap again at once — aiming wakes it out of the knead.)
  pet(cat) {
    cat.calm = 0;
    cat.eyes = 'happy'; cat.sq.v += 3;
    if (!cat.jump && cat.mode !== 'upright' && !this.scene.reduced) cat.act('knead', { dur: 1.1 });
    this.audio.sfx.purr(1.1);
    this.scene.hearts(cat.x, cat.y - 52 * cat.size, 3);
    const n = (cat._petN = (cat._petN || 0) + 1);
    this.scene.spawn(async () => { await this.scene.wait(1.1); if (cat._petN === n && cat.eyes === 'happy') cat.eyes = 'open'; });
  }

  // Leap now. Resolves on landing.
  go(q) {
    const c = this.cat, from = this.at;
    this.state = 'air'; this.aim = null; c.look = null;          // (the aim made the cat watch the perch; now it looks about again)
    if (this.onLeap) this.onLeap(q, from);
    const pan = this.pan(c.x);
    this.audio.sfx.hop(pan);
    return new Promise((resolve) => {
      c.leapTo(q.x, q.y, {
        done: () => {
          this.at = q; this.state = 'idle';
          if (q.owner && q.owner.land) q.owner.land(1);
          this.audio.sfx.land(this.pan(c.x), q.kind !== 'tree');
          this.audio.playerNote({ pan: this.pan(c.x) });
          if (this.scene.game.buzz) this.scene.game.buzz(8);
          if (q.kind === 'tree') this.scene.leaves(c.x, c.y - 4, 6);
          for (const f of this.followers) { f.queue.push(from); f.wait = f.delay; }
          if (this.onLand) this.onLand(q, from);
          const w = this._waiters; this._waiters = [];
          for (const k of w) { if (!k.perch || (k.ok ? k.ok(q) : k.perch === q)) k.hit = q; else this._waiters.push(k); }
          resolve(q);
        }
      });
    });
  }
  // Promise: the cat has landed on `perch` (any landing if omitted). Also makes it the hinted goal.
  // o.past: perches further along the road that count as well, so a quick child who has already
  // leapt beyond is never sent back.
  reach(perch, o) {
    const past = (o && o.past) || null;
    const ok = (q) => !!q && (q === perch || (!!past && past.indexOf(q) >= 0));
    if (perch && !ok(this.at)) this.goal = perch;
    if (perch && ok(this.at) && this.state !== 'air') return Promise.resolve(this.at);
    const k = { perch: perch || null, ok: perch ? ok : null, hit: null };
    this._waiters.push(k);
    return this.scene.until(() => k.hit).then(() => k.hit);
  }
  pan(x) { const v = this.scene.view; return clamp(((x - v.cam.x) / Math.max(1, v.width)) * 1.6, -0.8, 0.8); }

  update(dt) {
    const c = this.cat, t = this.scene.t;
    // while the player is thinking, the cats may make themselves comfortable
    c.idleSit = this.enabled && this.state === 'idle' && this.sit !== false;
    for (const f of this.followers) f.cat.idleSit = c.idleSit && !!f.at && !f.queue.length;
    if (this.state === 'aim') {
      c.crouch = Math.min(1, c.crouch + dt * 7);
      // the cat looks at the perch it would take (head turn), or after the finger while nothing is in reach
      const q = this.aim.perch, lk = this._lk;
      if (q) { lk.x = q.x; lk.y = q.y - 14 * c.size; const d = q.x - c.x; if (Math.abs(d) > 6) c.dir = d > 0 ? 1 : -1; }
      else { lk.x = this.aim.x; lk.y = this.aim.y; }
      c.look = lk;
    } else {
      c.crouch = Math.max(0, c.crouch - dt * 9);
      if (this.state === 'idle' && this.at) { c.x = this.at.x; c.y = this.at.y; }
    }
    for (const f of this.followers) {
      const k = f.cat;
      if (!k.jump) {
        if (f.at) { k.x = f.at.x + f.offset; k.y = f.at.y; }
        if (f.queue.length) {
          f.wait -= dt;
          if (f.wait <= 0) {
            const q = f.queue.shift(), self = f;
            if (q !== f.at) {
              this.audio.sfx.hop(this.pan(k.x));
              k.leapTo(q.x + f.offset, q.y, { done: () => { self.at = q; if (q.owner && q.owner.land) q.owner.land(0.6); this.audio.sfx.land(this.pan(k.x), true); if (self.onLand) self.onLand(q); } });
              f.at = null;
            }
            f.wait = 0.08;
          }
        } else if (this.state === 'idle' || !k.look || k.look === f._lk) {        // watching the leader: at rest, while it aims and in the air
          k.look = c.anchor('head', f._lk || (f._lk = { x: 0, y: 0 }));
        }
      }
    }
    // fireflies
    for (const f of this.flies) {
      if (f.got) continue;
      f.cx = f.x + Math.sin(t * 0.9 + f.seed) * 9 + (f.orbit ? Math.cos(t * f.speed + f.seed) * f.orbit : 0);
      f.cy = f.y + Math.cos(t * 1.3 + f.seed) * 7 + (f.orbit ? Math.sin(t * f.speed + f.seed) * f.orbit * 0.6 : 0);
      for (const k of [c].concat(this.followers.map((x) => x.cat))) {
        if (k.hidden) continue;
        if (dist(f.cx, f.cy, k.x, k.y - 26 * k.size) < f.r) { this.catchFly(f); break; }
      }
    }
    if (this.petT > 0) this.petT -= dt;
  }
  catchFly(f) {
    f.got = true; this.caught++;
    this.audio.sfx.sparkle(this.pan(f.cx));
    this.scene.fx.burst('spark', f.cx, f.cy, 7, { speed: 70, life: 0.7, size: 4, colors: ['#fff7c0', '#ffe36e'] });
    const v = this.scene.view;
    this.scene.fx.add({ kind: 'dot', x: f.cx, y: f.cy, vx: (v.cam.x - f.cx) * 1.2, vy: (v.top + 30 - f.cy) * 1.2, life: 0.8, size: 5, color: '#fff3a0', drag: 0 });
    this.scene.game.catchFly(1);
  }

  // chalk arc + landing ring while aiming; fireflies
  draw(ctx, t) {
    for (const f of this.flies) if (!f.got && f.cx !== undefined) { if (this.day) drawButterfly(ctx, f.cx, f.cy, t, f.seed); else drawFirefly(ctx, f.cx, f.cy, t, f.seed); }
    if (this.state !== 'aim' || !this.aim) return;
    const c = this.cat, q = this.aim.perch;
    const x0 = c.x, y0 = c.y - 16 * c.size;
    let x1, y1, ok = !!q;
    if (q) { x1 = q.x; y1 = q.y - 6; } else { const d = clamp(this.aim.x - c.x, -150, 150); x1 = c.x + d; y1 = c.y + 30; }
    const dd = Math.hypot(x1 - x0, y1 - y0), h = 34 + dd * 0.22 + Math.max(0, y0 - y1) * 0.25, n = 22, pts = [];
    for (let i = 0; i <= n; i++) { const u = i / n; pts.push([lerp(x0, x1, u), lerp(y0, y1, u) - 4 * h * u * (1 - u)]); }
    const off = Math.floor(t * 10) % 3;
    for (let i = off; i < n - (ok ? 0 : 8); i += 3) chalk(ctx, [pts[i], pts[Math.min(n, i + 1)]], { width: 3.2, alpha: ok ? 0.85 : 0.35, color: '#fff3b8', seed: i });
    if (ok) {
      const ring = [];
      const rr = 20 + 3 * Math.sin(t * 7);
      for (let i = 0; i <= 18; i++) ring.push([x1 + Math.cos((i / 18) * TAU) * rr, y1 + 4 + Math.sin((i / 18) * TAU) * rr * 0.36]);
      chalk(ctx, ring, { width: 2.6, alpha: 0.9, color: '#fff3b8', seed: Math.floor(t * 6) });
    }
  }
}
