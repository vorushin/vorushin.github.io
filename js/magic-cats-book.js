/* Magic cats storybook — reading page behaviour (/books/magic-cats)

   1. language switch (EN / DE / RU), keeping your place in the text
   2. scene colours follow the section being read
   3. picture details only animate while their picture is on screen
   4. "the delivery round": the treetop frieze at the bottom of the page. The cats hop
      along it as you read; every finished section lights a window; the kitten joins
      after the kittens' paragraph; at the end they curl up on the last roof.
   5. a lullaby while you read, if you ask for it (the game's own little synthesiser):
      the music follows the section, and every hop of the cat sings the next note
   6. small courtesies: pictures and paragraphs settle in as they arrive, the cover leans
      towards the pointer, a touch on a picture sends up a few chalk stars

   No dependencies. Everything here is an enhancement: without this file the page is a
   plain, fully readable night-coloured book. */
(function () {
  'use strict';

  var d = document, root = d.documentElement, body = d.body;
  root.className += ' mc-live';

  var reduceMq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(reduceMq && reduceMq.matches); }
  function $$(sel, el) { return Array.prototype.slice.call((el || d).querySelectorAll(sel)); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ── 1. Language ─────────────────────────────────────────────────────────── */
  var AUTHOR = { en: 'Roman Vorushin', de: 'Roman Vorushin', ru: 'Роман Ворушин' };
  var LABELS = { nav: { en: 'Book', de: 'Buch', ru: 'Книга' }, langs: { en: 'Language', de: 'Sprache', ru: 'Язык' } };
  function applyLang(lang, keepPlace) {
    var anchor = null, before = 0;
    if (keepPlace) {
      // hold on to the paragraph being read, so switching mid-story does not lose the place
      var blocks = $$('.mc-para, .mc-afterword-text, .mc-hero-words'), i, r;
      for (i = 0; i < blocks.length; i++) {
        r = blocks[i].getBoundingClientRect();
        if (r.bottom > window.innerHeight * 0.3) { anchor = blocks[i]; before = r.top; break; }
      }
    }
    root.setAttribute('data-lang', lang);
    root.setAttribute('lang', lang);
    try { localStorage.setItem('magic-cats-lang', lang); } catch (e) {}
    $$('[data-set-lang]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-set-lang') === lang));
    });
    $$('img[data-alt-' + lang + ']').forEach(function (img) { img.alt = img.getAttribute('data-alt-' + lang); });
    var t = d.querySelector('.mc-title [lang="' + lang + '"]');
    if (t) d.title = t.textContent.trim() + ' — ' + (AUTHOR[lang] || AUTHOR.en);
    // the controls' spoken names follow the language too (the lullaby button keeps an aria-label:
    // its visible word is hidden on narrow screens)
    var nav = d.querySelector('.mc-topbar'), langs = d.querySelector('.mc-langs'), mb = d.getElementById('mc-music');
    if (nav) nav.setAttribute('aria-label', LABELS.nav[lang] || LABELS.nav.en);
    if (langs) langs.setAttribute('aria-label', LABELS.langs[lang] || LABELS.langs.en);
    var ml = mb && mb.querySelector('.mc-music-label [lang="' + lang + '"]');
    if (ml) { mb.setAttribute('aria-label', ml.textContent); mb.title = ml.textContent; }
    if (anchor && window.pageYOffset > 4) {
      var delta = anchor.getBoundingClientRect().top - before;
      if (Math.abs(delta) > 1) window.scrollBy(0, delta);
    }
    scheduleMeasure();
  }
  $$('[data-set-lang]').forEach(function (b) {
    b.addEventListener('click', function () { applyLang(b.getAttribute('data-set-lang'), true); });
  });

  /* ── 2. Geometry, scene colours, reading progress ────────────────────────── */
  var sceneEls = $$('[data-scene]').filter(function (el) { return el !== body; });
  var spreads = $$('.mc-spread'), endEl = d.querySelector('.mc-end');
  var geo = { scenes: [], spreads: [], endTop: 0, vh: window.innerHeight };
  var themeMeta = d.querySelector('meta[name="theme-color"]');
  var THEME = { night: '#111a44', 'day-yellow': '#f9ec8d', 'day-green': '#d6eead', dusk: '#5f2f7e', pale: '#f1f8fb' };
  var round = null;
  var measureQueued = false, scrollQueued = false;

  function measure() {
    measureQueued = false;
    var sy = window.pageYOffset;
    geo.vh = window.innerHeight;
    geo.scenes = sceneEls.map(function (el) {
      var top = el.getBoundingClientRect().top + sy, fig = el.querySelector('.mc-figure--angel'), txt = el.querySelector('.mc-text');
      // the angel is multiplied into the page and would show as a dark ghost on the night. Where the picture
      // comes first (stacked layouts) the page turns pale as soon as it rises into view; in two columns the
      // turn stays at mid-screen and the picture simply waits for the pale page (see the CSS)
      if (fig && txt && fig.getBoundingClientRect().bottom <= txt.getBoundingClientRect().top + 1) {
        top = Math.min(top, fig.getBoundingClientRect().top + sy - geo.vh * 0.42);
      }
      return { top: top, scene: el.getAttribute('data-scene') };
    });
    geo.spreads = spreads.map(function (el) {
      var r = el.getBoundingClientRect();
      return { top: r.top + sy, bottom: r.bottom + sy };
    });
    geo.endTop = endEl ? endEl.getBoundingClientRect().top + sy : 0;
    onScrollFrame();
  }
  function scheduleMeasure() {
    if (!measureQueued) { measureQueued = true; requestAnimationFrame(measure); }
  }

  function updateScene(sy) {
    var mid = sy + geo.vh * 0.5, scene = 'night', i;
    for (i = 0; i < geo.scenes.length; i++) {
      if (geo.scenes[i].top <= mid) scene = geo.scenes[i].scene; else break;
    }
    if (body.getAttribute('data-scene') !== scene) {
      body.setAttribute('data-scene', scene);
      if (themeMeta && THEME[scene]) themeMeta.setAttribute('content', THEME[scene]);
    }
  }

  /* Reading position → where the cat should be: perch 0–1 are the two lead-in trees (the
     hero), then every section is three trees and a roof. `sleep` rises after the last roof. */
  function storyProgress(sy) {
    var sp = geo.spreads, n = sp.length, read = sy + geo.vh * 0.62, i, t, lead;
    if (!n) return { s: 0, sleep: 0 };
    if (read < sp[0].top) {
      lead = sp[0].top - geo.vh * 0.62;
      return { s: lead > 0 ? clamp(sy / lead, 0, 1) : 1, sleep: 0 };
    }
    for (i = n - 1; i > 0; i--) if (read >= sp[i].top) break;
    t = clamp((read - sp[i].top) / Math.max(1, sp[i].bottom - sp[i].top), 0, 1);
    return {
      s: 1 + 4 * i + 4 * t,
      sleep: (i === n - 1 && t >= 1) ? clamp((read - sp[i].bottom) / (geo.vh * 0.45), 0, 1) : 0
    };
  }

  /* Which part of the book is in the middle of the window (for the music). */
  function sectionKey(sy) {
    var mid = sy + geo.vh * 0.5, sp = geo.spreads, key = 'hero', i;
    for (i = 0; i < sp.length; i++) { if (sp[i].top <= mid) key = spreads[i].id; else break; }
    if (geo.endTop && mid >= geo.endTop) key = 'end';
    return key;
  }

  function onScrollFrame() {
    scrollQueued = false;
    var sy = window.pageYOffset;
    updateScene(sy);
    if (music) music.section(sectionKey(sy));
    if (round) { var p = storyProgress(sy); round.setTarget(p.s, p.sleep); round.nudge(); }
  }
  function onScroll() {
    if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(onScrollFrame); }
  }

  /* ── 3. Animate picture details only while they are on screen ────────────── */
  (function () {
    var live = $$('.mc-figure, .mc-cover, .mc-invite');
    var drawn = $$('.mc-divider, .mc-end');
    var arriving = $$('.mc-figure, .mc-para, .mc-photo, .mc-afterword h2, .mc-afterword-text p');
    if (!('IntersectionObserver' in window)) {
      live.forEach(function (el) { el.classList.add('is-live'); });
      drawn.forEach(function (el) { el.classList.add('is-drawn'); });
      arriving.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    function arrive(el) {
      // a picture settles in only once its painting has loaded, so the plate never fades in empty
      var img = el.classList.contains('mc-figure') ? el.querySelector('.mc-art img') : null;
      if (img && !img.complete) {
        var done = function () { el.classList.add('is-in'); };
        img.addEventListener('load', done, { once: true }); img.addEventListener('error', done, { once: true });
        if (img.complete) done();
      } else el.classList.add('is-in');
    }
    var inObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { arrive(en.target); inObs.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    arriving.forEach(function (el) { inObs.observe(el); });
    var liveObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-live', en.isIntersecting); });
    }, { rootMargin: '8% 0px 8% 0px' });
    live.forEach(function (el) { liveObs.observe(el); });
    var drawObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-drawn'); drawObs.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -16% 0px', threshold: 0.5 });
    drawn.forEach(function (el) { drawObs.observe(el); });
  })();

  /* ── 4. The delivery round ───────────────────────────────────────────────── */
  var PAL = {
    plum: '#1d1530',
    trunks: ['#8a5a2b', '#b0652f', '#c2983a'],
    leaves: ['#2f8f3a', '#3f9f45', '#37994a'], leafHi: '#72c45c', leafDot: '#1f6e2e', apple: '#e2483a',
    grass: '#2c6b3a', grassHi: '#4f9d4c', grassPink: '#c873ae', grassBlue: '#6f8fd8',
    winDark: '#4a2340', winLit: '#ffe36e', gold: '#ffcf5a', ember: '#f39a3d', chalk: '#b9cdf5',
    papa: '#cdd2e2', papaShade: '#a7adc6', papaMuzzle: '#f4f2ec',
    kit: '#f0b24c', kitShade: '#d38f2c', kitMuzzle: '#fde6ae',
    ear: '#e9a9bd', nose: '#d9738c', bundle: '#fbf8ef', bundleFold: '#c9c3b0'
  };
  /* Seven houses, one per section, borrowed from the pictures: the cover's pink house, the
     woven sunny wall, the brick house of the moon milk, the yellow house behind the tree
     library, a lavender cottage, the cover's blue house with its white roof, and a pale one
     with a cloud-blue dome for the angel. `win` is the height of the tale window. */
  var HOUSES = [
    { w: 38, body: 62, roof: 'gable', rh: 17, wall: '#e9b5d8', top: '#d58fc0', win: 42 },
    { w: 46, body: 46, roof: 'flat', rh: 6, wall: '#c9a83e', top: '#8a6f1c', win: 28, weave: true },
    { w: 54, body: 36, roof: 'gable', rh: 20, wall: '#9c3f38', top: '#b5553d', win: 20, chimney: 1 },
    { w: 46, body: 44, roof: 'hip', rh: 16, wall: '#f3e08a', top: '#e08a3c', win: 26, chimney: -1 },
    { w: 40, body: 42, roof: 'gable', rh: 18, wall: '#b89ad6', top: '#7d4c9e', win: 25 },
    { w: 50, body: 50, roof: 'lopsided', rh: 16, wall: '#86a3dc', top: '#f4f6fb', win: 30, chimney: 1 },
    { w: 40, body: 56, roof: 'dome', rh: 18, wall: '#eaf6fa', top: '#a9dcea', win: 35 }
  ];
  var BAND = 92;            // design height of the band, in units (1 unit = k css px)
  var JOIN = 9;
  var GATHER = 0.3;         // the crouch before a leap, as a share of the leap's time
  var SIT_AFTER = 2.6;      // seconds on one perch before a cat sits down             // perch where the kitten joins: the roof of the second house
  function roofOf(i) { return 1 + 4 * (i + 1); }

  function Round(holder) {
    var cv = holder.querySelector('canvas');
    var ctx = cv.getContext('2d');
    var W = 0, H = 0, k = 1, dpr = 1, G = 0, view = 0;   // css size, px per unit, pixel ratio, ground line, visible units
    var world = null, strip = null;
    var cam = 0, clock = 0, last = 0, rafId = 0, idleTimer = 0, aliveUntil = 0, placed = false;
    var target = 0, sleepy = false;
    var lights = [0, 0, 0, 0, 0, 0, 0];
    var sparks = [];
    var papa = hopper(false), kit = hopper(true);

    function hopper(kitten) {
      return { kit: kitten, idx: 0, from: 0, to: 0, t: 0, dur: 0.4, moving: false, wait: 0, dir: 1,
               x: 0, e: 0, air: -1, squash: 0, show: kitten ? 0 : 1, curl: 0, off: 0, rest: 0,
               gather: 0, sit: 0, sat: 0, restAt: 0, px: 0, vx: 0, sw: 0, swv: 0, happy: false };
    }

    /* The frieze. Deterministic, so it is the same little town on every visit. */
    function build(viewUnits) {
      var r = rng(20120726), trees = [], houses = [], perches = [], x = 62, i, j, count = 0;
      function tree(px, perch) {
        var old = (count++ % 5) === 2;
        var t = { x: px, r: old ? 19 + r() * 2.5 : 13 + r() * 5, top: old ? 53 + r() * 5 : 40 + r() * 11, seed: Math.floor(r() * 1e6),
                  trunk: PAL.trunks[Math.floor(r() * 3)], apples: !old && r() < 0.3, lean: (r() - 0.5) * 3, old: old, tw: old ? 6.4 : 2.4 + r() * 1.5 };
        trees.push(t);
        if (perch) perches.push({ x: px + t.lean * 0.3, e: t.top, tree: t });
        return t;
      }
      x += tree(x, true).r * 0.5 + 36 + r() * 8;
      x += tree(x, true).r * 0.5 + 36 + r() * 8;
      for (i = 0; i < 7; i++) {
        for (j = 0; j < 3; j++) x += tree(x, true).r * 0.5 + 35 + r() * 9;
        var s = HOUSES[i], hx = x + s.w / 2 - 4;
        var hs = { x: hx, spec: s, idx: i, seed: 100 + i * 17 };
        houses.push(hs);
        perches.push({ x: hx + (s.roof === 'lopsided' ? -s.w * 0.16 : 0), e: s.body + s.rh, house: hs });
        x = hx + s.w / 2 + 30 + r() * 8;
      }
      tree(x, false); tree(x + 46 + r() * 10, false);
      var width = x + 96;
      if (viewUnits > width) {           // very wide screens: centre the town, plant more trees around it
        var pad = (viewUnits - width) / 2, fx;
        trees.forEach(function (t) { t.x += pad; });
        houses.forEach(function (h) { h.x += pad; });
        perches.forEach(function (p) { p.x += pad; });
        for (fx = pad - 12; fx > 8; fx -= 44 + r() * 14) tree(fx, false);
        for (fx = pad + width - 6; fx < viewUnits - 8; fx += 44 + r() * 14) tree(fx, false);
        width = viewUnits;
      }
      return { width: width, trees: trees, houses: houses, perches: perches };
    }

    /* ── drawing helpers (all in units; y grows downwards, G is the ground line) ── */
    function circle(c, x, y, rad) { c.beginPath(); c.arc(x, y, rad, 0, 6.2832); }
    function wobbly(c, pts, r, amp, closed) {
      var j = pts.map(function (p) { return [p[0] + (r() - 0.5) * amp, p[1] + (r() - 0.5) * amp]; }), i;
      c.beginPath(); c.moveTo(j[0][0], j[0][1]);
      for (i = 1; i < j.length; i++) c.lineTo(j[i][0], j[i][1]);
      if (closed) c.closePath();
    }
    function arch(c, x, y, hw, hh) {
      c.beginPath();
      c.moveTo(x - hw, y + hh * 0.5);
      c.lineTo(x - hw, y - hh * 0.25);
      c.quadraticCurveTo(x, y - hh, x + hw, y - hh * 0.25);
      c.lineTo(x + hw, y + hh * 0.5);
      c.closePath();
    }
    function crownBlobs(t) {
      var rr = rng(t.seed), cap = { x: t.x + t.lean * 0.3, y: G - t.top + t.r * 0.62, r: t.r * 0.62 };
      var blobs = [cap], n = 4, i, a;
      for (i = 0; i < n; i++) {
        a = Math.PI * (0.08 + 0.84 * i / (n - 1)) + (rr() - 0.5) * 0.3;
        blobs.push({ x: cap.x + Math.cos(a) * t.r * 0.62, y: cap.y + t.r * 0.32 + Math.sin(a) * t.r * 0.26, r: t.r * (0.5 + rr() * 0.16) });
      }
      return { blobs: blobs, rr: rr, cap: cap };
    }
    function drawTree(c, t) {
      var cb = crownBlobs(t), blobs = cb.blobs, rr = cb.rr, cap = cb.cap, i;
      c.beginPath();
      c.moveTo(t.x - t.tw * 1.5, G + 60);
      c.quadraticCurveTo(t.x - t.tw * 0.9, G - 8, cap.x - t.tw * 0.85, cap.y + t.r * 0.5);
      c.lineTo(cap.x + t.tw * 0.85, cap.y + t.r * 0.5);
      c.quadraticCurveTo(t.x + t.tw * 0.9, G - 8, t.x + t.tw * 1.5, G + 60);
      c.closePath();
      c.fillStyle = t.trunk; c.fill();
      c.strokeStyle = PAL.plum; c.lineWidth = 1.5; c.stroke();
      if (t.old) { circle(c, t.x, G - 11.5, 4.3); c.fillStyle = '#17101f'; c.fill(); }
      c.lineWidth = 3.2;                                    // stroke every blob, then fill over: only the outer outline stays
      for (i = 0; i < blobs.length; i++) { circle(c, blobs[i].x, blobs[i].y, blobs[i].r); c.stroke(); }
      c.fillStyle = PAL.leaves[Math.floor(rr() * 3)];
      for (i = 0; i < blobs.length; i++) { circle(c, blobs[i].x, blobs[i].y, blobs[i].r); c.fill(); }
      c.fillStyle = PAL.leafHi; c.globalAlpha = 0.7;
      circle(c, cap.x - cap.r * 0.28, cap.y - cap.r * 0.18, cap.r * 0.5); c.fill();
      circle(c, blobs[4].x - 1.5, blobs[4].y - 1.5, blobs[4].r * 0.42); c.fill();
      c.globalAlpha = 1;
      for (i = 0; i < 6; i++) {
        c.fillStyle = t.apples ? PAL.apple : PAL.leafDot;
        circle(c, cap.x + (rr() - 0.5) * t.r * 1.5, cap.y + rr() * t.r * 0.85, t.apples ? 1.35 : 0.9); c.fill();
      }
    }
    function roofPath(c, h) {
      var s = h.spec, x0 = h.x - s.w / 2, x1 = h.x + s.w / 2, y = G - s.body;
      c.beginPath();
      if (s.roof === 'gable') { c.moveTo(x0 - 3.5, y + 1); c.lineTo(h.x, y - s.rh); c.lineTo(x1 + 3.5, y + 1); }
      else if (s.roof === 'flat') { c.moveTo(x0 - 3, y + 1); c.lineTo(x0 - 3, y - s.rh); c.lineTo(x1 + 3, y - s.rh); c.lineTo(x1 + 3, y + 1); }
      else if (s.roof === 'hip') { c.moveTo(x0 - 3.5, y + 1); c.lineTo(x0 + s.w * 0.24, y - s.rh); c.lineTo(x1 - s.w * 0.24, y - s.rh); c.lineTo(x1 + 3.5, y + 1); }
      else if (s.roof === 'lopsided') { c.moveTo(x0 - 4, y + 1.5); c.lineTo(x0 + s.w * 0.34, y - s.rh); c.lineTo(x1 - s.w * 0.06, y - s.rh * 0.52); c.lineTo(x1 + 4, y + 1.5); }
      else { c.moveTo(x0 - 2, y + 1); c.bezierCurveTo(x0 + 1, y - s.rh * 1.33, x1 - 1, y - s.rh * 1.33, x1 + 2, y + 1); }
      c.closePath();
    }
    function chimneyTop(h) {         // where the smoke starts, or null
      var s = h.spec;
      if (!s.chimney) return null;
      return { x: h.x + s.chimney * s.w * 0.27, y: G - s.body - s.rh * 0.5 - 7 };
    }
    function drawHouse(c, h) {
      var s = h.spec, x0 = h.x - s.w / 2, x1 = h.x + s.w / 2, y = G - s.body, rr = rng(h.seed), i, ch;
      ch = chimneyTop(h);
      if (ch) {
        c.beginPath(); c.rect(ch.x - 3, ch.y, 6, 14);
        c.fillStyle = s.roof === 'lopsided' ? '#8f6a5c' : s.top; c.fill();
        c.strokeStyle = PAL.plum; c.lineWidth = 1.5; c.stroke();
      }
      wobbly(c, [[x0, G + 60], [x0, y], [x1, y], [x1, G + 60]], rr, 0.9, true);
      c.fillStyle = s.wall; c.fill();
      if (s.weave) {                 // the woven wall from the sunny-tree picture
        c.save(); c.clip();
        c.strokeStyle = 'rgba(110, 86, 16, 0.55)'; c.lineWidth = 1.6;
        for (i = y + 5; i < G + 10; i += 5.5) { c.beginPath(); c.moveTo(x0, i); c.lineTo(x1, i + (rr() - 0.5)); c.stroke(); }
        c.strokeStyle = 'rgba(110, 86, 16, 0.3)'; c.lineWidth = 1;
        for (i = x0 + 5; i < x1; i += 6.5) { c.beginPath(); c.moveTo(i, y); c.lineTo(i, G + 10); c.stroke(); }
        c.restore();
        wobbly(c, [[x0, G + 60], [x0, y], [x1, y], [x1, G + 60]], rng(h.seed), 0.9, true);
      }
      c.strokeStyle = PAL.plum; c.lineWidth = 1.6; c.stroke();
      roofPath(c, h); c.fillStyle = s.top; c.fill(); c.strokeStyle = PAL.plum; c.lineWidth = 1.6; c.lineJoin = 'round'; c.stroke();
      if (s.body > 48) {             // tall houses get a second, sleeping window
        arch(c, h.x - 7, G - s.win + 20, 3.6, 6); c.fillStyle = PAL.winDark; c.fill(); c.lineWidth = 1.1; c.stroke();
        arch(c, h.x + 7, G - s.win + 20, 3.6, 6); c.fill(); c.stroke();
      }
      arch(c, h.x, G - s.win, 5.6, 8.8); c.fillStyle = PAL.winDark; c.fill(); c.lineWidth = 1.3; c.stroke();
      c.beginPath(); c.rect(h.x - 7.4, G - s.win + 4.2, 14.8, 2); c.fillStyle = '#f4f6fb'; c.fill(); c.lineWidth = 1; c.stroke();
    }
    function drawGrass(c) {
      var r = rng(4242), x, w = world.width, i;
      c.beginPath(); c.moveTo(-4, G + 60); c.lineTo(-4, G - 5);
      for (x = 0; x <= w + 8; x += 7) c.lineTo(x, G - 4.2 - r() * 2.6);
      c.lineTo(w + 8, G + 60); c.closePath();
      c.fillStyle = PAL.grass; c.fill();
      c.lineCap = 'round';
      for (x = 2; x < w; x += 4.6) {     // painted blades, with the cover's pink and blue strokes among them
        i = r();
        c.strokeStyle = i < 0.09 ? PAL.grassPink : i < 0.16 ? PAL.grassBlue : PAL.grassHi;
        c.globalAlpha = 0.5 + r() * 0.4; c.lineWidth = 1 + r() * 0.5;
        c.beginPath(); c.moveTo(x, G - 0.5 + r() * 3); c.lineTo(x + (r() - 0.5) * 3.4, G - 4.5 - r() * 4.2); c.stroke();
      }
      c.globalAlpha = 1;
    }
    function renderStrip() {
      strip = d.createElement('canvas');
      strip.width = Math.ceil(world.width * k * dpr);
      strip.height = Math.ceil(H * dpr);
      var c = strip.getContext('2d');
      c.setTransform(k * dpr, 0, 0, k * dpr, 0, 0);
      c.lineJoin = 'round';
      world.houses.forEach(function (h) { drawHouse(c, h); });
      world.trees.forEach(function (t) { drawTree(c, t); });
      drawGrass(c);
    }

    /* The surface a cat stands on, `off` units to the side of a perch. */
    function surface(p, off) {
      if (p.tree) { var cr = p.tree.r * 0.62, o = Math.min(Math.abs(off), cr * 0.92); return p.e - (cr - Math.sqrt(cr * cr - o * o)); }
      var s = p.house.spec, a = Math.abs(off);
      if (s.roof === 'gable') return p.e - a * s.rh / (s.w / 2 + 3.5);
      if (s.roof === 'lopsided') return p.e - (off < 0 ? a * s.rh / (s.w * 0.34 + 4) : a * s.rh * 0.48 / (s.w * 0.6));
      if (s.roof === 'dome') return p.e - a * a * 0.045;
      return p.e;
    }
    function standOffset(hp) {       // side by side only when they share a perch (the last roof)
      var together = kit.show > 0.5 && kit.idx === papa.idx && !kit.moving && !papa.moving;
      return together ? (hp.kit ? -8 : 7) : 0;
    }

    function place(hp) {
      var P = world.perches, a, b, p, ax, bx, arc, off;
      hp.off += (standOffset(hp) - hp.off) * 0.2;
      off = hp.off;
      hp.gather = 0;
      if (hp.moving && hp.t < 0) {     // gathering on the old perch before the push-off
        a = P[hp.from];
        hp.x = a.x + off; hp.e = surface(a, off); hp.air = -1;
        hp.gather = 1 + hp.t / GATHER;
      } else if (hp.moving) {
        a = P[hp.from]; b = P[hp.to]; p = hp.t;
        ax = a.x + off; bx = b.x + off;
        hp.x = lerp(ax, bx, p * 0.7 + p * p * (3 - 2 * p) * 0.3);
        arc = 12 + Math.abs(bx - ax) * 0.15 + Math.max(0, b.e - a.e) * 0.3;
        hp.e = lerp(surface(a, off), surface(b, off), p) + arc * 4 * p * (1 - p) * (hp.kit ? 1.18 : 1);
        hp.air = p;
      } else {
        a = P[hp.idx];
        hp.x = a.x + off; hp.e = surface(a, off); hp.air = -1;
      }
    }
    function burst(x, e, kind) {
      var n = kind === 'gold' ? 9 : 5, i, a;
      for (i = 0; i < n; i++) {
        a = kind === 'gold' ? -Math.PI / 2 + (Math.random() - 0.5) * 2.2 : -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
        sparks.push({ x: x + (Math.random() - 0.5) * 6, e: e, vx: Math.cos(a) * (14 + Math.random() * 16), ve: -Math.sin(a) * (16 + Math.random() * 22),
                      life: 0, max: kind === 'gold' ? 0.9 + Math.random() * 0.5 : 0.45 + Math.random() * 0.25, kind: kind });
      }
    }
    function swing(hp, dt) {         // the bundle: a pendulum hanging from the mouth, pushed by every change of speed
      var vx = (hp.x - hp.px) / dt;
      hp.swv += clamp(vx - hp.vx, -160, 160) * 0.011;
      hp.vx = vx; hp.px = hp.x;
      hp.swv += (-46 * hp.sw - 4.2 * hp.swv) * dt;
      hp.sw = clamp(hp.sw + hp.swv * dt, -0.7, 0.7);
    }
    function settle(hp) { hp.px = hp.x; hp.vx = 0; hp.sw = hp.swv = 0; hp.restAt = clock - SIT_AFTER - 1; }
    function landed(hp) {
      var p = world.perches[hp.idx];
      hp.restAt = clock; wake();
      if (hp.kit && kit.show < 0.5) return;
      if (p.tree) burst(hp.x, hp.e - 1, 'leaf');
      else if (!hp.kit && hp.dir > 0) burst(p.house.x, p.house.spec.win + 5, 'gold');
      if (music) {                     // with the lullaby on, every landing sings
        var pan = clamp(((hp.x - cam) / Math.max(1, view)) * 1.6 - 0.8, -0.8, 0.8);
        if (!p.tree && !hp.kit && hp.dir > 0) music.bell(pan); else music.hop(pan, hp.kit);
      }
    }
    function moveHopper(hp, tgt, dt, delay) {
      var gap, turning = false;
      if (!hp.moving) {
        if (hp.squash > 0) hp.squash = Math.max(0, hp.squash - dt * 5);
        if (hp.idx !== tgt) {
          hp.wait += dt;
          if (hp.wait >= delay) {
            gap = Math.abs(tgt - hp.idx);
            hp.from = hp.idx; hp.to = hp.idx + (tgt > hp.idx ? 1 : -1);
            hp.dir = hp.to > hp.from ? 1 : -1;
            hp.dur = clamp(0.46 / (1 + (gap - 1) * 0.6), 0.075, 0.46) * (hp.kit ? 1.08 : 1);
            hp.sat = hp.sit; hp.t = -GATHER; hp.moving = true; hp.squash = 0; hp.rest = 0;
          }
        } else {
          hp.wait = 0;
          if (hp.dir < 0) {                 // after hopping back, turn to face the way the story goes
            hp.rest += dt;
            if (hp.rest > 0.5) { hp.dir = 1; hp.rest = 0; } else turning = true;
          }
        }
      }
      if (hp.moving) {
        hp.t += dt / hp.dur;
        if (hp.t >= 1) { hp.t = 1; hp.moving = false; hp.idx = hp.to; hp.squash = 1; hp.wait = delay; place(hp); landed(hp); }
      }
      place(hp);
      swing(hp, dt);
      if (Math.abs(hp.sw) > 0.004 || Math.abs(hp.swv) > 0.03) turning = true;
      var sat = clock - hp.restAt;               // a while on one perch: sit down
      if (!hp.moving && sat > SIT_AFTER - 0.1 && sat < SIT_AFTER + 0.7) turning = true;
      return hp.moving || hp.squash > 0 || hp.idx !== tgt || turning;
    }

    function step(dt) {
      var P = world.perches, lastIdx = P.length - 1, busy = false, i, want, lv, camT, c0, s;
      var tgt = clamp(target, 0, lastIdx);
      if (!placed || reduced()) {      // first frame, or no motion wanted: simply be there
        papa.idx = tgt; papa.moving = false; papa.squash = 0; papa.dir = kit.dir = 1;
        kit.idx = kitTarget(tgt, lastIdx); kit.moving = false; kit.squash = 0;
        kit.show = tgt > JOIN ? 1 : 0;
        papa.off = kit.off = 0;
        for (i = 0; i < 7; i++) lights[i] = tgt >= roofOf(i) ? 1 : 0;
        papa.curl = kit.curl = sleepy && tgt === lastIdx ? 1 : 0;
        place(papa); place(kit); settle(papa); settle(kit);
        cam = cameraTarget();
        placed = true;
        return false;
      }
      if (!papa.moving && Math.abs(tgt - papa.idx) > 6) {     // a long jump in the text: skip ahead, hop only the last few trees
        papa.idx = tgt - (tgt > papa.idx ? 3 : -3);
        kit.idx = kitTarget(papa.idx, lastIdx); kit.moving = false;
        kit.show = papa.idx > JOIN ? 1 : 0;
        place(papa); place(kit); settle(papa); settle(kit);
        cam = cameraTarget();
      }
      busy = moveHopper(papa, tgt, dt, 0) || busy;
      want = papa.idx > JOIN || (papa.moving && papa.to > JOIN) ? 1 : 0;
      if (Math.abs(kit.show - want) > 0.01) { kit.show += (want - kit.show) * Math.min(1, dt * 7); busy = true; } else kit.show = want;
      busy = moveHopper(kit, kitTarget(tgt, lastIdx), dt, 0.2) || busy;
      if (Math.abs(standOffset(papa) - papa.off) > 0.05 || Math.abs(standOffset(kit) - kit.off) > 0.05) busy = true;
      for (i = 0; i < 7; i++) {
        lv = papa.idx >= roofOf(i) ? 1 : 0;
        if (Math.abs(lights[i] - lv) > 0.01) { lights[i] += (lv - lights[i]) * Math.min(1, dt * 3.2); busy = true; } else lights[i] = lv;
      }
      want = sleepy && papa.idx === lastIdx && !papa.moving ? 1 : 0;
      if (Math.abs(papa.curl - want) > 0.01) { papa.curl += (want - papa.curl) * Math.min(1, dt * 5); busy = true; } else papa.curl = want;
      want = want && kit.idx === lastIdx && !kit.moving ? 1 : 0;
      if (Math.abs(kit.curl - want) > 0.01) { kit.curl += (want - kit.curl) * Math.min(1, dt * 5); busy = true; } else kit.curl = want;
      for (i = sparks.length - 1; i >= 0; i--) {
        s = sparks[i]; s.life += dt;
        if (s.life >= s.max) { sparks.splice(i, 1); continue; }
        s.x += s.vx * dt; s.e += s.ve * dt; s.ve -= (s.kind === 'gold' ? 18 : 70) * dt;
        busy = true;
      }
      camT = cameraTarget(); c0 = cam;
      cam += (camT - cam) * Math.min(1, dt * 4.5);
      if (Math.abs(camT - cam) < 0.05) cam = camT;
      if (cam !== c0) busy = true;
      return busy;
    }
    function kitTarget(tgt, lastIdx) {       // one tree behind papa; they share only the last roof
      return tgt >= lastIdx ? lastIdx : Math.max(JOIN, tgt - 1);
    }
    function cameraTarget() {
      return clamp(papa.x - view * 0.4, 0, Math.max(0, world.width - view));
    }

    /* ── the cats ──
       The game's two cats (js/magic-cats/cat.js), redrawn small and by hand: a slim level trunk, a neck,
       hind legs with a hock, a head turned three-quarters with two big dark eyes, a tail with a hooked
       tip. A pose is a handful of points in the cat's own frame (x forwards, y down, 0 = where the paws
       stand); poses are blended number by number. Everything is stroked in plum first, a little wider,
       and coloured on top, so one ink line runs round the whole animal. */
    var KINDS = {
      papa: { fur: '#c9cfe6', dark: '#9aa2c6', belly: '#f4f5fb', ear: '#f3a9b8', nose: '#e5788d', size: 1.2, B: 1, L: 1, H: 1, P: 1, T: 1, W: 1 },
      kit: { fur: '#f2ab3e', dark: '#d07c1f', belly: '#fde6ae', ear: '#f7b7a8', nose: '#e06a6a', size: 0.86, B: 0.8, L: 0.74, H: 1.16, P: 1.25, T: 0.82, W: 1.08 }
    };
    function smooth(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
    function mix(a, b, t) {
      var o = {}, key, i;
      for (key in a) {
        if (typeof a[key] === 'number') o[key] = a[key] + (b[key] - a[key]) * t;
        else { o[key] = []; for (i = 0; i < a[key].length; i++) o[key].push(a[key][i] + (b[key][i] - a[key][i]) * t); }
      }
      return o;
    }
    // hk: knee, hock, paw of the near hind leg; fk: elbow, paw of the near foreleg (the far pair is the
    // near pair moved `far` forwards); ta: tail root, two controls, top, hooked tip; tf: tail lies in front
    function poseStand(d) {
      var L = d.L, T = d.T, hy = -(0.9 * d.P + 11 * L), sy = hy + 0.4, hx = -7.2 * d.B, sx = 6 * d.B, py = -0.9 * d.P;
      return { hx: hx, hy: hy, sx: sx, sy: sy, nx: sx + 5.4, ny: sy - 6.6 - 0.9 * d.H, turn: 1, rr: 1, lid: 0, tf: 0, far: 1.9,
        hk: [hx + 3 * L, -7.4 * L, hx - 1.5 * L, -3.4 * L, hx + 0.3, py],
        fk: [sx - 0.1, -6.2 * L, sx + 0.5, py],
        ta: [hx - 3.4, hy - 2, hx - 8.8 * T, hy - 1.4 * T, hx - 10.4 * T, hy - 12.6 * T, hx - 5.6 * T, hy - 14.8 * T, hx - 3.4 * T, hy - 12.8 * T] };
    }
    function poseSit(d) {
      var L = d.L, T = d.T, hx = -4.4 * d.B, hy = -5.6 * L - 0.6, sx = 3.8 * d.B, sy = -(0.9 * d.P + 12.6 * L), py = -0.9 * d.P;
      return { hx: hx, hy: hy, sx: sx, sy: sy, nx: sx + 2.8, ny: sy - 7.4 - 0.9 * d.H, turn: 1, rr: 1.1, lid: 0, tf: 1, far: 1.5,
        hk: [hx + 4 * L, hy + 1.2 * L, hx - 0.4, -1.3, hx + 4.4 * L, py],
        fk: [sx + 0.8, -6.6 * L, sx + 1.1, py],
        ta: [hx - 4.4, hy + 2.6, hx - 9.6 * T, -0.2, hx - 6.6 * T, 1, hx + 1.2 * T, -0.6, hx + 3.8 * T, -1.9] };
    }
    function poseCrouch(d) {      // gathering for the leap, and the knees giving on touch-down
      var o = poseStand(d), L = d.L, T = d.T, hx = o.hx, sx = o.sx, py = -0.9 * d.P;
      o.hy += 3.6 * L; o.sy += 4 * L; o.nx += 1.4; o.ny += 5.4 * L; o.turn = 0.45;
      var hy = o.hy;
      o.hk = [hx + 4.2 * L, -4.8 * L, hx - 2.8 * L, -2.2 * L, hx + 0.6, py];
      o.fk = [sx - 2 * L, -3.8 * L, sx + 0.9, py];
      o.ta = [hx - 3.4, hy - 1.6, hx - 8.4 * T, hy - 1, hx - 12.4 * T, hy - 4.4 * T, hx - 11.6 * T, hy - 9.4 * T, hx - 9.2 * T, hy - 10 * T];
      return o;
    }
    function poseOff(d) {         // pushing off: hind legs straight out behind, forepaws tucked under the chest
      var o = poseStand(d), L = d.L, T = d.T, hx = o.hx, hy = o.hy, sx = o.sx, sy = o.sy;
      o.nx = sx + 6; o.ny = sy - 6.2; o.turn = 0.35; o.far = 2.4;
      o.hk = [hx + 1.4 * L, hy + 5.4 * L, hx - 2.6 * L, -3 * L, hx - 4.6 * L, -0.5];
      o.fk = [sx + 2.8 * L, sy + 3.6 * L, sx + 4.6 * L, sy + 1.8 * L];
      o.ta = [hx - 3.4, hy - 1.4, hx - 8.6 * T, hy - 0.4, hx - 12.6 * T, hy - 3 * T, hx - 15.4 * T, hy - 6.6 * T, hx - 16.4 * T, hy - 8.8 * T];
      return o;
    }
    function poseAir(d) {         // stretched out, the head looking ahead
      var o = poseStand(d), L = d.L, T = d.T, hx = -8.8 * d.B, sx = 7.6 * d.B, hy = o.hy - 0.4, sy = hy;
      o.hx = hx; o.sx = sx; o.hy = hy; o.sy = sy; o.nx = sx + 6.6; o.ny = sy - 4.4; o.turn = 0.12; o.far = 2.6;
      o.hk = [hx - 1.4 * L, hy + 4.6 * L, hx - 6 * L, hy + 6.2 * L, hx - 9.2 * L, hy + 7 * L];
      o.fk = [sx + 3.8 * L, hy + 3.6 * L, sx + 7.6 * L, hy + 5.4 * L];
      o.ta = [hx - 3.6, hy - 1.2, hx - 8.2 * T, hy - 1.8 * T, hx - 12.4 * T, hy - 2.8 * T, hx - 16.6 * T, hy - 4.2 * T, hx - 18.4 * T, hy - 6.2 * T];
      return o;
    }
    function poseLand(d) {        // forepaws reaching down for the roof or the crown, hind legs drawn up
      var o = poseStand(d), L = d.L, T = d.T, hx = o.hx, hy = o.hy, sx = o.sx;
      o.nx = sx + 6; o.ny = o.sy - 5.6; o.turn = 0.3; o.far = 2.2;
      o.hk = [hx + 3.8 * L, hy + 3 * L, hx + 0.4 * L, hy + 4.8 * L, hx + 3 * L, hy + 6.4 * L];
      o.fk = [sx + 2.4 * L, -6.6 * L, sx + 3.6 * L, -1.1 * d.P];
      o.ta = [hx - 3.4, hy - 1.8, hx - 8.6 * T, hy - 2.6 * T, hx - 11.4 * T, hy - 10.4 * T, hx - 7.6 * T, hy - 13.4 * T, hx - 5.4 * T, hy - 11.8 * T];
      return o;
    }
    function poseCurl(d, br) {    // the loaf: asleep, paws and tail tucked in, breathing
      var hx = -5.8 * d.B, sx = 2.6 * d.B, hy = -5.4 * d.W * br, sy = -5.1 * d.W * br;
      return { hx: hx, hy: hy, sx: sx, sy: sy, nx: sx + 4.2, ny: -5 - 0.6 * d.H, turn: 1, rr: 1.08, lid: 1, tf: 1, far: 1.2,
        hk: [hx + 2, -2.8, hx - 0.6, -1.6, hx + 3.2, -1.1],
        fk: [sx + 1.8, -2.6, sx + 3.8, -1.1],
        ta: [hx - 4.8, -2.6, hx - 7.4, 0.4, hx - 2, 0.7, sx - 0.4, -0.5, sx + 2.2, -1.5] };
    }
    function leapPose(d, u) {
      if (u < 0.12) return mix(poseCrouch(d), poseOff(d), smooth(u / 0.12));
      if (u < 0.45) return mix(poseOff(d), poseAir(d), smooth((u - 0.12) / 0.33));
      return mix(poseAir(d), poseLand(d), smooth((u - 0.45) / 0.55));
    }

    function catPose(o, d) {
      var rest = o.sit, P;
      if (o.curl > 0) return mix(poseSit(d), poseCurl(d, 1 + Math.sin(clock * 1.5 + (o.kit ? 0.8 : 0)) * 0.04), smooth(o.curl));
      if (o.air >= 0) return leapPose(d, o.air);
      P = rest > 0 ? mix(poseStand(d), poseSit(d), smooth(rest)) : poseStand(d);
      if (o.gather > 0) P = mix(P, poseCrouch(d), smooth(o.gather));
      if (o.squash > 0) P = o.squash > 0.7 ? mix(poseCrouch(d), poseLand(d), (o.squash - 0.7) / 0.3) : mix(P, poseCrouch(d), o.squash / 0.7);
      return P;
    }

    function drawCat(c, o) {
      var K = o.kit ? KINDS.kit : KINDS.papa, d = K, size = K.size * o.show;
      if (size < 0.05) return;
      var P = catPose(o, d), OL = 1.3 / Math.sqrt(K.size), young = 1 - d.L;
      var legW = 2.7 * (1 + young * 0.5), pawR = 1.5 * d.P, tw = 4.4 * d.W, rr = 5.3 * d.W * P.rr, cr = 4.8 * d.W;
      var fly = o.air >= 0 ? Math.sin(Math.PI * o.air) : 0;
      var pitch = o.air >= 0 ? -0.4 * Math.cos(Math.PI * o.air) * Math.pow(fly, 0.6) : 0;
      var sq = o.squash, H = d.H, f = 1 - P.turn, E = 1 + young * 0.9;
      var blink = ((clock + (o.kit ? 1.7 : 0)) % 4.7) < 0.15;
      var sway = Math.sin(clock * 2.1 + (o.kit ? 1.3 : 0));
      var hk = P.hk, fk = P.fk, ta = P.ta, far = P.far, i;
      c.save();
      c.translate(o.x, G - o.e);
      c.scale(o.dir * size, size);
      c.scale(1 + 0.1 * sq - 0.04 * fly, 1 - 0.12 * sq + 0.04 * fly);
      var cx = (P.hx + P.sx) / 2, cy = (P.hy + P.sy) / 2;
      c.translate(cx, cy); c.rotate(pitch); c.translate(-cx, -cy);
      c.lineJoin = 'round'; c.lineCap = 'round';
      // tail sways a little at rest
      if (o.air < 0 && !P.tf) { ta = ta.slice(); ta[6] += sway * 0.9; ta[8] += sway * 1.2; ta[9] += Math.abs(sway) * 0.4; ta[4] += sway * 0.5; }

      function tailPath() { c.beginPath(); c.moveTo(ta[0], ta[1]); c.bezierCurveTo(ta[2], ta[3], ta[4], ta[5], ta[6], ta[7]); c.quadraticCurveTo(ta[8] - (ta[6] - ta[8]) * 0.2, ta[7] - 0.6, ta[8], ta[9]); }
      function hind(dx, fromKnee) {
        c.beginPath();
        if (fromKnee) c.moveTo(hk[0] + dx, hk[1]); else { c.moveTo(P.hx + dx, P.hy); c.lineTo(hk[0] + dx, hk[1]); }
        c.lineTo(hk[2] + dx, hk[3]); c.lineTo(hk[4] + dx, hk[5]);
      }
      function fore(dx, fromElbow) {
        c.beginPath();
        if (fromElbow) c.moveTo(fk[0] + dx, fk[1]); else { c.moveTo(P.sx + dx, P.sy + 1); c.lineTo(fk[0] + dx, fk[1]); }
        c.lineTo(fk[2] + dx, fk[3]);
      }
      function trunk() { c.beginPath(); c.moveTo(P.hx, P.hy); c.lineTo(P.sx, P.sy); }
      function neck() { c.beginPath(); c.moveTo(P.sx + 1, P.sy - 1); c.lineTo(P.nx - 1.2, P.ny + 1.6); }
      // head-local features (the head is drawn at P.nx, P.ny)
      var hrx = 6.1 * H, hry = 5.4 * H;
      function headPath() { c.beginPath(); c.ellipse(P.nx, P.ny, hrx, hry, 0, 0, 6.2832); }
      function snout() { circle(c, P.nx + (3.2 + f * 2) * H, P.ny + 1.9 * H, 2.4 * H); }
      function ear(nearEar) {
        var s = nearEar ? -1 : 1, bx = P.nx - f * (nearEar ? 1.4 : 2.4) * H, by = P.ny;
        c.beginPath();
        if (nearEar) { c.moveTo(bx - 5.1 * H, by - 1.6 * H); c.lineTo(bx - 4.5 * H, by - 8.8 * H); c.lineTo(bx - 0.8 * H, by - 5 * H); }
        else { c.moveTo(bx + 0.8 * H, by - 5.1 * H); c.lineTo(bx + 3.8 * H, by - 9 * H); c.lineTo(bx + 5 * H, by - 2.4 * H); }
        c.closePath();
        return s;
      }
      function earIn(nearEar) {
        var bx = P.nx - f * (nearEar ? 1.4 : 2.4) * H, by = P.ny;
        c.beginPath();
        if (nearEar) { c.moveTo(bx - 4.2 * H, by - 3 * H); c.lineTo(bx - 4.2 * H, by - 7.2 * H); c.lineTo(bx - 2 * H, by - 4.9 * H); }
        else { c.moveTo(bx + 1.8 * H, by - 5 * H); c.lineTo(bx + 3.6 * H, by - 7.6 * H); c.lineTo(bx + 4.2 * H, by - 3.6 * H); }
        c.closePath();
      }

      // ── 1. the ink: everything a little wider, in plum ──
      c.strokeStyle = PAL.plum; c.fillStyle = PAL.plum;
      c.lineWidth = 2.5 + 2 * OL; tailPath(); c.stroke();
      c.lineWidth = legW + 2 * OL; hind(far, false); c.stroke(); fore(far, false); c.stroke(); hind(0, false); c.stroke(); fore(0, false); c.stroke();
      circle(c, hk[4] + 0.5, hk[5] - 0.2, pawR + OL); c.fill(); circle(c, fk[2] + 0.5, fk[3] - 0.2, pawR + OL); c.fill();
      circle(c, hk[4] + far + 0.5, hk[5] - 0.2, pawR + OL); c.fill(); circle(c, fk[2] + far + 0.5, fk[3] - 0.2, pawR + OL); c.fill();
      c.lineWidth = 2 * tw + 2 * OL; trunk(); c.stroke();
      circle(c, P.hx, P.hy, rr + OL); c.fill(); circle(c, P.sx, P.sy, cr + OL); c.fill();
      c.lineWidth = 5.6 * H + 2 * OL; neck(); c.stroke();
      c.lineWidth = 2 * OL; ear(true); c.stroke(); c.fill(); ear(false); c.stroke(); c.fill();
      headPath(); c.stroke(); c.fill(); snout(); c.stroke(); c.fill();

      // ── 2. colour ──
      c.strokeStyle = K.dark; c.fillStyle = K.dark; c.lineWidth = legW;
      hind(far, false); c.stroke(); fore(far, false); c.stroke();
      circle(c, hk[4] + far + 0.5, hk[5] - 0.2, pawR); c.fill(); circle(c, fk[2] + far + 0.5, fk[3] - 0.2, pawR); c.fill();
      c.strokeStyle = K.fur; c.fillStyle = K.fur;
      if (!P.tf) { c.lineWidth = 2.5; tailPath(); c.stroke(); }
      c.lineWidth = 2 * tw; trunk(); c.stroke();
      circle(c, P.hx, P.hy, rr); c.fill(); circle(c, P.sx, P.sy, cr); c.fill();
      c.lineWidth = 5.6 * H; neck(); c.stroke();
      // pale chest, tabby stripes on the back, the line of the near thigh
      c.strokeStyle = K.belly; c.lineWidth = 2.6;
      c.beginPath(); c.moveTo(P.sx + 2.6, P.sy - 2.4); c.lineTo(P.sx + 2.4, P.sy + 2.6); c.stroke();
      c.strokeStyle = K.dark; c.lineWidth = 1.1;
      c.beginPath();
      for (i = 0; i < 3; i++) {
        var t = 0.22 + i * 0.2, bx = lerp(P.hx, P.sx, t), by = lerp(P.hy, P.sy, t) - tw + 0.6;
        c.moveTo(bx, by); c.lineTo(bx + 0.5, by + 2.6);
      }
      c.stroke();
      ear(false); c.fillStyle = K.fur; c.fill(); earIn(false); c.fillStyle = K.ear; c.fill();
      headPath(); c.fillStyle = K.fur; c.fill(); snout(); c.fill();
      ear(true); c.fill(); earIn(true); c.fillStyle = K.ear; c.fill();
      // the near legs carry their own (thinner) line over the body
      c.strokeStyle = PAL.plum; c.lineWidth = legW + OL * 1.2;
      hind(0, true); c.stroke(); fore(0, true); c.stroke();
      c.strokeStyle = K.fur; c.lineWidth = legW;
      hind(0, true); c.stroke(); fore(0, true); c.stroke();
      c.lineWidth = 2 * legW * 0.7; c.beginPath(); c.moveTo(P.hx, P.hy); c.lineTo(hk[0] - 0.6, hk[1] - 1.2); c.stroke();
      c.fillStyle = PAL.plum;
      circle(c, hk[4] + 0.5, hk[5] - 0.2, pawR + OL * 0.6); c.fill(); circle(c, fk[2] + 0.5, fk[3] - 0.2, pawR + OL * 0.6); c.fill();
      c.fillStyle = K.belly;
      circle(c, hk[4] + 0.5, hk[5] - 0.2, pawR); c.fill(); circle(c, fk[2] + 0.5, fk[3] - 0.2, pawR); c.fill();
      c.strokeStyle = PAL.plum; c.lineWidth = 0.9;
      c.beginPath(); c.arc(P.hx + 0.4, P.hy + 0.2, rr * 0.72, -1.25, 1.2); c.stroke();
      if (P.tf) {
        c.lineWidth = 2.5 + 2 * OL; tailPath(); c.stroke();
        c.strokeStyle = K.fur; c.lineWidth = 2.5; tailPath(); c.stroke();
      }

      // ── 3. the face ──
      var ex = P.nx + (-1 + 3.2 * f) * H, ey = P.ny - 0.3 * H, er = 1.45 * H * E, fx = P.nx + (3 + 1.8 * f) * H;
      c.fillStyle = K.belly;
      c.beginPath(); c.ellipse(P.nx + (1.4 + 3.6 * f) * H, P.ny + 2.7 * H, 2.6 * H, 1.6 * H, 0, 0, 6.2832); c.fill();
      var closed = P.lid > 0.5 || blink, happy = o.happy && !closed;
      c.strokeStyle = PAL.plum; c.fillStyle = PAL.plum; c.lineWidth = 0.9;
      if (closed || happy) {
        c.beginPath();
        c.arc(ex, ey + (happy ? 0.6 : -0.7), er * 0.85, happy ? 3.6 : 0.45, happy ? 5.8 : 2.7);
        if (P.turn > 0.35) { c.moveTo(fx + er * 0.7 * Math.cos(happy ? 3.6 : 0.45), ey + (happy ? 0.4 : -0.9) + er * 0.7 * Math.sin(happy ? 3.6 : 0.45)); c.arc(fx, ey + (happy ? 0.4 : -0.9), er * 0.7, happy ? 3.6 : 0.45, happy ? 5.8 : 2.7); }
        c.stroke();
      } else {
        circle(c, ex, ey, er); c.fill();
        if (P.turn > 0.35) { c.beginPath(); c.ellipse(fx, ey - 0.1, er * (0.5 + 0.4 * P.turn), er * 0.95, 0, 0, 6.2832); c.fill(); }
        c.fillStyle = '#ffffff';
        circle(c, ex + er * 0.3, ey - er * 0.35, er * 0.36); c.fill();
        if (P.turn > 0.35) { circle(c, fx + er * 0.2, ey - er * 0.4, er * 0.28); c.fill(); }
      }
      c.fillStyle = K.nose;
      circle(c, P.nx + (1.7 + 4 * f) * H, P.ny + 1.5 * H, 0.85 * H); c.fill();

      if (o.bundle) {             // the tale, knotted in its little white sheet, swinging from the mouth
        var mx = P.nx + (2.4 + 3.2 * f) * H, my = P.ny + 4.4 * H, br = 2.9;
        c.save();
        c.translate(mx, my); c.rotate(-pitch + o.sw * o.dir + sway * 0.05);
        c.strokeStyle = PAL.plum; c.fillStyle = PAL.plum; c.lineWidth = 2 * OL;
        circle(c, 0, br + 0.6, br); c.stroke();
        c.beginPath(); c.ellipse(-1.3, -0.1, 1.1, 0.7, -0.6, 0, 6.2832); c.ellipse(1.3, -0.1, 1.1, 0.7, 0.6, 0, 6.2832); c.stroke();
        c.fillStyle = PAL.bundle;
        circle(c, 0, br + 0.6, br); c.fill();
        c.beginPath(); c.ellipse(-1.3, -0.1, 1.1, 0.7, -0.6, 0, 6.2832); c.fill();
        c.beginPath(); c.ellipse(1.3, -0.1, 1.1, 0.7, 0.6, 0, 6.2832); c.fill();
        c.fillStyle = PAL.gold; star(c, 0, br + 1, 1.5); c.fill();
        c.restore();
      }
      c.restore();
    }
    function star(c, x, y, r) {
      var i, a;
      c.beginPath();
      for (i = 0; i < 10; i++) { a = -Math.PI / 2 + i * Math.PI / 5; c.lineTo(x + Math.cos(a) * (i % 2 ? r * 0.45 : r), y + Math.sin(a) * (i % 2 ? r * 0.45 : r)); }
      c.closePath();
    }
    function drawZeds(c, x, e, phase) {
      var i, p, s;
      c.strokeStyle = PAL.chalk; c.lineCap = 'round'; c.lineJoin = 'round';
      for (i = 0; i < 3; i++) {
        p = ((clock * 0.28 + phase + i / 3) % 1);
        s = 2 + p * 2.6;
        c.globalAlpha = Math.sin(Math.PI * p) * 0.9;
        c.lineWidth = 1.1;
        c.save(); c.translate(x + 6 + p * 9 + Math.sin(p * 6) * 1.5, G - e - 8 - p * 22);
        c.beginPath(); c.moveTo(-s, -s); c.lineTo(s, -s); c.lineTo(-s, s); c.lineTo(s, s); c.stroke();
        c.restore();
      }
      c.globalAlpha = 1;
    }

    function draw() {
      var camPx = Math.round(cam * k * dpr) / dpr, x0 = cam - 30, x1 = cam + view + 30;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.drawImage(strip, 0, 0, strip.width, strip.height, -camPx, 0, strip.width / dpr, strip.height / dpr);
      ctx.save();
      ctx.translate(-camPx, 0); ctx.scale(k, k);
      world.houses.forEach(function (h, i) {
        var L = lights[i], s = h.spec, wy = G - s.win, g, ch, j, y, pulse;
        if (L < 0.01 || h.x < x0 || h.x > x1) return;
        g = ctx.createRadialGradient(h.x, wy, 2, h.x, wy, 21);
        g.addColorStop(0, 'rgba(255, 227, 110, ' + (0.5 * L) + ')'); g.addColorStop(1, 'rgba(255, 227, 110, 0)');
        ctx.fillStyle = g; circle(ctx, h.x, wy, 21); ctx.fill();
        ctx.globalAlpha = L;
        arch(ctx, h.x, wy, 5.6, 8.8); ctx.fillStyle = PAL.winLit; ctx.fill(); ctx.strokeStyle = PAL.plum; ctx.lineWidth = 1.3; ctx.stroke();
        pulse = Math.sin(clock * 1.3 + i);                       // the candle's crayon halo rings
        ctx.lineWidth = 0.9; ctx.setLineDash([3.2, 2.2]);
        ctx.strokeStyle = PAL.ember; ctx.globalAlpha = 0.6 * L; ctx.lineDashOffset = clock * 2;
        circle(ctx, h.x, wy - 1, 11.4 + pulse * 0.7); ctx.stroke();
        ctx.strokeStyle = PAL.gold; ctx.globalAlpha = 0.45 * L; ctx.lineDashOffset = -clock * 1.6;
        circle(ctx, h.x, wy - 1, 15.4 + pulse); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        ch = chimneyTop(h);
        if (ch) {                                                // chalk smoke: someone is home
          ctx.strokeStyle = PAL.chalk; ctx.globalAlpha = 0.8 * L; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(ch.x, ch.y - 1);
          for (j = 1; j <= 9; j++) { y = ch.y - 1 - j * 2.6; ctx.lineTo(ch.x + Math.sin(j * 1.15 + clock * 1.4 + i) * (0.6 + j * 0.42), y); }
          ctx.stroke(); ctx.globalAlpha = 1;
        }
      });
      world.trees.forEach(function (t, i) {
        if (!t.old || t.x < x0 || t.x > x1) return;
        if (((clock * 0.37 + i * 0.713) % 1) < 0.035) return;          // blink
        var look = clamp((papa.x - t.x) / 120, -1, 1) * 0.5;
        ctx.fillStyle = '#f3efe6';
        circle(ctx, t.x - 1.7 + look, G - 11.8, 1); ctx.fill();
        circle(ctx, t.x + 1.7 + look, G - 11.8, 1); ctx.fill();
      });
      sparks.forEach(function (s) {
        var a = 1 - s.life / s.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = s.kind === 'gold' ? PAL.gold : PAL.leafHi;
        circle(ctx, s.x, G - s.e, s.kind === 'gold' ? 1.1 : 1.4); ctx.fill();
      });
      ctx.globalAlpha = 1;
      var onRoof = !!world.perches[papa.idx].house && !papa.moving;
      kit.bundle = kit.idx >= roofOf(2) && !(world.perches[kit.idx].house && !kit.moving) && kit.idx < world.perches.length - 1;
      papa.bundle = !onRoof;
      [papa, kit].forEach(function (hp) {
        hp.sit = hp.moving ? (hp.t < 0 ? hp.sat || 0 : 0) : smooth((clock - hp.restAt - SIT_AFTER) / 0.6);
        hp.happy = !hp.kit && onRoof && lights[world.houses.indexOf(world.perches[hp.idx].house)] > 0.5;
      });
      if (kit.curl > 0.5) { drawCat(ctx, papa); drawCat(ctx, kit); }   // asleep, the kitten snuggles up in front
      else { drawCat(ctx, kit); drawCat(ctx, papa); }
      if (papa.curl > 0.5 && !reduced()) {
        drawZeds(ctx, papa.x, papa.e + 10, 0);
        if (kit.curl > 0.5) drawZeds(ctx, kit.x - 6, kit.e + 6, 0.45);
      }
      ctx.restore();
    }

    /* ── loop: animation frames only while something moves; then a few seconds of unhurried life
       (tails, blinks, halo rings, chalk smoke); then everything rests until the reader scrolls on ── */
    function frame(now) {
      rafId = 0;
      var dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now; clock += dt;
      var busy = step(dt);
      draw();
      if (busy) rafId = requestAnimationFrame(frame); else armIdle();
    }
    function wake() { aliveUntil = performance.now() + 7000; }
    function kick() {
      if (!world) return;
      wake();
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = 0; }
      if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(frame); }
    }
    function armIdle() {
      if (idleTimer || reduced() || d.hidden || performance.now() > aliveUntil) return;
      idleTimer = setTimeout(function () {
        idleTimer = 0;
        if (rafId || d.hidden) return;
        clock += 0.05; draw(); armIdle();
      }, 50);
    }

    function resize() {
      var cs = getComputedStyle(holder);
      var safe = parseFloat(cs.paddingBottom) || 0;
      var bandPx = holder.clientHeight - safe;
      var w = cv.clientWidth, h = cv.clientHeight, ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (!w || !h || bandPx <= 0) return;
      if (world && w === W && h === H && ratio === dpr) return;     // e.g. a phone's toolbar sliding away: nothing to redo
      W = w; H = h; dpr = ratio;
      k = bandPx / BAND;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      G = (H - safe) / k;
      view = W / k;
      world = build(view);
      renderStrip();
      placed = false;
      kick();
    }

    this.setTarget = function (s, sleep) {
      var t = Math.floor(s + 0.3), sl = sleep > 0.5;
      if (t === target && sl === sleepy) return;
      target = t; sleepy = sl;
      kick();
    };
    this.nudge = function () { if (world) { wake(); if (!rafId) armIdle(); } };
    this.resize = resize;
    this.kick = kick;
    this.state = function () { return { target: target, papa: papa.idx, kitten: kit.show > 0.5 ? kit.idx : -1, asleep: papa.curl > 0.5, lit: lights.map(function (l) { return l > 0.5 ? 1 : 0; }).join(''),
      px: world ? Math.round((papa.x - cam) * k) : null }; };
    resize();
  }

  /* ── 5. A lullaby while you read ─────────────────────────────────────────────
     Off until the reader asks for it. The synthesiser is the game's (js/magic-cats/audio.js,
     loaded only now); the tune and the night sounds follow the section being read. */
  var music = (function () {
    var btn = d.getElementById('mc-music'), AC = window.AudioContext || window.webkitAudioContext;
    if (!btn || !AC) return null;
    // import() is grammar, not an API: hidden inside Function so this file still parses on an old
    // tablet (which then simply gets no lullaby button)
    var dynImport = null;
    try { dynImport = new Function('u', 'return import(u)'); } catch (e) {}
    if (!dynImport) return null;
    var SONGS = {
      hero: ['title', 'night'], candle: ['candle', 'room'], 'summer-tree': ['treetops', 'day'], 'moon-milk': ['moonmilk', 'night'],
      'tree-library': ['library', 'day'], 'lavender-calf': ['noticing', 'dusk'], 'night-garden': ['towers', 'night'], angel: ['garden', 'sky'], end: ['lullaby', 'night']
    };
    var ctx = null, engine = null, loading = null, on = false, timer = 0, key = 'hero', lastNote = 0, pendKey = null, pendTimer = 0, sleepTimer = 0;
    btn.hidden = false;
    function apply() {
      if (!engine || !on) return;
      var s = SONGS[key] || SONGS.hero;
      engine.play(s[0], { intensity: 0.5 });
      engine.ambience(s[1]);
    }
    function stop() {
      on = false; btn.setAttribute('aria-pressed', 'false');
      clearTimeout(sleepTimer); sleepTimer = 0;
      if (!engine) return;
      engine.stopMusic(0.9); engine.ambience('none');
      setTimeout(function () { if (!on && engine) engine.suspend(); }, 1500);
    }
    function wake() {
      // 'suspended' after a mute, 'interrupted' on an iPhone after a call or an alarm: ask either way — and also
      // when it still says 'running' (WebKit/Gecko report a suspend only once it has settled; resuming a running context is harmless)
      if (!ctx || !ctx.resume || ctx.state === 'closed') return;
      try { var p = ctx.resume(); if (p && p.catch) p.catch(function () {}); } catch (e) {}
    }
    function start() {
      on = true; btn.setAttribute('aria-pressed', 'true');
      if (pendKey) { key = pendKey; pendKey = null; clearTimeout(pendTimer); pendTimer = 0; }
      // iOS: without this the ring/silent switch mutes a WebAudio-only page (Safari 17+)
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
      if (!ctx) { try { ctx = new AC(); } catch (e) { ctx = null; } }     // made inside the tap, so the browser lets it sound
      wake();
      if (!loading) {
        loading = dynImport('/js/magic-cats/audio.js').then(function (m) {
          engine = new m.AudioEngine({ ctx: ctx || undefined, enabled: true });
          if (!ctx) engine.unlock();
          return engine;
        });
        loading.catch(function () { on = false; clearTimeout(sleepTimer); btn.setAttribute('aria-pressed', 'false'); btn.hidden = true; });
      }
      // whoever fell asleep listening: after 25 minutes the tune slowly lets go
      clearTimeout(sleepTimer);
      sleepTimer = setTimeout(function () {
        if (!on || !engine) return;
        engine.stopMusic(20); engine.ambience('none'); if (engine.sfx && engine.sfx.goodnight) engine.sfx.goodnight();
        sleepTimer = setTimeout(function () { if (on) stop(); }, 21000);
      }, 25 * 60 * 1000);
      loading.then(function () {
        if (!on) return;
        engine.setEnabled(true); engine.resume(); apply();
        if (!timer) timer = setInterval(function () { if (on && !d.hidden) engine.pump(); }, 60);
      }, function () {});
    }
    btn.addEventListener('click', function () { if (on) stop(); else start(); });
    d.addEventListener('visibilitychange', function () {
      if (!engine) return;
      if (d.hidden) engine.suspend(); else if (on) engine.resume();
    });
    // an interrupted context may only resume inside a gesture: the next touch anywhere asks again
    d.addEventListener('pointerdown', function () { if (on && engine) engine.resume(); }, { passive: true });
    function ready(gap) { var now = Date.now(); if (!on || !engine || now - lastNote < gap) return false; lastNote = now; return true; }
    return {
      section: function (k) {
        // the tune changes only once the reader has rested in the new part for a moment, so a nudge
        // across a boundary or a flick to the end does not restart song after song
        if (k === key) { if (pendTimer) { clearTimeout(pendTimer); pendTimer = 0; } pendKey = null; return; }
        if (k === pendKey) return;
        pendKey = k; clearTimeout(pendTimer);
        pendTimer = setTimeout(function () { pendTimer = 0; key = pendKey; pendKey = null; apply(); }, 1500);
      },
      hop: function (pan, soft) { if (ready(90)) engine.playerNote({ vel: soft ? 0.3 : 0.5, pan: pan }); },
      bell: function (pan) { if (ready(60)) engine.sfx.bell(pan); },
      sparkle: function () { if (ready(60)) engine.sfx.sparkle(); },
      playing: function () { return on; },
      debug: function () { return { on: on, section: key, song: engine ? engine.songName : null, ctx: ctx ? ctx.state : null }; }
    };
  })();

  /* ── 6. Small courtesies ─────────────────────────────────────────────────── */
  (function () {
    // the cover leans a little towards the pointer
    var hero = d.querySelector('.mc-hero'), book = d.querySelector('.mc-book');
    if (hero && book) {
      hero.addEventListener('pointermove', function (e) {
        if (reduced() || (e.pointerType && e.pointerType !== 'mouse')) return;
        var r = book.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / window.innerWidth, dy = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
        book.style.setProperty('--ry', clamp(dx * 24, -9, 9).toFixed(2) + 'deg');
        book.style.setProperty('--rx', clamp(-dy * 18, -7, 7).toFixed(2) + 'deg');
      });
      hero.addEventListener('pointerleave', function () { book.style.setProperty('--ry', '0deg'); book.style.setProperty('--rx', '0deg'); });
    }
    // a touch on a picture sends up a few chalk stars
    $$('.mc-plate, .mc-book').forEach(function (plate) {
      // the angel figure is multiplied into the page, which would multiply the stars away too:
      // its stars fly from the spread instead
      var fig = plate.parentNode, host = (fig && fig.className && String(fig.className).indexOf('mc-figure--angel') >= 0 && fig.parentNode) || plate;
      plate.addEventListener('click', function (e) {
        if (reduced()) return;
        var r = host.getBoundingClientRect(), pop = d.createElement('span'), i, a, far, star;
        pop.className = 'mc-pop';
        pop.style.left = (e.clientX - r.left) + 'px'; pop.style.top = (e.clientY - r.top) + 'px';
        for (i = 0; i < 9; i++) {
          a = (i / 9) * 6.283 + Math.random() * 0.5; far = 30 + Math.random() * 46;
          star = d.createElement('i');
          star.style.setProperty('--dx', (Math.cos(a) * far).toFixed(1) + 'px');
          star.style.setProperty('--dy', (Math.sin(a) * far - 16).toFixed(1) + 'px');
          star.style.setProperty('--s', (0.7 + Math.random() * 0.9).toFixed(2));
          star.style.animationDelay = Math.round(Math.random() * 70) + 'ms';
          pop.appendChild(star);
        }
        host.appendChild(pop);
        setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 1200);
        plate.classList.remove('is-poked'); void plate.offsetWidth; plate.classList.add('is-poked');
        if (music) music.sparkle();
      });
    });
  })();

  /* ── boot ────────────────────────────────────────────────────────────────── */
  applyLang(root.getAttribute('data-lang') || 'en', false);

  var holder = d.querySelector('.mc-round');
  if (holder && holder.querySelector('canvas') && holder.querySelector('canvas').getContext) {
    round = new Round(holder);
    window.__mcBook = { round: round, music: music };
  }

  var resizeTimer = 0;
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { if (round) round.resize(); measure(); }, 120);
  });
  window.addEventListener('load', scheduleMeasure);
  d.addEventListener('visibilitychange', function () { if (!d.hidden && round) round.kick(); });
  if (d.fonts && d.fonts.ready && d.fonts.ready.then) d.fonts.ready.then(scheduleMeasure);
  if ('ResizeObserver' in window) {
    var story = d.querySelector('.mc-story');
    if (story) new ResizeObserver(scheduleMeasure).observe(story);
  }
  if (reduceMq) {
    var onMq = function () { if (round) round.kick(); };
    if (reduceMq.addEventListener) reduceMq.addEventListener('change', onMq); else if (reduceMq.addListener) reduceMq.addListener(onMq);
  }
  /* Printing: the pictures further down are fetched lazily and may not be there yet: ask for all of them
     (beforeprint, and the print media query for Safari before 13, which has no beforeprint) */
  var eager = function () { $$('img[loading="lazy"]').forEach(function (img) { img.loading = 'eager'; }); };
  window.addEventListener('beforeprint', eager);
  var printMq = window.matchMedia ? window.matchMedia('print') : null;
  if (printMq) {
    var onPrint = function (e) { if (e.matches) eager(); };
    if (printMq.addEventListener) printMq.addEventListener('change', onPrint); else if (printMq.addListener) printMq.addListener(onPrint);
  }
  measure();
})();
