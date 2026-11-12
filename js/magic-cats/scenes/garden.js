// Scene 9 — The garden of tales, and the end of the story.
// The cats' own world (the pale "Angel and bird" picture): say hello to the cats who live
// there, open the garden gate, wake the magic trees, visit the hundred-year tale, pick tales
// the moment they ripen, water the saplings, draw a brand-new tree … and then carry one last
// tale home through the night to our own window, where the candle from scene 1 is waiting.
import { Street, Perch } from '../street.js';
import { Leap } from '../leap.js';
import { Cat, CAT_KINDS, drawBundle, drawLooseBundle } from '../actors.js';
import { TAU, clamp, clamp01, lerp, ease, dist, spring, approach } from '../util.js';
import { glow, crayonRings, chalk, starPath, rgba, freeSprites } from '../paint.js';
import Candle from './candle.js';
import { D, ANGEL_BIRD, spiralPath, drawAngel, drawSpiralCloud, drawCatHouse, drawBubble, drawHedge, drawGate, drawBasket, MagicTree, drawPod, drawAncient, Sapling, drawCan, canSpout, drawMound, drawScarf, drawBow, drawEarFlower, drawApron } from './garden-art.js';
import { DreamTree } from './garden-tree.js';

const T = {
  mist: { en: 'Touch the dream clouds', de: 'Tippe die Traumwolken an', ru: 'Коснись сонных облаков' },
  hello: { en: 'Say hello to the cats', de: 'Sag den Katzen hallo', ru: 'Поздоровайся с котами' },
  gate: { en: 'Open the garden gate', de: 'Öffne das Gartentor', ru: 'Открой калитку в сад' },
  trees: { en: 'Touch the magic trees', de: 'Berühre die Zauberbäume', ru: 'Коснись волшебных деревьев' },
  old: { en: 'Touch the oldest tale of all', de: 'Berühre das allerälteste Märchen', ru: 'Коснись самой старой сказки' },
  pick: { en: 'Pick each tale the moment it turns gold', de: 'Pflück jedes Märchen, sobald es golden wird', ru: 'Срывай сказку, как только она станет золотой' },
  water: { en: 'Hold a drooping sapling to water it', de: 'Halte ein welkes Bäumchen gedrückt, dann wird es gegossen', ru: 'Подержи поникшее деревце — его польют' },
  draw: { en: 'Draw a new tree: slide up from the soil', de: 'Male einen neuen Baum: vom Boden nach oben ziehen', ru: 'Нарисуй новое дерево: веди пальцем от земли вверх' },
  last: { en: 'Pick the tale from your tree', de: 'Pflück das Märchen von deinem Baum', ru: 'Сорви сказку со своего дерева' },
  blow: { en: 'Blow out the candle: hold the flame', de: 'Puste die Kerze aus: halte die Flamme', ru: 'Задуй свечу: удержи огонёк' },
  home: { en: 'Carry it home over the treetops', de: 'Trag es über die Wipfel nach Hause', ru: 'Отнеси её домой по верхушкам' }
};
const X = { street: 30, gate: 720, garden: 1350, old: 1700, tend: 2110, mound: 2700, exit: 3130, town: 3520, home: 4085 };
const SILL = -114;                      // the window sill inside our room (candle.js: WIN.b − 2)
const STEPS = ['mist', 'street', 'gate', 'garden', 'old', 'pick', 'tend', 'draw', 'finale', 'town', 'room'];
// paces (world units / s): an upright cat strolls and trots on its hind legs; on all fours they hurry home
const STROLL = 64, TROT = 118, HURRY = 150, ACC = 260;
const LANE = 13;                        // in the cats' town our two walk this much nearer to us than the town cats, who stand at their doors
const DRAW_WAIT = 25;                   // seconds of nothing at the soil before the paw draws the tree for the player
// inside our room (candle.js coordinates): the flame, the child's head on the pillow, Papa's head
const FLAME = { x: -150, y: -176 }, CHILD = { x: -224, y: -5 }, PAPA = { x: 142, y: -60 };
const STAR = { x: 146, y: -112 };       // where the story lands: just above Papa's hair (his head is size 3.25 at (142, −56))
const ON_SILL = { papa: 26, kit: 92, tale: -62 };

export default class Garden extends Street {
  constructor(game, index) {
    super(game, index);
    this.setSky('pale');
    this.far = 0; this.follow = false; this.camLead = 60; this.camRate = 2.4;
    this.mode = 'dream';                // 'dream' | 'room'
    this.phase = '';                    // 'pick' | 'draw' | 'leap'
    this.veil = 1; this.dark = 0;
    this.cam.x = X.street;
    this.skyFixed = true;               // the moon and the clouds keep their size when the camera comes closer
    this.camPhase = 'open';             // what the director's camera frames (see frame())
    this.camGoal = null; this._fb = { l: 0, r: 0, t: 0, b: 0 }; this._dest = null;
    this._ans = 0;
    this.view.safeAbove = 400;          // a slightly closer look than the default (nothing here is taller)
    // our two travellers
    this.papa = this.addCat(new Cat({ kind: 'papa', x: X.street - 560, y: LANE }));     // (the front lane, see LANE)
    this.kit = this.addCat(new Cat({ kind: 'kitten', x: X.street - 620, y: LANE }));
    // the cats who live here
    const up = (kind, x, o) => { const c = this.addCat(new Cat(Object.assign({ kind, x, y: 0 }, o || {}))); c.mode = 'upright'; return c; };
    // (the town cats keep to a lane of their own at their doors — higher on the ground, a little smaller, drawn
    // first — so our two always walk in front of them and are never hidden by them)
    const near = (c) => { c.size *= 0.92; return c; };
    const grown = { head: 1, leg: 1, tail: 1 };
    this.folk = [
      { cat: near(up('mama', -42, { dir: -1 })), icon: 'heart', wear: 'scarf', voice: 0 },
      { cat: near(up('night', 108, { size: 0.95, colors: grown })), icon: 'moon', wear: 'bow', voice: 1 },
      { cat: near(up('kitten', 238, { size: 0.9, dir: -1, colors: grown })), icon: 'fish', wear: 'flower', voice: 2 }
    ].map((f, i) => Object.assign(f, { home: f.cat.x, go: f.cat.x, done: false, talk: 0, idle: 1 + Math.random() * 2, lk: { x: 0, y: 0 }, lkAt: null, lkT: 0.5 + i * 0.9 }));
    this.says = [];                     // speech bubbles: {cat, icon, k, life}
    this.homes = [{ x: -128, w: 118, h: 104, col: 0 }, { x: 42, w: 134, h: 128, col: 1 }, { x: 216, w: 112, h: 96, col: 2 }];
    this.mist = [{ u: 0.27, y: -330, dir: -1 }, { u: 0.72, y: -300, dir: 1 }, { u: 0.36, y: -140, dir: -1 }, { u: 0.78, y: -120, dir: 1 }]
      .map((m, i) => Object.assign(m, { a: 1, dx: 0, done: false, seed: 400 + i, i }));
    this.skyClouds = [];
    for (let i = 0; i < 15; i++) this.skyClouds.push({ x: -420 + i * 205, y: [-405, -520, -360, -640, -455, -760][i % 6], w: 120 + (i * 37) % 70, seed: 430 + i });
    this.gate = { open: 0, flip: 0 };
    // the garden
    this.mtrees = [new MagicTree({ x: 1170, h: 150, r: 58, seed: 301 }), new MagicTree({ x: 1350, h: 166, r: 62, seed: 302, col: D.cloudLight }), new MagicTree({ x: 1530, h: 146, r: 56, seed: 303 })];
    const hang = [[-0.6, 0.6], [0.05, 0.84], [0.62, 0.56]];
    this.fruits = [];
    this.mtrees.forEach((tr, ti) => {
      (ti === 0 ? [0, 1, 2] : [0, 2]).forEach((hi, i) => this.fruits.push({ tree: tr, dx: hang[hi][0] * tr.r, dy: hang[hi][1] * tr.r + 6, k: 0, gold: 0, state: 'none', wig: { x: 0, v: 0 }, seed: 500 + ti * 10 + i }));
    });
    this.great = { x: X.old - 200, y: -322, wig: { x: 0, v: 0 }, hum: 0, rings: [] };
    this.basket = { x: 1292, k: 0, n: 0, pop: { x: 0, v: 0 } };
    this.flying = []; this.picked = 0; this.cur = null;
    this.saps = [new Sapling(1985, 311), new Sapling(2115, 312), new Sapling(2245, 313)];
    this.gard = up('mama', 2470, { dir: -1 }); this.gardGo = 2470; this.wet = null; this.canTilt = 0; this.dropT = 0; this.pour = null;
    // our two are drawn last (in front of everybody), and what the others wear is drawn with them, in their depth
    for (const c of [this.papa, this.kit]) { this.cats.splice(this.cats.indexOf(c), 1); this.cats.push(c); }
    const dress = (c, fn) => { const d = c.draw.bind(c); c.draw = (ctx, t) => { d(ctx, t); if (!c.hidden) fn(ctx); }; };
    for (const f of this.folk) dress(f.cat, (ctx) => { if (f.wear === 'scarf') drawScarf(ctx, f.cat, '#f29bb4'); else if (f.wear === 'bow') drawBow(ctx, f.cat, '#ffd35a'); else drawEarFlower(ctx, f.cat); });
    dress(this.gard, (ctx) => { const gc = this.gard; drawApron(ctx, gc); drawEarFlower(ctx, gc); const h = this.canAt(); drawCan(ctx, h.x, h.y, gc.dir, this.canTilt); });
    // the tree that will be dreamed up
    this.stroke = null; this.dtree = null; this.motes = []; this.last = null; this.moundPulse = 0; this.scr = null;
    // the edge of town, and our house
    this.town = [this.addTree({ x: X.town, h: 172, r: 60, kind: 'round', seed: 71 }), this.addTree({ x: X.town + 190, h: 192, r: 64, kind: 'apple', seed: 72 }), this.addTree({ x: X.town + 380, h: 176, r: 62, kind: 'big', hollow: true, seed: 73 })];
    this.home = this.addHouse({ x: X.home, w: 176, h: 268, style: 'lilac', seed: 75, chimney: true, windows: [{ dx: -24, dy: -186, w: 58, h: 62, lit: 1, flame: true, ledge: 48, glowK: 1.5 }, { dx: -40, dy: -84 }, { dx: 46, dy: -84 }] });
    this.sill = Perch.sill(this.home, 0);
    // our room, exactly as in scene 1
    this.room = new Candle(game, 1, { passive: true });
    this.sillTale = null; this.gift = null; this.zT = 1;
    this.feT = 0;
    this.expect = () => this.expectNow();
    this.audio.play('garden', { intensity: 0.45 }); this.audio.ambience('dream');
  }

  // ───────────────────────── story ─────────────────────────
  async run() {
    const steps = {
      mist: async () => { await Promise.all([this.say(0), this.clearMist()]); await this.arrive(); },   // …some children dream of the world of the magic cats themselves.
      street: async () => { await this.say(1); await this.standUp(); await this.greet(); },             // …walk on their hind legs, live in little houses, know how to talk.
      gate: () => this.toGate(),          // …a library there — no, not a library at all, but a magic garden of fairy tales.
      garden: () => this.toGarden(),      // In that garden the tales grow on magic trees.
      old: () => this.ancient(),          // Some tales grow for hundreds of years…
      pick: () => this.picking(),         // others are picked the moment they ripen.
      tend: () => this.tending(),         // Gardener cats walk among the trees and look after them —
      draw: () => this.dreaming(),        // …can even dream up whole new trees.
      finale: () => this.finale(at === 'town' || at === 'room' ? at : undefined)
    };
    const at = this.game.params.get('at');                 // dev shortcut: ?scene=9&at=pick|tend|draw|finale|town|room
    let from = Math.max(0, STEPS.indexOf(at));
    if (from > 0) { this.skipTo(from); await this.wait(0.4); }
    const keys = Object.keys(steps);
    for (let i = Math.min(from, keys.length - 1); i < keys.length; i++) await steps[keys[i]]();
  }

  // B0 — brush the dream mist aside (a wide, still picture: the town of the cats appears)
  async clearMist() {
    const v = this.view;
    const tg = this.mist.map((m) => ({ get x() { return v.left + m.u * v.width; }, get y() { return m.y - (m.i < 2 ? clamp01((v.height - 700) / 500) * 170 : 0); }, r: 100, get done() { return m.done; } }));
    this.mistY = (m) => tg[m.i].y;
    await this.wait(0.5);
    for (let n = 0; n < this.mist.length; n++) {
      const i = await this.tapAny(tg, { text: T.mist }), m = this.mist[i];
      m.done = true;
      if (n === 1) this.spawn(() => this.arrive());                // our two come walking in out of the mist
      this.audio.sfx.whoosh(0.7, m.u - 0.5); this.audio.scaleNote(n * 2, { inst: 'glass', vel: 0.6 });
      this.fx.burst('spark', tg[i].x, tg[i].y, 12, { speed: 110, life: 1, size: 5, colors: ['#ffd35a', '#f6a9bd', '#8fd0e2'], layer: 2, spread: 60 });
      this.spawn(() => this.tween(m, { dx: m.dir * v.width * 0.8, a: 0 }, 1.25, ease.inOutQuad));
      this.spawn(() => this.tween(this, { veil: 1 - (n + 1) / this.mist.length }, 1.1, ease.outQuad));
    }
    await this.wait(0.8);
  }
  arrive() {
    if (this._arrival) return this._arrival;
    this.audio.sfx.step();
    return (this._arrival = Promise.all([this.goTo(this.papa, -150, STROLL), this.goTo(this.kit, -206, STROLL * 1.05)]).then(() => {
      this.papa.look = this.headOf(this.folk[0].cat);              // a look at the cats who live here
      this.kit.look = this.headOf(this.folk[1].cat);
    }));
  }

  // B1 — the cats of this world stand up, and talk
  async standUp() {
    this.camPhase = 'street';
    this.direct();
    for (const c of [this.papa, this.kit]) {
      c.act('ears'); await this.wait(0.35);
      c.mode = 'upright'; c.dir = 1;                                // (the rig rises on to the hind legs as a movement)
      this.audio.sfx.pop(); if (c === this.kit) { c.meow(0.22); this.audio.sfx.mrrp(true); }
      this.fx.burst('spark', c.x, c.y - 40 * c.size, 7, { speed: 70, life: 0.8, size: 4, colors: ['#ffd35a', '#f6a9bd'] });
      await this.wait(0.45);
    }
    this.kit.look = this.headOf(this.papa); this.papa.look = this.headOf(this.kit);   // look at us: on two legs!
    this.bounce(this.kit);
    await this.wait(0.7);
    this.papa.look = this.kit.look = null;
  }
  async greet() {
    const tg = this.folk.map((f) => ({ get x() { return f.cat.x; }, get y() { return f.cat.y - 44 * f.cat.size; }, r: 52, get done() { return f.done; } }));
    let last = null;
    for (let n = 0; n < this.folk.length; n++) {
      if (n > 0) { const c = this.folk.find((q) => !q.done).cat; await this.untilSeen(c.x, c.y - 44 * c.size); }  // (the next hello is offered once that cat is in the picture)
      const i = await this.tapAny(tg, { text: T.hello });
      this.hello(this.folk[i]); this.folk[i].done = true;
      const me = n === 1 ? this.kit : this.papa, icon = ['star', 'heart', 'tale'][n];
      last = this.answer(this.folk[i], me, icon).catch(() => {});
    }
    await last;                                                              // (the last answer is seen to the end before they move on)
    await this.wait(0.6);
  }
  // our cat walks over to whoever said hello, waves back, says something and bows its head
  async answer(f, me, icon) {
    const tok = ++this._ans, c = f.cat, p = this.papa, k = this.kit;
    // Papa stops beside the cat at a talking distance, the kitten on his far side — unless the kitten is the one
    // who answers, then it steps up nearer and Papa waits a pace behind it
    const side = p.x < c.x ? -1 : 1, px = c.x + side * (me === k ? 132 : 74), kx = me === k ? c.x + side * 66 : px + side * 50;
    this.makeRoom(f, px, kx);
    if (Math.abs(p.x - px) > 20 || Math.abs(k.x - kx) > 20) {
      this.stroll(k, kx, STROLL * 1.3);
      await this.goTo(p, px, STROLL * 1.15);
      if (tok !== this._ans) return;
    }
    for (const q of [p, k]) { q.dir = c.x > q.x ? 1 : -1; q.look = this.headOf(c); }
    await this.wait(me === k ? 0.2 : 0.35);
    me.wake(); this.wave(me, 1.1);
    this.bubble(me, icon); me.meow(0.25); this.audio.sfx.mrrp(me === k, this.pan(me.x));
    await this.wait(0.7);
    this.bow(me);
    await this.wait(1.2);
    if (tok === this._ans) p.look = k.look = null;
  }
  hello(f) {
    const c = f.cat, A = this.audio, pan = this.pan(c.x);
    c._go = null; c.walking = 0;                                          // (she stops where she is to answer)
    f.talk = 2.6; c.dir = this.papa.x < c.x ? -1 : 1; c.eyes = 'happy';
    c.look = this.headOf(this.papa);
    this.bubble(c, f.icon); this.wave(c, 1.2);
    c.meow(f.voice === 1 ? 0.3 : 0.4);
    if (f.voice === 0) A.sfx.meow(false, pan);
    else if (f.voice === 1) { A.sfx.mrrp(false, pan); A.blip({ f0: 300, f1: 430, dur: 0.2, vel: 0.07, type: 'triangle', when: A.now + 0.17, pan }); }
    else A.sfx.meow(true, pan);
    A.chordNote(f.voice, { vel: 0.5, pan });
    this.spawn(async () => { await this.wait(1.3); this.bow(c); await this.wait(1); c.eyes = 'open'; });
  }

  // B2 — "…not a library at all, but a magic garden of fairy tales"
  async toGate() {
    this.camPhase = 'walk'; this.direct(); this.camGoal = { l: X.gate - 190, r: X.gate + 90, t: -214, b: 0 };
    this.spawn(async () => {                                                // the cats of the town wave them off
      await this.wait(0.5);
      for (const f of this.folk) { f.talk = 1.6; f.cat.dir = 1; f.cat.look = this.headOf(this.papa); this.wave(f.cat, 1.3); await this.wait(0.25); }
    });
    this.spawn(async () => { await this.wait(1.2); for (const c of [this.papa, this.kit]) this.spawn(() => this.tween(c, { y: 0 }, 1.4, ease.inOutSine)); });   // past the houses, back onto the road
    await Promise.all([this.say(2), this.travel(X.gate - 124)]);
    this.camPhase = 'gate';
    this.papa.look = { x: X.gate, y: -176 }; this.kit.look = { x: X.gate, y: -150 };   // what does the sign say?
    await this.tapOn({ x: X.gate, y: -78, r: 88 }, { text: T.gate });
    this.wave(this.papa, 0.5);                                              // a knock
    this.audio.sfx.knock();
    await this.tween(this.gate, { flip: 1 }, 0.6, ease.inOutQuad);        // the sign turns: a book → a tree of tales
    this.audio.sfx.pop(); this.sparkle(X.gate, -176, 10, '#ffd35a');
    this.kit.act('tilt');
    await this.wait(0.35);
    this.audio.sfx.rise(); this.audio.sfx.whoosh(0.6);
    await this.tween(this.gate, { open: 1 }, 0.9, ease.outCubic);
    this.papa.look = this.headOf(this.kit); this.kit.look = this.headOf(this.papa); this.bounce(this.kit);
    await this.wait(0.6);
    this.papa.look = this.kit.look = null;
  }

  // B3 — the tales grow on magic trees
  async toGarden() {
    this.camPhase = 'walk'; this.direct(); this.camGoal = { l: X.garden - 240, r: X.garden + 60, t: -260, b: 0 };
    await Promise.all([this.say(3), this.travel(X.garden - 114)]);
    this.camPhase = 'trees';
    const tg = this._treeTg = this.mtrees.map((tr) => ({ x: tr.x, y: tr.cy, r: tr.r + 12, done: false }));
    for (let n = 0; n < tg.length; n++) {
      const nx = tg.find((q) => !q.done);
      if (nx) { this.papa.look = { x: nx.x, y: nx.y }; this.kit.look = this.papa.look; }
      if (n > 0 && nx) await this.untilSeen(nx.x, nx.y);                  // (offered once it is in the picture)
      const i = await this.tapAny(tg, { text: T.trees }), tr = this.mtrees[i];
      tg[i].done = true;
      tr.ring();
      this.papa.look = this.kit.look = { x: tr.x, y: tr.cy + tr.r * 0.5 };
      this.audio.chordNote(n + 1, { inst: 'glass', vel: 0.7, pan: this.pan(tr.x) }); this.audio.sfx.chime(3, this.pan(tr.x));
      this.fx.burst('spark', tr.x, tr.cy, 12, { speed: 90, life: 1, size: 5, colors: ['#ffd35a', '#ffffff', '#f6a9bd'], spread: tr.r });
      this.fruits.filter((f) => f.tree === tr).forEach((f, j) => this.spawn(async () => {      // its tales begin to bud
        await this.wait(0.25 + j * 0.22);
        f.state = 'bud'; f.wig.v += 6; this.audio.sfx.plip(this.pan(tr.x));
        await this.tween(f, { k: 0.24 }, 0.4, ease.outBack);
      }));
      if (n === 0) this.bounce(this.kit);
    }
    await this.wait(1.3);
    this.papa.look = this.kit.look = null;
  }

  // B4 — the tale that has been growing for hundreds of years: a wide, still picture, the cats small under it
  async ancient() {
    this.camPhase = '';
    const g = this.great;
    this.shot(() => ({ l: Math.min(this.kit.x, 1320) - 30, r: X.old + 170, t: -470, b: 0 }), this.reduced ? 0.4 : 3.2, { ground: true, max: 1.15, min: 0.6 });
    const look = { x: g.x, y: g.y + 20 };
    this.spawn(async () => { await this.goTo(this.papa, 1404, STROLL); this.papa.look = look; });
    this.spawn(async () => { await this.goTo(this.kit, 1356, STROLL); this.kit.look = look; });
    await this.say(4);
    await this.tapOn({ x: g.x, y: g.y + 30, r: 60 }, { text: T.old });
    this.hum();
    this.knowsOld = true;
    this.papa.look = this.kit.look = look;
    this.papa.act('ears');
    await this.wait(0.9);
    this.papa.act('slowblink'); this.kit.act('tilt');                       // (a cat's way of saying: I love you, old one)
    await this.wait(1.7);
  }
  hum() {
    const g = this.great, A = this.audio;
    g.wig.v += 5; g.hum = 1;
    A.glass(38, { vel: 1, dur: 2.3, bus: A.sfxBus }); A.glass(50, { vel: 0.85, dur: 2.3, bus: A.sfxBus }); A.glass(57, { vel: 0.5, dur: 2, bus: A.sfxBus });
    A.glass(62, { vel: 0.35, dur: 1.8, bus: A.sfxBus, when: A.now + 0.25 });
    for (let i = 0; i < 3; i++) g.rings.push({ r: 34, d: i * 0.5 });
    this.fx.burst('spark', g.x, g.y + 32, 10, { speed: 44, life: 2.2, size: 4.5, colors: ['#ffd35a', '#ffffff', '#e0a020'], grav: 16, drag: 0.6, layer: 2 });
  }

  // B5 — "…picked the moment they ripen": papa goes from tree to tree, the kitten minds the basket
  async picking() {
    this.papa.look = this.kit.look = null;
    this.camPhase = 'pick';
    this.direct();
    // the kitten minds the basket: it follows him there, then sits by it, a step nearer to us than Papa's line, and
    // watches the tales ripen and fly in; Papa alone goes from tale to tale (passing behind it, so nobody has to
    // change sides) — keepApart leaves a minding kitten alone
    const MIND = this.basket.x - 44;
    this.spawn(async () => {
      await this.wait(0.45);
      await this.goTo(this.kit, MIND, TROT);
      const K = this.kit; K._mind = true; K.dir = 1; K.mode = 'sit';
      await this.tween(K, { y: K.y + 10 }, 0.3, ease.outQuad);
    });
    await Promise.all([this.say(5), this.goTo(this.papa, MIND - 72, TROT)]);   // (his first place: a talking distance from the kitten's)
    this.audio.sfx.knock();
    await this.tween(this.basket, { k: 1 }, 0.4);
    this.phase = 'pick';
    const order = [1, 3, 5, 0, 4, 2, 6];
    let n = 0;
    while (this.picked < 5) {
      let f = null;
      for (let j = 0; j < order.length && !f; j++) { const c = this.fruits[order[(n + j) % order.length]]; if (c.state !== 'picked') { f = c; n += j + 1; } }
      this.nextTale = f;
      let px = clamp(f.tree.x + f.dx + (f.tree.x + f.dx > this.basket.x ? -34 : 34), 1100, 1600);
      if (Math.abs(px - MIND) < 76) px = MIND + (px >= MIND ? 76 : -76);    // (he never stops right behind the kitten)
      this.stroll(this.papa, px, TROT);                                       // the picker goes to stand under it…
      { const q = this.fruitPos(f); await this.untilSeen(q.x, q.y + 17); }   // (offered once the camera has it in the picture)
      this.cur = f; this.nextTale = null;
      if (f.k < 0.9) { f.state = 'grow'; this.audio.sfx.plip(this.pan(f.tree.x)); await this.tween(f, { k: 1 }, 0.95, ease.outBack); await this.wait(0.3); }
      f.state = 'gold'; f.wig.v += 4;
      this.audio.sfx.chime(3, this.pan(f.tree.x));
      this.spawn(() => this.tween(f, { gold: 1 }, 0.25));
      const t0 = this.t, first = this.picked === 0;                        // the first ripe tale waits to be picked; the others, a good while
      await this.until(() => f.state === 'picked' || (!first && !this.game.auto && this.t - t0 > 4.5));
      if (f.state !== 'picked') { f.state = 'white'; await this.tween(f, { gold: 0 }, 0.5); } else await this.wait(0.55);
    }
    this.cur = null; this.phase = '';
    { const K = this.kit; await this.tween(K, { y: K.y - 10 }, 0.3, ease.inOutQuad); K._mind = false; K.mode = 'upright'; }   // (the kitten gets up from its place)
    await this.wait(0.5);
    await this.goTo(this.papa, this.basket.x + 46, TROT);
    this.papa.dir = -1; this.papa.look = this.kit.look = { x: this.basket.x, y: -30 };
    this.papa.eyes = 'happy'; this.bounce(this.kit); this.audio.sfx.purr(1.4);
    this.sparkle(this.basket.x, -44, 12, '#ffd35a');
    await this.wait(1.2);
    this.papa.eyes = 'open'; this.papa.look = this.kit.look = null;
  }
  pickAt(p) {
    let best = null, bd = 46;
    for (const f of this.fruits) {
      if (f.state === 'none' || f.state === 'picked') continue;
      const q = this.fruitPos(f), d = dist(p.x, p.y, q.x, q.y + 17 * Math.max(0.4, f.k));
      if (d < bd) { bd = d; best = f; }
    }
    if (!best) return false;
    if (best.state === 'gold') this.pick(best);
    else { best.wig.v += 9; this.audio.sfx.plip(this.pan(best.tree.x)); this.papa.act('tilt'); }       // not yet: it only wiggles
    return true;
  }
  pick(f) {
    const q = this.fruitPos(f), slot = this.basket.n + this.flying.length;
    f.state = 'picked'; this.picked++;
    f.tree.ring();
    this.reach(this.papa, q.x, q.y + 17, 0.5);                                 // a reach up for it
    this.audio.playerNote({ pan: this.pan(q.x) }); this.audio.sfx.pop(this.pan(q.x));
    this.sparkle(q.x, q.y + 17, 10, '#ffd35a');
    const fl = { x0: q.x, y0: q.y + 17, u: 0, x: q.x, y: q.y };
    this.flying.push(fl);
    this.kit.look = fl;                                                          // the kitten watches it come
    this.spawn(async () => {
      await this.tween(fl, { u: 1 }, 0.66, ease.inOutQuad);                     // it wraps itself in its little sheet on the way
      this.flying.splice(this.flying.indexOf(fl), 1);
      if (this.kit.look === fl) this.kit.look = null;
      this.basket.n++; this.basket.pop.v += 8;
      this.audio.sfx.swish(this.pan(this.basket.x)); this.audio.chordNote(slot, { vel: 0.5 });
      this.sparkle(this.basket.x, -40, 6);
      this.bounce(this.kit);
    });
  }
  fruitPos(f) { return f.tree.hang(f.dx, f.dy, this.t); }

  // B6 — the gardener cats look after the trees (papa and the kitten follow her about and watch)
  async tending() {
    this.gardGo = this.saps[0].x + 58;                    // she walks over to the first sapling while they come
    this.camPhase = 'walk'; this.direct(); this.camGoal = { l: this.saps[0].x - 150, r: this.saps[0].x + 100, t: -130, b: 0 };
    await Promise.all([this.say(6), this.travel(X.tend - 205)]);
    this.camPhase = 'tend';
    this.gard.look = this.headOf(this.papa); this.wave(this.gard, 1);          // hello from the gardener
    this.spawn(async () => { await this.wait(1.4); if (this.gard.look && !this.wet) this.gard.look = null; });
    let done = 0;
    await Promise.all(this.saps.map((s, i) => this.water(s, i).then(() => {
      done++;
      const nx = this.saps.find((q) => q.perk < 1 && q !== s);
      if (nx) { this.gardGo = nx.x + 58; this.stroll(this.papa, nx.x - 112, STROLL); this.trail(this.kit, nx.x - 172, STROLL); }   // she goes on to the next one; they follow at a respectful distance
    })));
    this.wet = null; this.gardGo = 2330;
    this.gard.look = this.headOf(this.papa);
    this.gard.eyes = 'happy'; this.bubble(this.gard, 'heart'); this.gard.meow(0.4); this.audio.sfx.meow(false, this.pan(this.gard.x));
    this.papa.look = this.headOf(this.gard); this.wave(this.papa, 0.9);
    await this.wait(1.5);
    this.gard.eyes = 'open'; this.gard.look = null; this.papa.look = null;
  }
  water(s, i) {
    let last = -1;
    // The hold only calls the gardener over; the sapling straightens (and the water sounds) once she
    // stands there and really pours — see update(): the cats look after the trees, not the finger.
    s.note = (n) => { if (n !== last) { last = n; this.audio.scaleNote(n + i * 2, { inst: 'glass', vel: 0.4, pan: this.pan(s.x) }); } };
    return this.holdOn({ x: s.x + 8, y: -50, r: 58 }, 1.5, {
      keep: true, text: T.water,
      onStart: () => { this.wet = s; this.gardGo = s.x + 58; this.papa.look = this.kit.look = { x: s.x, y: -40 }; if (Math.abs(this.papa.x - (s.x - 112)) > 40) { this.stroll(this.papa, s.x - 112, STROLL * 1.3); this.trail(this.kit, s.x - 172, STROLL * 1.3); } },
      onProgress: (f) => { s.want = Math.max(s.want || 0, f); },
      onStop: () => { if (this.wet === s) this.wet = null; if (this.pour) { this.pour.stop(); this.pour = null; } }
    }).then(() => {
      s.perk = 1; s.b.v += 6;
      this.audio.sfx.rise(this.pan(s.x));
      this.fx.burst('spark', s.x, -84, 12, { speed: 80, life: 0.9, size: 5, colors: ['#ffd35a', '#f6a9bd', '#ffffff'] });
      this.bounce(this.kit);
    });
  }

  // B7 — dream up a whole new tree: draw it. The camera stands still the whole time (the stroke is in
  // world coordinates and must stay under the finger).
  async dreaming() {
    this.papa.look = this.kit.look = null;
    this.camPhase = 'walk'; this.direct(); this.camGoal = { l: X.mound - 190, r: X.mound + 150, t: -352, b: 0 };
    await Promise.all([this.say(7), this.travel(X.mound - 134)]);
    this.camPhase = '';
    await this.shot(() => this.drawBox(), this.reduced ? 0.4 : 1.4, { ground: !this.view.portrait, max: 1.5, min: 0.7 });
    this.papa.eyes = 'closed'; this.papa.dir = 1;
    this.kit.look = { x: X.mound, y: -30 }; this.kit.mode = 'sit';
    this.drawT = 0; this.failed = 0;
    this.phase = 'draw';
    await this.until(() => this.stroke && this.stroke.done);
    this.phase = ''; this.hint(null);
    this.papa.eyes = 'happy';
    const flies = clamp(this.game.save.flies || 0, 7, 34);
    const data = DreamTree.fromStroke(this.stroke.pts, { x: X.mound, y: -4 }, flies, 1 + Math.floor(Math.random() * 9000));
    this.game.save.tree = data; this.game.persist();                       // so the tree can be shown again later
    await this.growTree(data, true);
    this.papa.eyes = 'open';
  }
  // the fixed picture for drawing: the soil, room above it for a tall tree, papa dreaming beside it
  // (on an upright screen the soil sits well above the bottom edge: the box reaches below the ground)
  drawBox() { return { l: Math.min(X.mound - 176, this.kit.x - 34), r: X.mound + 150, t: -352, b: this.view.portrait ? 70 : 0 }; }
  async growTree(data, animate) {
    const tr = this.dtree = new DreamTree(data);
    if (!animate) return;
    tr.g = 0; tr.ck = tr.ck.map(() => 0);
    for (const b of tr.blossoms) b.k = 0;
    this.spawn(() => this.tween(this.stroke, { fade: 0 }, 1.4));
    let last = -1;
    const tip = { x: X.mound, y: -10 };
    this.papa.look = this.kit.look = tip;                                    // both watch the trunk climb
    await this.frames((dt, el) => {                                         // the trunk climbs along the stroke
      const f = clamp01(el / 1.9);
      tr.g = ease.inOutSine(f);
      const a = tr.at(tr.g); tip.x = X.mound + a.x; tip.y = -4 + a.y;
      const n = Math.floor(f * 9);
      if (n !== last) { last = n; this.audio.scaleNote(n, { inst: 'pluck', vel: 0.55 }); this.fx.burst('spark', tip.x, tip.y, 3, { speed: 50, life: 0.8, size: 4, colors: ['#ffd35a', '#f6a9bd'] }); }
      return f >= 1;
    });
    for (let i = 0; i < tr.crowns.length; i++) {                            // the cloud crowns unfold
      const c = tr.crowns[i];
      tip.x = X.mound + c.x; tip.y = -4 + c.y;
      this.audio.sfx.pop(); this.audio.chordNote(i, { inst: 'glass', vel: 0.6 });
      this.fx.burst('spark', X.mound + c.x, -4 + c.y, 8, { speed: 90, life: 0.8, size: 4.5, colors: ['#ffffff', '#ffd35a', '#8fd0e2'], spread: c.r });
      await this.tween(tr.ck, { [i]: 1 }, 0.42);
    }
    this.audio.sfx.rise();
    this.kit.mode = 'upright'; this.bounce(this.kit);
    // every firefly caught along the way comes to open a blossom
    const v = this.view, n = tr.blossoms.length;
    tr.blossoms.forEach((b, i) => this.spawn(async () => {
      await this.wait(0.3 + i * 0.09);
      const m = { x0: v.cam.x + (i % 5 - 2) * 40, y0: v.top + 20, x1: X.mound + b.x, y1: -4 + b.y, u: 0, sd: i % 2 ? 1 : -1 };
      this.motes.push(m);
      await this.tween(m, { u: 1 }, 0.75, ease.inOutQuad);
      this.motes.splice(this.motes.indexOf(m), 1);
      if (n < 14 || i % 2 === 0) this.audio.scaleNote(i % 10, { inst: 'box', vel: 0.3, octave: 2 });
      await this.tween(b, { k: 1 }, 0.35);
    }));
    await this.wait(0.3 + n * 0.09 + 1.5);
    this.papa.look = this.kit.look = null;
  }

  // ───────────────────────── finale ─────────────────────────
  async finale(part) {
    const p = this.papa, k = this.kit, tr = this.dtree;
    if (!part) {
      // one tale ripens on the new tree — the last one, for us
      const c = tr.main;
      const f = this.last = { x: X.mound + c.x, y: Math.min(-58, -4 + c.y + c.r * 0.6), k: 0, gold: 0, state: 'grow', wig: { x: 0, v: 0 }, fly: null };
      this.shot(() => {                                                      // the picker, the tale, and the whole new tree (however wide it was drawn)
        const b = { l: Math.min(k.x, f.x) - 40, r: Math.max(p.x, f.x) + 70, t: f.y - 70, b: 0 };
        for (const q of tr.crowns) { b.l = Math.min(b.l, X.mound + q.x - q.r); b.r = Math.max(b.r, X.mound + q.x + q.r); }
        return b;
      }, this.reduced ? 0.4 : 1.8, { ground: true, max: 1.6, min: 0.7 });
      p.look = k.look = { x: f.x, y: f.y + 10 };
      this.audio.sfx.plip();
      await this.tween(f, { k: 1 }, 1.3, ease.outBack);
      this.audio.sfx.chime(4);
      await this.tween(f, { gold: 1 }, 0.5);
      f.state = 'gold';
      await this.tapOn(() => ({ x: f.x, y: f.y + 16, r: 48 }), { text: T.last });
      f.state = 'picked'; f.fly = { u: 0 };
      this.audio.sfx.pop(); this.audio.sfx.bell(); this.sparkle(f.x, f.y + 16, 14, '#ffd35a');
      this.wave(p, 1);                                                      // papa holds up his paw for it
      await this.tween(f.fly, { u: 1 }, 0.8, ease.inOutQuad);
      this.last = null;
      p.bindle = true; this.bounce(p); this.audio.sfx.swish();
      p.look = this.headOf(k); k.look = this.headOf(p);
      this.bubble(k, 'heart'); k.meow(); this.audio.sfx.meow(true, this.pan(k.x));
      await this.wait(1.6);
      p.look = k.look = null;
    }
    if (part !== 'room') {
      // night falls as they carry it home
      this.story.clear();
      this.audio.setIntensity(0.25);
      this.spawn(() => this.skyTo('night', 6.5));
      this.spawn(() => this.tween(this, { far: 0.5 }, 6.5));
      this.spawn(async () => { await this.wait(3); this.audio.ambience('night'); });
      for (const c of [p, k]) { c.mode = 'stand'; c.dir = 1; this.fx.burst('spark', c.x, c.y - 30 * c.size, 5, { speed: 40, life: 0.7, size: 3.5, colors: ['#ffd35a', '#ffffff'] }); }
      p.bindle = false; p.carry = 1; p.bundleSize = 1;                       // down on all fours (a movement), the tale in papa's teeth
      this.audio.sfx.pop();
      this.camPhase = 'home';
      this.track(() => this.frame(), { ground: true, max: 1.5, pad: 26, clampX: [-260, 4300], rate: 1.8, zoomIn: 0.6 });
      await this.wait(0.5);
      const home = this.goTo(p, X.town - 84, HURRY);
      await this.wait(0.55);                                                 // (the kitten falls in a good length behind)
      await Promise.all([home, this.goTo(k, X.town - 180, HURRY)]);
      // up into the treetops: the old road
      const perch = this.town.map((t) => t.perch);
      p.look = { x: perch[0].x, y: perch[0].y - 20 };                         // a look up first
      await this.wait(0.45);
      this.audio.sfx.hop(this.pan(p.x));
      await this.jump(p, perch[0].x, perch[0].y);
      p.look = null;
      this.town[0].land(1); this.audio.sfx.land(0); this.audio.playerNote(); this.leaves(p.x, p.y - 4, 6);
      this.leap = new Leap(this, { cat: p, perches: perch, start: perch[0], onLeap: (q) => { this._dest = q; } });
      this.leap.addFollower(k, null);
      this.leap.goal = perch[2];
      this.bounds = { l: X.town - 40, r: X.home - 130 };
      this.camPhase = 'leap'; this.phase = 'leap';
      await this.leap.reach(perch[2]);
      this.phase = ''; this.leap.enabled = false;
      // the window of our own house: papa looks at it while the kitten catches up
      const g = this.home.win(this.home.windows[0]);
      this.camPhase = 'sill';
      p.look = { x: g.x, y: g.y };
      await this.wait(0.95);                                                 // (the kitten catches up)
      this.leap = null;
      // the last leap is theirs: onto the sill of our own window
      this.audio.sfx.hop(this.pan(p.x));
      await this.jump(p, this.sill.x, this.sill.y);
      this.audio.sfx.land(this.pan(p.x), true); this.audio.playerNote();
      p.look = { x: g.x + 10, y: g.y - 4 };                                  // …and peers in at the candle
      this.spawn(() => this.tween(this.home.windows[0], { rings: 1 }, 1.2, ease.outCubic));
      this.audio.sfx.hop(this.pan(k.x));
      await this.jump(k, perch[2].x, perch[2].y);
      this.town[2].land(0.6); this.audio.sfx.land(this.pan(k.x), true);
      k.look = { x: g.x, y: g.y };
      await this.wait(0.9);
      // in through the glass: the camera goes up to the lit window as the night closes over it
      this.camPhase = '';
      this.shot({ l: g.x - g.w * 0.62, r: g.x + g.w * 0.62, t: g.top - 10, b: g.bottom + 10 }, this.reduced ? 0.4 : 1.6, { pad: 0, max: 3, min: 1 });
      await this.wait(0.5);
      await this.tween(this, { dark: 1 }, 1.0, ease.inQuad);
    } else this.dark = 1;
    await this.inside();
  }

  // ── inside: our room, the candle, the child asleep — slow, close, quiet ──
  async inside() {
    const p = this.papa, k = this.kit, r = this.room, R = this.reduced;
    this.enterRoom();
    this.shot(() => this.roomBox('sill'), 0, { pad: 8, max: 2.6 });
    await this.wait(0.5);
    this.spawn(() => this.tween(this, { dark: 0 }, 1.8, ease.outQuad));
    await this.wait(1.1);
    // papa hops in through the window, the kitten after him
    p.hidden = false; this.audio.sfx.hop(0.2);
    this.spawn(() => this.tween(p, { size: 1 }, 0.55));
    await this.jump(p, ON_SILL.papa, SILL, { height: 30, dur: 0.66 });
    this.audio.sfx.land(0, true);
    p.look = { x: CHILD.x, y: CHILD.y };                                    // the child is asleep…
    await this.wait(0.45);
    k.hidden = false; this.audio.sfx.hop(0.3);
    this.spawn(() => this.tween(k, { size: 0.6 }, 0.45));
    await this.jump(k, ON_SILL.kit, SILL, { height: 26, dur: 0.58 });
    this.audio.sfx.land(0.3, true);
    k.look = { x: CHILD.x, y: CHILD.y };
    await this.wait(0.9);
    k.meow(0.16); this.audio.sfx.mrrp(true, 0.3);                           // (very quietly)
    await this.wait(0.7);
    // the tale is set down beside the candle, like something precious
    this.shot(() => this.roomBox('tale'), R ? 0.4 : 2.6, { pad: 8, max: 2.4 });
    p.look = { x: ON_SILL.tale, y: SILL - 6 };
    await this.wait(0.8);
    const m = p.anchor('mouth'), s = p.bundleSize * (p.d ? p.d.H : 1) * p.size;
    p.carry = 0; p.meow(0.2);
    const b = this.sillTale = { x: m.x, y: m.y + 13 * s, rot: -0.2, glow: 0.3 }, x0 = b.x, y0 = b.y;
    this.audio.sfx.swish();
    await this.frames((dt, el) => {
      const u = clamp01(el / 0.75), e = ease.inOutSine(u);
      b.x = lerp(x0, ON_SILL.tale, e); b.y = lerp(y0, SILL, e) - 18 * 4 * e * (1 - e); b.rot = lerp(-0.2, 0, e) + Math.sin(Math.PI * u) * 0.2;
      return u >= 1;
    });
    this.audio.sfx.bell(); this.sparkle(b.x, b.y - 16, 10);
    this.spawn(() => this.tween(b, { glow: 0.8 }, 1.8));
    p.look = FLAME;
    await this.wait(1.4);
    // …and a story comes to Papa: we see the whole room again
    this.shot(() => this.roomBox('tell'), R ? 0.4 : 3.4, { pad: 4, max: 1.6, min: 0.6 });
    await this.wait(0.6);
    const gift = this.gift = { x: b.x, y: b.y - 24, u: 0, px: b.x, py: b.y - 24 };
    p.look = k.look = { x: gift.x, y: gift.y };
    this.audio.sfx.chime(4);
    await this.frames((dt, el) => {
      const u = clamp01(el / 2.2); gift.u = ease.inOutSine(u);
      gift.px = lerp(gift.x, STAR.x, gift.u); gift.py = lerp(gift.y, STAR.y, gift.u) - Math.sin(gift.u * Math.PI) * 70;
      p.look.x = k.look.x = gift.px; p.look.y = k.look.y = gift.py;        // the cats follow it with their eyes
      return u >= 1;
    });
    this.gift = null;
    this.sparkle(STAR.x, STAR.y, 14); this.audio.chordNote(3, { vel: 0.5 });
    p.look = k.look = { x: PAPA.x, y: PAPA.y };
    // Papa draws a breath (the room's own tweens need its clock, so they are done here), turns to the child, and tells it
    this.spawn(async () => { if (R) return; await this.tween(r.pa, { breath: 1 }, 0.8, ease.inOutSine); await this.wait(0.15); await this.tween(r.pa, { breath: 0 }, 1.3, ease.inOutSine); });
    await this.wait(0.9);
    r.turnTo = 1; r.pa.tiltTo = 0.06;
    this.spawn(async () => { await this.wait(1.2); r.pa.strokeTo = 1; r.ch.to = [0.42, 0.12, 1, 0.2]; await this.tween(r.ch, { smile: 0.6 }, 2.4); });
    this.telling = true;
    this.spawn(async () => {                                                  // his mouth moves softly: a tale told in a low voice
      await this.wait(1.4);
      while (this.telling) { r.pa.sing = 0.45 + Math.random() * 0.3; await this.wait(0.4 + Math.random() * 0.45); }
    });
    this.audio.sfx.purr(3.2);
    // the cats settle in: papa sits and blinks slowly at them; the kitten yawns, turns round and curls up
    this.spawn(async () => {
      await this.wait(0.8); p.mode = 'sit'; p.look = { x: CHILD.x + 120, y: CHILD.y - 10 };
      await this.wait(1.8); p.look = null; p.act('slowblink');
      await this.wait(1.6); p.eyes = 'happy';
    });
    this.spawn(async () => {
      await this.wait(1.6); k.look = null; k.act('yawn'); this.audio.sfx.yawn(true, 0.3);
      await this.wait(1.9); k.dir = 1; await this.wait(0.35); k.mode = 'curl'; k.eyes = 'closed';
    });
    this.spawn(() => this.farCat());                                         // far away, another cat is still on her round
    await this.wait(2.4);
    this.shot(() => this.roomBox('bed'), R ? 0.4 : 6, { pad: 4, max: 1.8, min: 0.6 });   // a slow push in while he tells it
    await this.wait(4.6);
    // the last thing of the night is ours: blow out the candle (hold the flame; left alone, it gutters out by itself)
    this.shot(() => this.roomBox('candle'), R ? 0.4 : 4.5, { pad: 6, max: 2.2, min: 0.8 });
    p.eyes = 'open'; p.look = FLAME;
    await this.wait(1.2);
    let blown = false;
    this.flame = { x: FLAME.x, y: FLAME.y, r: 56 };
    this.holdOn(() => this.flame, 1.3, {
      keep: true, text: T.blow,
      onStart: () => this.audio.sfx.blow(),
      onProgress: (f) => { r.lit = Math.min(r.lit, 1 - 0.55 * f); }
    }).then(() => { blown = true; }).catch(() => {});
    const t0 = this.t;
    await this.until(() => blown || this.t - t0 > (this.game.auto ? 22 : 90));
    this.flame = null; this.hint(null);
    this.audio.sfx.blow();
    this.telling = false; r.pa.strokeTo = 0;
    await this.tween(r, { lit: 0 }, blown ? 1.4 : 3.5, ease.outQuad);
    // a thread of smoke from the wick; the cats curl up; Papa's eyes close too
    if (!R) for (let i = 0; i < 4; i++) this.fx.add({ kind: 'puff', x: FLAME.x + (Math.random() - 0.5) * 4, y: FLAME.y - 4 - i * 6, vx: (Math.random() - 0.5) * 6, vy: -14 - i * 3, life: 2.4, size: 4, color: 'rgba(220,220,235,0.4)', grow: 5, sway: 6 });
    p.eyes = 'closed'; p.look = null;
    this.spawn(async () => { await this.wait(0.6); p.mode = 'curl'; });
    this.spawn(() => this.tween(r.pa, { shut: 1 }, 2.4, ease.inOutSine));
    this.shot(() => this.roomBox('night'), R ? 0.4 : 5, { pad: 0, max: 1.4, min: 0.6 });
    await this.wait(3.4);
    await this.game.endCard();
  }
  // what the camera frames in the room (candle.js coordinates; upright phones get narrower boxes)
  roomBox(name) {
    const P = this.view.portrait;
    switch (name) {
      case 'sill': return P ? { l: -30, r: 210, t: -262, b: -84 } : { l: -40, r: 230, t: -264, b: -6 };     // the window, where they come in (with the whole of Papa's head below, not a sliver)
      case 'tale': return P ? { l: -282, r: 118, t: -246, b: -88 }   // (upright: the sleeping child wholly in, not cut at the edge)
         : { l: -196, r: 186, t: -258, b: -6 };   // the candle, the tale, the cats
      case 'tell': return P ? { l: -292, r: 196, t: -236, b: 70 } : { l: -320, r: 250, t: -240, b: 110 };   // the child, Papa, the cats on the sill
      case 'bed': return P ? { l: -290, r: 190, t: -176, b: 70 } : { l: -300, r: 210, t: -172, b: 92 };     // closer: the two of them, the cats settling above
      case 'candle': return P ? { l: -236, r: 116, t: -236, b: -64 } : { l: -246, r: 132, t: -238, b: -62 };  // the flame, the tale, the cats asleep
      default: return P ? { l: -270, r: 210, t: -330, b: 90 } : { l: -330, r: 270, t: -350, b: 120 };       // the room going dark
    }
  }
  enterRoom() {
    const v = this.view, r = this.room, p = this.papa, k = this.kit;
    this.mode = 'room'; this.phase = ''; this.leap = null; this.follow = false; this.camPhase = '';
    this.track(null); this.shot(null);
    this.fx.clear(); this.says.length = 0;
    v.resetSafe(); v.safeW = 600; v.plain = true; this.game.layout(); this.cam.x = 0; this.cam.y = 0; this.cam.zoom = 1;      // (no more narration: the room may have the whole screen)
    r.lit = 1; r.room = 1; r.dim = 0; r.cat.hidden = true; r.turn = r.turnTo = 0;
    for (const c of [p, k]) { c.mode = 'stand'; c.dir = -1; c.hidden = true; c.eyes = 'open'; c.look = null; c.walking = 0; c.jump = null; c.air = 0; c.crouch = 0; c._go = null; c.light = 0.35; c.fidget = false; c.wake(); }
    p.x = 138; p.y = -250; p.size = 0.82; p.carry = 1; p.bindle = false;
    k.x = 168; k.y = -236; k.size = 0.48; k.carry = 0;
    this.audio.setIntensity(1); this.audio.play('lullaby'); this.audio.ambience('room');
  }
  async farCat() {
    const c = this.room.cat, tr = this.room.trees;
    Object.assign(c.c, CAT_KINDS.mama);
    c.size = 1.25; c.carry = 1; c.dir = 1; c.x = tr[0].topX; c.y = tr[0].perchY; c.hidden = false;
    for (let i = 1; i < 3; i++) {
      await this.wait(1.5);
      c.look = { x: tr[i].topX, y: tr[i].perchY - 10 };                       // (a look at the landing spot first)
      await this.wait(0.4);
      c.leapTo(tr[i].topX, tr[i].perchY);
      await this.until(() => !c.jump);
      tr[i].land(1); this.audio.sfx.land((i - 1) * 0.3, true); this.audio.playerNote({ vel: 0.35 });
    }
    c.look = null;
  }

  // ───────────────────────── helpers ─────────────────────────
  get cat() { return this.mode === 'room' ? this.papa : this.papa; }     // (for the test tools: the hero of the chapter)
  pan(x) { const v = this.view; return clamp(((x - v.cam.x) / Math.max(1, v.width)) * 1.6, -0.8, 0.8); }
  // walk (or trot) to x at a pace, easing in and out of it; the gait follows the distance really moved
  stroll(cat, x, speed) { cat.wake(); cat._go = { x, v: speed || STROLL, sp: cat._go ? cat._go.sp : 0 }; return cat._go; }
  goTo(cat, x, speed) { const g = this.stroll(cat, x, speed); return this.until(() => cat._go !== g); }
  async travel(papaX) {
    // (the kitten falls in a good length behind — not on Papa's tail — and closes up to his side when they stop)
    // (a kitten that is already ahead leads the way instead; the two never walk through each other — keepApart)
    const P = this.papa, K = this.kit, dir = papaX >= P.x ? 1 : -1, lead = (K.x - P.x) * dir > 0 ? dir : -dir;
    const go = this.goTo(P, papaX, TROT);
    if (lead < 0) await this.wait(0.4);
    await this.goTo(K, papaX + lead * 92, TROT);
    await go;
    await this.goTo(K, papaX + lead * 56, STROLL);
  }
  jump(cat, x, y, o) { cat._go = null; cat.walking = 0; cat.leapTo(x, y, o); return this.until(() => !cat.jump); }
  bounce(cat) { if (cat.jump || cat._bn || cat._go || cat._hop || (cat === this.kit && this.papa._go && !cat._mind)) return; cat._bn = true; this.spawn(async () => { const y = cat.y; try { await this.tween(cat, { y: y - 12 }, 0.13, ease.outQuad); await this.tween(cat, { y }, 0.17, ease.inQuad); } finally { cat._bn = false; } }); }
  bubble(cat, icon) { this.says.push({ cat, icon, k: 0, life: 2.5 }); }
  // a raised paw (upright cats), lowered again after `dur` seconds
  wave(cat, dur) {
    if (cat.mode !== 'upright') return;
    const id = (cat._wv || 0) + 1; cat._wv = id;
    this.spawn(async () => { await this.tween(cat, { armUp: 1 }, 0.22, ease.outQuad); await this.wait(dur); if (cat._wv === id) await this.tween(cat, { armUp: 0 }, 0.3, ease.inOutQuad); });
  }
  // an arm held up steadily towards (x, y) for `dur` seconds (upright cats), then lowered
  reach(cat, x, y, dur) {
    if (cat.mode !== 'upright') return;
    const id = (cat._rc || 0) + 1, sh = cat.anchor('neck'); cat._rc = id;
    cat.armReach = clamp(Math.atan2((x - sh.x) * cat.dir, y - sh.y), 0.6, 3);
    this.spawn(async () => { await this.tween(cat, { armHold: 1 }, 0.2, ease.outQuad); await this.wait(dur); if (cat._rc === id) await this.tween(cat, { armHold: 0 }, 0.35, ease.inOutQuad); });
  }
  // a little bow (from the waist when upright)
  bow(cat) {
    if (this.reduced) return;
    cat.act('bow');
  }
  // Personal space, for any timing. A town cat never stands on, chooses, or walks to a spot one of ours stands
  // on (while standing still) or is walking to — nor a spot another town cat stands on or is walking to. Whoever
  // is inside such a spot steps out to the nearest free place; two town cats that stand in each other ease apart.
  // (a clear gap of 12 units between bodies of ours and theirs, 8 between two of theirs)
  spotOf(c) { return c._go ? c._go.x : c.x; }
  // is x free for town cat c? (ours: where they stand still or are going; the other town cats: where they are going)
  spotFree(c, x) {
    const w = 26 * c.size;
    for (const h of [this.papa, this.kit]) {
      if (h.hidden || (h.jump && !h._go)) continue;
      if (Math.abs(x - this.spotOf(h)) < w + 26 * h.size + 12) return false;
    }
    for (const f of this.folk) { const o = f.cat; if (o !== c && Math.abs(x - this.spotOf(o)) < w + 26 * o.size + 8) return false; }
    return true;
  }
  // the nearest free spot to x (searching outwards on both sides, the side away from `away` first when tied)
  freeSpot(c, x, away) {
    if (this.spotFree(c, x)) return x;
    const first = away === undefined ? 1 : (x >= away ? 1 : -1);
    for (let k = 1; k <= 40; k++) for (const sd of [first, -first]) { const q = x + sd * k * 6; if (this.spotFree(c, q)) return q; }
    return x;
  }
  giveRoom() {
    if (!this.view.visible(X.street, 700)) return;
    for (const f of this.folk) {
      const c = f.cat, at = this.spotOf(c);
      if (this.spotFree(c, at)) continue;
      // (out on its own side of whichever of ours it is near, so it does not walk across them)
      const P = this.papa, K = this.kit, near = Math.abs(c.x - this.spotOf(P)) < Math.abs(c.x - this.spotOf(K)) ? P : K;
      const to = this.freeSpot(c, at, this.spotOf(near) + (c.x >= this.spotOf(near) ? -1 : 1) * 0.01);
      if (Math.abs(to - at) < 0.5) continue;
      this.stroll(c, to, 46); f.go = to; f.idle = Math.max(f.idle, 3);
    }
  }
  // Our two on the move: one rule for both. While either walks, their bodies stay at least 46 apart. A kitten
  // that is behind (or closing up to its place beside a standing Papa) does not come closer than that — it marks
  // time; a kitten that leads keeps its lead; a kitten that is in the way of a walking Papa and should follow
  // hops round him, through the nearer lane, to behind him. (At a stop side by side they may stand closer.)
  keepApart(pp, pk) {
    const P = this.papa, K = this.kit;
    if (this.mode === 'room' || P.hidden || K.hidden || P.jump || K.jump || K._hop || K._mind) return;
    if (Math.abs(P.y - K.y) > 30) return;                                   // (one of them up in a tree)
    const dx = K.x - P.x, d = Math.abs(dx);
    if (!(P._go || K._go)) {                                                // both standing: never one inside the other
      if (d < 26 * P.size + 26 * K.size && !K._bn && (P.mode === 'upright' || P.mode === 'stand') && K.mode !== 'curl') this.hopRound(K, Math.sign(dx) || -P.dir, P.dir);
      return;
    }
    let Dc = 26 * P.size + 26 * K.size + 46;
    if (!P._go && K._go) Dc = Math.min(Dc, Math.max(50, Math.abs(K._go.x - P.x)));   // (closing up to its place beside him)
    if (d >= Dc) return;
    const dP = P._go ? Math.sign(P._go.x - P.x) : 0, sideK = Math.sign(dx) || -(dP || 1), pT = P._go ? P._go.x : P.x;
    // which side of Papa the kitten belongs on: the side of its own goal (or, standing in his way, behind him)
    const want = K._go ? (Math.sign(K._go.x - pT) || sideK) : (dP ? (sideK === dP ? -dP : sideK) : sideK);
    if (want !== sideK) { if (!K._bn) this.hopRound(K, want, dP || want); return; }   // it has to change sides: a hop round him
    if (dP && sideK === dP) { K.x += Math.max(0, (P.x - pp) * dP) * dP + dP * Math.min(3, Dc - d); return; }   // it leads: it keeps (and makes) its lead
    if (d < Math.abs(pk - P.x)) K.x = pk;                                   // it follows: it does not come any closer
  }
  // the kitten sets off after Papa a moment later, so that a gap opens between them first
  trail(K, x, speed) { const tok = (K._fw || 0) + 1; K._fw = tok; this.spawn(async () => { await this.wait(0.45); if (K._fw === tok) this.stroll(K, x, speed); }); }
  // a small hop round Papa through the nearer lane (the kitten stays on its feet, upright or not)
  hopRound(K, side, face) {
    K._hop = true; K.walking = 0; K.wake();
    const R = this.reduced, dur = R ? 0.4 : 0.6, gap = () => Math.max(26 * this.papa.size + 26 * K.size + 46, 70);
    let x0 = K.x, x = this.papa.x + side * gap();
    K.dir = x > x0 ? 1 : -1;
    this._hops = (this._hops || 0) + 1;
    let off = 0;                                                             // (the arc is added to whatever height it has: lanes may be easing)
    this.spawn(async () => {
      try {
        if (!R) { K.sq.v += 5; await this.wait(0.14); }                       // a little crouch to gather itself…
        x0 = K.x; x = this.papa.x + side * gap();
        this.audio.sfx.hop(this.pan(x0));
        await this.frames((dt, el) => {
          const u = clamp01(el / dur), e = ease.inOutSine(u), x1 = this.papa.x + side * gap();     // (the spot moves on with Papa)
          K.x = lerp(x0, Math.abs(x1 - x) < 60 ? x1 : x, e); const o = Math.sin(Math.PI * u) * 6 - Math.sin(Math.PI * u) * (R ? 8 : 26); K.y += o - off; off = o;   // …and a real arc, about 20 up, through the nearer lane
          return u >= 1;
        });
        K.sq.v += 3;
      } finally { K.y -= off; off = 0; K._hop = false; K.dir = face; }
    });
  }
  // the town cats step aside if one of ours is going to stand where they are (to a place free of everybody)
  makeRoom(f0, ...xs) {
    for (const f of this.folk) {
      if (f === f0) continue;                                              // (one still talking steps aside too)
      const c = f.cat;
      for (const x of xs) if (Math.abs(c.x - x) < 54) { const to = this.freeSpot(c, c.x + (c.x >= x ? 1 : -1) * (58 - Math.abs(c.x - x)), x); f.go = to; this.stroll(c, to, 40); f.idle = 4 + Math.random() * 2; break; }
    }
  }
  // a live look target at another cat's head
  headOf(c) { const o = { get x() { return c.anchor('head').x; }, get y() { return c.anchor('head').y; } }; return o; }

  // ───────────────────────── the director's camera ─────────────────────────
  _add(l, r, t, b) { const B = this._fb; B.l = Math.min(B.l, l); B.r = Math.max(B.r, r); B.t = Math.min(B.t, t); B.b = Math.max(B.b, b); }
  _addCat(c) { if (c.hidden) return; const s = c.size, h = c.mode === 'upright' ? 92 : 62; this._add(c.x - 38 * s, c.x + 38 * s, c.y - h * s, c.y + 6); }
  // the paw shows the stroke once in the air (nothing is drawn: the tree stays the child's to draw)
  demo() {
    if (this._demo) return;
    this._demo = true;
    this.hint(T.draw);
    const e = this.expectNow();
    this.spawn(async () => {
      try {
        await this.wait(0.6);
        if (!e || this.phase !== 'draw' || (this.stroke && this.stroke.on)) return;
        const v = this.view;
        await this.frames((dt, el) => {
          if (this.phase !== 'draw' || (this.stroke && this.stroke.on && this.stroke.id !== -1)) return true;
          const u = clamp01(el / 1.6), q = e.via(ease.inOutQuad(u));
          this.game.showPaw(v.sx(q.x), v.sy(q.y), 0.12);
          return u >= 1;
        });
      } finally { this._demo = false; }
    });
  }
  // Wait until a cat stands inside the free part of the screen by a margin (30 px), or 2.5 s at most — the
  // story never waits for a camera, but the hint paw should not point at something outside the picture.
  untilSeen(wx, wy) {
    const v = this.view, t0 = this.t;
    return this.until(() => {
      if (this.t - t0 > 2.5) return true;
      const F = v.freeRect(), x = v.sx(wx), y = v.sy(wy);
      return x > F.l + 30 && x < F.r - 30 && y > F.t + 30 && y < F.b - 30;
    });
  }
  // the tracking camera (started once; a scripted shot in between hands back to it here)
  // (its options object is kept: frame() switches `ground` and `max` for the beats that want the ground higher up)
  direct() { if (!this._track) this.track(() => this.frame(), (this._camO = { ground: true, max: 1.7, pad: 24, clampX: [-260, 4300], rate: 2, zoomIn: 0.6 })); }
  // What the camera keeps in the picture while it tracks: our two cats, whatever the player is asked to
  // touch, and what the beat is about (a cat saying hello, the gate, the tree being picked, the gardener…).
  frame() {
    const B = this._fb, p = this.papa, k = this.kit, ph = this.camPhase;
    B.l = 1e9; B.r = -1e9; B.t = 1e9; B.b = -1e9;
    // On an upright screen the ordinary framing leaves the cats in the bottom strip under a tall empty sky.
    // Where nothing above matters (the walks, the tending) the box reaches below the ground instead, so the
    // action sits near the middle of the picture, and the shot may come closer.
    const low = this.view.portrait && (ph === 'walk' || ph === 'tend' || ph === 'street'), O = this._camO;
    if (O && this._track && this._track.o === O) {
      O.ground = !low; O.max = low ? (ph === 'street' ? 1.8 : 2.1) : 1.7;
      O.zoomOut = ph === 'walk' ? 0.8 : 2.4;                                 // (a walk widens at a pace the eye can follow)
    }
    // Upright screens are too narrow to hold a whole beat still, so the beats with one target after another keep
    // ONE window size and only slide it, between the hero of the beat and what is to be touched next (no breathing).
    if (low && ph === 'tend') {                                              // the gardener and the sapling she is called to
      const e = this.currentExpect(), sx = e && e.kind === 'hold' ? e.x : this.gard.x, cx = (this.gard.x + sx) / 2;
      this._add(cx - 108, cx + 108, -112, 46);
      return B;
    }
    if (this.view.portrait && (ph === 'trees' || ph === 'pick')) {
      const e = this.currentExpect(), nt = ph === 'trees' && this._treeTg ? this._treeTg.find((q) => !q.done) : null;
      const nf = ph === 'pick' && this.nextTale ? this.fruitPos(this.nextTale) : null;
      const tx = nt ? nt.x : nf ? nf.x : e && e.kind === 'tap' ? e.x : p.x, cx = (tx + p.x) / 2, w = ph === 'trees' ? 170 : 150;
      this._add(cx - w, cx + w, ph === 'trees' ? -300 : -250, 0);
      return B;
    }
    const leapAir = ph === 'leap' && this.leap && this.leap.state === 'air' && this._dest;
    if (!leapAir && ph !== 'sill') this._addCat(p);                       // (the sill shot is fixed: the window and the tree hold every spot of Papa's leap)
    if (ph !== 'leap' && ph !== 'pick' && ph !== 'home' && ph !== 'walk' && ph !== 'sill' && !(ph === 'street' && low) && Math.abs(k.x - p.x) < 260) this._addCat(k);
    if (ph === 'street' && low) {
      // upright: one window of one size for the whole greeting phase, leaning towards the next cat to greet
      // (which comes in at the side); everything said and done at a stop lies within it
      const nf = this.folk.find((q) => !q.done), lean = nf ? clamp(nf.cat.x - p.x, -170, 170) * 0.75 : 0, cx = p.x + lean;   // (leans towards the next cat even before it is asked for)
      this._add(cx - 160, cx + 160, -172, 50);
      return B;
    }
    if (ph === 'street') {
      // one height all through the greetings (room for the speech bubbles whether they are up or not), so the
      // zoom does not breathe as bubbles come and go; on an upright screen the ground sits at about 60 % down
      this._add(p.x - 40, p.x + 40, -172, low ? 50 : 0);
      for (const f of this.folk) if (f.talk > 0 && f.done) this._add(f.cat.x - 40, f.cat.x + 40, -118, 0);
      for (const s of this.says) this._add(s.cat.x - 66, s.cat.x + 66, -118, 0);
    } else if (ph === 'walk') {
      // A walk is one window of fixed size that travels with Papa, as tall as the picture waiting at its end —
      // so the zoom does not close in between two goals and widen again (upright screens: a narrower window,
      // reaching below the ground, the kitten and the goal left to come in at the sides)
      const G = this.camGoal, gt = G ? Math.min(G.t, -150) : -150;
      if (!low) this._add(p.x - 150, p.x + 230, gt, 0);
      else this._add(p.x - 110, p.x + 170, gt, 46);
    } else if (ph === 'gate') this._add(X.gate - 92, X.gate + 92, -212, 0);
    else if (ph === 'pick' && !this.view.portrait) this._add(1124, 1580, -236, 0);   // the whole orchard, held still from tale to tale (no breathing)
    else if (ph === 'pick') {
      if (this.cur) { const q = this.fruitPos(this.cur); this._add(q.x - 46, q.x + 46, q.y - 36, q.y + 50); if (Math.abs(this.basket.x - q.x) < 230) { this._add(this.basket.x - 44, this.basket.x + 44, -70, 0); this._addCat(k); } }
      else { this._add(this.basket.x - 44, this.basket.x + 44, -70, 0); this._addCat(k); }
      for (const fl of this.flying) this._add(fl.x - 20, fl.x + 20, fl.y - 20, fl.y + 20);
    } else if (ph === 'tend') {
      const gc = this.gard; this._add(gc.x - 50, gc.x + 50, -110, 0);
    } else if (ph === 'home') this._add(p.x - 140, p.x + 230, -300, 0);    // (one window of fixed size, as tall as the treetops they are about to leap into)
    else if (ph === 'leap') {
      const L = this.leap, perch = (q) => { if (q) this._add(q.x - 62, q.x + 62, q.y - 80, q.y + (q.kind === 'tree' ? 64 : 40)); };
      if (L) {
        if (leapAir) perch(this._dest); else perch(L.at);
        const n = L.enabled && L.state !== 'air' ? L.stepToward(L.goal) : null;
        perch(n);
        if (L.at === this.town[2].perch || this._dest === this.town[2].perch) { const g = this.home.win(this.home.windows[0]); this._add(g.x - g.w / 2 - 40, g.x + g.w / 2 + 30, g.top - 40, g.sillY + 40); }
      }
    } else if (ph === 'sill') {
      const g = this.home.win(this.home.windows[0]);
      this._add(g.x - g.w / 2 - 50, g.x + g.w / 2 + 40, g.top - 44, g.sillY + 30);
      this._add(this.town[2].x - 50, this.town[2].x + 40, this.town[2].perch.y - 60, this.town[2].perch.y + 20);
    }
    const e = this.currentExpect();
    if (e && e.x !== undefined && e.kind !== 'continue' && e.kind !== 'drag') {
      // (upright greetings: the next cat to greet is taken in only as far as Papa ± 240, so the camera leans
      // towards it and it comes in at the side, instead of the whole street being pulled into a wide shot)
      const ex = low && ph === 'street' ? clamp(e.x, p.x - 240, p.x + 240) : e.x;
      this._add(ex - 50, ex + 50, e.y - 50, e.y + 50);
    }
    return B;
  }

  // dev shortcut: put the world in the state it has when step `from` begins
  skipTo(from) {
    const put = (camX, px) => { this.cam.x = camX; this.papa.x = px; this.kit.x = px - 52; };
    this.veil = 0; for (const m of this.mist) { m.done = true; m.a = 0; }
    put(X.street, -150);
    for (const c of [this.papa, this.kit]) c.y = from >= 2 ? 0 : LANE;
    if (from >= 2) for (const c of [this.papa, this.kit]) c.mode = 'upright';
    if (from >= 1) this.folk.forEach((f) => { f.done = from >= 2; });
    if (from >= 3) { this.gate.open = 1; this.gate.flip = 1; put(X.gate - 30, X.gate - 124); }
    if (from >= 4) { for (const f of this.fruits) { f.state = 'bud'; f.k = 0.24; } put(X.garden, X.garden - 114); }
    if (from >= 6) { this.basket.k = 1; this.basket.n = 5; this.picked = 5; [1, 3, 5, 0, 4].forEach((i) => { this.fruits[i].state = 'picked'; }); this.gardGo = 2330; this.gard.x = 2330; }
    if (from >= 7) { for (const s of this.saps) s.perk = 1; put(X.tend, X.tend - 205); }
    if (from >= 8) {
      const pts = []; for (let i = 0; i <= 12; i++) pts.push({ x: X.mound + Math.sin(i * 0.5) * 30 + i * 3, y: -10 - i * 24 });
      this.growTree(DreamTree.fromStroke(pts, { x: X.mound, y: -4 }, 14, 4242), false);
      put(X.mound, X.mound - 134);
    }
  }

  // ───────────────────────── input ─────────────────────────
  expectNow() {
    if (this.mode === 'room') return null;
    if (this.phase === 'pick' && this.cur) { const q = this.fruitPos(this.cur); return { kind: 'tap', x: q.x, y: q.y + 17, r: 36, text: T.pick, quiet: this.cur.state !== 'gold' }; }
    // (drawn for the player, the stroke takes its time and leans a little: a tree, not a pole)
    if (this.phase === 'draw') return { kind: 'drag', x: X.mound, y: -12, r: 56, x2: X.mound + 26, y2: -300, text: T.draw, slow: 2, via: (u) => ({ x: X.mound + Math.sin(u * 3.6) * 34 * (0.4 + u) + 10 * u, y: lerp(-12, -300, u) }) };
    if (this.phase === 'leap' && this.leap) return this.leap.expect(T.home);
    return null;
  }
  onDown(p) {
    if (this.mode === 'room') return;
    if (this.phase === 'pick' && this.pickAt(p)) return;
    if (this.phase === 'draw' && this.strokeDown(p)) return;
    if (this.phase === 'leap' && this.leap) { this.leap.down(p); return; }
    this.toy(p);
  }
  onMove(p) {
    if (this.phase === 'draw' && this.stroke && this.stroke.on) this.strokeMove(p);
    else if (this.phase === 'leap' && this.leap) this.leap.move(p);
  }
  onUp(p) {
    if (this.stroke && this.stroke.on) { if (p.id === this.stroke.id) this.strokeUp(); }
    else if (this.phase === 'leap' && this.leap) this.leap.up(p);
  }
  onKey(k) { if (this.phase === 'leap' && this.leap) this.leap.key(k); }
  // little answers to touches that are not part of the task
  onToy(p) { return this.toy(p); }
  toy(p) {
    for (const c of [this.papa, this.kit]) {
      if (!c.hidden && dist(p.x, p.y, c.x, c.y - 34 * c.size) < 40) { this.hearts(c.x, c.y - 80 * c.size, 3); this.audio.sfx.purr(1); this.bounce(c); return true; }
    }
    for (const f of this.folk) if (f.done && f.talk <= 0 && dist(p.x, p.y, f.cat.x, f.cat.y - 44) < 46) { this.hello(f); return true; }
    if (this.angel && dist(p.x, p.y, this.angel.x + ANGEL_BIRD.x * this.angel.s, this.angel.y + ANGEL_BIRD.y * this.angel.s) < 44) { this.audio.sfx.chirp(this.pan(p.x)); this.notes(p.x, p.y - 20, 2, D.deep); return true; }
    if (this.knowsOld && dist(p.x, p.y, this.great.x, this.great.y + 30) < 60) { this.hum(); return true; }
    for (const tr of this.mtrees) if (dist(p.x, p.y, tr.x, tr.cy) < tr.r) { tr.ring(); this.audio.sfx.sparkle(this.pan(tr.x)); return true; }
    return false;
  }
  // A stroke belongs to the pointer that began it. A real finger that comes down while the paw is drawing
  // throws the paw's half-drawn stroke away and starts the child's own (the paw's later events are ignored).
  strokeDown(p) {
    const cur = this.stroke && this.stroke.on ? this.stroke : null;
    if (cur && (cur.id === p.id || p.id === -1)) return true;           // (one stroke at a time; the paw never cuts in)
    if (dist(p.x, p.y, X.mound, -14) > 86) { this.moundPulse = 1; return false; }
    this.drawT = 0;
    this.stroke = { id: p.id, on: true, done: false, fade: 1, pts: [{ x: X.mound, y: -6 }, { x: p.x, y: Math.min(-3, p.y) }] };
    if (!this.scr) this.scr = this.audio.loop('scribble');
    return true;
  }
  strokeMove(p) {
    if (p.id !== this.stroke.id) return;
    const s = this.stroke, l = s.pts[s.pts.length - 1], y = Math.min(-3, p.y);
    if (dist(l.x, l.y, p.x, y) < 5) return;
    if (s.pts.length > 400) s.pts = s.pts.filter((q, i) => i % 2 === 0 || i === s.pts.length - 1);   // a long scribble keeps its shape at half the points
    s.pts.push({ x: p.x, y }); this.idle = 0;
    if (this.scr) this.scr.set(0.8, clamp01(-y / 320));
    if (Math.random() < 0.5) this.fx.add({ kind: 'spark', x: p.x, y, vx: (Math.random() - 0.5) * 30, vy: -10 - Math.random() * 24, life: 0.7, size: 3.6, color: Math.random() < 0.5 ? '#ffd35a' : '#f6a9bd', layer: 2 });
  }
  strokeUp() {
    const s = this.stroke;
    s.on = false;
    if (this.scr) { this.scr.stop(); this.scr = null; }
    let top = 0;
    for (const q of s.pts) top = Math.min(top, q.y);
    this.drawT = 0;
    if (-top >= (s.cut ? 170 : 90)) { s.done = true; return; }              // (one cut short by a turned phone must be a good tall one)
    this.kit.meow(0.22); this.audio.sfx.mrrp(true); this.moundPulse = 1;                           // too small to be a tree: it fades, try again
    if (s.pts.length > 6 && -top > 45 && !s.cut) this.failed = (this.failed || 0) + 1;                     // a real little stroke counts as a try…
    if (s.id !== -1) this.demo();                                                                // …and either way the paw shows how, once more
    this.spawn(async () => { await this.tween(s, { fade: 0 }, 0.5); if (this.stroke === s) this.stroke = null; });
  }

  // ───────────────────────── frame ─────────────────────────
  tick(dt) {
    const t = this.t;
    if (this.mode === 'room') {
      const r = this.room;
      r.t += dt; if (!this.directing) r.frame(); r.update(dt); r.fx.update(dt);   // (the room's own framing only when we are not directing)
      this.zT -= dt;
      if (this.zT < 0) { this.zT = 1.9; this.zzz(-206, -44); }
      return;
    }
    // everybody who has somewhere to go walks there (see stroll): easing into the pace and out of it
    const pp = this.papa.x, pk = this.kit.x;
    for (const c of this.cats) {
      const g = c._go;
      if (!g || c.jump || c._hop) continue;
      const dx = g.x - c.x, d = Math.abs(dx);
      if (d < 0.6) { c.x = g.x; c.walking = 0; c._go = null; continue; }
      c.dir = dx > 0 ? 1 : -1; c.walking = 1;
      g.sp = Math.min(g.v, g.sp + ACC * dt, Math.sqrt(2 * ACC * d) + 6);
      c.x += c.dir * Math.min(d, g.sp * dt);
    }
    this.keepApart(pp, pk);
    const day = clamp01(1.15 - this.sky.star * 1.4);
    for (const c of this.cats) c.light = day;
    // the cats of the town: they amble about in front of their houses and chat — heads turned to each
    // other, or to the visitors when those come close
    for (let i = 0; i < this.folk.length; i++) {
      const f = this.folk[i], c = f.cat;
      if (f.talk > 0) { f.talk -= dt; if (f.talk <= 0 && c.look && c.look !== f.lk) c.look = null; continue; }
      if (!this.view.visible(c.x, 400)) continue;
      const waiting = this.camPhase === 'street' && f === this.folk.find((q) => !q.done);   // (the one to greet next stays put for the camera)
      if (!c._go && !waiting) {
        f.idle -= dt;
        if (f.idle < 0) {
          f.idle = 2 + Math.random() * 3.5;
          const to = f.home + (Math.random() - 0.5) * 56, P = this.papa, K = this.kit, at = (q) => q._go ? q._go.x : q.x;
          if (Math.abs(to - at(P)) > 56 && Math.abs(to - at(K)) > 54 && this.spotFree(c, to)) this.stroll(c, to, 30);   // (never into anybody's spot)
        }
      }
      f.lkT -= dt;
      if (f.lkT < 0) {
        f.lkT = 1.8 + Math.random() * 2.6;
        const near = Math.abs(this.papa.x - c.x) < 220 && !this.papa.hidden && Math.random() < 0.6;
        f.lkAt = near ? this.papa : Math.random() < 0.75 ? this.folk[i === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1].cat : null;
        if (f.lkAt && !this.reduced && Math.random() < 0.3) c.act('tilt');
      }
      if (f.lkAt && !c._go) { const h = f.lkAt.anchor('head'); f.lk.x = h.x; f.lk.y = h.y; c.look = f.lk; }
      else if (c.look === f.lk) c.look = null;
    }
    this.giveRoom();
    for (let i = this.says.length - 1; i >= 0; i--) { const s = this.says[i]; s.k = Math.min(1, s.k + dt * 5); s.life -= dt; if (s.life <= 0) this.says.splice(i, 1); }
    for (const tr of this.mtrees) tr.update(dt);
    for (const f of this.fruits) spring(f.wig, 0, dt, 200, 9);
    const g = this.great;
    spring(g.wig, 0, dt, 90, 5); g.hum = Math.max(0, g.hum - dt * 0.4);
    for (let i = g.rings.length - 1; i >= 0; i--) { const r = g.rings[i]; if (r.d > 0) r.d -= dt; else r.r += dt * 92; if (r.r > 300) g.rings.splice(i, 1); }
    spring(this.basket.pop, 0, dt, 220, 12);
    if (this.last) spring(this.last.wig, 0, dt, 200, 9);
    for (const s of this.saps) s.update(dt);
    // the gardener cat goes to whichever sapling is being watered
    const gc = this.gard;
    if (Math.abs(this.gardGo - gc.x) > 3) { if (!gc._go || gc._go.x !== this.gardGo) this.stroll(gc, this.gardGo, TROT); }
    else if (!gc._go && this.wet) gc.dir = -1;
    gc.armUp = approach(gc.armUp, 0, 4, dt);
    const near = !!this.wet && Math.abs(gc.x - (this.wet.x + 58)) < 16;
    gc.armReach = 1.45; gc.armHold = approach(gc.armHold, near ? 1 : 0, 6, dt);     // she holds her can out over the sapling
    this.canTilt = approach(this.canTilt, near ? 1 : 0, 9, dt);
    if (near && this.canTilt > 0.55) {
      const w = this.wet, want = w.want || 0;
      if (!this.pour) this.pour = this.audio.loop('pour');
      if (w.pourLvl !== want) { w.pourLvl = want; this.pour.set(0.85, want); }
      if (w.perk < want) { w.perk = Math.min(want, w.perk + dt / 1.1); const n = Math.floor(w.perk * 6); if (n > 0 && w.note) w.note(n); }
      this.dropT -= dt;
      while (this.dropT < 0) {
        this.dropT += 0.035;
        const h = this.canAt(), s = canSpout(h.x, h.y, gc.dir, this.canTilt);
        this.fx.add({ kind: 'drop', x: s.x, y: s.y, vx: gc.dir * (10 + Math.random() * 26), vy: 20 + Math.random() * 30, grav: 420, drag: 0, life: 0.36, size: 5.2, color: '#ffd23a', layer: 2 });
        if (Math.random() < 0.25) this.fx.add({ kind: 'spark', x: this.wet.x + (Math.random() - 0.5) * 24, y: -6, vx: (Math.random() - 0.5) * 30, vy: -50 - Math.random() * 40, life: 0.7, size: 3.6, color: '#ffd35a', layer: 2 });
      }
    }
    if (this.moundPulse > 0) this.moundPulse = Math.max(0, this.moundPulse - dt * 1.4);
    if (this.phase === 'pick' && this.cur) {                                  // the picker keeps an eye on the tale that is ripening
      const q = this.fruitPos(this.cur), lk = this._pk || (this._pk = { x: 0, y: 0 });
      lk.x = q.x; lk.y = q.y; this.papa.look = lk;
      if (!this.flying.length) this.kit.look = lk;
    }
    // drawing is the hardest thing asked of a small hand: after two tries that were too small, or a long
    // wait, the paw draws the tree for them (the way the story does when it plays by itself)
    // (the draw phase keeps its own clock: from the prompt, and from every try)
    if (this.phase === 'draw') {
      const v = this.view, vk = v.W * 10000 + v.H;
      if (this.stroke && this.stroke.on && this._vk && vk !== this._vk) { this.stroke.cut = true; this.strokeUp(); }      // the phone turned mid-stroke: that stroke ends there
      this._vk = vk;
      if (!this.game._dragging && !(this.stroke && this.stroke.on)) this.drawT = (this.drawT || 0) + dt;
      if (!this.game.auto && !this.game._dragging && !(this.stroke && this.stroke.on) && ((this.failed || 0) >= 2 || this.drawT > DRAW_WAIT)) {
        this.failed = 0; this.drawT = 0;
        const e = this.currentExpect();
        if (e && e.kind === 'drag') this.game.autoDrag(this, e, 2.2);
      }
    }
    // a little down drifting through the dream
    if (!this.reduced && this.sky.star < 0.5) {
      this.feT -= dt;
      if (this.feT < 0) {
        this.feT = 0.7 + Math.random() * 0.7;
        const v = this.view;
        this.fx.add({ kind: 'feather', x: v.left + Math.random() * v.width, y: Math.max(v.top, -620) - 10, vx: 6, vy: 16 + Math.random() * 10, life: 9, size: 6 + Math.random() * 4, color: Math.random() < 0.5 ? '#f6c7d3' : '#bfe6f2', vr: 0.6, rot: Math.random() * TAU, sway: 16, drag: 0, alpha: 0.85, layer: -1 });
      }
    }
  }

  // sky things: clouds with spirals, the sleeping angel, the ancient tree
  drawBack(ctx, view, t, sky) {
    const dream = clamp01(1 - sky.star * 1.7), cx = this.cam.x;
    if (dream > 0.01) {
      for (const c of this.skyClouds) {
        const x = c.x + cx * 0.5 + Math.sin(t * 0.07 + c.seed) * 26;
        if (x > view.left - 120 && x < view.right + 120 && c.y > view.top - 60) drawSpiralCloud(ctx, x, c.y, c.w, c.seed, 0.85 * dream);
      }
      const aa = dream * clamp01(1 - (cx - 800) / 420);
      if (aa > 0.01) {
        const tall = clamp01((view.height - 700) / 500);
        this.angel = { x: 150 + (cx - X.street) * 0.86 - (view.portrait ? 44 : 0), y: lerp(-262, -440, tall), s: lerp(0.72, 0.8, tall) };
        drawAngel(ctx, this.angel.x, this.angel.y, this.angel.s, t, aa);
      } else this.angel = null;
    }
    if (view.visible(X.old, 480)) drawAncient(ctx, X.old, t);
  }

  drawMid(ctx, view, t) {
    if (view.visible(X.street, 700)) for (const h of this.homes) drawCatHouse(ctx, h.x, h);
    if (view.visible(X.gate, 800)) { drawHedge(ctx, 452, X.gate - 66, 21); drawHedge(ctx, X.gate + 66, 1012, 22); drawGate(ctx, X.gate, this.gate.open, this.gate.flip, t); }
    for (const tr of this.mtrees) if (view.visible(tr.x, 170)) tr.draw(ctx, t);
    for (const f of this.fruits) {
      if (f.state === 'none' || f.state === 'picked' || !view.visible(f.tree.x, 200)) continue;
      const q = this.fruitPos(f);
      if (f.gold > 0.05) crayonRings(ctx, q.x, q.y + 17, 34, t, { alpha: 0.55 * f.gold, rings: 3, seed: f.seed });
      drawPod(ctx, q.x, q.y, 15.5, f.k, f.gold, t, f.wig.x * 0.25 + Math.sin(t * 1.5 + f.seed) * 0.05, f.seed);
    }
    const g = this.great;
    if (view.visible(g.x, 200)) {
      const hush = this.phase === 'pick' ? 0.25 : 1;                         // (while tales are picked it is not one of them: no decoy)
      const gl = (0.5 + 0.22 * Math.sin(t * 0.8)) * (hush < 1 ? 0.55 : 1) + g.hum * 0.28;
      if (hush > 0.3 || g.hum > 0.05) crayonRings(ctx, g.x, g.y + 32, 62, t * 0.4, { alpha: (0.26 + g.hum * 0.3) * hush, rings: 4, seed: 9 });
      drawPod(ctx, g.x, g.y, 30, 1, gl, t * 0.35, g.wig.x * 0.2 + Math.sin(t * 0.7) * 0.03, 600);
    }
    if (view.visible(this.basket.x, 120)) drawBasket(ctx, this.basket.x, 0, this.basket.n, this.basket.k, this.basket.pop.x);
    for (const s of this.saps) if (view.visible(s.x, 100)) s.draw(ctx, t);
    if (view.visible(X.exit, 760)) { drawHedge(ctx, X.exit - 150, X.exit - 66, 23); drawHedge(ctx, X.exit + 66, X.exit + 160, 24); drawGate(ctx, X.exit, 1, 1, t); }
    if (view.visible(X.mound, 420)) {
      drawMound(ctx, X.mound, t, !!this.dtree, this.moundPulse + (this.phase === 'draw' && !this.stroke ? 0.3 + 0.2 * Math.sin(t * 3) : 0));
      if (this.dtree) this.dtree.draw(ctx, X.mound, -4, t);
      const f = this.last;
      if (f && !f.fly) {
        if (f.gold > 0.05) crayonRings(ctx, f.x, f.y + 17, 36, t, { alpha: 0.6 * f.gold, rings: 4, seed: 77 });
        drawPod(ctx, f.x, f.y, 15, f.k, f.gold, t, f.wig.x * 0.25 + Math.sin(t * 1.5) * 0.05, 77);
      }
    }
  }

  drawFront(ctx, view, t) {
    if (this.phase === 'draw') {                                              // papa is dreaming it up
      const p = this.papa;
      const h = p.anchor('headTop');
      for (let i = 0; i < 3; i++) { const u = (t * 0.5 + i / 3) % 1; ctx.globalAlpha = Math.sin(u * Math.PI) * 0.9; spiralPath(ctx, h.x + 10 + u * 26 + i * 4, h.y - 8 - u * 46, 4 + u * 7, 1.5, 1, t + i); ctx.strokeStyle = D.deep; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    for (const s of this.says) {
      const c = s.cat;
      const flip = c === this.kit ? c.x < this.papa.x : c.dir < 0, h = c.anchor('headTop');   // (each bubble on the side away from the other speaker)
      drawBubble(ctx, h.x + (flip ? -30 : 30), h.y - 34, s.icon, s.k, clamp01(s.life / 0.35), t, flip);
    }
    // picked tales fly to the basket, wrapping themselves in their little sheets
    for (const f of this.flying) {
      const u = f.u, x = lerp(f.x0, this.basket.x, u), y = lerp(f.y0, -40, u) - Math.sin(u * Math.PI) * 74;
      f.x = x; f.y = y;
      this.drawWrap(ctx, x, y, u, t);
    }
    const lf = this.last && this.last.fly;
    if (lf) { const u = lf.u, h = this.papa.anchor('hand'), x = lerp(this.last.x, h.x, u), y = lerp(this.last.y + 16, h.y - 8, u) - Math.sin(u * Math.PI) * 60; this.drawWrap(ctx, x, y, u, t, 1.15); }
    // rings of hundreds of years
    for (const r of this.great.rings) {
      if (r.d > 0) continue;
      const pts = [], a = clamp01(1 - r.r / 300);
      for (let i = 0; i <= 28; i++) pts.push([this.great.x + Math.cos((i / 28) * TAU) * r.r, this.great.y + 32 + Math.sin((i / 28) * TAU) * r.r * 0.8]);
      chalk(ctx, pts, { color: '#e0a020', width: 3, alpha: 0.75 * a, seed: Math.floor(r.r / 12) });
    }
    // the stroke being drawn
    const s = this.stroke;
    if (s && s.fade > 0.01 && s.pts.length > 1) {
      chalk(ctx, s.pts.map((q) => [q.x, q.y]), { color: '#ee7fa2', width: 4.5, alpha: 0.9 * s.fade, rough: 0.7, seed: 5 });
      const l = s.pts[s.pts.length - 1];
      if (s.on) { glow(ctx, l.x, l.y, 30, D.gold, 0.8, 'source-over'); ctx.fillStyle = '#fff3b0'; starPath(ctx, l.x, l.y, 7, t * 3); ctx.fill(); }
    }
    // fireflies on their way to become blossoms
    for (const m of this.motes) {
      const u = m.u, x = lerp(m.x0, m.x1, u) + Math.sin(u * Math.PI) * 40 * m.sd, y = lerp(m.y0, m.y1, u);
      glow(ctx, x, y, 16, '#ffcf5a', 0.85, 'source-over'); ctx.fillStyle = '#ffb52e'; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
    }
    // the dream mist of the beginning
    if (this.veil > 0.004) { ctx.fillStyle = rgba('#f6fcfe', this.veil * 0.93); ctx.fillRect(view.left - 10, view.top - 10, view.width + 20, view.height + 20); }
    const w = Math.round(clamp(view.width * 0.62, 260, 420) / 20) * 20;
    for (const m of this.mist) if (m.a > 0.01) drawSpiralCloud(ctx, view.left + m.u * view.width + m.dx + Math.sin(t * 0.7 + m.i * 1.7) * 8, (this.mistY ? this.mistY(m) : m.y) + Math.cos(t * 0.9 + m.i * 1.7) * 5, w, m.seed, m.a);
    this.fx.draw(ctx, t, 2);
  }
  // a tale on its way: the golden star fades into a white bundle (u: 0 → 1)
  drawWrap(ctx, x, y, u, t, size) {
    const k = size || 1;
    glow(ctx, x, y, 34 * k, D.gold, 0.7 * (1 - u * 0.5), 'source-over');
    if (u < 0.75) { ctx.save(); ctx.globalAlpha *= clamp01(1 - u / 0.75); ctx.fillStyle = '#f2b22e'; starPath(ctx, x, y, 9 * k, t * 4); ctx.fill(); ctx.restore(); }
    if (u > 0.2) { const s = ease.outBack(clamp01((u - 0.2) / 0.6)) * 0.72 * k; ctx.save(); ctx.translate(x, y - 10 * s); ctx.rotate(Math.sin(u * 9) * 0.25); drawBundle(ctx, 0, 0, 0, s, 31); ctx.restore(); }
  }

  // the watering can hangs from the gardener's near paw (and tips forward from it to pour)
  canAt() { const h = this.gard.anchor('hand', this._ca || (this._ca = { x: 0, y: 0 })); h.x += this.gard.dir * 10; h.y += 10; return h; }

  draw(ctx, view, t) {
    if (this.mode !== 'room') { super.draw(ctx, view, t); return; }
    this.room.draw(ctx, view, t);
    const b = this.sillTale;
    if (b) drawLooseBundle(ctx, b.x, b.y, b.rot, 1, b.glow * (0.85 + 0.15 * Math.sin(t * 2)));
    const g = this.gift;
    if (g) {
      glow(ctx, g.px, g.py, 30, '#ffe36e', 0.85); ctx.fillStyle = '#fff3b0'; starPath(ctx, g.px, g.py, 7.5, t * 2); ctx.fill();
    }
    this.kit.draw(ctx, t); this.papa.draw(ctx, t);
    this.fx.draw(ctx, t, 0);
  }
  drawOver(ctx, view) {
    if (this.dark <= 0.003) return;
    view.screen(ctx);
    ctx.fillStyle = rgba('#0b1038', this.dark); ctx.fillRect(0, 0, view.W, view.H);
  }
  dispose() {
    if (this.pour) this.pour.stop();
    if (this.scr) this.scr.stop();
    freeSprites('gd-');
  }
}
