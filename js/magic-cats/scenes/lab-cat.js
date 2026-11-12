// Magic cats — character lab: the cats (see lab.js for the card API and the URL params).
//   ?scene=lab-cat&card=poses&kind=papa|kitten|mama|night
//   sheets: poses kinds small heads faces walk-keys leap-keys upright
//   clips:  walk trot leap leap-up leap-down hop sit curl drink turn idle carry upright-walk follow

import { Lab, sheet, clip } from './lab.js';
import { Cat, CAT_KINDS } from '../actors.js';
import { ease } from '../util.js';

const BOX = [-56, -96, 86, 10];                       // a papa-sized cell, feet at (0, 0)

// A cat in the lab: still unless asked (fidget off).
function addCat(L, o) {
  o = o || {};
  const c = new Cat({ kind: o.kind || L.param('kind', 'papa'), x: o.x || 0, y: o.y || 0, dir: o.dir || 1, seed: o.seed || 7 });
  c.fidget = !!o.fidget;
  if (L.param('light')) c.light = Number(L.param('light'));
  L.add(c, { z: o.z || 0 });
  return c;
}
// start act `kind` and step the cat until it is `u` of the way through
function actAt(L, c, kind, u) {
  L.advance(c, 1);
  c.act(kind, { side: 1 });
  L.advance(c, c._act.dur * u);
}
// stop at `u` of a leap of dx across, dy up (the cat is placed so that it is near x = 0 by then)
function leapAt(L, c, dx, dy, u) {
  L.advance(c, 1);
  c.x = -dx * u; c.y = 0; c._px = c._gx = c.x;
  c.leapTo(c.x + dx, dy);
  L.advance(c, c.jump.pre + c.jump.dur * u);
}
function cell(label, fn, o) { return Object.assign({ label, settle: 1, setup: (L) => fn(L, addCat(L)) }, o || {}); }
// walk (walking = 1) to x at `speed` units/s
async function walkTo(L, c, x, speed) {
  c.dir = x >= c.x ? 1 : -1; c.walking = 1;
  await L.tween(c, { x }, Math.abs(x - c.x) / speed, ease.linear);
  c.walking = 0;
}
async function leap(L, c, x, y, o) { c.leapTo(x, y, o); await L.until(() => !c.jump); }

export default class LabCat extends Lab {
  static cards() {
    const q = new URLSearchParams(location.search);
    const kindOf = () => CAT_KINDS[q.get('kind')] || CAT_KINDS.papa;
    const s = kindOf().size, box = BOX.map((v) => v * s), big = [-100, -150, 100, 10].map((v) => v * s), sc = Number(q.get('scale')) || 2.4;
    const kit = kindOf().head > 1.1;
    return {
      poses: sheet({ box, scale: sc / s, cols: 5 }, [
        cell('stand', () => {}),
        cell('carry 1', (L, c) => { c.carry = 1; }),
        cell('carry 2', (L, c) => { c.carry = 2; }),
        cell('sit', (L, c) => { c.mode = 'sit'; }),
        cell('sit happy', (L, c) => { c.mode = 'sit'; c.eyes = 'happy'; }),
        cell('curl', (L, c) => { c.mode = 'curl'; }),
        cell('upright', (L, c) => { c.mode = 'upright'; }),
        cell('upright bindle', (L, c) => { c.mode = 'upright'; c.bindle = true; }),
        cell('crouch 1', (L, c) => { c.crouch = 1; c.look = { x: 160, y: -60 }; }),
        cell('headDown 1 + tongue', (L, c) => { c.headDown = 1; c.tongue = 1; }),
        cell('look up-left', (L, c) => { c.look = { x: -120, y: -170 }; }),
        cell('look ahead', (L, c) => { c.look = { x: 220, y: -40 }; }),
        cell('eyes wide', (L, c) => { c.eyes = 'wide'; }),
        cell('eyes happy', (L, c) => { c.eyes = 'happy'; }),
        cell('eyes closed', (L, c) => { c.eyes = 'closed'; }),
        cell('sleepy', (L, c) => { c.lids = 0.55; c.mode = 'sit'; }),
        cell('meow', (L, c) => { L.advance(c, 1); c.meow(0.4); L.advance(c, 0.2); }, { settle: 0 }),
        cell('arm hold (reach up)', (L, c) => { c.mode = 'upright'; c.armHold = 1; c.armReach = 2.5; }),
        cell('arm hold (can out)', (L, c) => { c.mode = 'upright'; c.armHold = 1; c.armReach = 1.45; }),
        cell('bow upright', (L, c) => { c.mode = 'upright'; actAt(L, c, 'bow', 0.4); }, { settle: 0 }),
        cell('tail curl', (L, c) => { c.tailCurl = 1; }),
        ...['yawn', 'lick', 'stretch', 'tilt', 'look', 'slowblink', 'knead', 'bow'].map((k) => cell('act ' + k, (L, c) => actAt(L, c, k, k === 'knead' ? 0.4 : 0.5), { settle: 0 })),
        cell('sit lick', (L, c) => { c.mode = 'sit'; actAt(L, c, 'lick', 0.5); }, { settle: 0 }),
        ...(kit ? [cell('pounce (crouch)', (L, c) => actAt(L, c, 'pounce', 0.42), { settle: 0 }), cell('pounce (hop)', (L, c) => actAt(L, c, 'pounce', 0.75), { settle: 0 })] : []),
        cell('turning round (mid)', (L, c) => { L.advance(c, 1); c.dir = -1; L.advance(c, 0.13); }, { settle: 0 }),
        cell('glowing 1', (L, c) => { c.glowing = 1; })
      ]),
      kinds: sheet({ box: BOX, scale: 2.4, cols: 4 }, ['papa', 'mama', 'kitten', 'night'].flatMap((k) => [
        { label: k + ' stand', settle: 1, setup: (L) => { addCat(L, { kind: k }); } },
        { label: k + ' sit', settle: 1, setup: (L) => { addCat(L, { kind: k }).mode = 'sit'; } }
      ]).concat(['papa', 'mama', 'kitten', 'night'].map((k) => ({ label: k + ' face', settle: 1, box: [-6, -84, 62, -20], scale: 5, ground: false, setup: (L) => { const c = addCat(L, { kind: k }); c.size = 1; c.headTurn = 0.8; } })))),
      // on-screen size (device px per world unit) on a phone held upright ('phone': fit 0.72) and on its side ('land': 0.52),
      // at 2 device px per CSS px, and a 1280×800 desktop ('desk': 1.17 × 2) for reference
      small: sheet({ box: [-60, -96, 60, 12], cols: 3 }, [['desk', 2.34], ['phone', 1.44], ['land', 1.04]].flatMap(([n, px]) => [
        { label: n + ' ' + px + ' · papa', px, settle: 1, props: [{ kind: 'ledge' }], setup: (L) => { addCat(L, { kind: 'papa', x: -4 }); } },
        { label: n + ' ' + px + ' · kitten', px, settle: 1, props: [{ kind: 'ledge' }], setup: (L) => { addCat(L, { kind: 'kitten', x: -4 }); } },
        { label: n + ' ' + px + ' · sit', px, settle: 1, props: [{ kind: 'ledge' }], setup: (L) => { addCat(L, { kind: 'papa', x: -10 }).mode = 'sit'; addCat(L, { kind: 'kitten', x: 14, z: 1 }).mode = 'sit'; } }
      ])),
      // the head: turn 0 … 1.8 in six steps, nod, tilt (large)
      heads: sheet({ box: [-4, -86, 64, -16].map((v) => v * s), scale: 5.2 / s, cols: 5, settle: 1 }, [
        ...[0, 0.36, 0.72, 1.08, 1.44, 1.8].map((tn) => cell('turn ' + tn, (L, c) => { c.headTurn = tn; })),
        cell('nod up', (L, c) => { c.headTurn = 0.75; c.headNod = 0.45; }),
        cell('nod down', (L, c) => { c.headTurn = 0.75; c.headNod = -0.45; }),
        cell('tilt', (L, c) => { c.headTurn = 0.9; c.headTilt = 0.35; }),
        cell('profile, nod up', (L, c) => { c.headTurn = 0.15; c.headNod = 0.35; })
      ]),
      faces: sheet({ box: [-4, -86, 64, -16].map((v) => v * s), scale: 5.2 / s, cols: 5, settle: 1 }, [
        cell('open (dark)', () => {}), cell('day light', (L, c) => { c.light = 1; }), cell('wide', (L, c) => { c.eyes = 'wide'; }),
        cell('sleepy', (L, c) => { c.lids = 0.55; }), cell('closed', (L, c) => { c.eyes = 'closed'; }), cell('happy', (L, c) => { c.eyes = 'happy'; }),
        cell('meow', (L, c) => { L.advance(c, 1); c.meow(0.4); L.advance(c, 0.2); }, { settle: 0 }),
        cell('yawn', (L, c) => actAt(L, c, 'yawn', 0.45), { settle: 0 }),
        cell('lapping', (L, c) => { c.headDown = 1; c.tongue = 1; }, { box: [-4, -60, 64, 10].map((v) => v * s) }),
        cell('carry 2', (L, c) => { c.carry = 2; }, { box: [-4, -86, 64, 10].map((v) => v * s) })
      ]),
      // the walk at the moments of its cycle (lateral sequence: LH 0, LF .25, RH .5, RF .75), and the trot
      'walk-keys': sheet({ box, scale: sc / s, cols: 4, settle: 1 }, [
        ...[0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875].map((ph) => cell('walk ' + ph, (L, c) => { c.walking = 1; c._gaitDbg = { phase: ph, speed: 45 * s }; })),
        ...[0, 0.125, 0.25, 0.375].map((ph) => cell('trot ' + ph, (L, c) => { c.walking = 1; c._gaitDbg = { phase: ph, speed: 95 }; })),
        ...[0, 0.2, 0.4, 0.6, 0.8].map((ph) => cell('bound ' + ph, (L, c) => { c.walking = 1; c._gaitDbg = { phase: ph, speed: 210 }; }))
      ]),
      'leap-keys': sheet({ box: big, scale: (sc * 0.8) / s, cols: 4, settle: 0 }, [
        cell('gather', (L, c) => { L.advance(c, 1); c.leapTo(160 * s, 0, { pre: 0.3 }); L.advance(c, 0.25); }, { settle: 0 }),
        ...[0.1, 0.25, 0.5, 0.75, 0.96].map((u) => cell('leap u=' + u, (L, c) => leapAt(L, c, 170 * s, 0, u), { settle: 0 })),
        cell('touch-down +0.06 s', (L, c) => { leapAt(L, c, 170 * s, 0, 1); L.advance(c, 0.06); }, { settle: 0 }),
        cell('land +0.2 s', (L, c) => { leapAt(L, c, 170 * s, 0, 1); L.advance(c, 0.2); }, { settle: 0 }),
        cell('hop u=0.5', (L, c) => { L.advance(c, 1); c.hopInPlace(); L.advance(c, c.jump.pre + c.jump.dur * 0.5); }, { settle: 0 }),
        cell('leap up u=0.5', (L, c) => { L.advance(c, 1); c.x = -80 * s; c._px = c._gx = c.x; c.leapTo(c.x + 150 * s, -90 * s); L.advance(c, c.jump.pre + c.jump.dur * 0.5); c.y += 90 * s * 0.5; }, { settle: 0 }),
        cell('leap down u=0.7', (L, c) => { L.advance(c, 1); c.x = -100 * s; c.y = -60 * s; c._px = c._gx = c.x; c._py = c.y; c.leapTo(c.x + 150 * s, 0); L.advance(c, c.jump.pre + c.jump.dur * 0.7); }, { settle: 0 })
      ]),
      upright: sheet({ box: [-50, -100, 60, 10].map((v) => v * s), scale: sc / s, cols: 6, settle: 1 }, [
        cell('arms down', (L, c) => { c.mode = 'upright'; }),
        cell('bindle', (L, c) => { c.mode = 'upright'; c.bindle = true; }),
        cell('one arm up', (L, c) => { c.mode = 'upright'; c.armUp = 1; c.eyes = 'happy'; }),
        cell('carry 1', (L, c) => { c.mode = 'upright'; c.carry = 1; }),
        ...[0, 0.25, 0.5, 0.75].map((ph) => cell('walk ' + ph, (L, c) => { c.mode = 'upright'; c.walking = 1; c._gaitDbg = { phase: ph, speed: 26 }; })),
        ...[0, 0.5].map((ph) => cell('bindle walk ' + ph, (L, c) => { c.mode = 'upright'; c.bindle = true; c.walking = 1; c._gaitDbg = { phase: ph, speed: 26 }; }))
      ]),

      walk: clip({ box: [-62, -86, 82, 10], film: { frames: 24, dt: 50, cols: 4 } }, async (L) => {
        const c = addCat(L); L.follow(c);
        await L.wait(0.2); await walkTo(L, c, 300, 45); await L.wait(0.6);
      }),
      trot: clip({ box: [-62, -86, 82, 10], film: { frames: 24, dt: 40, cols: 4 } }, async (L) => {
        const c = addCat(L); L.follow(c);
        await L.wait(0.2); await walkTo(L, c, 300, 100); await L.wait(0.6);
      }),
      'walk-stop': clip({ box: [-62, -86, 82, 10], film: { frames: 30, dt: 60, cols: 6 } }, async (L) => {
        const c = addCat(L); L.follow(c);
        await L.wait(0.2); await walkTo(L, c, 70, 45); await L.wait(0.8); await walkTo(L, c, 120, 30); await L.wait(0.6);
      }),
      scamper: clip({ box: [-50, -60, 50, 8], film: { frames: 24, dt: 33, cols: 6 } }, async (L) => {
        const c = addCat(L, { kind: 'kitten' }); L.follow(c);
        await L.wait(0.2); await walkTo(L, c, 400, 150); await L.wait(0.4);
      }),
      'kitten-walk': clip({ box: [-50, -60, 50, 8], film: { frames: 24, dt: 50, cols: 6 } }, async (L) => {
        const c = addCat(L, { kind: 'kitten' }); L.follow(c);
        await L.wait(0.2); await walkTo(L, c, 200, 40); await L.wait(0.4);
      }),
      // the head follows a moving point (eyes lead), the tail swishes while it watches; then it is petted
      watch: clip({ box: [-90, -120, 110, 10], film: { frames: 30, dt: 120, cols: 6 } }, async (L) => {
        const c = addCat(L), m = { x: 90, y: -90 };
        L.prop({ draw: (ctx) => { ctx.beginPath(); ctx.arc(m.x, m.y, 4, 0, Math.PI * 2); ctx.fillStyle = '#f2b93a'; ctx.fill(); } });
        c.look = m;
        await L.wait(0.3); await L.tween(m, { x: -80, y: -60 }, 1.4); await L.tween(m, { x: 60, y: -20 }, 1);
        c.look = null; c.eyes = 'happy'; await L.wait(1.2); c.eyes = 'open'; await L.wait(0.6);
      }),
      // a scene changing everything at once: teleport, dir, mode, carry, eyes (must not pop or fling)
      abrupt: clip({ box: [-90, -100, 110, 10], film: { frames: 24, dt: 50, cols: 6 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.3); c.x = 40; c.dir = -1; c.carry = 1; c.eyes = 'happy';
        await L.wait(0.4); c.x = -30; c.mode = 'sit'; c.eyes = 'open';
        await L.wait(0.4); c.mode = 'stand'; c.dir = 1; c.carry = 0;
        await L.wait(0.3);
      }),
      // falling asleep: lids come down slowly into a drowsy half-closed look, then a slow blink, then curled up
      drowsy: clip({ box: [-40, -86, 60, -20], film: { frames: 24, dt: 150, cols: 6 } }, async (L) => {
        const c = addCat(L); c.mode = 'sit'; c.headTurn = 0.9;
        await L.wait(0.5); c.lids = 0.5; await L.wait(1.6); c.act('slowblink'); await L.wait(1.5);
      }),
      wave: clip({ box: [-50, -100, 60, 10], film: { frames: 18, dt: 60, cols: 6 } }, async (L) => {
        const c = addCat(L); c.mode = 'upright';
        await L.wait(0.3); c.armUp = 1; c.eyes = 'happy'; await L.wait(0.9); c.armUp = 0; c.eyes = 'open'; await L.wait(0.4);
      }),
      // a steady raised arm (armHold + armReach): reaching up to a branch, holding a can out; then a wave on top
      'arm-hold': clip({ box: [-50, -110, 70, 10], film: { frames: 24, dt: 100, cols: 6 } }, async (L) => {
        const c = addCat(L); c.mode = 'upright';
        await L.wait(0.3); c.armReach = 2.5; await L.tween(c, { armHold: 1 }, 0.25); await L.wait(0.6);
        await L.tween(c, { armReach: 1.45 }, 0.5); await L.wait(0.5);
        c.armUp = 1; await L.wait(0.6); c.armUp = 0; await L.wait(0.3); await L.tween(c, { armHold: 0 }, 0.35); await L.wait(0.3);
      }),
      bow: clip({ box: [-50, -100, 70, 10], film: { frames: 18, dt: 80, cols: 6 } }, async (L) => {
        const c = addCat(L); c.mode = 'upright';
        await L.wait(0.2); c.act('bow'); await L.wait(1.3);
      }),
      'bow-stand': clip({ box: [-56, -96, 86, 10], film: { frames: 12, dt: 110, cols: 6 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.1); c.act('bow'); await L.wait(1.3);
      }),
      // lapping with the tip of the tail curling and uncurling with pleasure
      'tail-curl': clip({ box: [-70, -90, 70, 10], film: { frames: 24, dt: 200, cols: 6 } }, async (L) => {
        const c = addCat(L); L.prop({ kind: 'saucer', x: 40, fill: 1 });
        await L.tween(c, { headDown: 1 }, 0.3); await L.tween(c, { tailCurl: 1 }, 0.8);
        for (let i = 0; i < 6; i++) { await L.tween(c, { tongue: 1 }, 0.1); await L.tween(c, { tongue: 0 }, 0.14); await L.wait(0.3); }
        await L.tween(c, { tailCurl: 0 }, 1.2); await L.tween(c, { headDown: 0 }, 0.3);
      }),
      // the kitten at a scamper (bound) and papa at a trot, side by side, at about phone size
      'scamper-trot': clip({ box: [-90, -70, 90, 8], film: { frames: 24, dt: 33, cols: 6 } }, async (L) => {
        const k = addCat(L, { kind: 'kitten', x: -40 }), p = addCat(L, { kind: 'papa', x: 20 }); L.follow(k);
        k.walking = p.walking = 1;
        await L.wait(0.1); await Promise.all([L.tween(k, { x: 300 }, 340 / 150, (u) => u), L.tween(p, { x: 360 }, 340 / 150, (u) => u)]);
      }),
      leap: clip({ box: [-60, -165, 300, 10], film: { frames: 20, dt: 50, cols: 4 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.15); await leap(L, c, 200, 0); await L.wait(0.5);
      }),
      'leap-up': clip({ box: [-70, -240, 240, 14], film: { frames: 20, dt: 50, cols: 4 } }, async (L) => {
        L.prop({ kind: 'block', x: 110, w: 90, h: 120 });
        const c = addCat(L);
        await L.wait(0.15); await leap(L, c, 150, -120); await L.wait(0.5);
      }),
      'leap-down': clip({ box: [-70, -240, 240, 14], film: { frames: 20, dt: 50, cols: 4 } }, async (L) => {
        L.prop({ kind: 'block', x: -45, w: 90, h: 120 });
        const c = addCat(L, { y: -120 });
        await L.wait(0.15); await leap(L, c, 150, 0); await L.wait(0.5);
      }),
      hop: clip({ box: [-62, -110, 82, 10], film: { frames: 16, dt: 40, cols: 4 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.1); c.hopInPlace(); await L.until(() => !c.jump); await L.wait(0.4);
      }),
      sit: clip({ box: [-62, -90, 82, 10], film: { frames: 24, dt: 100, cols: 4 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.4); c.mode = 'sit'; await L.wait(1.2); c.mode = 'stand'; await L.wait(0.8);
      }),
      curl: clip({ box: [-62, -90, 82, 10], film: { frames: 24, dt: 100, cols: 4 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.4); c.mode = 'curl'; await L.wait(1.2); c.mode = 'stand'; await L.wait(0.8);
      }),
      drink: clip({ box: [-130, -90, 100, 10], film: { frames: 30, dt: 180, cols: 5 } }, async (L) => {
        const sx = 60, c = addCat(L, { x: -70 });
        L.prop({ kind: 'saucer', x: sx, fill: 1 });
        await L.wait(0.2); await walkTo(L, c, sx - 28 * c.size, 45);
        await L.tween(c, { headDown: 1 }, 0.3);
        for (let i = 0; i < 3; i++) {
          await L.wait(0.3);
          await L.tween(c, { tongue: 1 }, 0.1); await L.tween(c, { tongue: 0 }, 0.14); await L.tween(c, { tongue: 1 }, 0.1); await L.tween(c, { tongue: 0 }, 0.14);
        }
        await L.wait(0.4); await L.tween(c, { headDown: 0 }, 0.3); await L.wait(0.6);
      }),
      turn: clip({ box: [-82, -90, 82, 10], film: { frames: 24, dt: 50, cols: 6 } }, async (L) => {
        const c = addCat(L);
        await L.wait(0.2); c.dir = -1; await L.wait(0.8); c.dir = 1; await L.wait(0.8);
      }),
      idle: clip({ box: [-62, -90, 90, 10], film: { frames: 36, dt: 300, cols: 6 } }, async (L) => {
        const c = addCat(L), kinds = ['yawn', 'lick', 'stretch', 'tilt', 'ears', 'look', 'slowblink', 'knead'].concat(c.c.head > 1.1 ? ['pounce'] : []);
        await L.wait(0.5);
        for (const k of kinds) { c.act(k); await L.wait(c._act.dur + 0.4); }
      }),
      carry: clip({ box: [-60, -170, 330, 10], film: { frames: 24, dt: 120, cols: 4 } }, async (L) => {
        const c = addCat(L); c.carry = 2;
        await L.wait(0.2); await walkTo(L, c, 100, 45); await L.wait(0.15); await leap(L, c, 260, 0); await L.wait(0.6);
      }),
      'upright-walk': clip({ box: [-60, -100, 60, 10], film: { frames: 24, dt: 80, cols: 6 } }, async (L) => {
        const c = addCat(L); c.mode = 'upright'; c.bindle = true; L.follow(c);
        await L.wait(0.3); await walkTo(L, c, 78, 26); await L.wait(0.6);
      }),
      // papa leaps twice; the kitten comes after him to the perch he has just left (like leap.js followers)
      follow: clip({ box: [-160, -210, 300, 14], film: { frames: 30, dt: 140, cols: 5 } }, async (L) => {
        L.prop({ kind: 'block', x: 95, w: 70, h: 70 });
        const P = [{ x: -110, y: 0 }, { x: 0, y: 0 }, { x: 130, y: -70 }, { x: 250, y: 0 }];
        const papa = addCat(L, { kind: 'papa', x: P[1].x }), kit = addCat(L, { kind: 'kitten', x: P[0].x, z: 1 });
        const queue = [];
        let wait = 0;
        L.each((dt) => {
          if (kit.jump || !queue.length) return;
          if ((wait -= dt) > 0) return;
          const q = queue.shift(); kit.leapTo(q.x, q.y); wait = 0.08;
        });
        await L.wait(0.3);
        for (let i = 2; i <= 3; i++) {
          const from = P[i - 1];
          await leap(L, papa, P[i].x, P[i].y);
          queue.push(from); wait = 0.22;
          await L.wait(0.7);
        }
        await L.until(() => !kit.jump && !queue.length); await L.wait(0.6);
      })
    };
  }
}
