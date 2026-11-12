// Magic cats — Scene base class: scripted async sequences on the scene clock, awaited
// gestures (which also drive the hints and the keyboard / test "do the expected thing"),
// particles and camera helpers.
//
// A scene overrides:  async run()  — the script; resolving it completes the scene
//                     update(dt), draw(ctx, view, t), optional drawOver(ctx, view, t)
//                     optional onDown/onMove/onUp(p) for free-form input (p in world coords)

import { TAU, clamp, clamp01, lerp, ease, dist, approach } from './util.js';
import { ZOOM_MAX } from './view.js';
import { glow, sparklePath, heartPath, starPath, INK, PAL } from './paint.js';

export const ABORT = { name: 'SceneAbort' };
// Helper promises reject with ABORT when their scene is left. Scripts often start one without
// awaiting it (this.say(0); this.tween(…)): mark those as handled so they never surface as
// "unhandled rejection". Awaiting the same promise still throws, as scripts expect.
function quiet(p) { p.catch(() => {}); return p; }

// ───────────────────────── Particles ─────────────────────────
export class Particles {
  constructor() { this.list = []; }
  add(p) {
    this.list.push(Object.assign({ x: 0, y: 0, vx: 0, vy: 0, life: 1, age: 0, size: 4, color: '#ffffff', kind: 'dot', rot: 0, vr: 0, grav: 0, drag: 0, alpha: 1, sway: 0, ph: Math.random() * TAU, grow: 0, layer: 0 }, p));
    return this.list[this.list.length - 1];
  }
  // n particles thrown in a fan. o: {speed, a0, a1 (radians), life, size, color|colors, grav, drag, vr, spread}
  burst(kind, x, y, n, o) {
    o = o || {};
    for (let i = 0; i < n; i++) {
      const a = lerp(o.a0 === undefined ? 0 : o.a0, o.a1 === undefined ? TAU : o.a1, Math.random());
      const sp = (o.speed === undefined ? 80 : o.speed) * (0.45 + Math.random() * 0.55);
      const sprd = o.spread || 0;
      this.add({
        kind, x: x + (Math.random() - 0.5) * sprd, y: y + (Math.random() - 0.5) * sprd,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: (o.life || 1) * (0.7 + Math.random() * 0.6),
        size: (o.size || 4) * (0.7 + Math.random() * 0.6), color: o.colors ? o.colors[i % o.colors.length] : (o.color || '#ffffff'),
        grav: o.grav || 0, drag: o.drag === undefined ? 1.5 : o.drag, vr: (Math.random() - 0.5) * (o.vr === undefined ? 6 : o.vr),
        rot: Math.random() * TAU, sway: o.sway || 0, alpha: o.alpha === undefined ? 1 : o.alpha, grow: o.grow || 0, layer: o.layer || 0
      });
    }
  }
  update(dt) {
    const L = this.list;
    for (let i = L.length - 1; i >= 0; i--) {
      const p = L[i];
      p.age += dt;
      if (p.age >= p.life) { L[i] = L[L.length - 1]; L.pop(); continue; }
      p.vy += p.grav * dt;
      if (p.drag) { const k = Math.exp(-p.drag * dt); p.vx *= k; p.vy *= k; }
      p.x += (p.vx + (p.sway ? Math.sin(p.age * 3 + p.ph) * p.sway : 0)) * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.grow) p.size += p.grow * dt;
    }
  }
  draw(ctx, t, layer) {
    const L = this.list;
    for (let i = 0; i < L.length; i++) {
      const p = L[i];
      if ((p.layer || 0) !== (layer || 0)) continue;
      const u = p.age / p.life, a = p.alpha * Math.min(1, p.age / 0.08) * (1 - u * u);
      if (a <= 0.01) continue;
      ctx.save();
      ctx.globalAlpha *= a;
      ctx.translate(p.x, p.y);
      switch (p.kind) {
        case 'dot':
          glow(ctx, 0, 0, p.size * 4, p.color, 0.8);
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.size * 0.5, 0, TAU); ctx.fill(); break;
        case 'spark':
          ctx.fillStyle = p.color; sparklePath(ctx, 0, 0, p.size * (0.7 + 0.3 * Math.sin(t * 12 + p.ph)), p.rot * 0.2); ctx.fill(); break;
        case 'star':
          ctx.fillStyle = p.color; starPath(ctx, 0, 0, p.size, p.rot); ctx.fill(); break;
        case 'leaf':
        case 'petal':
          ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size, p.size * (p.kind === 'leaf' ? 0.48 : 0.62), 0, 0, TAU); ctx.fill(); break;
        case 'feather':
          ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.quadraticCurveTo(0, -p.size * 0.5, p.size, 0); ctx.quadraticCurveTo(0, p.size * 0.5, -p.size, 0); ctx.fill();
          ctx.strokeStyle = 'rgba(29,21,48,0.35)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(-p.size, 0); ctx.lineTo(p.size, 0); ctx.stroke(); break;
        case 'heart':
          heartPath(ctx, 0, 0, p.size); ctx.fillStyle = p.color; ctx.fill(); break;
        case 'puff':
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill(); break;
        case 'ring':
          ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(0.6, 2.4 * (1 - u)); ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.stroke(); break;
        case 'drop':
          ctx.rotate(Math.atan2(p.vy, p.vx) - Math.PI / 2); ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(0, 0, p.size * 0.45, p.size, 0, 0, TAU); ctx.fill(); break;
        case 'crumb':
          ctx.rotate(p.rot); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); break;
        case 'note': {
          const s = p.size; ctx.rotate(Math.sin(p.age * 3 + p.ph) * 0.2);
          ctx.fillStyle = p.color; ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.ellipse(0, 0, s * 0.42, s * 0.3, -0.4, 0, TAU); ctx.fill();
          ctx.beginPath(); ctx.moveTo(s * 0.36, -s * 0.05); ctx.lineTo(s * 0.36, -s * 1.15); ctx.quadraticCurveTo(s * 0.9, -s * 0.9, s * 0.8, -s * 0.5); ctx.stroke(); break;
        }
        case 'z': {
          const s = p.size; ctx.strokeStyle = p.color; ctx.lineWidth = s * 0.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.beginPath(); ctx.moveTo(-s * 0.5, -s * 0.5); ctx.lineTo(s * 0.5, -s * 0.5); ctx.lineTo(-s * 0.5, s * 0.5); ctx.lineTo(s * 0.5, s * 0.5); ctx.stroke(); break;
        }
        default:
          ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
      }
      ctx.restore();
    }
  }
  clear() { this.list.length = 0; }
}

// ───────────────────────── Scene ─────────────────────────
export class Scene {
  constructor(game, index) {
    this.game = game;
    this.index = index;
    this.view = game.view;
    this.cam = game.view.cam;
    this.audio = game.audio;
    this.story = game.story;
    this.t = 0;
    this.dead = false;
    this.idle = 0;                 // seconds since the player last touched anything
    this.fx = new Particles();
    this.expect = null;            // manual expectation: {kind:'tap'|'hold'|'drag', x, y, r, x2, y2, dur, text} or a function returning one
    this._tasks = [];
    this._gestures = [];
    this._pointer = null;
    this.reduced = game.reduced;
    this._held = null;             // the director's camera (see shot / track below)
    this._track = null;
    this._shotId = 0;
  }

  // ── override me ──
  async run() {}
  update(dt) {}
  draw(ctx, view, t) {}
  dispose() {}

  // ── engine ──
  _step(dt) {
    this.t += dt;
    this.idle += dt;
    const T = this._tasks;
    for (let i = 0; i < T.length; i++) {
      const k = T[i];
      if (k.done) continue;
      let fin = false;
      try { fin = k.step(dt); } catch (e) { k.done = true; k.reject(e); continue; }
      if (fin) { k.done = true; k.resolve(k.value); }
    }
    if (T.length > 24) this._tasks = T.filter((k) => !k.done);
    for (const g of this._gestures) if (g.step) g.step(dt);
    this.fx.update(dt);
    this.update(dt);
    this._camStep(dt);
  }
  _abort() {
    if (this.dead) return;
    this.dead = true;
    for (const k of this._tasks) if (!k.done) { k.done = true; k.reject(ABORT); }
    for (const g of this._gestures) g.reject(ABORT);
    this._tasks = []; this._gestures = [];
    try { this.dispose(); } catch (e) { console.error(e); }
  }
  _task(step, value) {
    if (this.dead) return quiet(Promise.reject(ABORT));
    return quiet(new Promise((resolve, reject) => { this._tasks.push({ step, resolve, reject, value, done: false }); }));
  }
  // `_lasting`: the press that is down began something that lasts (a hold, a drag, a stroke the scene
  // expects): a second finger must not take over from it (main.js / input.js `busy`). Set when the press
  // lands on the start of a hold or drag expectation, or when holdOn / dragTo take it; cleared on `_up`.
  _down(p) {
    this.idle = 0; this._pointer = p;
    const e = this.currentExpect();
    this._lasting = !!(e && (e.kind === 'hold' || e.kind === 'drag') && e.x !== undefined && e.x !== null && dist(p.x, p.y, e.x, e.y) <= this.hitR((e.r || 46) * 1.5));
    for (const g of this._gestures.slice()) if (g.down && g.down(p)) return;
    if (this.onDown) this.onDown(p);
  }
  _move(p) {
    this._pointer = p;
    for (const g of this._gestures.slice()) if (g.move && g.move(p)) return;
    if (this.onMove) this.onMove(p);
  }
  _up(p) {
    this.idle = 0; this._pointer = null; this._lasting = false;
    let used = false;
    for (const g of this._gestures.slice()) if (g.up && g.up(p)) { used = true; break; }
    if (!used && this.onUp) this.onUp(p);
  }
  _removeGesture(g) { const i = this._gestures.indexOf(g); if (i >= 0) this._gestures.splice(i, 1); }
  // What the player is expected to do right now (world coords) — feeds hints, keyboard and tests.
  currentExpect() {
    for (const g of this._gestures) if (g.expect) { const e = g.expect(); if (e) return e; }
    const e = typeof this.expect === 'function' ? this.expect() : this.expect;
    return e || null;
  }

  // ── scripting on the scene clock ──
  wait(sec) { let left = sec; return this._task((dt) => (left -= dt) <= 0); }
  until(fn) { return this._task(() => !!fn()); }
  frames(fn) { let el = 0; return this._task((dt) => { el += dt; return !!fn(dt, el); }); }
  // tween numeric props of obj; resolves at the end
  tween(obj, props, dur, fn) {
    const from = {}, e = fn || ease.inOutQuad;
    let el = 0, init = false;
    return this._task((dt) => {
      if (!init) { for (const k in props) from[k] = obj[k]; init = true; }
      el += dt;
      const u = dur <= 0 ? 1 : clamp01(el / dur), v = e(u);
      for (const k in props) obj[k] = lerp(from[k], props[k], v);
      return u >= 1;
    });
  }
  // fire-and-forget script; aborts are swallowed
  spawn(fn) { Promise.resolve().then(() => fn()).catch((e) => { if (e !== ABORT) console.error(e); }); }

  // ── narration ──
  // Show beat i of this scene's text. Resolves once the words have appeared.
  // (It first lets the previous caption stay up long enough to be read.)
  say(i, o) { return quiet(this.story.show(this.index, i, o, this)); }
  // Show beat i, then wait for a tap / key to continue.
  async tell(i, o) { await this.say(i, o); await this.next(); }
  // Wait for "continue" (tap anywhere, Space, Enter).
  next() {
    this.story.more(true);
    return quiet(new Promise((resolve, reject) => {
      let toyed = false;
      const g = {
        reject, expect: () => ({ kind: 'continue' }),
        up: () => { if (toyed) { toyed = false; return true; } this._removeGesture(g); this.story.more(false); this.story.hush(); this.audio.sfx.tick(); resolve(); return true; },
        down: (p) => { toyed = p.id !== -1 && typeof this.onToy === 'function' && !!this.onToy(p); return true; }     // a cat or a window still answers a real finger; that touch does not turn the page (a performed tap, id -1, always does)
      };
      this._gestures.push(g);
    }));
  }
  hint(text) { this.story.hint(text || null); }

  // ── awaited gestures ──
  // A target's radius in world units, but never under ~26 px on the screen: a finger must be able to land on it.
  hitR(r) { return Math.max(r, 26 / Math.max(0.2, (this.view && this.view.scale) || 1)); }
  // target: {x, y, r?} in world coords, or a function returning that (may return null = not available yet).
  tapOn(target, o) {
    o = o || {};
    const get = typeof target === 'function' ? target : () => target;
    return quiet(new Promise((resolve, reject) => {
      const g = {
        reject,
        expect: () => { const q = get(); return q ? { kind: 'tap', x: q.x, y: q.y, r: q.r || 46, text: o.text } : null; },
        down: (p) => {
          const q = get(); if (!q) return false;
          if (dist(p.x, p.y, q.x, q.y) <= this.hitR((q.r || 46) * (o.slop || 1.3))) { this._removeGesture(g); resolve(p); return true; }
          return false;
        }
      };
      this._gestures.push(g);
    }));
  }
  // Resolves with the index of whichever target is tapped first. `targets` may contain nulls (already done).
  tapAny(targets, o) {
    o = o || {};
    return quiet(new Promise((resolve, reject) => {
      const g = {
        reject,
        expect: () => { for (const q of targets) if (q && !q.done) return { kind: 'tap', x: q.x, y: q.y, r: q.r || 46, text: o.text }; return null; },
        down: (p) => {
          let best = -1, bd = 1e9, done = -1, dd = 1e9;
          targets.forEach((q, i) => {
            if (!q) return;
            const d = dist(p.x, p.y, q.x, q.y) / this.hitR((q.r || 46) * (o.slop || 1.3));
            if (d > 1) return;
            if (q.done) { if (d < dd) { dd = d; done = i; } } else if (d < bd) { bd = d; best = i; }
          });
          if (best < 0) { if (done >= 0 && o.onDone) { o.onDone(done); return true; } return false; }
          this._removeGesture(g); resolve(best); return true;
        }
      };
      this._gestures.push(g);
    }));
  }
  // Press on target and keep holding for `dur` seconds. o: {onProgress(f), onStart(), onStop(), keep (keep progress when released), anywhere}
  holdOn(target, dur, o) {
    o = o || {};
    const get = typeof target === 'function' ? target : () => target;
    let acc = 0, holding = false;
    return quiet(new Promise((resolve, reject) => {
      const stop = () => { if (holding) { holding = false; if (o.onStop) o.onStop(acc / dur); } };
      const g = {
        reject,
        expect: () => { const q = get(); return q ? { kind: 'hold', x: q.x, y: q.y, r: q.r || 46, dur: dur * (1 - (o.keep ? acc / dur : 0)), text: o.text } : null; },
        down: (p) => {
          const q = get(); if (!q) return false;
          if (o.anywhere || dist(p.x, p.y, q.x, q.y) <= this.hitR((q.r || 46) * (o.slop || 1.4))) { holding = true; this._lasting = true; if (o.onStart) o.onStart(); return true; }
          return false;
        },
        up: () => { if (!holding) return false; stop(); return true; },    // let go early: step() eases the progress back, nothing snaps
        step: (dt) => {
          if (!holding) { if (!o.keep && acc > 0) { acc = Math.max(0, acc - dt * 2); if (o.onProgress) o.onProgress(acc / dur); } return; }
          this.idle = 0;
          acc += dt;
          if (o.onProgress) o.onProgress(clamp01(acc / dur));
          if (acc >= dur) { holding = false; this._removeGesture(g); if (o.onStop) o.onStop(1); resolve(); }
        }
      };
      this._gestures.push(g);
    }));
  }
  // Drag `obj` (anything with x, y; r = grab radius) and drop it within dest's radius.
  // o: {onMove(p), onGrab(), onDrop(ok), snapBack (default true), text, free (resolve wherever it is dropped),
  //     slow (seconds the gesture should take when it is performed for the player)}
  dragTo(obj, dest, o) {
    o = o || {};
    const getD = typeof dest === 'function' ? dest : () => dest;
    let grabbed = false, home = null, off = null;
    return quiet(new Promise((resolve, reject) => {
      const g = {
        reject,
        expect: () => { const d = getD(); return d ? { kind: 'drag', x: obj.x, y: obj.y, r: obj.r || 44, x2: d.x, y2: d.y, text: o.text, slow: o.slow } : null; },
        down: (p) => {
          if (dist(p.x, p.y, obj.x, obj.y) > this.hitR((obj.r || 44) * 1.4)) return false;
          grabbed = true; this._lasting = true; home = { x: obj.x, y: obj.y }; off = { x: obj.x - p.x, y: obj.y - p.y };
          if (o.onGrab) o.onGrab(); return true;
        },
        move: (p) => { if (!grabbed) return false; obj.x = p.x + off.x; obj.y = p.y + off.y; this.idle = 0; if (o.onMove) o.onMove(p); return true; },
        up: (p) => {
          if (!grabbed) return false;
          grabbed = false;
          const d = getD(), ok = o.free || (d && dist(obj.x, obj.y, d.x, d.y) <= (d.r || 56));
          if (o.onDrop) o.onDrop(ok);
          if (ok) { this._removeGesture(g); resolve({ x: obj.x, y: obj.y }); }
          else if (o.snapBack !== false) this.spawn(() => this.tween(obj, home, 0.28, ease.outBack));
          return true;
        }
      };
      this._gestures.push(g);
    }));
  }

  // ── camera ──
  camFollow(x, y, dt, rate) {
    this.cam.x = approach(this.cam.x, x, rate || 3.2, dt);
    if (y !== undefined && y !== null) this.cam.y = approach(this.cam.y, y, rate || 3.2, dt);
  }
  camTo(x, y, zoom, dur, fn) {
    this._held = null; this._track = null; this._shotId++;     // (an explicit move takes the camera back from the director)
    const props = {};
    if (x !== undefined && x !== null) props.x = x;
    if (y !== undefined && y !== null) props.y = y;
    if (zoom !== undefined && zoom !== null) props.zoom = zoom;
    return this.tween(this.cam, props, dur === undefined ? 1 : dur, fn || ease.inOutCubic);
  }

  // ── the director's camera ──
  // Framing by what should be in the picture instead of by camera coordinates. A box is a world rect
  // {l, r, t, b} or {x, y, w, h} (x, y = its centre). Options (o):
  //   pad      world units of air around the box (default 30)
  //   min/max  zoom limits (default 0.7 / ZOOM_MAX = 1.8); on short landscape screens max is raised by
  //            view.closeMax (× view.closeK, sprite-safe, ≤ 2.4) unless max ≤ 1.2, min ≥ max or o.exact
  //   exact    take max literally on every screen
  //   ground   when the box reaches the ground (b >= -2), keep the ground line where it normally sits
  //            and make room above it, instead of centring the box
  //   clampX   [l, r] limits for cam.x
  // A scene that never calls these keeps its camera exactly as before. While a shot is held or a track
  // runs, Street's own follow camera stands aside; camTo() takes the camera back (and ends both).
  freeRect() { return this.view.freeRect(); }
  _box(b) {
    if (typeof b === 'function') b = b();
    if (!b) return null;
    return b.l !== undefined ? b : { l: b.x - b.w / 2, r: b.x + b.w / 2, t: b.y - b.h / 2, b: b.y + b.h / 2 };
  }
  // the camera {x, y, zoom} that shows the box as large as possible, centred in the free rect
  shotFor(box, o, zoom) {
    o = o || {};
    const v = this.view, F = v.freeRect(), B = this._box(box), pad = o.pad === undefined ? 30 : o.pad;
    if (!B) return { x: this.cam.x, y: this.cam.y, zoom: this.cam.zoom };
    const l = Math.min(B.l, B.r) - pad, r = Math.max(B.l, B.r) + pad, t = Math.min(B.t, B.b) - pad, bb = Math.max(B.t, B.b) + pad;
    const fw = Math.max(1, F.r - F.l), fh = Math.max(1, F.b - F.t), ground = !!o.ground && Math.max(B.t, B.b) >= -2;
    let z = zoom;
    if (z === undefined) {
      z = ground ? Math.min(fw / (r - l), (v.oy - F.t) / Math.max(1, -t)) / v.fit : Math.min(fw / (r - l), fh / (bb - t)) / v.fit;
      z = clamp(z, o.min === undefined ? 0.7 : o.min, v.closeMax(o.max === undefined ? ZOOM_MAX : o.max, o));
    }
    const s = v.fit * z;
    let x = (l + r) / 2 - ((F.l + F.r) / 2 - v.ox) / s;
    const y = ground ? 0 : (t + bb) / 2 - ((F.t + F.b) / 2 - v.oy) / s;
    if (o.clampX) x = clamp(x, o.clampX[0], o.clampX[1]);
    return { x, y, zoom: z };
  }
  // camera ↔ the world point at the centre of the free rect (moves interpolate that point and log zoom,
  // so whatever is being framed slides calmly into place instead of swinging about the screen centre)
  _fc(c) { const v = this.view, F = v.freeRect(), s = v.fit * c.zoom; return { x: c.x + ((F.l + F.r) / 2 - v.ox) / s, y: c.y + ((F.t + F.b) / 2 - v.oy) / s }; }
  _place(fc, z) { const v = this.view, F = v.freeRect(), s = v.fit * z; this.cam.zoom = z; this.cam.x = fc.x - ((F.l + F.r) / 2 - v.ox) / s; this.cam.y = fc.y - ((F.t + F.b) / 2 - v.oy) / s; }
  // Ease the camera to a box (awaitable, on the scene clock). The box may be a function (re-read every
  // frame of the move). The shot is then held: re-framed when the window is resized or the phone turned.
  // Reduced motion: a short ease. shot(null) lets go of a held shot (the camera stays where it is).
  shot(box, dur, o) {
    this._track = null;
    const id = ++this._shotId;
    if (!box) { this._held = null; return Promise.resolve(); }
    o = o || {};
    this._held = { box, o, key: null };
    dur = dur === undefined ? 1.6 : dur;
    if (this.reduced) dur = Math.min(dur, 0.4);
    const v = this.view, fn = o.ease || ease.inOutSine;
    let el = 0, z0, f0;
    return this._task((dt) => {
      if (id !== this._shotId) return true;
      if (z0 === undefined) { z0 = this.cam.zoom; f0 = this._fc(this.cam); }
      el += dt;
      const u = dur <= 0 ? 1 : clamp01(el / dur), e = fn(u), to = this.shotFor(box, o), f1 = this._fc(to);
      this._place({ x: lerp(f0.x, f1.x, e), y: lerp(f0.y, f1.y, e) }, Math.exp(lerp(Math.log(z0), Math.log(to.zoom), e)));
      if (u >= 1) { this._held.key = v.W + 'x' + v.H + ':' + v.fit; return true; }
      return false;
    });
  }
  // Back to the scene's ordinary framing (zoom 1, ground line in its place) around world x (default:
  // where the camera looks now); the held shot / track ends, Street's follow takes over again.
  async wide(x, dur) {
    this._track = null; this._held = null;
    const id = ++this._shotId;
    dur = dur === undefined ? 1.6 : dur;
    if (this.reduced) dur = Math.min(dur, 0.4);
    const to = { x: x === undefined || x === null ? this.cam.x : x, y: 0, zoom: 1 };
    let el = 0, z0, f0;
    this._widening = true;                               // (Street's follow waits until the move is over)
    await this._task((dt) => {
      if (id !== this._shotId) { this._widening = false; return true; }
      if (z0 === undefined) { z0 = this.cam.zoom; f0 = this._fc(this.cam); }
      el += dt;
      const u = dur <= 0 ? 1 : clamp01(el / dur), e = ease.inOutSine(u), f1 = this._fc(to);
      this._place({ x: lerp(f0.x, f1.x, e), y: lerp(f0.y, f1.y, e) }, Math.exp(lerp(Math.log(z0), 0, e)));
      return u >= 1;
    });
    if (id === this._shotId) { this.cam.x = to.x; this.cam.y = 0; this.cam.zoom = 1; this._widening = false; }
  }
  // Follow a moving box every frame: fn() → box (or null: hold still). The zoom has a dead zone — it
  // widens as soon as the box no longer fits (with a little room to spare) but closes in again only when
  // it could come 14% closer — so the picture does not breathe; position and zoom are damped.
  // o: shotFor options + rate (position, default 2.2), zoomIn (default 0.9), zoomOut (default 2.4), dead (0.14).
  // track(null) stops (the camera stays where it is).
  track(fn, o) {
    this._held = null; this._shotId++;
    this._track = fn ? { fn, o: o || {}, zT: null } : null;
  }
  get directing() { return !!(this._track || this._held || this._widening); }
  _camStep(dt) {
    const v = this.view;
    if (this._held && this._held.key) {                  // a held shot: re-framed after a resize / rotation
      const key = v.W + 'x' + v.H + ':' + v.fit;
      if (key !== this._held.key) { const c = this.shotFor(this._held.box, this._held.o); this.cam.x = c.x; this.cam.y = c.y; this.cam.zoom = c.zoom; this._held.key = key; }
      return;
    }
    const k = this._track;
    if (!k || dt <= 0) return;
    const B = this._box(k.fn());
    if (!B) return;
    const o = k.o, g = this.shotFor(B, o), dead = o.dead === undefined ? 0.14 : o.dead, quick = this.reduced ? 3 : 1;
    if (k.zT === null) k.zT = g.zoom;
    else if (g.zoom < k.zT) k.zT = g.zoom * 0.97;         // doesn't fit: widen (with room to spare)
    else if (g.zoom > k.zT * (1 + dead)) k.zT = g.zoom;   // could be much closer: close in
    k.zT = clamp(k.zT, o.min === undefined ? 0.7 : o.min, this.view.closeMax(o.max === undefined ? ZOOM_MAX : o.max, o));
    const lz = Math.log(this.cam.zoom), lt = Math.log(k.zT), out = lt < lz;
    // (where shots come closer than nominal — view.closeK — the picture is that much narrower in the world and
    // has further to back out: widen and re-centre that much quicker, so whatever is to be touched next is
    // not left outside meanwhile; closing in stays as calm as anywhere)
    const ck = this.view.closeK;
    let z = Math.exp(approach(lz, lt, (out ? (o.zoomOut || 2.4) * ck : (o.zoomIn || 0.9)) * quick, dt));
    if (Math.abs(Math.log(z) - lt) < 0.002) z = k.zT;     // (settle exactly: the cached layers repaint sharp once)
    const c = this.shotFor(B, o, z), rate = (o.rate || 2.2) * quick * ck;
    this.cam.zoom = z;
    this.cam.x = approach(this.cam.x, c.x, rate, dt);
    this.cam.y = approach(this.cam.y, c.y, rate, dt);
  }

  // ── small shared effects ──
  sparkle(x, y, n, color) { this.fx.burst('spark', x, y, n || 8, { speed: 90, life: 0.8, size: 5, colors: color ? [color] : ['#fff7c0', '#ffe36e', '#ffffff'], drag: 2.5 }); }
  leaves(x, y, n, colors) { this.fx.burst('leaf', x, y, n || 7, { speed: 110, a0: -Math.PI, a1: 0, life: 1.3, size: 5, colors: colors || ['#5ab04a', '#8fd05a', '#2f8a3f'], grav: 260, drag: 1.8, sway: 20 }); }
  hearts(x, y, n) { this.fx.burst('heart', x, y, n || 3, { speed: 40, a0: -Math.PI * 0.8, a1: -Math.PI * 0.2, life: 1.5, size: 5, colors: ['#f08aa0', '#f6b0c0'], grav: -30, drag: 1, vr: 0 }); }
  notes(x, y, n, color) { this.fx.burst('note', x, y, n || 1, { speed: 34, a0: -Math.PI * 0.75, a1: -Math.PI * 0.25, life: 1.7, size: 9, color: color || '#fff3b0', grav: -22, drag: 0.6, vr: 0, sway: 14 }); }
  zzz(x, y) { this.fx.add({ kind: 'z', x, y, vx: 8, vy: -16, life: 2.2, size: 7, color: '#dfe6ff', grow: 3, sway: 8 }); }
}

export { INK, PAL };
