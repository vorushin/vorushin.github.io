// Scene 3 — The kitten. Wrap a tale in its little white sheet, coax the kitten out of the
// hollow, let it trot behind Papa and learn the window, share the carrying — and, when night
// has come and the kitten has grown, send it out to deliver the tales all by itself.
import { Street, Perch } from '../street.js';
import { Leap } from '../leap.js';
import { Cat, Kid, drawLooseBundle } from '../actors.js';
import { drawBush, drawBench } from '../props.js';
import { lerp, ease, clamp01, spring } from '../util.js';
import { PAL, ink, wobble, glow, starPath, crayonRings } from '../paint.js';

const T = {
  wrap: { en: 'Tap the sheet to wrap up the tale', de: 'Tippe aufs Laken und wickle das Märchen ein', ru: 'Нажимай на простынку — заверни сказку' },
  hollow: { en: 'Tap the hollow in the tree', de: 'Tippe auf das Astloch im Baum', ru: 'Нажми на дупло в дереве' },
  follow: { en: 'Touch the next treetop — the kitten follows', de: 'Tippe auf den nächsten Wipfel — das Kätzchen kommt nach', ru: 'Нажми на соседнюю верхушку — котёнок побежит следом' },
  window: { en: 'Carry the tale to the window', de: 'Bring das Märchen zum Fenster', ru: 'Отнеси сказку к окну' },
  again: { en: 'Once more!', de: 'Noch einmal!', ru: 'Ещё разок!' },
  onward: { en: 'Hop on — new tales are waiting', de: 'Weiter — neue Märchen warten schon', ru: 'Вперёд — там ждут новые сказки' },
  send: { en: 'Tap the kitten: the tiny window is its own', de: 'Tippe das Kätzchen an: das kleine Fenster gehört ihm', ru: 'Нажми на котёнка: маленькое окошко — его' },
  catch: { en: 'Catch the tale for the kitten', de: 'Fang das Märchen für das Kätzchen', ru: 'Поймай сказку для котёнка' },
  solo: { en: 'Now you are the kitten: deliver the tales', de: 'Jetzt bist du das Kätzchen: trag die Märchen aus', ru: 'Теперь ты котёнок: разнеси сказки' }
};

// The sheet in three states: lying flat, sides lifted, gathered into a pouch.
const SHEET = [
  [[-10, -7], [-26, 0], [-16, 5], [-5, 9], [5, 9], [16, 5], [26, 0], [10, -7]],
  [[-13, -19], [-20, -8], [-16, 4], [-5, 9], [5, 9], [16, 4], [20, -8], [13, -19]],
  [[-6, -25], [-15, -11], [-15, 3], [-7, 10], [7, 10], [15, 3], [15, -11], [6, -25]]
];

function drawTaleStar(ctx, x, y, r, t, a) {
  glow(ctx, x, y, r * 3.6, PAL.gold, 0.75 * (a === undefined ? 1 : a) * (0.85 + 0.15 * Math.sin(t * 5)));
  ctx.save();
  ctx.globalAlpha *= a === undefined ? 1 : a;
  starPath(ctx, x, y, r, Math.sin(t * 1.7) * 0.25);
  ctx.fillStyle = '#ffd95a'; ctx.fill(); ink(ctx, 1.8, '#a8641a');
  ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.beginPath(); ctx.arc(x - r * 0.2, y - r * 0.22, r * 0.2, 0, 6.3); ctx.fill();
  ctx.restore();
}

export default class KittenScene extends Street {
  constructor(game, index) {
    super(game, index);
    this.setSky('day');
    this.bounds = { l: 40, r: 2050 };
    this.follow = false;
    this.skyFixed = true;                                // (the moon and the clouds stay put when the camera comes closer)
    const kid = (kind, size) => new Kid({ kind, mood: 'wait', size: size || 1 });
    // houses along the round (the far end is drawn close together: from the yellow house on, every leap
    // of the kitten's own round goes straight from one window to the next)
    this.addHouse({ x: 108, w: 150, h: 296, style: 'pink', seed: 321, windows: [{ dx: -34, dy: -228 }, { dx: 36, dy: -228, lit: 1 }, { dx: -34, dy: -144, lit: 1 }, { dx: 36, dy: -144 }, { dx: -34, dy: -62 }, { dx: 36, dy: -62 }] });
    this.H1 = this.addHouse({ x: 600, w: 180, h: 232, style: 'blue', seed: 322, windows: [{ dx: -30, dy: -158, w: 44, h: 56, ledge: 56, lit: 1, kid: kid('pigtails') }, { dx: 46, dy: -158 }, { dx: -44, dy: -60 }, { dx: 46, dy: -60, lit: 1 }] });
    this.H2 = this.addHouse({ x: 985, w: 160, h: 176, style: 'brick', seed: 323, windows: [{ dx: -30, dy: -104, w: 42, h: 52, ledge: 56, lit: 1, kid: kid('curly') }, { dx: 42, dy: -104 }] });
    this.cottage = this.addHouse({ x: 1275, w: 104, h: 118, style: 'mint', seed: 324, chimney: false, windows: [{ dx: 0, dy: -66, w: 32, h: 38, ledge: 46, lit: 1, kid: kid('blond', 0.78) }] });
    this.H3 = this.addHouse({ x: 1470, w: 160, h: 230, style: 'butter', roof: 'tile', chimney: false, seed: 325, windows: [{ dx: -28, dy: -150, w: 42, h: 54, ledge: 56, lit: 1, kid: kid('spiky') }, { dx: 42, dy: -150 }, { dx: -28, dy: -62 }, { dx: 42, dy: -62, lit: 1 }] });
    this.H4 = this.addHouse({ x: 1740, w: 180, h: 226, style: 'blue', seed: 326, windows: [{ dx: -36, dy: -150, w: 42, h: 54, ledge: 56, lit: 1, kid: kid('bob') }, { dx: 46, dy: -150 }, { dx: -40, dy: -60, lit: 1 }, { dx: 46, dy: -60 }] });
    this.H5 = this.addHouse({ x: 1990, w: 160, h: 280, style: 'pink', seed: 327, windows: [{ dx: -30, dy: -190, w: 42, h: 54, ledge: 56, lit: 1, kid: kid('pigtails') }, { dx: 40, dy: -190 }, { dx: -30, dy: -100 }, { dx: 40, dy: -100, lit: 1 }] });
    // the road of treetops
    const tr = (x, h, r, kind, o) => this.addTree(Object.assign({ x, h, r, kind, lean: 0, seed: 331 + this.trees.length }, o || {}));
    this.T = [
      tr(0, 200, 80, 'big', { hollow: true, lean: 0.02, trunk: '#b9963f' }), tr(200, 172, 58, 'round'), tr(392, 190, 60, 'apple'),
      tr(800, 180, 76, 'round'), tr(1150, 176, 58, 'apple'), tr(1600, 190, 60, 'round'), tr(1870, 180, 58, 'round'), tr(2140, 196, 62, 'apple')
    ];
    this.addTree({ x: 2330, h: 186, r: 64, kind: 'round', lean: 0, seed: 351 });          // (scenery beyond the last house)
    this.addTree({ x: -210, h: 170, r: 60, kind: 'apple', lean: 0, seed: 352 });
    this.addHouse({ x: 2520, w: 170, h: 210, style: 'butter', seed: 328 });
    const P = this.P = this.T.map((t) => t.perch);
    // (a cat handing over a tale stands a little further along the ledge than the middle of it, so the
    // child reaching out and cheering in the window stays in sight)
    const sill = (h, o, dx) => { const q = Perch.sill(h, 0, o), at = q.at; q.at = () => { const a = at(); a.x += dx; return a; }; return q; };
    this.sill1 = sill(this.H1, { only: [P[2]] }, -14);
    this.roof1 = Perch.point(600, -282, { kind: 'roof', hw: 50 });
    this.sillA = sill(this.H2, { only: [P[3], P[4]] }, -14);
    this.sillTiny = sill(this.cottage, null, -10);
    this.sillB = sill(this.H3, { only: [P[4]] }, -14);
    this.roof3 = Perch.point(1482, -278, { kind: 'roof', hw: 40 });
    // the road opens up as the story goes on (so nobody runs ahead of it)
    this.shut(this.roof1, P[3], this.sillA, P[4], this.sillB);
    // the kitten's own round, later: window to window
    this.sillB2 = sill(this.H3, null, -12);
    this.sillC = sill(this.H4, null, -12);
    this.sillD = sill(this.H5, null, -12);
    // the cats
    const T0 = this.T[0];
    const papa = this.papa = this.addCat(new Cat({ kind: 'papa' }));
    const kit = this.kit = this.addCat(new Cat({ kind: 'kitten' })); kit.hidden = true;
    this.kitAt = { get x() { return kit.x; }, get y() { return kit.y - 22 * kit.size; } };       // (live points to look at)
    this.papaAt = { get x() { return papa.x; }, get y() { return papa.y - 34 * papa.size; } };
    this.pins = [];                // cats standing on a spot of their own (a crown that bobs keeps them on it)
    this.pin(papa, T0.perch, -24);
    this.sheet = { x: T0.topX + 50, y: T0.perchY + 6, fold: 0, sq: { x: 0, v: 0 }, tied: 0, gone: false };
    papa.look = this.sheet;
    this.pile = [{ dx: -40, dy: -8, size: 1, big: true }, { dx: 44, dy: -7, size: 1, big: true }, { dx: -68, dy: 17, size: 0.5, big: false }];
    this.fly = null;               // a bundle on its way to somebody's teeth
    this.tales = [];               // tale-stars drifting down in the evening
    this.kitOut = false; this.papaBusy = false;
    this.copy = false; this._copyT = 0;          // the kitten does what Papa does, a beat late
    this.puffing = false; this._puffT = 0;       // …and puffs along behind him
    this.expectText = null;
    this.expect = () => { const l = this.leap; return l && l.enabled ? l.expect(this.expectText) : null; };
    this.camPhase = 'sheet'; this._dest = null; this._next = null; this._buddy = false;
    this.cam.x = 40;
    this.audio.play('kitten', { intensity: 0.8 }); this.audio.ambience('day');
  }

  // little helpers
  shut(...ps) { for (const q of ps) { q.locked = true; q.enabled = false; } }
  open(...ps) { for (const q of ps) { q.locked = false; q.enabled = true; } }
  pin(cat, at, dx, dy) { this.unpin(cat); this.pins.push({ cat, at, dx: dx || 0, dy: dy || 0 }); }
  unpin(cat) { this.pins = this.pins.filter((p) => p.cat !== cat); }
  async hop(cat, x, y, o) { cat.leapTo(x, y, o); await this.until(() => !cat.jump); }
  // a place for a second cat on a treetop, on Papa's tail side (away from his tales): near the edge of the
  // crown and a little down its curve, so it stands on the leaves and not on air
  seat(tree, side) { const r = tree.r * (tree.crownScale || 1); return { dx: side * 0.8 * r, dy: 0.24 * r }; }
  hollowPos() { const t = this.T[0]; return { x: lerp(t.x, t.topX, 0.42), y: -t.h * 0.42, r: 42 }; }
  mouth(cat) { const m = cat.anchor('mouth'); return { x: m.x, y: m.y - 3 * cat.size }; }     // (the flying bundle's knot ends in the cat's teeth)
  landed() {
    const c = this.leap ? this.leap.cat : this.papa;
    for (const h of this.houses) for (const w of h.windows) if (w.kid && w.lit > 0.5 && Math.abs(h.x - c.x) < 200 && w.kid.mood === 'wait') { w.kid.mood = 'wave'; this.audio.sfx.giggle(); }
  }
  puff(cat, n) {
    if (this.reduced) return;
    const m = cat.anchor('nose'), d = cat.dir;
    this.fx.burst('puff', m.x + 5 * d * cat.size, m.y, n || 1, { speed: 22, life: 0.7, size: 3.4 + (n || 1) * 0.4, color: 'rgba(255,255,255,0.75)', a0: d > 0 ? -1.2 : -2.5, a1: d > 0 ? -0.6 : -1.9 });
  }
  // Papa turns his head to see that the kitten is still coming
  lookBack() {
    const papa = this.papa, kit = this.kit, L = this.L;
    if (!L || L.followers.indexOf(this.fol) < 0 || kit.hidden) return;
    const tok = this._lb = {};
    this.spawn(async () => {
      await this.wait(0.3);
      if (this._lb !== tok || L.state !== 'idle' || Math.abs(kit.x - papa.x) < 30) return;
      papa.look = this.kitAt;
      await this.wait(1.2);
      if (this._lb === tok && papa.look === this.kitAt) papa.look = null;
    });
  }
  // a bundle hops into a cat's teeth: the cat bends down for it, and it follows the mouth all the way in
  async take(cat, from, size, done) {
    const f = this.fly = { x: from.x, y: from.y, rot: 0, size, glow: 0.5 };
    this.audio.sfx.pop();
    cat.wake(); cat.look = { x: from.x, y: from.y };
    this.spawn(() => this.tween(cat, { headDown: 0.6 }, 0.2));
    const x0 = f.x, y0 = f.y, dur = 0.32;
    await this.frames((dt, el) => {
      const u = clamp01(el / dur), e = ease.inOutQuad(u), m = this.mouth(cat);
      f.x = lerp(x0, m.x, e); f.y = lerp(y0, m.y + 16 * size, e) - Math.sin(Math.PI * u) * 16; f.rot = 0.3 * cat.dir * e;
      return u >= 1;
    });
    this.fly = null;
    done();
    cat.look = null;
    this.spawn(() => this.tween(cat, { headDown: 0 }, 0.3));
    cat.sq.v += 4;
    const m = this.mouth(cat);
    this.sparkle(m.x, m.y + 8, 5);
  }

  // ── the director's camera ──
  // What is kept in the picture in each part of the story. Whatever the player is asked to touch is
  // always in; on the road the frame looks ahead to where the leader lands and the step after that,
  // and takes the companion in when the screen has room for both.
  frame() {
    const ph = this.camPhase, papa = this.papa, kit = this.kit, T0 = this.T[0];
    const b = { l: 1e9, r: -1e9, t: 1e9, b: -1e9 };
    const add = (l, r, t, bb) => { b.l = Math.min(b.l, l); b.r = Math.max(b.r, r); b.t = Math.min(b.t, t); b.b = Math.max(b.b, bb); };
    // (in the scripted shots a cat in the air is framed where it lands, so the picture does not breathe with every hop)
    const land = ph !== 'road' && ph !== 'solo';
    const cat = (c) => { if (c && !c.hidden) { const s = c.size, j = land && c.jump, x = j ? j.x1 : c.x, y = j ? j.y1 : c.y; add(x - 40 * s, x + 40 * s, y - 74 * s, y + 8); } };
    const win = (h, m) => { const g = h.win(0); add(g.x - g.w / 2 - m, g.x + g.w / 2 + m, g.top - m, g.sillY + m * 0.6); };
    const perch = (q) => { if (!q) return; add(q.x - 46, q.x + 46, q.y - 66, q.y + (q.kind === 'tree' ? 40 : 24)); if (q.kind === 'sill') win(q.owner, 14); };
    const step = (q) => { if (q) add(q.x - 40, q.x + 40, q.y - 50, q.y + 22); };      // (the next step only needs room for a finger)
    if (ph === 'sheet') { cat(papa); const s = this.sheet; add(s.x - 44, s.x + 44, s.y - 50, s.y + 18); }
    else if (ph === 'hollow') { cat(papa); cat(kit); const h = this.hollowPos(); add(h.x - 40, h.x + 40, h.y - 36, h.y + 40); add(T0.topX - 96, T0.topX + 40, T0.perchY - 50, T0.perchY + 30); }
    else if ((ph === 'road' || ph === 'solo') && this.leap) {
      const L = this.leap, c = L.cat, air = L.state === 'air' && this._dest;
      const after = (q) => { const at = L.at; L.at = q; const n = L.stepToward(L.goal); L.at = at; return n; };
      // (the last leap of a stretch has no step after it: keep where it started in the picture instead, until the
      // next shot takes over — otherwise the frame would close in on the leap alone and open out again after it)
      if (air) { if (this._destFor !== this._dest) { this._destFor = this._dest; this._next = after(this._dest); } perch(this._dest); if (!this._next) perch(this._from); }
      else { cat(c); if (L.state === 'idle') this._next = L.stepToward(L.goal); perch(L.at); }
      step(this._next);
      // the companion (the kitten behind Papa; later Papa watching the kitten), when there is room
      const o = ph === 'road' ? kit : papa;
      // (either wholly in the picture or clearly out of it — never half a cat at the edge: if any of it would
      // show at the zoom the rest allows, it is taken in, or when there is room to spare anyway)
      if (!o.hidden) {
        const F = this.freeRect(), v = this.view, room = (F.r - F.l) / v.fit, pad = this._camPad, hw = 46 * o.size;
        const w = Math.max(b.r, o.x + hw) - Math.min(b.l, o.x - hw);
        const z = Math.min(room / (b.r - b.l + 2 * pad), v.closeMax(this._camMax)), half = room / (2 * z), cx = (b.l + b.r) / 2;
        const shows = Math.abs(o.x - cx) - hw < half + 12;
        this._buddy = shows || w < room * (this._buddy ? 0.85 : 0.72);
        if (this._buddy) cat(o);
      }
    }
    else if (ph === 'lesson') { const r1 = this.roof1; win(this.H1, 20); perch(this.sill1); cat(papa); cat(kit); add(r1.x - 44, r1.x + 44, r1.y - 72, r1.y); }   // (the window, its sill and the roof above, from the delivery to the end of the lesson)
    else if (ph === 'pile') { const T3 = this.T[3]; cat(papa); cat(kit); add(T3.topX - 84, T3.topX + 74, T3.perchY - 70, T3.perchY + 24); }
    else if (ph === 'carry') { win(this.H2, 14); perch(this.P[4]); win(this.cottage, 14); cat(papa); cat(kit); }
    else if (ph === 'tiny') { win(this.cottage, 20); cat(kit); cat(papa); }     // (Papa watches from the treetop just above: never cut him in half)
    else if (ph === 'grow') { const r3 = this.roof3; cat(kit); cat(papa); win(this.H3, 14); add(r3.x - 44, r3.x + 44, r3.y - 72, r3.y); const k = this.kitAtRest || kit; add(k.x - 110, k.x + 70, k.y - 190, k.y + 22); }
    else if (ph === 'reunion') { const T6 = this.T[6]; cat(papa); cat(kit); add(T6.topX - 96, T6.topX + 96, T6.perchY - 96, T6.perchY + 30); }
    const e = this.currentExpect();
    if (e && e.x !== undefined && e.kind !== 'continue') add(e.x - 44, e.x + 44, e.y - 44, e.y + 44);
    // (where the picture is narrow and tall — an upright phone — there is height to spare at the zoom the
    // width allows: let the town and the ground come up into it instead of leaving plain sky above)
    if (this.view.portrait && b.b < 10 && b.r > b.l) {
      const F = this.freeRect(), v = this.view, pad = this._camPad, z = Math.min((F.r - F.l) / (v.fit * (b.r - b.l + 2 * pad)), v.closeMax(this._camMax));
      const room = ((F.b - F.t) / (v.fit * z) - 2 * pad) * 0.9;
      if (room > b.b - b.t) b.b = Math.min(10, b.t + room);
    }
    return b;
  }
  direct(phase, o) {
    this.camPhase = phase;
    const opt = Object.assign({ pad: 22, max: 1.7, clampX: [-200, 2300], rate: 1.8, zoomIn: 0.8 }, o || {});
    this._camPad = opt.pad; this._camMax = opt.max;
    this.track(() => this.frame(), opt);
  }

  // Open the way to `goal`, let the camera look along it first, then hand the leap back to the player.
  async road(goal, text, past, keep) {
    const L = this.leap;
    this.open(goal); L.goal = goal; this.expectText = text;
    if (!keep) this.direct(L === this.K ? 'solo' : 'road', L === this.K ? { max: 1.5 } : null);     // (keep: the shot that is up already covers this stretch)
    await this.wait(this.reduced ? 0.15 : 0.6);
    // (…and until the step the player will be asked to touch is well inside the picture: coming from a
    // close shot on a short screen the camera needs a little longer; never more than 2 s in all)
    const v = this.view, inside = () => {
      const n = L.stepToward(goal); if (!n) return true;
      const F = this.freeRect(), x = v.sx(n.x), y = v.sy(n.y - 18), m = 30;
      return x > F.l + m && x < F.r - m && y > F.t + m && y < F.b - m;
    };
    let waited = 0;
    await this.frames((dt) => (waited += dt) > 1.4 || inside());
    L.enabled = true;
    await L.reach(goal, past ? { past } : undefined);
    L.enabled = false;
  }

  async run() {
    const P = this.P, papa = this.papa, kit = this.kit, T0 = this.T[0], sh = this.sheet;
    // a look at the street, then close in on Papa and the sheet
    this.spawn(async () => { await this.wait(this.reduced ? 1 : 2.2); this.direct('sheet', { max: 1.8 }); });
    await this.wait(0.8);
    this.say(0);                                         // The cats carry the tales in their teeth, each wrapped in a little white sheet.
    for (let i = 0; i < 3; i++) {
      await this.tapOn(() => ({ x: sh.x, y: sh.y - 12, r: 48 }), { text: T.wrap });
      sh.sq.v += 7;
      this.audio.chordNote(i, { vel: 0.75 });
      this.audio.sfx.rustle();
      this.sparkle(sh.x, sh.y - 12, 5 + i * 2);
      papa.wake(); papa.act(i === 0 ? 'tilt' : 'ears');
      if (i < 2) await this.tween(sh, { fold: i + 1 }, 0.4, ease.outBack);
      else { this.audio.sfx.rise(); await this.tween(sh, { tied: 1 }, 0.35, ease.outBack); }
    }
    await this.wait(0.35);
    papa.eyes = 'happy';
    sh.gone = true;
    await this.take(papa, { x: sh.x, y: sh.y + 4 }, 1, () => { papa.carry = 1; });
    this.audio.sfx.purr(1.2);
    await this.wait(0.9);
    papa.eyes = 'open';
    this.unpin(papa);                                    // (into the middle of the crown: room for the kitten behind him)
    await this.hop(papa, T0.perch.x, T0.perch.y, { height: 10, dur: 0.24 });
    this.pin(papa, T0.perch);

    // ── the kitten ──
    this.direct('hollow', { max: 1.7 });
    const h = this.hollowPos();
    papa.look = { x: h.x, y: h.y };                      // somebody is peeping out of the hollow
    await this.say(1);                                   // The kittens help too.
    await this.tapOn(() => this.hollowPos(), { text: T.hollow });
    kit.hidden = false; kit.size = 0.32; kit.x = h.x; kit.y = h.y + 12; kit.dir = 1;
    this.kitOut = true;
    this.audio.sfx.pop(); kit.meow(); this.audio.sfx.meow(true);
    this.leaves(h.x, h.y, 7);
    papa.look = this.kitAt;
    this.spawn(() => this.tween(kit, { size: 0.6 }, 0.45, ease.outBack));
    const s0 = this.seat(T0, -1);
    await this.hop(kit, T0.topX + s0.dx, T0.perchY + s0.dy, { height: 70, dur: 0.6 });
    this.pin(kit, T0.perch, s0.dx, s0.dy);
    T0.land(0.6); this.audio.sfx.land(0, true);
    kit.dir = 1; kit.look = this.papaAt;
    kit.eyes = 'happy'; papa.eyes = 'happy';
    this.hearts((papa.x + kit.x) / 2, papa.y - 60, 4);
    for (let i = 0; i < 2; i++) { await this.hop(kit, kit.x, kit.y, { height: 18, dur: 0.3 }); kit.meow(0.22); this.audio.sfx.mrrp(true); }
    kit.eyes = 'open'; papa.eyes = 'open'; papa.act('slowblink');
    await this.wait(0.6);
    kit.look = null; kit.dir = 1;

    // ── learning the way ──
    this.unpin(papa);
    papa.look = null;
    const L = this.L = this.leap = new Leap(this, {
      cat: papa, perches: [P[0], P[1], P[2], this.sill1, this.roof1, P[3], this.sillA, P[4], this.sillB], start: P[0],
      flies: [{ x: 102, y: -352 }, { x: 296, y: -345 }, { x: 496, y: -372 }, { x: 700, y: -366 }, { x: 1031, y: -312 }, { x: 1275, y: -356 }],
      onLand: (q) => { this.landed(); this.lookBack(); if (this._onP2) this._onP2(); this.join(q); }, onLeap: (q, from) => { this._dest = q; this._from = from; this.leaving(); if (q === this.sill1) this.direct('lesson', { max: 1.7 }); }
    });
    const fol = this.fol = L.addFollower(kit, null, { delay: 0.4 });
    fol.onLand = () => { kit.sq.v += 3; if (kit.carry) this.puff(kit, 2); };
    this.copy = true; this.joining = true;
    L.enabled = false;
    this.say(2);                                         // …learning the way, learning how to slip in through the window.
    this._onP2 = () => { if (L.at === P[2]) this.expectText = T.window; };   // (the hint changes once the window is the next step)
    await this.road(this.sill1, T.follow);
    this._onP2 = null; this.joining = false;            // (at the window the kitten waits a step behind, to copy him)
    await this.deliver(papa, this.H1, 0);
    // Papa makes room — up onto the roof over the window — and the kitten copies what he did
    this.direct('lesson', { max: 1.7 });
    this.open(this.roof1);
    await L.go(this.roof1);
    papa.dir = -1; papa.look = this.kitAt;
    await this.until(() => fol.at === this.sill1 && !kit.jump && !fol.queue.length);
    await this.windowLesson();
    papa.look = null;

    // ── helping with the carrying ──
    await this.road(P[3], T.onward);
    const T3 = this.T[3];
    this.direct('pile', { max: 1.8 });
    for (const b of this.pile.filter((q) => q.big)) {
      this.pile.splice(this.pile.indexOf(b), 1);                 // off the pile first, so it is not drawn twice while it flies
      await this.take(papa, { x: T3.topX + b.dx, y: T3.perchY + b.dy }, 1, () => { papa.carry++; });
    }
    await this.say(3);                                   // Then it begins to help with the carrying.
    await this.until(() => fol.at && !kit.jump && !fol.queue.length);
    fol.at = null;                                       // the kitten scrambles up beside Papa for the tiny one
    kit.wake();
    this.audio.sfx.hop();
    const s3 = this.seat(T3, -1);
    await this.hop(kit, T3.topX + s3.dx, T3.perchY + s3.dy);
    T3.land(0.6); this.audio.sfx.land(0, true); kit.dir = 1;
    this.pin(kit, T3.perch, s3.dx, s3.dy);
    papa.dir = 1; papa.look = this.kitAt;              // (he keeps facing the road and only turns his head: both faces and all three tales in sight)
    const tiny = this.pile[0];
    kit.bundleSize = 0.85;
    this.pile = [];
    await this.take(kit, { x: T3.topX + tiny.dx, y: T3.perchY + tiny.dy }, 0.5, () => { kit.carry = 1; });
    kit.eyes = 'happy'; kit.meow(0.22); this.audio.sfx.mrrp(true);
    papa.act('slowblink');
    this.puffing = true;
    await this.say(4);                                   // Papa carries two big tales, and the kitten puffs along behind…
    kit.eyes = 'open'; papa.look = null;
    await this.road(this.sillA, T.window);
    // (where the picture is wide, one shot from the brick house's window to the cottage's — no closing in and opening
    // out between them; an upright phone has no width for that and follows the road as before)
    const carry = !this.view.portrait;
    if (carry) this.direct('carry', { max: 1.7 });
    await this.deliver(papa, this.H2, 0);
    // the kitten hurries after him up onto the roof over the window (so the two stay in one picture)…
    const T4 = this.T[4], roof2 = { x: this.H2.x - 4, y: -236 };
    fol.queue.length = 0; fol.at = null; kit.wake();
    await this.hop(kit, roof2.x, roof2.y); this.audio.sfx.land(0, true); this.puff(kit, 2);
    this.pin(kit, roof2); kit.dir = 1;
    await this.road(P[4], T.onward, null, carry);
    this.direct('tiny', { max: 1.7 });                   // (straight into the next shot: the kitten's hops happen inside it)
    // …and on, up beside him
    this.unpin(kit); fol.queue.length = 0; fol.at = null; kit.wake();
    await this.wait(0.25);
    const s4 = this.seat(T4, -1);
    await this.hop(kit, T4.topX + s4.dx, T4.perchY + s4.dy); T4.land(0.6); this.audio.sfx.land(0, true); this.puff(kit, 2);
    this.pin(kit, T4.perch, s4.dx, s4.dy); kit.dir = 1;
    papa.look = this.kitAt; papa.mode = 'sit';           // (he settles down to watch: sitting, he leaves the kitten in plain sight)
    // the kitten's very own window
    await this.tapOn(() => (this.view.visible(kit.x, -30) ? { x: kit.x, y: kit.y - 14, r: 32 } : null), { text: T.send });
    this.unpin(kit); this.puffing = false;
    kit.wake(); kit.crouch = 1; await this.wait(0.28);
    this.audio.sfx.hop();
    await this.hop(kit, this.sillTiny.x, this.sillTiny.y);
    this.audio.sfx.land(0, true);
    await this.deliver(kit, this.cottage, 0);
    papa.mode = 'stand'; papa.eyes = 'happy'; this.audio.sfx.purr(1);     // (up on his feet, tail high: that's my kitten)
    await this.hop(kit, T4.topX + s4.dx, T4.perchY + s4.dy);
    T4.land(0.6); this.audio.sfx.land(0, true);
    this.pin(kit, T4.perch, s4.dx, s4.dy);
    kit.dir = 1; kit.look = this.papaAt; kit.eyes = 'happy'; kit.meow(0.22); this.audio.sfx.mrrp(true);
    await this.wait(0.7);
    papa.eyes = 'open'; papa.look = null; kit.eyes = 'open'; kit.look = null; kit.dir = 1;
    await this.road(this.sillB, T.window);
    this.kitAtRest = this.sillB2;                        // (the shot of the growing, framed from here on where the kitten will stand)
    this.direct('grow', { max: 1.7 });
    await this.deliver(papa, this.H3, 0);
    // Papa goes up onto the roof; the kitten comes to the window he leaves
    papa.wake();
    await L.go(this.roof3);
    papa.dir = -1; papa.look = this.kitAt;
    await this.until(() => fol.at === this.sillB && !kit.jump && !fol.queue.length);
    L.removeFollower(kit); this.copy = false;
    await this.hop(kit, this.sillB2.x - 20, this.sillB2.y, { height: 8, dur: 0.24 });     // (a step along the ledge, never a snap)
    this.pin(kit, this.sillB2, -20);                     // (along the ledge a little, so the child in the window can watch)
    kit.dir = 1; kit.look = this.papaAt;

    // ── growing up ──
    this.kitAtRest = null;
    this.spawn(() => this.skyTo('dawn', 6));
    await this.say(5);                                   // Soon it can carry a bigger tale, then two at once —
    await this.taleFor(-56, -100, { carry: 1, bundle: 1, size: 0.75, head: 1.16, leg: 0.88 });
    await this.wait(0.5);
    await this.taleFor(-6, -132, { carry: 2, bundle: 0.95, size: 0.9, head: 1.1, leg: 0.94 });
    await this.wait(0.3);

    // ── all by itself ──
    this.audio.ambience('night');
    this.spawn(() => this.skyTo('night', 6));
    papa.mode = 'sit'; papa.dir = 1; papa.look = this.kitAt;
    await this.say(6);                                   // …it goes out and delivers the tales all by itself.
    this.unpin(kit); kit.look = null;
    await this.hop(kit, this.sillB2.x, this.sillB2.y, { height: 8, dur: 0.22 });
    const K = this.K = this.leap = new Leap(this, {
      cat: kit, perches: [this.sillB2, this.sillC, this.sillD], start: this.sillB2, range: 280,
      flies: [{ x: 1530, y: -322 }, { x: 1790, y: -338 }], onLand: () => this.landed(), onLeap: (q, from) => { this._dest = q; this._from = from; }
    });
    K.enabled = false;
    await this.road(this.sillC, T.solo);
    await this.deliver(kit, this.H4, 0);
    this.spawn(() => this.papaTo(P[5], true));           // …though Papa cannot help following, a little way behind
    await this.road(this.sillD, T.solo);
    await this.deliver(kit, this.H5, 0);
    kit.eyes = 'happy';
    this.leap = null;                                    // (the round is done: nothing holds the kitten to the sill any more)
    this.direct('reunion', { max: 1.8 });
    await this.until(() => !this.papaBusy);
    // home again: Papa comes to the next treetop, and the kitten runs to him
    const T6 = this.T[6];
    await this.papaTo({ get x() { return T6.topX - 30; }, get y() { return T6.perchY; }, owner: T6 }, false, -30);
    kit.wake(); kit.eyes = 'open';
    await this.hop(kit, T6.topX + 30, T6.perchY);
    T6.land(0.6); this.audio.sfx.land(0, true);
    this.pin(kit, T6.perch, 30);
    kit.dir = -1; papa.dir = 1;
    papa.look = this.kitAt; kit.look = this.papaAt;
    await this.wait(0.3);
    kit.mode = 'sit'; papa.act('slowblink');
    this.audio.sfx.purr(2.6);
    this.hearts((papa.x + kit.x) / 2, kit.y - 70, 5);
    kit.meow(); this.audio.sfx.meow(true);
    await this.wait(1.6);
    papa.eyes = 'happy'; kit.act('slowblink');
    await this.next();
  }

  // On the first stretch of the road the kitten walks beside Papa: once he has landed on a treetop it
  // comes up onto the same crown, a little behind him (so it is never left half in the picture)
  join(q) {
    const kit = this.kit, fol = this.fol;
    if (!this.joining || !fol || q.kind !== 'tree' || this.L.followers.indexOf(fol) < 0) return;
    const tok = this._jt = {};
    this.spawn(async () => {
      await this.until(() => !kit.jump || this._jt !== tok);
      await this.wait(0.3);
      if (this._jt !== tok || this.L.at !== q || this.L.state !== 'idle' || !this.joining) return;
      fol.queue.length = 0; fol.at = null; kit.wake();
      const st = this.seat(q.owner, -this.papa.dir), dx = st.dx;
      await this.hop(kit, q.x + dx, q.y + st.dy);
      if (q.owner && q.owner.land) q.owner.land(0.5);
      this.audio.sfx.land(0, true); kit.sq.v += 3;
      if (this.L.state === 'idle' && this.L.at === q) { this.pin(kit, q, dx, st.dy); kit.dir = this.papa.dir; }
      else { kit.leapTo(q.x, q.y, { height: 9, dur: 0.22, done: () => { fol.at = q; } }); }   // (Papa has already gone on: a little step into his place, then follow)
    });
  }

  // the kitten leaves its spot a moment after Papa when it had come to stand beside him
  leaving() {
    const p = this.pins.find((r) => r.cat === this.kit);
    if (!p || !this.fol || this.L.followers.indexOf(this.fol) < 0) return;
    const q = p.at;
    this.unpin(this.kit);
    this.kit.leapTo(q.x, q.y, { height: 9, dur: 0.22 });
    this.fol.at = q;
  }

  // "learning how to slip in through the window": the kitten copies Papa straight away — bonk —
  // and then, with a little encouragement, in it goes
  async windowLesson() {
    const kit = this.kit, papa = this.papa, fol = this.fol, sill = this.sill1, w = this.H1.windows[0], g = this.H1.win(0);
    const target = () => (this.view.visible(kit.x, -30) ? { x: kit.x, y: kit.y - 16, r: 42 } : null);
    fol.at = null; kit.wake(); kit.dir = 1; this.copy = false;
    kit.look = this.papaAt; await this.wait(0.7);           // that is how Papa did it…
    kit.look = { x: g.x, y: g.y };
    if (!this.reduced) { kit.act('pounce'); await this.wait(1.0); }
    kit.crouch = 1; await this.wait(0.2);
    this.audio.sfx.hop();
    await this.hop(kit, g.x - 6, g.top + 26, { height: 24, dur: 0.24 });
    this.audio.sfx.knock(); kit.meow(0.22); this.audio.sfx.mrrp(true);
    kit.eyes = 'closed'; kit.look = null;
    this.fx.burst('star', g.x - 2, g.top + 4, 6, { speed: 70, life: 0.9, size: 4.5, colors: ['#ffe36e', '#fff7c0'], drag: 2.4, vr: 9 });
    await this.hop(kit, sill.x, sill.y, { height: 14, dur: 0.36 });
    fol.at = sill; kit.dir = 1;
    this.audio.sfx.land(0, true);
    if (w.kid) w.kid.mood = 'wave';
    await this.wait(0.5);
    kit.eyes = 'open'; kit.act('ears');
    papa.act('tilt');
    await this.wait(0.5);
    kit.look = this.papaAt;
    await this.tapOn(target, { text: T.again });
    fol.at = null;
    kit.wake(); kit.look = null; kit.crouch = 1; await this.wait(0.34);
    this.audio.sfx.hop();
    this.spawn(() => this.tween(kit, { size: 0.42 }, 0.36));
    await this.hop(kit, g.x, g.y + 16, { height: 22, dur: 0.38 });
    kit.hidden = true;
    this.audio.sfx.swish();
    if (w.kid) w.kid.cheer();
    this.audio.sfx.giggle();
    w.rings = 0.3; this.spawn(() => this.tween(w, { rings: 1 }, 0.8, ease.outCubic));
    this.sparkle(g.x, g.y, 10);
    await this.wait(0.9);
    kit.hidden = false; kit.x = g.x; kit.y = g.bottom; kit.eyes = 'happy';
    this.audio.sfx.pop(); kit.meow(); this.audio.sfx.meow(true);
    this.spawn(() => this.tween(kit, { size: 0.6 }, 0.3, ease.outBack));
    await this.hop(kit, g.x, g.bottom, { height: 20, dur: 0.32 });
    await this.hop(kit, sill.x, sill.y, { height: 24, dur: 0.34 });
    fol.at = sill; kit.dir = 1; kit.look = this.papaAt;
    this.hearts(kit.x, kit.y - 40, 3);
    papa.eyes = 'happy'; this.audio.sfx.purr(1.2);
    await this.wait(0.9);
    kit.eyes = 'open'; papa.eyes = 'open'; kit.look = null;
    this.copy = true;
  }

  // a tale drifts down through the evening; catch it and the kitten is big enough to carry it
  async taleFor(dx, dy, o) {
    const kit = this.kit, papa = this.papa, v = this.view;
    const s = { x: kit.x + dx + 50, y: v.top - 40, a: 1, r: 11 }, tx = kit.x + dx, ty = kit.y - 26 + dy;
    this.tales.push(s);
    this.audio.sfx.fall();
    kit.look = s;                                          // (it watches the tale come down)
    this.spawn(() => this.tween(s, { x: tx, y: ty }, this.reduced ? 0.6 : 2.2, ease.outCubic));
    await this.tapOn(() => (s.y > Math.min(ty - 60, v.free + 150) ? { x: s.x, y: s.y, r: 46 } : null), { text: T.catch });
    s.caught = true;
    this.audio.sfx.sparkle();
    const sx = s.x, sy = s.y;
    await this.frames((dt, el) => { const u = clamp01(el / 0.3), e = ease.inQuad(u), m = this.mouth(kit); s.x = lerp(sx, m.x, e); s.y = lerp(sy, m.y + 10, e); s.r = lerp(11, 6, e); return u >= 1; });
    this.tales.splice(this.tales.indexOf(s), 1);
    const m = this.mouth(kit);
    this.sparkle(m.x, m.y + 8, 12);
    this.fx.burst('puff', m.x, m.y + 8, 5, { speed: 40, life: 0.5, size: 7, color: 'rgba(255,255,255,0.8)' });
    kit.carry = o.carry; kit.bundleSize = o.bundle; kit.look = null;
    this.audio.sfx.rise();
    kit.eyes = 'happy';
    this.spawn(() => this.tween(kit, { size: o.size }, 0.7, ease.outBack));
    this.spawn(() => this.tween(kit.c, { head: o.head, leg: o.leg }, 0.7, ease.inOutQuad));     // (it grows into a different shape, not only a bigger one)
    this.fx.burst('ring', kit.x, kit.y - 20, 2, { speed: 0, life: 0.7, size: 12, color: '#fff3b8', grow: 90, spread: 2 });
    await this.hop(kit, kit.x, kit.y, { height: 20, dur: 0.34 });
    kit.meow(); this.audio.sfx.meow(true);
    papa.act('slowblink');
    await this.wait(0.6);
    kit.eyes = 'open'; kit.look = this.papaAt;
  }

  // Papa hops to `to` (a perch or any {x, y}); a moment of pride first if he has just watched a delivery
  async papaTo(to, proud, dx) {
    const papa = this.papa;
    this.papaBusy = true;
    if (proud) { papa.mode = 'stand'; papa.eyes = 'happy'; this.audio.sfx.purr(0.9); await this.wait(1.1); }
    papa.mode = 'stand'; papa.eyes = 'open'; papa.wake();
    this.unpin(papa);
    this.audio.sfx.hop();
    await this.hop(papa, to.x, to.y);
    if (to.owner && to.owner.land) to.owner.land(0.8);
    this.audio.sfx.land(0, true);
    this.pin(papa, to.owner && to.owner.perch && dx !== undefined ? to.owner.perch : to, dx !== undefined ? dx : 0);
    papa.dir = 1; papa.mode = 'sit'; papa.look = this.kitAt;
    this.papaBusy = false;
  }

  tick(dt) {
    const T0 = this.T[0], papa = this.papa, kit = this.kit;
    if (this.kitOut) { T0._blink = -0.05; T0.hollowEmpty = true; }      // nobody left in the hollow
    else T0.lookAt = this._pointer || { x: papa.x, y: papa.y - 40 };
    for (const p of this.pins) if (!p.cat.jump) { p.cat.x = p.at.x + p.dx; p.cat.y = p.at.y + p.dy; }
    const sh = this.sheet;
    spring(sh.sq, 0, dt, 200, 12);
    sh.x = T0.topX + 50; sh.y = T0.perchY + 6;
    for (const s of this.tales) if (!s.caught && Math.random() < dt * 9) this.fx.add({ kind: 'spark', x: s.x + (Math.random() - 0.5) * 14, y: s.y + 8, vy: 30, life: 0.7, size: 3.2, color: '#fff3b8' });
    // the kitten sits when Papa sits (and gets up when he does), a beat late
    if (this.copy && !kit.hidden && !kit.jump && !papa.jump) {
      const pSit = papa.sitting, kSit = kit.mode === 'sit';
      if (pSit !== kSit) { this._copyT += dt; if (this._copyT > (pSit ? 0.6 : 0.3)) { kit.mode = pSit ? 'sit' : 'stand'; this._copyT = 0; } } else this._copyT = 0;
    } else this._copyT = 0;
    // …and, with its tiny tale, it puffs along
    if (this.puffing && kit.carry && !kit.hidden && (this._puffT -= dt) < 0) { this._puffT = 1 + Math.random() * 0.6; this.puff(kit, 1); }
  }

  drawSheet(ctx, t) {
    const sh = this.sheet;
    if (sh.gone) return;
    const f = sh.fold, a = SHEET[f <= 1 ? 0 : 1], b = SHEET[f <= 1 ? 1 : 2], k = clamp01(f <= 1 ? f : f - 1);
    const pts = a.map((p, i) => [lerp(p[0], b[i][0], k), lerp(p[1], b[i][1], k)]);
    const sq = sh.sq.x, starY = lerp(-25, -8, clamp01(f / 2)) + (f < 0.5 ? Math.sin(t * 2.4) * 2 : 0);
    if (sh.tied > 0.5) {
      const s = 0.6 + 0.4 * sh.tied;
      drawLooseBundle(ctx, sh.x, sh.y + 5, 0, s * 1.05, 0.55);
      return;
    }
    ctx.save();
    ctx.translate(sh.x, sh.y); ctx.scale(1.3 * (1 + sq * 0.14), 1.3 * (1 - sq * 0.2));
    if (f > 1.05) drawTaleStar(ctx, 0, starY, 8.5, t, 1);
    wobble(ctx, pts, 91 + Math.floor(t * 6) * 3, 0.5);
    ctx.fillStyle = PAL.white; ctx.fill(); ink(ctx, 2.4);
    ctx.strokeStyle = 'rgba(29,21,48,0.2)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[1][0] * 0.6, pts[1][1] * 0.5 + 2); ctx.lineTo(pts[6][0] * 0.6, pts[6][1] * 0.5 + 2); ctx.stroke();
    if (f <= 1.05) drawTaleStar(ctx, 0, starY, 9, t, 1);
    else glow(ctx, 0, -6, 34, PAL.gold, 0.55);
    ctx.restore();
  }

  drawMid(ctx) {
    drawBush(ctx, 292, 0, 36, 341, '#e8505a'); drawBench(ctx, 712, 0); drawBush(ctx, 1076, 0, 32, 342, '#f2c23a');
    drawBush(ctx, 1500, 0, 30, 343, '#f08ab0'); drawBench(ctx, 1868, 0); drawBush(ctx, 2218, 0, 34, 344, '#e8505a');
  }

  drawFront(ctx, view, t) {
    this.drawSheet(ctx, t);
    const T3 = this.T[3];
    for (const b of this.pile) drawLooseBundle(ctx, T3.topX + b.dx, T3.perchY + b.dy, b.dx * 0.004, b.size, 0.35);
    if (this.fly) drawLooseBundle(ctx, this.fly.x, this.fly.y, this.fly.rot, this.fly.size, this.fly.glow);
    for (const s of this.tales) {
      if (!s.caught) crayonRings(ctx, s.x, s.y, 26, t, { alpha: 0.45, rings: 3, seed: 5 });
      drawTaleStar(ctx, s.x, s.y + (s.caught ? 0 : Math.sin(t * 2.2) * 4), s.r, t, s.a);
    }
  }
}
