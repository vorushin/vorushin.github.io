// Magic cats — the character lab: dev scenes that show a character large and clear, alone on a
// plain ground, so poses and motion can be judged (and captured: book_cats/tools/lab.js).
// Reached only by URL:  /books/magic-cats/play?scene=lab            index of every lab scene
//                       /books/magic-cats/play?scene=lab-cat&card=poses
// Params: card=<name>   bg=plain|day|night|dusk   z=<extra zoom>   grid=1 (10-unit grid, origin)
//         only=<a,b>    sheets: just the cells whose label contains one of these words
//         live=1        sheets keep moving (default: frozen once settled)    loop=0  clips play once
//         seed=<n>      Math.random is seeded (here only) so two captures are identical
//         …and whatever a card reads itself with L.param('kind', 'papa').
//
// A lab scene:   export default class extends Lab { static cards() { return { name: card, … }; } }
// cards() is static and must not keep state: every bit of setup goes through the L argument.
//
// SHEET — a grid of labelled cells, each a still (frozen after `settle` seconds of updates):
//   sheet({ box: [x0, y0, x1, y1], scale: 2.4, cols, settle: 1 }, [
//     { label: 'sit', setup: (L) => { const c = L.add(new Cat()); c.mode = 'sit'; return c; } },
//     { label: 'tiny', px: 1.4, box: […], props: [{ kind: 'ledge' }], settle: 0, setup… }
//   ])
//   box: the world box of a cell, feet at (0, 0), y up is negative; scale: CSS px per world unit;
//   px: device px per unit for that cell instead (on-screen size on some device); props: see drawProp.
//   setup(L, cell) may also step its actors on its own: L.advance(actor, secs).
// CLIP — a deterministic scripted action from t = 0 on the scene clock:
//   clip({ box: [x0, y0, x1, y1], film: { frames: 24, dt: 50, cols: 6 } }, async (L) => {
//     const c = L.add(new Cat()); L.follow(c);              // camera keeps c at x = 0 of the box
//     L.prop({ kind: 'block', x: 150, w: 70, h: 120 });
//     await L.tween(c, { x: 300 }, 3); await L.wait(0.5);   // Scene helpers: wait, tween, until, spawn
//   })
//   film: what the capture tool uses when frames / dt / cols are not given.
// L.add(obj, { update(dt, t), draw(ctx, t), z }) — default: obj.update(dt, t) / obj.draw(ctx, t).
// L.each((dt, t) => …) — a per-frame hook (clips). L.time — seconds since the card (re)started.
// window.__mc.lab = { scene, card, cards: {name: 'sheet'|'clip'}, box (CSS px), need, done, dur, film,
//                     restart(), redraw(), step(secs) } — for the capture tool.

import { Scene, ABORT } from '../scene.js';
import { TAU, rng, clamp } from '../util.js';
import { PAL, SKIES, ink } from '../paint.js';
import { drawSaucer } from '../props.js';

export const LAB_SCENES = ['lab-cat', 'lab-people', 'lab-birds'];

export function sheet(o, cells) { return Object.assign({ kind: 'sheet', cells }, o); }
export function clip(o, script) { return Object.assign({ kind: 'clip', script }, o); }

const BG = { plain: '#f4ead2', day: SKIES.day.bot, night: SKIES.night.mid, dusk: SKIES.dusk.mid };
const DARK = { night: true, dusk: true };
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const M = 16;                 // screen margin (CSS px)
const LBL = 24;               // label strip above a sheet cell

function rect(ctx, x, y, w, h, fill, lw) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.fillStyle = fill; ctx.fill(); ctx.lineJoin = 'round'; ink(ctx, lw); }

// Simple scenery to stand on (plain shapes: they are there to measure against, not to look at).
// Coordinates are world units in the cell / clip.
export function drawProp(ctx, p, t) {
  if (p.draw) { p.draw(ctx, t); return; }
  if (p.kind === 'block') {                        // a box to leap onto: top at y = -h
    rect(ctx, p.x, -p.h, p.w, p.h, p.color || '#c99a62', 2.4);
  } else if (p.kind === 'ledge') {                 // a window ledge (46 wide), the lit window above it
    const w = p.w || 46, y = p.y || 0, x = p.x || 0;
    if (p.window !== false) {
      const ww = w - 4, wh = p.wh || 50;
      rect(ctx, x - ww / 2, y - wh, ww, wh, p.lit === false ? PAL.winNight : PAL.winLit, 2.4);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - wh); ctx.moveTo(x - ww / 2, y - wh * 0.55); ctx.lineTo(x + ww / 2, y - wh * 0.55); ink(ctx, 2);
    }
    rect(ctx, x - w / 2 - 4, y, w + 8, 6, '#e9dcc0', 2.2);
  } else if (p.kind === 'saucer') {
    drawSaucer(ctx, p.x || 0, p.y || 0, p.fill === undefined ? 1 : p.fill, t, p.size || 1);
  } else if (p.kind === 'rope') {                  // a line to hang from / walk along: pts [[x, y], …]
    ctx.beginPath(); p.pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])));
    ctx.strokeStyle = p.color || '#8a5a2b'; ctx.lineWidth = p.width || 3; ctx.lineCap = 'round'; ctx.stroke();
  }
}

export class Lab extends Scene {
  static cards() { return {}; }

  constructor(game, index) {
    super(game, index);
    this.params = game.params;
    this.name = game.devScene || 'lab';
    this.view.plain = true;
    this._seed = Number(this.param('seed', 1)) || 1;
    this._random = Math.random;
    Math.random = rng(this._seed);
    this._maxPx = this.view.maxPx;
    this.view.maxPx = 4e7; this.view.resize();      // big sheets on tall captures keep their full resolution
    document.documentElement.classList.add('mcp-lab');
    this._style = document.createElement('style');
    this._style.textContent = '.mcp-lab .mcp-top,.mcp-lab .mcp-grain,.mcp-lab .mcp-auto,.mcp-lab .mcp-hint,.mcp-lab .mcp-caption,.mcp-lab .mcp-vignette{display:none!important}';
    document.head.appendChild(this._style);
    this.bgName = BG[this.param('bg')] ? this.param('bg') : 'plain';
    this.dark = !!DARK[this.bgName];
    this.z = Number(this.param('z', 1)) || 1;
    this.grid = this.param('grid') === '1';
    this.allCards = this.constructor.cards();
    this.cardName = this.param('card');
    this.card = this.allCards[this.cardName] || null;
    this.scrollY = 0; this._rows = [];
    this.api = {
      scene: this.name, card: this.card ? this.cardName : null, cards: {}, box: null, need: null, done: false, dur: 0,
      film: this.card && this.card.film || null, restart: () => this.restart(), redraw: () => game.tick(0),
      // advance the (manual) clock by secs in 1/60 s ticks, letting the card's script run between ticks
      // (its awaits resolve as microtasks: many ticks in one go would leave it behind)
      step: async (secs) => { const n = Math.max(1, Math.round(secs * 60)); for (let i = 0; i < n; i++) { game.tick(secs / n); await new Promise((r) => setTimeout(r, 0)); } }
    };
    for (const k in this.allCards) this.api.cards[k] = this.allCards[k].kind;
    if (window.__mc) window.__mc.lab = this.api;
    this.restart();
  }
  dispose() {
    Math.random = this._random;
    this.view.maxPx = this._maxPx; this.view.resize();
    document.documentElement.classList.remove('mcp-lab');
    if (this._style) this._style.remove();
    if (window.__mc && window.__mc.lab === this.api) delete window.__mc.lab;
  }
  param(k, d) { const v = this.params.get(k); return v === null ? d : v; }
  get time() { return this.lt; }

  // ── building a card ──
  add(obj, o) {
    o = o || {};
    const e = { obj, z: o.z || 0, update: o.update || ((dt, t) => { if (obj.update) obj.update(dt, t); }), draw: o.draw || ((ctx, t) => obj.draw(ctx, t)) };
    (this._cell ? this._cell.actors : this.actors).push(e);
    return obj;
  }
  prop(p) { (this._cell ? this._cell.props : this.props).push(p); return p; }
  each(fn) { this.hooks.push(fn); }
  follow(obj) { this._follow = obj; }
  // step one actor (added with L.add) on its own for `secs` (sheet setups: get a leap, an act… to a given moment)
  advance(obj, secs) {
    const list = this._cell ? this._cell.actors : this.actors, e = list.find((q) => q.obj === obj), n = Math.round(secs * 60);
    for (let i = 0; i < n; i++) { (e ? e.update : (dt, t) => obj.update(dt, t))(1 / 60, (this._cell ? this._cell.t : this.lt)); if (this._cell) this._cell.t += 1 / 60; }
  }

  // (Re)start the card from nothing: same seed, same actors, t = 0.
  restart() {
    Math.random = rng(this._seed);
    for (const k of this._tasks) if (!k.done) { k.done = true; k.reject(ABORT); }
    this._tasks = []; this.fx.clear();
    this.actors = []; this.props = []; this.hooks = []; this._follow = null; this.camX = 0;
    this.lt = 0; this.done = false; this.dur = 0; this.api.done = false; this.api.dur = 0;
    const token = this._token = (this._token || 0) + 1;
    const c = this.card;
    if (!c) return;
    if (c.kind === 'sheet') {
      const only = (this.param('only') || '').split(',').map((s) => s.trim()).filter(Boolean);
      this.cells = [];
      for (const def of c.cells) {
        if (only.length && !only.some((w) => def.label.indexOf(w) >= 0)) continue;
        const cell = { def, label: def.label, box: def.box || c.box || [-60, -100, 80, 12], actors: [], props: (def.props || []).slice(), t: 0 };
        this._cell = cell;
        try { if (def.setup) def.setup(this, cell); }
        catch (e) { console.error('lab: cell "' + def.label + '" failed', e); cell.error = String(e && e.message || e); }
        const settle = def.settle !== undefined ? def.settle : c.settle !== undefined ? c.settle : 1;
        for (let i = 0, n = Math.round(settle * 60); i < n; i++) { for (const e of cell.actors) e.update(1 / 60, cell.t); cell.t += 1 / 60; }
        this._cell = null;
        this.cells.push(cell);
      }
      this.done = this.api.done = true;
    } else {
      let p;
      try { p = c.script(this); } catch (e) { p = Promise.reject(e); }
      Promise.resolve(p).then(() => { if (token === this._token) { this.done = this.api.done = true; this.dur = this.api.dur = +this.lt.toFixed(3); } },
        (e) => { if (e !== ABORT) console.error('lab: clip failed', e); });
    }
  }

  async run() { await new Promise(() => {}); }        // a lab never ends by itself

  update(dt) {
    if (!this.card) return;
    this.lt += dt;
    if (this.card.kind === 'sheet') {
      if (this.param('live') === '1') for (const cell of this.cells) { for (const e of cell.actors) e.update(dt, cell.t); cell.t += dt; }
      return;
    }
    for (const h of this.hooks) h(dt, this.lt);
    for (const e of this.actors) e.update(dt, this.lt);
    if (this._follow) this.camX = this._follow.x;
    if (this.done && this.param('loop') !== '0' && !this.game.manual && this.lt > this.dur + 1.5) this.restart();
  }

  onUp(p) {
    if (!this.card) { for (const r of this._rows) if (p.sy >= r.y && p.sy < r.y + r.h && p.sx >= r.x && p.sx < r.x + r.w) { this.goTo(r.scene, r.card); return; } return; }
    if (this._drag && Math.abs(this._drag.moved) > 6) return;
    if (this.card.kind === 'clip') this.restart();
  }
  onDown(p) { this._drag = { y: p.sy, s: this.scrollY, moved: 0 }; }
  onMove(p) {
    if (!this._drag || !this.api.need) return;
    const d = p.sy - this._drag.y; this._drag.moved = d;
    this.scrollY = clamp(this._drag.s - d, 0, Math.max(0, this.api.need.h - this.view.H));
  }
  goTo(scene, card) {
    const q = new URLSearchParams(location.search);
    q.set('scene', scene); if (card) q.set('card', card); else q.delete('card');
    location.search = q.toString();
  }

  // ── drawing ──
  draw(ctx, view) {
    const dpr = view.dpr, W = view.W, H = view.H;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG[this.bgName]; ctx.fillRect(0, 0, W, H);
    if (!this.card) { this.drawIndex(ctx, view); return; }
    if (this.card.kind === 'sheet') this.drawSheet(ctx, view); else this.drawClip(ctx, view);
  }
  text(ctx, s, x, y, size, o) {
    o = o || {};
    ctx.font = (o.weight || 600) + ' ' + size + 'px ' + FONT;
    ctx.fillStyle = o.color || (this.dark ? 'rgba(255,255,255,0.92)' : 'rgba(29,21,48,0.88)');
    ctx.textAlign = o.align || 'left'; ctx.textBaseline = o.base || 'top';
    ctx.fillText(s, x, y);
  }
  // world → screen for one framed box: k = CSS px per unit, (sx, sy) = screen point of world (wx, wy)
  world(ctx, k, sx, sy, wx, wy) { const d = this.view.dpr; ctx.setTransform(d * k, 0, 0, d * k, d * (sx - wx * k), d * (sy - wy * k)); }
  drawGrid(ctx, x0, y0, x1, y1, k) {
    const c = this.dark ? '255,255,255' : '29,21,48';
    ctx.lineWidth = 1 / k;
    for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) { ctx.strokeStyle = 'rgba(' + c + ',' + (x % 50 ? 0.08 : 0.2) + ')'; ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1); ctx.stroke(); }
    for (let y = Math.ceil(y0 / 10) * 10; y <= y1; y += 10) { ctx.strokeStyle = 'rgba(' + c + ',' + (y % 50 ? 0.08 : 0.2) + ')'; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,40,60,0.7)'; ctx.lineWidth = 2 / k;
    ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.moveTo(0, -6); ctx.lineTo(0, 6); ctx.stroke();
  }
  // the ground: a line at y = 0 with a faint band below and ticks every 10 units (they slide past a followed actor)
  drawGround(ctx, x0, x1, y1, k, ticks) {
    ctx.fillStyle = this.dark ? 'rgba(0,0,0,0.18)' : 'rgba(120,90,50,0.10)';
    ctx.fillRect(x0, 0, x1 - x0, Math.max(0, y1));
    ctx.strokeStyle = this.dark ? 'rgba(255,255,255,0.55)' : 'rgba(29,21,48,0.55)';
    ctx.lineWidth = 1.6 / k; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x1, 0); ctx.stroke();
    if (ticks) {
      ctx.lineWidth = 1.2 / k; ctx.beginPath();
      for (let x = Math.ceil(x0 / 10) * 10; x <= x1; x += 10) { ctx.moveTo(x, 0); ctx.lineTo(x, x % 50 ? 3 : 6); }
      ctx.stroke();
    }
  }
  drawActors(ctx, list, t) {
    const s = list.slice().sort((a, b) => a.z - b.z);
    for (const e of s) { ctx.save(); try { e.draw(ctx, t); } catch (err) { if (!this._err) { this._err = true; console.error(err); } } ctx.restore(); }
  }

  drawSheet(ctx, view) {
    const W = view.W, c = this.card, dpr = view.dpr, cols = c.cols || 99;
    // flow layout: cells left to right, wrapping at the screen edge (or after `cols`)
    let x = M, y = M + 28 - this.scrollY, rowH = 0, n = 0;     // n: cells in the current row
    const placed = [];
    for (const cell of this.cells) {
      const k = (cell.def.px ? cell.def.px / dpr : (cell.def.scale || c.scale || 2.4)) * this.z, b = cell.box;
      const w = Math.ceil((b[2] - b[0]) * k), h = Math.ceil((b[3] - b[1]) * k) + LBL;
      if (n > 0 && (x + w > W - M || n >= cols)) { x = M; y += rowH + 10; rowH = 0; n = 0; }
      placed.push({ cell, k, x, y, w, h });
      x += w + 10; rowH = Math.max(rowH, h); n++;
    }
    const total = y + rowH + M + this.scrollY;
    this.api.need = { w: W, h: Math.ceil(total) };
    this.api.box = { x: 0, y: 0, width: W, height: Math.ceil(total) };
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.text(ctx, this.name + ' · ' + this.cardName + this.paramNote(), M, M - this.scrollY, 17, { weight: 700 });
    for (const q of placed) {
      const { cell, k, x: cx, y: cy, w, h } = q, b = cell.box;
      if (cy > view.H || cy + h < 0) continue;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = this.dark ? 'rgba(255,255,255,0.14)' : 'rgba(29,21,48,0.14)'; ctx.lineWidth = 1;
      ctx.strokeRect(cx + 0.5, cy + 0.5, w - 1, h - 1);
      ctx.save(); ctx.beginPath(); ctx.rect(cx, cy, w, LBL); ctx.clip();
      this.text(ctx, cell.label, cx + 6, cy + 5, 14);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(cx, cy + LBL, w, h - LBL); ctx.clip();
      this.world(ctx, k, cx, cy + LBL, b[0], b[1]);
      if (this.grid) this.drawGrid(ctx, b[0], b[1], b[2], b[3], k);
      if (cell.def.ground !== false) this.drawGround(ctx, b[0], b[2], b[3], k, false);
      for (const p of cell.props) drawProp(ctx, p, cell.t);
      this.drawActors(ctx, cell.actors, cell.t);
      ctx.restore();
      if (cell.error) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.text(ctx, 'error: ' + cell.error, cx + 6, cy + h - 20, 12, { color: '#d02040' }); }
    }
  }
  paramNote() {
    const skip = { scene: 1, card: 1, lang: 1, loop: 1 }, out = [];
    this.params.forEach((v, k) => { if (!skip[k]) out.push(k + '=' + v); });
    return out.length ? '   ' + out.join(' ') : '';
  }

  drawClip(ctx, view) {
    const W = view.W, H = view.H, c = this.card, dpr = view.dpr, b = c.box;
    const bw = b[2] - b[0], bh = b[3] - b[1], top = M + 26;
    const k = Math.min((W - 2 * M) / bw, (H - top - M) / bh) * this.z;
    const w = bw * k, h = bh * k, bx = Math.round((W - w) / 2), by = Math.round(top + (H - top - M - h) / 2);
    this.api.box = { x: Math.max(0, bx), y: Math.max(0, by), width: Math.min(W, Math.round(w)), height: Math.min(H, Math.round(h)) };
    this.api.need = null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.text(ctx, this.name + ' · ' + this.cardName + this.paramNote(), M, M, 17, { weight: 700 });
    ctx.save();
    ctx.beginPath(); ctx.rect(bx, by, w, h); ctx.clip();
    const x0 = this.camX + b[0], x1 = this.camX + b[2];
    this.world(ctx, k, bx, by, x0, b[1]);
    if (this.grid) this.drawGrid(ctx, x0, b[1], x1, b[3], k);
    this.drawGround(ctx, x0, x1, b[3], k, true);
    for (const p of this.props) drawProp(ctx, p, this.lt);
    this.drawActors(ctx, this.actors, this.lt);
    this.fx.draw(ctx, this.lt);
    ctx.restore();
    // the clock, inside the box so that it is on every frame of a filmstrip
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = this.dark ? 'rgba(255,255,255,0.2)' : 'rgba(29,21,48,0.2)'; ctx.lineWidth = 1; ctx.strokeRect(bx + 0.5, by + 0.5, w - 1, h - 1);
    const fs = Math.max(12, Math.round(h * 0.085));
    this.text(ctx, this.lt.toFixed(2) + ' s' + (this.done ? '  ■' : ''), bx + w - 8, by + 6, fs, { align: 'right', base: 'top', weight: 600 });
  }

  // no card (or an unknown one): the list of this scene's cards
  drawIndex(ctx, view) {
    this._rows = [];
    let y = M;
    this.text(ctx, 'magic cats · character lab', M, y, 24, { weight: 700 }); y += 40;
    if (this.cardName) { this.text(ctx, 'no card "' + this.cardName + '" here', M, y, 15, { color: '#d02040' }); y += 26; }
    const groups = this.groups ? this.groups : [{ scene: this.name, cards: this.allCards }];
    if (!groups.length) this.text(ctx, 'loading…', M, y, 15);
    for (const g of groups) {
      this.text(ctx, g.scene, M, y, 19, { weight: 700 }); y += 28;
      let x = M + 12;
      for (const name in g.cards) {
        const label = name + (g.cards[name].kind === 'sheet' ? ' ▦' : ' ▶');
        ctx.font = '500 16px ' + FONT;
        const w = ctx.measureText(label).width + 18;
        if (x + w > view.W - M) { x = M + 12; y += 30; }
        ctx.fillStyle = this.dark ? 'rgba(255,255,255,0.1)' : 'rgba(29,21,48,0.07)'; ctx.fillRect(x, y, w, 26);
        this.text(ctx, label, x + 9, y + 5, 16, { weight: 500 });
        this._rows.push({ x, y, w, h: 26, scene: g.scene, card: name });
        x += w + 8;
      }
      y += 44;
    }
    this.text(ctx, 'params: bg=plain|day|night|dusk  z=<zoom>  grid=1  only=<words>  live=1  loop=0  seed=<n>', M, y, 13, { weight: 400 });
  }
}

// ?scene=lab — the index of every lab scene and its cards
export default class LabIndex extends Lab {
  constructor(game, index) {
    super(game, index);
    this.groups = [];
    Promise.all(LAB_SCENES.map((n) => import('./' + n + '.js').then((m) => ({ scene: n, cards: m.default.cards() })).catch((e) => ({ scene: n + ' (failed: ' + e.message + ')', cards: {} }))))
      .then((list) => { this.groups = list; });
  }
}
