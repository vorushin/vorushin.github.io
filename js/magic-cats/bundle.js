// Magic cats — the bundles the cats carry: a tale wrapped in a little white sheet.

import { TAU } from './util.js';
import { PAL, ink, wobble, glow } from './paint.js';

// A tale wrapped in a little white sheet. (x, y) is where the knot is held.
export function drawBundle(ctx, x, y, angle, size, seed) {
  const s = size || 1, sd = seed || 1;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle || 0); ctx.scale(s, s);
  // the two floppy corners of the sheet above the knot
  wobble(ctx, [[-1.5, 2], [-12, -7], [-13.5, -1], [-4, 5]], sd + 1, 0.4); ctx.fillStyle = '#ece8dc'; ctx.fill(); ink(ctx, 2);
  wobble(ctx, [[1.5, 2], [12, -7], [13.5, -1], [4, 5]], sd + 2, 0.4); ctx.fillStyle = '#ece8dc'; ctx.fill(); ink(ctx, 2);
  // round sack
  wobble(ctx, [[-4, 3], [-12, 9], [-12.5, 18], [-6, 24], [6, 24], [12.5, 18], [12, 9], [4, 3]], sd, 0.5);
  ctx.fillStyle = PAL.white; ctx.fill(); ink(ctx, 2.4);
  ctx.strokeStyle = 'rgba(29,21,48,0.22)'; ctx.lineWidth = 1.2; ctx.lineCap = 'round'; ctx.beginPath();
  ctx.moveTo(-3, 6); ctx.quadraticCurveTo(-8, 11, -8, 17); ctx.moveTo(3, 6); ctx.quadraticCurveTo(8, 11, 8, 16); ctx.stroke();
  // the knot
  ctx.beginPath(); ctx.ellipse(0, 3.2, 3.6, 3, 0, 0, TAU); ctx.fillStyle = '#ece8dc'; ctx.fill(); ink(ctx, 1.8);
  // a little gold star: there is a tale inside
  ctx.fillStyle = '#f2b93a'; ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i / 10) * TAU, r = i % 2 ? 1.9 : 4.3; ctx.lineTo(Math.cos(a) * r, 15.5 + Math.sin(a) * r); }
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

// A bundle lying / flying on its own (world coordinates).
export function drawLooseBundle(ctx, x, y, rot, size, glowA) {
  if (glowA) glow(ctx, x, y, 34 * (size || 1), PAL.gold, glowA);
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.translate(0, -13 * (size || 1));
  drawBundle(ctx, 0, 0, 0, size || 1, 7);
  ctx.restore();
}
