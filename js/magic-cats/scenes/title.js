// Title: the book's cover, alive. A toy more than a scene — pet the cats, switch the windows on and off.
import { Street } from '../street.js';
import { Cat, Kid } from '../actors.js';
import { drawBench, drawBush, drawLadder, drawSmoke } from '../props.js';
import { dist, clamp } from '../util.js';
import { glow } from '../paint.js';

export default class Title extends Street {
  constructor(game, index) {
    super(game, index);
    game.dom.title.hidden = false;
    this.view.plain = true;                  // no narration here: the title itself has the sky
    this.far = 0.4; this.follow = false;
    this.big = this.addTree({ x: -300, h: 205, r: 88, kind: 'big', hollow: true, seed: 11, lean: 0.03, trunk: '#b9963f' });
    this.blue = this.addHouse({ x: -128, w: 200, h: 226, style: 'blue', seed: 22, windows: [
      { dx: -8, dy: -160, w: 56, h: 50, kind: 'square', lit: 1, kid: new Kid({ kind: 'pigtails', mood: 'wave' }) },
      { dx: -44, dy: -62, w: 40, h: 44, dark: '#27306e' }, { dx: 44, dy: -62, w: 40, h: 44, dark: '#27306e' }] });
    this.pink = this.addHouse({ x: 128, w: 170, h: 318, style: 'pink', seed: 21, chimney: true, windows: [
      { dx: -38, dy: -262 }, { dx: 40, dy: -262 }, { dx: -38, dy: -176 }, { dx: 40, dy: -176 }, { dx: -38, dy: -88 }, { dx: 40, dy: -88 },
      { dx: -6, dy: -338, w: 30, h: 30, kind: 'round' }] });
    // Nine windows, nine tales: each one lights up for good once its scene has been played.
    const bw = this.blue.windows, pw = this.pink.windows;
    this.slots = [bw[1], bw[2], pw[4], pw[5], pw[2], pw[3], pw[0], pw[1], pw[6]].map((w, i) => ({ w, h: i < 2 ? this.blue : this.pink, scene: i + 1 }));
    this.t2 = this.addTree({ x: -12, h: 150, r: 56, kind: 'round', seed: 12, trunk: '#c9763a' });
    this.t3 = this.addTree({ x: 236, h: 172, r: 56, kind: 'apple', seed: 13, trunk: '#c9a23f' });
    this.papa = this.addCat(new Cat({ kind: 'papa' })); this.papa.carry = 1; this.papa.mode = 'sit';
    this.kit = this.addCat(new Cat({ kind: 'kitten', dir: -1 }));
    this.kitAt = this.t2; this.kitIn = 4;
    this.girl = this.blue.windows[0].kid;
    // acting: where a finger / the mouse was last (looked at for a little while), who looks at whom
    this.pt = { x: 0, y: 0 }; this.ptT = 0; this._ptx = null; this._pty = null;
    this.papaEye = null; this.papaEyeT = 0; this.kitEye = null; this.kitEyeT = 0;
    this.girlWave = 0; this.girlAt = null;
    this._kh = { x: 0, y: 0 }; this._ph = { x: 0, y: 0 }; this._kl = { x: 0, y: 0 };
    this.papaBusy = false;
    // the tree the player dreamed up at the end of the story has taken root in town
    // (its painting code belongs to the last scene and is fetched only when there is a tree to show)
    this.dream = null;
    const saved = game.save.tree;
    if (saved && saved.pts) import('./garden-tree.js').then((m) => { if (!this.dead) this.dream = new m.DreamTree(saved); }).catch(() => {});
    this.dreamAt = { x: 0, y: 0, s: 0.6 }; this.dreamPulse = 0;
    this.audio.play('title'); this.audio.ambience('night');
  }
  async run() {
    this.spawn(() => this.papaLife());
    this.spawn(() => this.girlLife());
    await this.until(() => false);
  }
  // Papa keeps the night watch on his tree: he sits, looks about, glances over at the kitten; now and
  // then he puts his bundle down beside him for a good yawn, and picks it up again. (Not at first —
  // the cover shows him with his bundle — and not under reduced motion.)
  async papaLife() {
    await this.wait(13 + Math.random() * 5);
    for (;;) {
      if (!this.reduced && !this.papaBusy) await this.restBundle();
      await this.wait(20 + Math.random() * 16);
    }
  }
  async restBundle() {
    const p = this.papa, s = p.bundleSize * p.d.H * p.size, spot = { x: p.x + 19 * p.dir, y: p.y + 1 };
    this.papaBusy = true; p.wake(); p.fidget = false;     // (his own idle business waits: one yawn, not two)
    await this.tween(p, { headDown: 1 }, 0.5);
    const m = p.anchor('mouth'), b = { x: m.x, y: m.y + 13 * s, rot: 0, size: s, glow: 0.2 };
    p.carry = 0; this.loose.push(b);
    this.audio.sfx.paper();
    this.spawn(() => this.tween(b, { x: spot.x, y: spot.y, rot: 0.12 }, 0.3));
    await this.wait(0.25);
    await this.tween(p, { headDown: 0 }, 0.55);
    await this.wait(0.8);
    p.act('yawn'); this.audio.sfx.yawn(false, -0.4);
    await this.wait(2.2);
    if (Math.random() < 0.5) { p.act('lick'); await this.wait(2.6); }
    await this.wait(1.5 + Math.random() * 2);
    p.act('look');
    await this.wait(2.5 + Math.random() * 4);
    p.wake();
    await this.tween(p, { headDown: 1 }, 0.5);
    await this.tween(b, { x: p.anchor('mouth').x, y: p.anchor('mouth').y + 13 * s, rot: 0 }, 0.22);
    const i = this.loose.indexOf(b); if (i >= 0) this.loose.splice(i, 1);
    p.carry = 1;
    await this.tween(p, { headDown: 0 }, 0.55);
    p.fidget = true; this.papaBusy = false;
  }
  // The girl at the window waits for her tale: she watches the cats (the street turns her head to the
  // nearest one), waves at whoever is closest now and then, claps when the kitten lands by her window.
  async girlLife() {
    await this.wait(2.5);
    for (;;) {
      await this.wait(9 + Math.random() * 8);
      if (this.girlWave <= 0 && this.ptT <= 0) this.girlWave = 2.4;
      if (Math.random() < 0.3) { await this.wait(3); if (this.ptT <= 0 && !this.girl.acting) this.girl.act(Math.random() < 0.5 ? 'yawn' : 'rubEyes'); }
    }
  }
  tick(dt) {
    const v = this.view;
    // upright screens step back a little, so the whole street — and Papa on his tree — is in the picture
    this.cam.zoom = v.portrait ? 0.8 : 1;
    this.cam.x = v.portrait ? -42 : -v.width * 0.2;
    this.moon.u = 0.52; this.moon.y = 108; this.moon.r = v.portrait ? 48 : 40;
    this.moon.at = v.portrait ? { x: 214, y: -384 } : null;       // …and the moon rises from behind the pink roof
    const sv = this.game.save;
    for (const k of this.slots) {
      const done = !!sv.done[k.scene], next = !done && k.scene === sv.reached;
      const goal = done ? 1 : next ? 0.3 + 0.22 * Math.sin(this.t * 2.6) : 0;
      k.w.lit += (goal - k.w.lit) * Math.min(1, dt * 5);
      k.w.rings += ((done ? 0.55 : 0) - k.w.rings) * Math.min(1, dt * 2);
    }
    const P = this.papa, K = this.kit;
    P.x = this.big.topX + 14; P.y = this.big.perchY;
    // a finger or the mouse: both cats look at it for a little while after it last moved
    const ptr = this._pointer;
    if (ptr && (ptr.x !== this._ptx || ptr.y !== this._pty)) { this._ptx = ptr.x; this._pty = ptr.y; this.pt.x = ptr.x; this.pt.y = ptr.y; this.ptT = 2.5; }
    else if (ptr) this.ptT = Math.max(this.ptT, 0.6);
    else if (this.ptT > 0) this.ptT -= dt;
    // the kitten cannot sit still: now and then it hops to the other tree and back
    // (a look at where it is going and a little wiggle first)
    if (!K.jump) {
      K.x = this.kitAt.topX; K.y = this.kitAt.perchY;
      this.kitIn -= dt;
      const to = this.kitAt === this.t2 ? this.t3 : this.t2;
      if (this.kitIn < 0.7 && !this.reduced && this.ptT <= 0) {
        this._kl.x = to.topX; this._kl.y = to.perchY - 10; this.kitEye = this._kl; this.kitEyeT = 0.3;
        K.dir = to.topX > K.x ? 1 : -1;
        K.crouch = Math.min(0.75, K.crouch + dt * 2.2);
      } else K.crouch = Math.max(0, K.crouch - dt * 6);
      if (this.kitIn < 0 && !this.reduced) {
        this.kitIn = 5 + Math.random() * 6;
        if (this.ptT > 0) this.kitIn = 2;                   // (not while somebody is playing with them)
        else {
          this.audio.sfx.hop(0.3);
          this.papaEye = K; this.papaEyeT = 1.4;            // Papa follows the hop with his eyes
          K.leapTo(to.topX, to.perchY, { height: 150, dur: 0.75, done: () => {
            this.kitAt = to; to.land(0.8); this.audio.sfx.land(0.3, true); this.leaves(to.topX, to.perchY, 5);
            if (to === this.t2) { this.girlWave = 2.2; if (Math.random() < 0.5) this.girl.act('clap'); }   // right by her window
          } });
        }
      }
    }
    // who looks at whom: the pointer first; Papa keeps an eye on the kitten, who looks back at him
    if (this.papaEyeT > 0) this.papaEyeT -= dt; else this.papaEye = null;
    if (this.kitEyeT > 0) this.kitEyeT -= dt; else this.kitEye = null;
    if (!this.papaEye && !this.papaBusy && Math.random() < dt / 9) { this.papaEye = K; this.papaEyeT = 2.6; if (Math.random() < 0.6) { this.kitEye = P; this.kitEyeT = 2.2; } }
    if (!this.kitEye && !K.jump && Math.random() < dt / 11) { this.kitEye = P; this.kitEyeT = 1.6; }
    const head = (c, o) => { const h = c.anchor('head'); o.x = h.x; o.y = h.y; return o; };
    P.look = this.ptT > 0 ? this.pt : this.papaEye === K ? head(K, this._kh) : null;
    K.look = this.ptT > 0 ? this.pt : this.kitEye === P ? head(P, this._ph) : this.kitEye;
    this.big.lookAt = this.ptT > 0 ? this.pt : K;
    // the girl: waves at a finger close to her window, else at whoever is closest (the street turns her head)
    const G = this.girl, gw = this.blue.win(this.blue.windows[0]);
    if (this.girlWave > 0) this.girlWave -= dt;
    if (this.ptT > 0) { G.look = this.pt; G.mood = dist(this.pt.x, this.pt.y, gw.x, gw.y) < 230 ? 'wave' : 'wait'; }
    else { G.look = this.girlAt && this.girlWave > 0 ? head(this.girlAt, this._gh || (this._gh = { x: 0, y: 0 })) : null; G.mood = this.girlWave > 0 ? 'wave' : 'wait'; if (this.girlWave <= 0) this.girlAt = null; }
    const da = this.dreamAt;
    if (this.dream) {
      // where there is room for it: beside the old tree on upright screens, under the title on big
      // ones, and at the right edge of the street where the title fills the whole left side
      const ext = this.dreamExt || (this.dreamExt = Math.max(60, ...this.dream.crowns.map((c) => Math.abs(c.x) + c.r)));
      if (v.portrait) { da.x = -285; da.y = 128; da.s = 0.46; }
      else if (v.H < 560) { da.s = clamp((v.right - 388) / (2 * ext + 10), 0.3, 0.56); da.x = Math.max(388 + ext * da.s, v.right - ext * da.s - 6); da.y = 40; }
      else {
        // …between the last line of the title block and the note at the bottom (measured now and then: the words differ by language)
        this.dreamIn = (this.dreamIn || 0) - dt;
        if (this.dreamIn <= 0) {
          this.dreamIn = 0.5;
          const q = (id) => { const el = document.getElementById(id); return el && !el.hidden ? el.getBoundingClientRect() : null; };
          const w = q('mcp-watch') || q('mcp-begin'), note = q('mcp-replay') || q('mcp-intro');
          if (w) this.dreamBox = { top: w.bottom + 10, bot: note ? note.top - 8 : v.H - 12, x: w.left + Math.max(210, v.W * 0.19) };
        }
        const b = this.dreamBox, hgt = this.dreamHgt || (this.dreamHgt = Math.max(120, ...this.dream.crowns.map((c) => c.r - c.y)));
        if (b) {
          const ty = v.toWorld(0, b.bot).y, ts = clamp((ty - v.toWorld(0, b.top).y) / hgt, 0.3, 0.56), tx = v.toWorld(b.x, 0).x;
          if (!this.dreamSet) { this.dreamSet = true; da.y = ty; da.s = ts; da.x = tx; }
          else { const k = Math.min(1, dt * 6); da.y += (ty - da.y) * k; da.s += (ts - da.s) * k; da.x += (tx - da.x) * k; }   // glides while the title settles or the words change
        }
      }
    }
    if (this.dreamPulse > 0) this.dreamPulse = Math.max(0, this.dreamPulse - dt * 1.2);
  }
  onDown(p) {
    const gw = this.blue.win(this.blue.windows[0]);
    this.pt.x = p.x; this.pt.y = p.y; this.ptT = 2.5;              // (a quick tap is looked at too)
    if (this.skyToy(p) || this.worldToy(p)) {                      // the girl in the window, the hollow's owl
      if (Math.abs(p.x - gw.x) < gw.w / 2 + 9 && Math.abs(p.y - gw.y) < gw.h / 2 + 9) this.girlWave = 2.2;
      return;
    }
    for (const c of [this.papa, this.kit]) {
      if (dist(p.x, p.y, c.x, c.y - 26 * c.size) < 44) { this.pet(c); return; }
    }
    for (const k of this.slots) {
      const g = k.h.win(k.w);
      if (Math.abs(p.x - g.x) < g.w / 2 + 9 && Math.abs(p.y - g.y) < g.h / 2 + 9) {
        if (k.scene <= this.game.save.reached) { this.sparkle(g.x, g.y, 8); this.audio.sfx.bell(); this.game.go(k.scene); }
        else { this.audio.sfx.mrrp(); this.papa.meow(0.22); this.papa.hopInPlace(6); }
        return;
      }
    }
    if (this.dream && dist(p.x, p.y, this.dreamAt.x, this.dreamAt.y - 110 * this.dreamAt.s) < 120 * this.dreamAt.s + 20) {
      this.dreamPulse = 1; this.audio.sfx.chime(4);
      this.fx.burst('spark', this.dreamAt.x, this.dreamAt.y - 150 * this.dreamAt.s, 12, { speed: 80, life: 1, size: 5, colors: ['#ffd35a', '#f6a9bd', '#ffffff'], spread: 60 });
      return;
    }
    if (p.y < -60) { this.audio.sfx.sparkle(); this.fx.burst('spark', p.x, p.y, 5, { speed: 50, life: 0.9, size: 5, colors: ['#fff7c0', '#ffffff'] }); }
  }
  // petted: a purring squint, the face turned to whoever is petting (Papa kneads, the kitten wriggles and mews)
  pet(c) {
    const kit = c === this.kit, id = (c._petId = (c._petId || 0) + 1);
    c.eyes = 'happy'; c.headTurn = 1; c.sq.v += 3;
    this.hearts(c.x, c.y - 56 * c.size, 3);
    if (kit) { c.meow(); this.audio.sfx.meow(true); if (!c.jump && !this.reduced) c.hopInPlace(7); this.kitIn = Math.max(this.kitIn, 3); }
    else { this.audio.sfx.purr(1.6); if (!this.reduced && !this.papaBusy) c.act('knead', { dur: 1.4 }); }
    this.girlWave = 2.2; this.girlAt = c;                          // the girl waves at the one being petted
    this.spawn(async () => { await this.wait(kit ? 1.1 : 1.6); if (c._petId === id) { c.eyes = 'open'; c.headTurn = null; } });
  }
  drawFront(ctx, view, t) {
    if (!this.dream) return;
    const d = this.dreamAt, k = 1 + this.dreamPulse * 0.05 * Math.sin(t * 30);
    ctx.save(); ctx.translate(d.x, d.y); ctx.scale(1, 0.24); glow(ctx, 0, 0, 150 * d.s, '#cfeaff', 0.3 + 0.3 * this.dreamPulse); ctx.restore();
    glow(ctx, d.x, d.y - 190 * d.s, 150 * d.s, '#cfeaff', 0.16 + 0.05 * Math.sin(t * 1.3) + 0.3 * this.dreamPulse);
    this.dream.draw(ctx, d.x, d.y, t, d.s * k);
  }
  drawMid(ctx, view, t) {
    drawBench(ctx, -215, 0);
    drawLadder(ctx, -196, 0, -232, -150);
    drawBush(ctx, 330, 0, 44, 8, '#e8505a');
    drawBush(ctx, -400, 0, 36, 9, '#f2c23a');
  }
}
