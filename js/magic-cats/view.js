// Magic cats — canvas sizing and camera.
//
// World units: x → right, y → down, the ground line is y = 0 (sky is negative y).
// A "safe box" (safeW wide, safeAbove tall above the ground) is always visible clear of the
// caption strip on every screen shape; scenes paint beyond it as bleed (more sky on tall
// phones, more street on wide screens). Use view.left/right/top/bottom for the bleed.
//
// Where the caption goes depends on the shape of the screen: on wide screens it lies along
// the bottom like a subtitle; on upright ones (phones, tablets held tall) it sits at the top,
// under the bar — the sky has room for it — and the scene comes down to the thumbs.
// view.free is the world y where the uncovered part of the screen begins: hang the moon,
// the clouds and anything else that belongs "at the top" from there, not from view.top.

import { clamp } from './util.js';
import { setSpriteRes, SPR } from './paint.js';

// The closest scenes will frame things (Scene.shotFor's default max zoom): sprites are painted for it.
export const ZOOM_MAX = 1.8;

export class View {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = 0; this.H = 0; this.dpr = 1;
    this.cam = { x: 0, y: 0, zoom: 1 };
    this.maxPx = 5.2e6;                 // canvas pixel budget; main.js lowers it if the device can't keep up
    this.resetSafe();
    this.hud = 46; this.paper = 150; this.safeBottom = 0;
    this.topInset = 46;                 // px covered at the top (the bar, and the caption when it is up there)
    this.captionInset = 150;            // px kept free at the bottom (the caption, or just the hint line)
    this.captionTop = false;
    this.fit = 1; this.scale = 1; this.ox = 0; this.oy = 0;
    this.left = 0; this.right = 0; this.top = 0; this.bottom = 0; this.free = 0;
    this.portrait = false;
  }
  // plain: a scene without narration (the title) — nothing is kept free for a caption at the top
  resetSafe() { this.safeW = 640; this.safeAbove = 460; this.groundPad = 40; this.plain = false; }
  resize() {
    const W = this.canvas.clientWidth || window.innerWidth, H = this.canvas.clientHeight || window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (W * H * dpr * dpr > this.maxPx) dpr = Math.sqrt(this.maxPx / (W * H));
    this.W = W; this.H = H; this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);
    this.portrait = H > W * 1.05;
    this.paper = this.portrait ? clamp(H * 0.23, 150, 230) : clamp(H * 0.21, 92, 170);   // room for the longest caption
    this.hud = H < 480 ? 38 : 46;
    const probe = document.getElementById('mcp-safe');
    this.safeBottom = probe ? probe.offsetHeight || 0 : 0;
    this._hintKey = null;
    this.update();
    // Props are cached as sprites (paint.js): paint them at the pixel density the screen will really show
    // at the closest framing (dpr × fit × ZOOM_MAX, the fit taken for the standard safe box), never below
    // today's 2 px per unit, at most 4 (3 on touch screens: tablets, whose browsers cap canvas memory).
    // Small screens (phones) keep 2: they never get close enough for it to show, and they have the least memory.
    const fitStd = Math.min(W / (this.portrait ? 540 : 640), (H - this.captionInset - this.topInset) / 500);
    const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const want = Math.min(W, H) < 600 ? 2 : clamp(Math.round(dpr * fitStd * ZOOM_MAX * 2) / 2, 2, coarse ? 3 : 4);
    setSpriteRes(want);
  }
  // Where the hint pill sits when the caption is at the bottom: under the bar, in the middle of the top
  // edge (measured once per screen shape; it is display:none while empty, so the box is computed).
  hintLine() {
    const key = this.W + 'x' + this.H + (this.captionTop ? 't' : 'b');
    if (this._hintKey === key) return this._hint;
    const el = typeof document !== 'undefined' && document.getElementById('mcp-hint');
    if (el && !this.captionTop && el.closest('.mcp-captop')) return 0;      // (the stage's class is about to follow the screen shape)
    this._hintKey = key; this._hint = 0;
    if (el && !this.captionTop) {
      const cs = getComputedStyle(el), top = parseFloat(cs.top), fs = parseFloat(cs.fontSize) || 16;
      if (isFinite(top) && top < this.H / 2) this._hint = top + fs * 1.2 + (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0) + 2;
    }
    return this._hint;
  }
  // The part of the screen (css px) nothing covers: below the bar, a top caption and the hint pill,
  // above a bottom caption or the hint line. {l, t, r, b}
  freeRect() {
    const t = this.captionTop ? this.topInset : Math.max(this.topInset, this.hintLine());
    return { l: 0, t, r: this.W, b: this.H - this.captionInset };
  }
  update() {
    this.captionTop = this.portrait && !this.plain;
    this.topInset = this.hud + (this.captionTop ? this.paper + 6 : 0);
    this.captionInset = this.captionTop ? 60 + this.safeBottom : this.paper;
    const fitW = this.W / (this.portrait ? Math.min(this.safeW, 540) : this.safeW);
    const fitH = (this.H - this.captionInset - this.topInset) / (this.safeAbove + this.groundPad);
    this.fit = Math.max(0.05, Math.min(fitW, fitH));
    this.scale = this.fit * this.cam.zoom;
    this.ox = this.W / 2;
    this.oy = this.H - this.captionInset - this.groundPad * this.fit;
    this.left = this.cam.x - this.ox / this.scale;
    this.right = this.cam.x + (this.W - this.ox) / this.scale;
    this.top = this.cam.y - this.oy / this.scale;
    this.bottom = this.cam.y + (this.H - this.oy) / this.scale;
    this.free = this.top + this.topInset / this.scale;
    // Short landscape screens (phones held sideways) show everything small: there a close shot may come
    // proportionally closer than the max a scene tuned on a desk (see closeMax). Exactly 1 elsewhere.
    this.closeK = !this.portrait && this.H < 520 ? clamp(0.8 / this.fit, 1, 1.6) : 1;
  }
  // The zoom limit a shot really gets: nominal max × closeK, but no closer than cached sprites allow
  // (upscaled by at most 25 % at the sprite resolution) and never above 2.4 — and never below the
  // nominal max. Deliberate wide shots (max ≤ 1.2) and fixed zooms are left alone, as is o.exact.
  closeMax(max, o) {
    if (this.closeK === 1 || max <= 1.2 || (o && (o.exact || (o.min !== undefined && o.min >= max)))) return max;
    const cap = Math.min(2.4, (1.25 * SPR) / (this.dpr * this.fit));
    return Math.max(max, Math.min(max * this.closeK, cap));
  }
  get width() { return this.right - this.left; }
  get height() { return this.bottom - this.top; }
  sx(x) { return this.ox + (x - this.cam.x) * this.scale; }
  sy(y) { return this.oy + (y - this.cam.y) * this.scale; }
  toWorld(sx, sy) { return { x: this.cam.x + (sx - this.ox) / this.scale, y: this.cam.y + (sy - this.oy) / this.scale }; }
  // world transform
  apply(ctx) {
    const k = this.dpr * this.scale;
    (ctx || this.ctx).setTransform(k, 0, 0, k, this.dpr * (this.ox - this.cam.x * this.scale), this.dpr * (this.oy - this.cam.y * this.scale));
  }
  // screen (css px) transform
  screen(ctx) { (ctx || this.ctx).setTransform(this.dpr, 0, 0, this.dpr, 0, 0); }
  visible(x, pad) { return x > this.left - (pad || 0) && x < this.right + (pad || 0); }
}
