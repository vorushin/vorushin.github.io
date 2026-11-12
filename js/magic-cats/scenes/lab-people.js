// Magic cats — character lab: the children and grown-ups (see lab.js for the card API and the URL params).
//   sheets: busts (every kind × mood in a lit arch window, as props.js House._window draws it), full (kinds × poses),
//           turns (head-turn series + looking up/down), faces (expressions via drawHead), acts (one-off bits at their peak),
//           small (what a phone shows: device-pixel and CSS-pixel sizes), wins (other window shapes / sizes used by scenes)
//   clips:  wave cheer walk hang sleep yawn

import { Lab, sheet, clip } from './lab.js';
import { Kid, KIDS, Cat } from '../actors.js';
import { drawHead } from '../people.js';
import { ease } from '../util.js';
import { PAL, ink, wobblyPoly } from '../paint.js';

const MOODS = ['wait', 'happy', 'wave', 'read', 'sleep'];
const KINDS = Object.keys(KIDS);
const CHILDREN = ['pigtails', 'spiky', 'bob', 'curly', 'blond'];

// the arch / square / round window of props.js, bottom at y = -2 (so the kid stands at y = 0, as House does: g.bottom + 2)
function winPath(ctx, w, h, kind) {
  const l = -w / 2, r = w / 2, b = -2, tp = b - h;
  ctx.beginPath();
  if (kind === 'round') ctx.ellipse(0, b - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  else if (kind === 'square') ctx.rect(l, tp, w, h);
  else { ctx.moveTo(l, b); ctx.lineTo(l, tp + h * 0.36); ctx.bezierCurveTo(l, tp - h * 0.08, r, tp - h * 0.08, r, tp + h * 0.36); ctx.lineTo(r, b); ctx.closePath(); }
}
function drawWindow(ctx, kid, t, w, h, kind) {
  winPath(ctx, w, h, kind); ctx.fillStyle = PAL.winLit; ctx.fill();
  ctx.save(); winPath(ctx, w, h, kind); ctx.clip(); kid.drawBust(ctx, t); ctx.restore();
  winPath(ctx, w, h, kind); ink(ctx, 3);
  if (kind !== 'round') { wobblyPoly(ctx, [[-w / 2 - 6, -3], [w / 2 + 6, -3], [w / 2 + 5, 3], [-w / 2 - 5, 3]], 5, 0.6, 60); ctx.fillStyle = PAL.snow; ctx.fill(); ink(ctx, 2.4); }
}

// A person in the lab: in a window (win: [w, h, kind]), as a bare bust, or whole.
function addKid(L, o) {
  const k = new Kid(o);
  if (o.turn !== undefined) k.turn = o.turn;
  if (o.look) k.look = o.look;
  L.add(k, {
    z: o.z || 0,
    update: (dt, t) => k.update(dt, t),
    draw: (ctx, t) => (o.win ? drawWindow(ctx, k, t, o.win[0], o.win[1], o.win[2]) : o.bust ? k.drawBust(ctx, t) : k.drawFull(ctx, t))
  });
  return k;
}
const W34 = [34, 46, 'arch'];
const BAR = (y) => ({ kind: 'rope', pts: [[-40, y], [40, y]] });
// the belt of the rope slide (towers.js draws it from the rope down to the hands at kid.x ± 6, kid.y + 4)
const STRAP = { draw: (ctx) => { ctx.beginPath(); ctx.moveTo(-6, -74); ctx.lineTo(-6, -94); ctx.lineTo(0, -101); ctx.lineTo(6, -94); ctx.lineTo(6, -74); ctx.strokeStyle = '#1d1530'; ctx.lineWidth = 6.4; ctx.lineJoin = 'round'; ctx.stroke(); ctx.strokeStyle = '#e2483b'; ctx.lineWidth = 3.6; ctx.stroke(); } };

// full-figure pose cells: label, pose, mood, set-up
const FULL = [
  ['stand', 'stand', 'wait'],
  ['walk A', 'walk', 'wait', (L, k) => walkTo(k, 0.15)],
  ['walk B', 'walk', 'wait', (L, k) => walkTo(k, 0.5)],
  ['sit', 'sit', 'wait'],
  ['hang', 'hang', 'happy'],
  ['lie', 'lie', 'sleep']
];
// walk steadily for a while, so that the step is at `u` of a cycle (0 = contact, 0.25 = passing…), then stand the figure at x = 0
function walkTo(k, u) {
  const sp = 30 * k.size, S = k.B.stride;
  for (let i = 0; i < 90 || ((k._phase / (2 * Math.PI)) % 1 + 1) % 1 < u - 0.02 || ((k._phase / (2 * Math.PI)) % 1 + 1) % 1 > u + 0.02; i++) { k.x += sp / 60; k.update(1 / 60); if (i > 600) break; }
  void S; k.x = 0; k._px = 0;
}
function fullCell(kind, def) {
  const [label, pose, mood, fn] = def;
  return {
    label: kind + ' · ' + label, settle: pose === 'walk' ? 0 : 1.2,
    props: pose === 'hang' ? [BAR(-92), STRAP] : pose === 'sit' ? [{ kind: 'block', x: -46, w: 44, h: 12 }] : [],
    setup: (L) => {
      const k = addKid(L, { kind, pose, mood, y: pose === 'hang' ? -78 : pose === 'sit' ? -12 : 0, x: pose === 'lie' ? -8 : pose === 'sit' ? -4 : 0 });
      if (fn) { k.update(1 / 60); fn(L, k); }
    }
  };
}

export default class LabPeople extends Lab {
  static cards() {
    return {
      busts: sheet({ box: [-27, -56, 27, 9], scale: 3.1, cols: 10, settle: 1.2 }, KINDS.flatMap((kind) => MOODS.map((mood) => ({
        label: kind + ' · ' + mood,
        setup: (L) => { addKid(L, { kind, mood, win: W34 }); }
      })))),
      // bare busts (no clipping) — to see the whole composition the window cuts
      bare: sheet({ box: [-34, -60, 34, 12], scale: 3, cols: 10, settle: 1.2 }, ['pigtails', 'papa'].flatMap((kind) => MOODS.map((mood) => ({
        label: kind + ' · ' + mood, props: [{ kind: 'ledge', w: 46, window: false }],
        setup: (L) => { addKid(L, { kind, mood, bust: true }); }
      })))),
      full: sheet({ box: [-50, -100, 50, 14], scale: 2.6, cols: 6 }, KINDS.flatMap((kind) => FULL.map((d) => fullCell(kind, d)))),
      kids: sheet({ box: [-50, -80, 50, 14], scale: 3.4, cols: 5 }, CHILDREN.flatMap((kind) => [fullCell(kind, FULL[0])]).concat(
        CHILDREN.map((kind) => ({ label: kind + ' · happy', settle: 1.2, setup: (L) => { addKid(L, { kind, pose: 'stand', mood: 'happy' }); } })),
        CHILDREN.map((kind) => ({ label: kind + ' · wave', settle: 1.2, setup: (L) => { addKid(L, { kind, pose: 'stand', mood: 'wave' }); } })),
        CHILDREN.map((kind) => ({ label: kind + ' · read', settle: 1.2, setup: (L) => { addKid(L, { kind, pose: 'stand', mood: 'read' }); } }))
      )),
      // full-figure moods for the library: hugging a tree (a trunk just in front), holding a watering can (drawn at anchor('hand'))
      extra: sheet({ box: [-40, -80, 50, 12], scale: 3.4, cols: 4, settle: 1.2 }, ['pigtails', 'curly'].flatMap((kind) => [
        { label: kind + ' · hug', props: [{ kind: 'block', x: 16, w: 22, h: 80, color: '#b06a34' }], setup: (L) => { addKid(L, { kind, pose: 'stand', mood: 'hug' }); } },
        { label: kind + ' · hold', setup: (L) => { const k = addKid(L, { kind, pose: 'stand', mood: 'hold' }); L.prop({ draw: (ctx) => { const h = k.anchor('hand'); ctx.beginPath(); ctx.rect(h.x - 4, h.y - 2, 14, 12); ctx.fillStyle = '#7fa6d8'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#1d1530'; ctx.stroke(); } }); } }
      ])),
      sitting: sheet({ box: [-40, -60, 50, 22], scale: 3.4, cols: 5 }, ['wait', 'read', 'wave', 'happy', 'sleep'].map((mood) => ({
        label: 'spiky sit · ' + mood, settle: 1.2, props: [{ kind: 'block', x: -40, w: 44, h: 4 }],
        setup: (L) => { addKid(L, { kind: 'spiky', pose: 'sit', mood, y: -4 }); }
      }))),
      turns: sheet({ box: [-22, -46, 22, 2], scale: 4.4, cols: 7, settle: 1.2 }, ['pigtails', 'spiky', 'curly', 'mama', 'cap'].flatMap((kind) =>
        [-1, -0.5, 0, 0.5, 1].map((tu) => ({ label: kind + ' turn ' + tu, setup: (L) => { addKid(L, { kind, mood: 'wait', bust: true, turn: tu }); } })).concat([
          { label: kind + ' look up', setup: (L) => { addKid(L, { kind, mood: 'wait', bust: true, look: { x: 40, y: -140 } }); } },
          { label: kind + ' look down', setup: (L) => { addKid(L, { kind, mood: 'wait', bust: true, look: { x: 30, y: 60 } }); } }
        ]))),
      faces: sheet({ box: [-20, -20, 20, 18], scale: 5, cols: 9, settle: 0 }, ['pigtails', 'curly', 'bun', 'papa'].flatMap((kind) => [
        ['neutral', {}], ['smile', { smile: 0.9 }], ['laugh', { mood: 'happy' }], ['sing o', { mood: 'sing' }], ['yawn', { mood: 'yawn' }],
        ['surprised', { smile: 0, open: 0.5, brow: 1 }], ['sleepy', { lid: 0.45, smile: 0.1, brow: -0.3 }], ['asleep', { mood: 'sleep' }], ['from behind', { back: true }]
      ].map(([lbl, o]) => ({
        label: kind + ' · ' + lbl, ground: false,
        setup: (L) => { L.add({}, { update: () => {}, draw: (ctx, t) => drawHead(ctx, Object.assign({ kind, x: 0, y: 0, t, turn: lbl === 'neutral' || lbl === 'from behind' ? 0 : 0.2 }, o)) }); }
      })))),
      acts: sheet({ box: [-36, -96, 36, 12], scale: 2.8, cols: 7, settle: 0.3 }, [['yawn', 1.2], ['rubEyes', 0.9], ['clap', 0.75], ['nod', 0.4], ['point', 0.9], ['shrug', 0.6], ['stretch', 1.1]].flatMap(([a, at]) => [
        { label: 'bust · ' + a, box: [-27, -56, 27, 9], scale: 4, setup: (L) => { const k = addKid(L, { kind: 'pigtails', mood: 'wait', win: W34 }); L.advance(k, 0.6); k.act(a); L.advance(k, at); } },
        { label: 'full · ' + a, setup: (L) => { const k = addKid(L, { kind: 'spiky', pose: 'stand', mood: 'wait' }); L.advance(k, 0.6); k.act(a); L.advance(k, at); } }
      ])),
      // what a player sees: px = device px per unit. Upright phone (dpr 3): ~1.8; laptop (dpr 2): ~2.6; then CSS-size (dpr 1) ~0.65
      small: sheet({ box: [-26, -58, 26, 8], scale: 1, cols: 14, settle: 1.2 }, [1.8, 0.9].flatMap((px) => KINDS.map((kind, i) => ({
        label: (px > 1 ? 'phone ' : 'css ') + kind, px,
        setup: (L) => { addKid(L, { kind, mood: MOODS[i % 5], win: W34 }); }
      }))).concat([1.8, 0.9].flatMap((px) => KINDS.map((kind, i) => ({
        label: (px > 1 ? 'phone ' : 'css ') + kind + ' full', px, box: [-46, -100, 46, 12],
        setup: (L) => { addKid(L, { kind, pose: i % 3 === 1 ? 'sit' : 'stand', mood: ['wait', 'wave', 'happy'][i % 3], y: i % 3 === 1 ? -4 : 0 }); }
      }))))),
      // windows of other shapes and sizes the scenes use (title square 56×50, noticing 76×86 at size 1.45, cottage 28×34 at 0.72, 42×54)
      wins: sheet({ box: [-44, -96, 44, 9], scale: 2.6, cols: 6, settle: 1.2 }, [
        ['title square 56×50', { kind: 'pigtails', mood: 'wave', win: [56, 50, 'square'] }],
        ['noticing 76×86 ×1.45', { kind: 'pigtails', mood: 'wait', size: 1.45, win: [76, 86, 'arch'] }],
        ['noticing read', { kind: 'pigtails', mood: 'read', size: 1.45, win: [76, 86, 'arch'] }],
        ['cottage 28×34 ×0.72', { kind: 'blond', mood: 'wave', size: 0.72, win: [28, 34, 'arch'] }],
        ['candle 40×52 papa', { kind: 'papa', mood: 'read', win: [40, 52, 'arch'] }],
        ['candle 40×52 grandma', { kind: 'bun', mood: 'read', win: [40, 52, 'arch'] }],
        ['42×54 spiky wave', { kind: 'spiky', mood: 'wave', win: [42, 54, 'arch'] }],
        ['moonmilk 54×58', { kind: 'pigtails', mood: 'happy', win: [54, 58, 'square'] }],
        ['noticing sleep', { kind: 'pigtails', mood: 'sleep', size: 1.45, win: [76, 86, 'arch'] }]
      ].map(([label, o]) => ({ label, setup: (L) => { addKid(L, o); } }))),

      // ── stage B: motion ──
      // waiting at the window; a cat lands on the sill and is watched; it leaves
      wait: clip({ box: [-40, -64, 40, 10], film: { frames: 24, dt: 200, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'pigtails', mood: 'wait', win: W34 });
        const cat = L.add(new Cat({ kind: 'kitten', x: 90, y: -60, dir: -1 }), { z: 2 });
        await L.wait(1.6);
        await L.tween(cat, { x: 20, y: -4 }, 0.6, ease.outQuad); cat.mode = 'sit'; k.look = cat;
        await L.wait(2); await L.tween(cat, { x: -90, y: -50 }, 0.7, ease.inQuad); k.look = null; await L.wait(0.8);
      }),
      wave: clip({ box: [-30, -60, 30, 10], film: { frames: 24, dt: 50, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'pigtails', mood: 'wait', win: W34 });
        await L.wait(0.2); k.mood = 'wave'; await L.wait(1.6); k.mood = 'wait'; await L.wait(0.6);
      }),
      // the same at an upright phone's size (1 tile px ≈ 1 device px: the window is ~60 px, the head ~40)
      'wave-phone': clip({ box: [-82, -110, 82, 20], film: { frames: 12, dt: 66, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'spiky', mood: 'wait', win: W34 });
        await L.wait(0.1); k.mood = 'wave'; await L.wait(2);
      }),
      'cheer-win': clip({ box: [-30, -60, 30, 10], film: { frames: 24, dt: 50, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'curly', mood: 'wait', win: W34 });
        await L.wait(0.2); k.cheer(); await L.wait(1.4); k.mood = 'wait'; await L.wait(0.6);
      }),
      read: clip({ box: [-30, -60, 30, 10], film: { frames: 24, dt: 250, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'bob', mood: 'read', win: W34 });
        k._pageIn = 1.2; await L.wait(2.8); k.look = { x: 60, y: -120 }; await L.wait(1); k.look = null; await L.wait(2.4);
      }),
      'sleep-wake': clip({ box: [-30, -60, 30, 10], film: { frames: 24, dt: 120, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'pigtails', mood: 'sleep', win: W34 });
        await L.wait(0.6); k.cheer(); await L.wait(2.2);
      }),
      // bedtime in a window: a yawn, an eye rubbed, asleep on the folded arms
      yawn: clip({ box: [-30, -60, 30, 10], film: { frames: 30, dt: 250, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'bob', mood: 'wait', win: W34 });
        await L.wait(0.4); await L.wait(k.act('yawn')); await L.wait(0.3); await L.wait(k.act('rubEyes'));
        k.mood = 'sleep'; await L.wait(4);
      }),
      'yawn-full': clip({ box: [-40, -80, 40, 10], film: { frames: 24, dt: 250, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'blond', pose: 'stand', mood: 'wait' });
        await L.wait(0.3); await L.wait(k.act('yawn')); await L.wait(k.act('rubEyes')); k.mood = 'sleep'; await L.wait(1.8);
      }),
      cheer: clip({ box: [-50, -100, 50, 10], film: { frames: 18, dt: 60, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'pigtails', pose: 'stand', mood: 'wait' });
        await L.wait(0.2); k.cheer(); await L.wait(1.2); k.mood = 'wait'; await L.wait(0.5);
      }),
      // the legs follow the distance really walked: a slow start, a faster middle, a stop
      walk: clip({ box: [-50, -80, 50, 10], film: { frames: 30, dt: 66, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'pigtails', pose: 'stand' }); L.follow(k);
        await L.wait(0.2); k.pose = 'walk';
        await L.tween(k, { x: 30 }, 0.8, ease.inQuad);
        await L.tween(k, { x: 90 }, 1.1, ease.linear);
        await L.tween(k, { x: 110 }, 0.6, ease.outQuad);
        k.pose = 'stand'; await L.wait(0.5);
      }),
      'walk-papa': clip({ box: [-60, -105, 60, 10], film: { frames: 18, dt: 66, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'papa', pose: 'walk' }); L.follow(k);
        await L.tween(k, { x: 100 }, 2.2, ease.linear);
      }),
      sit: clip({ box: [-40, -50, 40, 20], film: { frames: 18, dt: 120, cols: 6 } }, async (L) => {
        L.prop({ kind: 'block', x: -40, w: 40, h: 4 });
        const k = addKid(L, { kind: 'spiky', pose: 'sit', mood: 'wait', y: -4 });
        await L.wait(1.2); k.mood = 'wave'; await L.wait(1.2);
      }),
      // as in towers.js: hanging by the hands from a line that slopes down to the right; the stop and the swing back
      hang: clip({ box: [-40, -175, 300, -10], film: { frames: 24, dt: 100, cols: 4 } }, async (L) => {
        const a = [0, -150], b = [260, -90];
        L.prop({ kind: 'rope', pts: [a, b] });
        const k = addKid(L, { kind: 'pigtails', pose: 'hang', mood: 'happy', x: a[0] + 10, y: a[1] + 14 });
        L.prop({ draw: (ctx) => { const l = k.anchor('handL'), r = k.anchor('handR'), ry = k.y - 14; ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(k.x - 6, ry - 2); ctx.lineTo(k.x, ry - 9); ctx.lineTo(k.x + 6, ry - 2); ctx.lineTo(r.x, r.y); ctx.strokeStyle = '#1d1530'; ctx.lineWidth = 6.4; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); ctx.strokeStyle = '#e2483b'; ctx.lineWidth = 3.6; ctx.stroke(); } });
        await L.wait(0.2);
        await L.tween(k, { x: b[0] - 20, y: b[1] + 7 }, 1.4, ease.inQuad);
        await L.wait(1.8);
      }),
      // the towers' landing: off the rope, standing on the platform (a teleport + a pose change), a cheer
      land: clip({ box: [-50, -110, 60, 10], film: { frames: 18, dt: 60, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'curly', pose: 'hang', mood: 'happy', x: -30, y: -90 });
        for (let i = 0; i < 20; i++) { k.x += 2.5; k.y += 0.8; await L.wait(1 / 60); }
        k.pose = 'stand'; k.x = 10; k.y = 0; k.cheer(); await L.wait(1);
      }),
      lie: clip({ box: [-50, -40, 50, 10], film: { frames: 12, dt: 400, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'blond', pose: 'lie', mood: 'sleep' }); k._sigh = 1.5;
        await L.wait(4.6);
      }),
      // towers: the girl asleep on the platform wakes and stands up
      getup: clip({ box: [-50, -90, 50, 10], film: { frames: 18, dt: 80, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'pigtails', pose: 'lie', mood: 'sleep', y: 0 });
        await L.wait(0.4); k.pose = 'stand'; k.mood = 'happy'; k.joy.v += 10; await L.wait(1.2);
      }),
      // turning round (dir flips) while waving, then a hop the other way
      turn: clip({ box: [-50, -90, 50, 10], film: { frames: 18, dt: 50, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'spiky', pose: 'stand', mood: 'wave' });
        await L.wait(0.3); k.dir = -1; await L.wait(0.4); k.joy.v += 9; await L.wait(0.3);
      }),
      // ── follow-up: carrier motion, wind, wistful, two-pass hug, drawHead line weight ──
      // the rope ride with the air of the ride in the hair (kid.wind), then the stop: the hair settles
      wind: clip({ box: [-40, -175, 300, -10], film: { frames: 24, dt: 100, cols: 4 } }, async (L) => {
        const a = [0, -150], b = [260, -90], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        L.prop({ kind: 'rope', pts: [a, b] });
        const k = addKid(L, { kind: 'pigtails', pose: 'hang', mood: 'happy', x: a[0] + 10, y: a[1] + 14 });
        let v = 0;
        L.each((dt) => { if (k._ride) { v = Math.min(240, v + 260 * dt); k.x += v * dt * dx / len; k.y += v * dt * dy / len; k.wind = { x: -v * dx / len, y: -v * dy / len }; if (k.x > b[0] - 20) { k._ride = false; k.wind = null; } } });
        await L.wait(0.2); k._ride = true; await L.until(() => !k._ride); await L.wait(1.4);
      }),
      // the same, close (the camera follows her along x): pigtails and hair stream back, then settle at the stop
      'wind-close': clip({ box: [-50, -160, 50, 0], film: { frames: 24, dt: 100, cols: 6 } }, async (L) => {
        const a = [0, -150], b = [260, -90], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        L.prop({ kind: 'rope', pts: [a, b] });
        const k = addKid(L, { kind: 'pigtails', pose: 'hang', mood: 'happy', x: a[0] + 10, y: a[1] + 14 }); L.follow(k);
        let v = 0;
        L.each((dt) => { if (k._ride) { v = Math.min(240, v + 260 * dt); k.x += v * dt * dx / len; k.y += v * dt * dy / len; k.wind = { x: -v * dx / len, y: -v * dy / len }; if (k.x > b[0] - 20) { k._ride = false; k.wind = null; } } });
        await L.wait(0.2); k._ride = true; await L.until(() => !k._ride); await L.wait(1.4);
      }),
      // a child standing on a platform that slides along: with carry() (left: no steps, no stream of air) and without (right)
      carried: clip({ box: [-60, -90, 220, 20], film: { frames: 18, dt: 100, cols: 6 } }, async (L) => {
        const plat = { x: 0, y: 0 }, kids = [addKid(L, { kind: 'bob', pose: 'walk', mood: 'wait', x: 0 }), addKid(L, { kind: 'pigtails', pose: 'walk', mood: 'wait', x: 90 })];
        L.prop({ draw: (ctx) => { for (const o of [0, 90]) { ctx.beginPath(); ctx.rect(plat.x + o - 26, 0, 52, 8); ctx.fillStyle = '#c99a62'; ctx.fill(); ctx.lineWidth = 2.4; ctx.strokeStyle = '#1d1530'; ctx.stroke(); } } });
        L.each((dt) => { const d = 45 * dt; plat.x += d; kids[0].x += d; kids[1].x += d; kids[0].carry(d, 0); });
        await L.wait(1.8);
      }),
      // the tale has run out: a window reader lowers the book, a wistful look down, a sigh, then out of the window
      wistful: clip({ box: [-30, -60, 30, 10], film: { frames: 18, dt: 180, cols: 6 } }, async (L) => {
        const k = addKid(L, { kind: 'bob', mood: 'read', win: W34 });
        await L.wait(0.4); k.mood = 'wistful'; await L.wait(2.8);
      }),
      // scene 6: the girl at the big window looks up amazed when the letters turn into pictures (girl.mood = 'wonder')
      wonder: sheet({ box: [-44, -96, 44, 9], scale: 2.6, cols: 4, settle: 1.2 }, [
        ['noticing 76×86 ×1.45 · wait', 'wait'], ['noticing 76×86 ×1.45 · wonder', 'wonder']
      ].map(([label, mood]) => ({ label, setup: (L) => { addKid(L, { kind: 'pigtails', mood, size: 1.45, win: [76, 86, 'arch'] }); } })).concat(
        ['pigtails', 'curly', 'papa'].map((kind) => ({ label: kind + ' · wonder (face)', box: [-20, -20, 20, 18], scale: 5, ground: false, settle: 0,
          setup: (L) => { L.add({}, { update: () => {}, draw: (ctx, t) => drawHead(ctx, { kind, mood: 'wonder', lookY: -0.7, t }) }); } })))),
      'wistful-faces': sheet({ box: [-20, -20, 20, 18], scale: 5, cols: 6, settle: 0 }, ['pigtails', 'curly', 'bun', 'papa', 'mama', 'spiky'].map((kind) => ({
        label: kind + ' · wistful', ground: false,
        setup: (L) => { L.add({}, { update: () => {}, draw: (ctx, t) => drawHead(ctx, { kind, mood: 'wistful', lookY: 0.6, t }) }); }
      }))),
      // hugging her tree in two passes: body, the trunk's edge, then the arms
      hug: sheet({ box: [-50, -80, 50, 12], scale: 3.4, cols: 3, settle: 1.2 }, [false, true].map((two) => ({
        label: two ? 'hug in two passes' : 'hug in one pass',
        setup: (L) => {
          const k = new Kid({ kind: 'pigtails', pose: 'stand', mood: 'hug', dir: -1, x: 8 });
          const trunk = (ctx) => { ctx.beginPath(); ctx.moveTo(-60, 12); ctx.lineTo(-60, -80); ctx.lineTo(4, -80); ctx.lineTo(4, 12); ctx.fillStyle = '#9a5428'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#1d1530'; ctx.stroke(); };
          L.add(k, { update: (dt) => k.update(dt), draw: (ctx, t) => {
            trunk(ctx);
            if (!two) { k.drawFull(ctx, t); return; }
            k.drawFull(ctx, t, 'body');
            ctx.save(); ctx.beginPath(); ctx.rect(-60, -40, 60 + k.x - 3, 36); ctx.clip(); trunk(ctx); ctx.restore();
            k.drawFull(ctx, t, 'arms');
          } });
        }
      }))),
      // drawHead at the bedroom's sizes with and without the line-weight scale
      headlw: sheet({ box: [-40, -40, 40, 40], scale: 2.6, cols: 4, settle: 0 }, [['child ×2.45', 'pigtails', 2.45, 1], ['child lw 0.66', 'pigtails', 2.45, 0.66], ['papa ×3.25', 'papa', 3.25, 1], ['papa lw 0.54', 'papa', 3.25, 0.54]].map(([label, kind, size, lw]) => ({
        label, ground: false, box: [-48, -48, 48, 48], scale: 1.6,
        setup: (L) => { L.add({}, { update: () => {}, draw: (ctx, t) => { ctx.lineWidth = 3.2; ctx.strokeStyle = '#1d1530'; ctx.beginPath(); ctx.moveTo(-46, 44); ctx.lineTo(46, 44); ctx.stroke(); drawHead(ctx, { kind, size, lw, t, x: 0, y: 0, turn: kind === 'papa' ? 0.8 : 0 }); } }); }
      })))
    };
  }
}
