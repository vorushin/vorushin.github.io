// Magic cats — character lab: birds, fireflies, butterflies (see lab.js for the card API and the URL params).
//   sheets: birds (large)  small (in-game sizes)     clips: fly fly-far peck hops turns perch-life butterfly firefly

import { Lab, sheet, clip } from './lab.js';
import { Bird, BIRD_COLORS, drawFirefly, drawButterfly } from '../actors.js';

function addBird(L, o) { const b = new Bird(o); L.add(b, { z: o.z || 0 }); return b; }
const COLS = Object.keys(BIRD_COLORS);

// still poses: each a function (L, bird) that puts the bird in the pose (fidgeting off)
const POSES = {
  'perched': () => {},
  'three-quarter': (L, b) => { b.look(0.8); L.advance(b, 0.3); },
  'front': (L, b) => { b.look(1.55); L.advance(b, 0.3); },
  'over the shoulder': (L, b) => { b.look(2.9, 0.15); L.advance(b, 0.3); },
  'away': (L, b) => { b.look(-1.5); L.advance(b, 0.3); },
  'head tilt': (L, b) => { b.look(0.35, 0.45); L.advance(b, 0.3); },
  'singing': (L, b) => { b.chirp(); L.advance(b, 0.12); },
  'pecking': (L, b) => { b.peck = 0.9; L.advance(b, 0.1); },
  'preening': (L, b) => { b.preen(); L.advance(b, 0.6); },
  'fluffed': (L, b) => { b.fluff(); L.advance(b, 0.45); },
  'take-off crouch': (L, b) => { b.flyTo(300, -40); L.advance(b, 0.1); },
  'wing up': (L, b) => { b.pose = { e: 1 }; },
  'wing level': (L, b) => { b.pose = { e: 0 }; },
  'wing down': (L, b) => { b.pose = { e: -1 }; },
  'bounding (folded)': (L, b) => { b.pose = { e: 0, open: 0, pitch: -0.1 }; },
  'landing flare': (L, b) => { b.pose = { e: 0.85, flare: 1 }; }
};
const AIR = { 'wing up': 1, 'wing level': 1, 'wing down': 1, 'bounding (folded)': 1, 'landing flare': 1 };

function poseCells(names, extra) {
  return names.map((p, i) => Object.assign({
    label: (extra && extra.colorOf ? extra.colorOf(i) : COLS[i % COLS.length]) + ' · ' + p, settle: 0, ground: !AIR[p],
    setup: (L) => { const b = addBird(L, { color: extra && extra.colorOf ? extra.colorOf(i) : COLS[i % COLS.length], fidget: false, y: AIR[p] ? -10 : 0 }); POSES[p](L, b); }
  }, extra && extra.cell));
}
const bfCell = (label, o, ex) => Object.assign({ label, settle: 0, ground: false, setup: (L) => { L.add({}, { draw: (ctx, t) => drawButterfly(ctx, 0, -20, t, o.seed, o) }); } }, ex);
const ffCell = (label, ex) => Object.assign({ label, settle: 0.3, ground: false, setup: (L) => { L.add({}, { draw: (ctx, t) => drawFirefly(ctx, 0, -20, t, 1) }); } }, ex);

export default class LabBirds extends Lab {
  static cards() {
    const all = Object.keys(POSES);
    return {
      birds: sheet({ box: [-26, -50, 26, 6], scale: 6, cols: 5 }, [
        ...COLS.map((color) => ({ label: color, settle: 0, setup: (L) => { addBird(L, { color, fidget: false }); } })),
        ...poseCells(all.slice(1)),
        bfCell('butterfly closed', { seed: 0, open: 0, tilt: 0 }), bfCell('butterfly half', { seed: 1, open: 0.35, tilt: 0 }),
        bfCell('butterfly open', { seed: 2, open: 0.7, tilt: 0 }), bfCell('butterfly flat', { seed: 3, open: 1, tilt: 0 }),
        ffCell('firefly')
      ]),
      // the same at the sizes the game shows them (device px per world unit)
      small: sheet({ box: [-26, -50, 26, 6], scale: 6, cols: 8 }, [
        ...[1.2, 2].flatMap((px) => [
          ...poseCells(['perched', 'three-quarter', 'singing', 'pecking', 'preening', 'wing up', 'wing down', 'landing flare'], { cell: { px } }).map((c) => Object.assign(c, { label: c.label + ' @' + px })),
          bfCell('butterfly @' + px, { seed: 1, open: 0.5, tilt: 0 }, { px }), ffCell('firefly @' + px, { px })
        ])
      ]),

      fly: clip({ box: [-40, -140, 210, 12], film: { frames: 30, dt: 50, cols: 6 } }, async (L) => {
        L.prop({ kind: 'block', x: -22, w: 40, h: 100 });
        const b = addBird(L, { color: 'blue', x: 0, y: -100, speed: 240, fidget: false });
        await L.wait(0.25);
        let landed = false;
        b.flyTo(165, 0, () => { landed = true; });
        await L.until(() => landed); await L.wait(0.35); b.chirp(); await L.wait(0.6);
      }),
      // a long flight, as in the library (from off-screen, high): bounding flight, then the flare
      'fly-far': clip({ box: [-480, -330, 40, 12], film: { frames: 36, dt: 60, cols: 6 } }, async (L) => {
        const b = addBird(L, { color: 'yellow', x: -460, y: -300, speed: 300, fidget: false });
        let landed = false;
        b.flyTo(0, 0, () => { landed = true; b.chirp(); });
        await L.until(() => landed); await L.wait(0.6);
      }),
      peck: clip({ box: [-30, -44, 40, 8], film: { frames: 18, dt: 60, cols: 6 } }, async (L) => {
        const b = addBird(L, { color: 'red', fidget: false });
        L.prop({ draw: (ctx) => { ctx.fillStyle = '#d9a35a'; ctx.beginPath(); ctx.arc(18, -1.5, 1.8, 0, 6.3); ctx.fill(); } });
        await L.wait(0.15); b.peck = 0.9; await L.wait(1.1);
      }),
      hops: clip({ box: [-40, -44, 40, 8], film: { frames: 24, dt: 70, cols: 6 } }, async (L) => {
        const b = addBird(L, { color: 'yellow', fidget: false });
        await L.wait(0.1); b.hopAlong(5); await L.wait(0.45); b.hopAlong(0); await L.wait(0.45);
        b._start('turn', 0.3); await L.wait(0.4);
      }),
      // no pops: a hop-turn by itself, chirp() brings it round quickly; a scene setting dir; then a preen with nibbles
      turns: clip({ box: [-36, -44, 36, 8], film: { frames: 48, dt: 50, cols: 8 } }, async (L) => {
        const b = addBird(L, { color: 'pink', fidget: false });
        await L.wait(0.1); b._start('turn', 0.3); await L.wait(0.45);
        b.chirp(); await L.wait(0.5);
        b.dir = -1; await L.wait(0.35);
        b.preen(); await L.wait(1.1);
      }),
      'perch-life': clip({ box: [-36, -44, 36, 8], film: { frames: 40, dt: 250, cols: 8 } }, async (L) => {
        addBird(L, { color: 'green' });
        await L.wait(10);
      }),
      butterfly: clip({ box: [-30, -60, 150, 10], film: { frames: 24, dt: 40, cols: 6 } }, async (L) => {
        L.add({}, { draw: (ctx, t) => drawButterfly(ctx, 10 + t * 80, -28 + Math.sin(t * 2.3) * 10, t, 1) });
        await L.wait(1.2);
      }),
      firefly: clip({ box: [-30, -60, 150, 10], film: { frames: 12, dt: 80, cols: 6 } }, async (L) => {
        L.add({}, { draw: (ctx, t) => drawFirefly(ctx, 10 + t * 60, -28 + Math.sin(t * 3) * 14, t, 2) });
        await L.wait(1.2);
      })
    };
  }
}
