# Magic Cats Play Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/books/magic-cats/play` — "The Delivery Round": a canvas storybook game where the player helps the magic cat deliver seven tale-bundles; each delivery reveals the next story passage (EN/DE/RU), phone + desktop.

**Architecture:** One Jekyll page on the existing `book` layout (plus an `extra_css` hook); DOM overlay for HUD/cards (trilingual via existing `html[data-lang]` CSS and the layout's switcher JS); a self-contained vanilla-JS IIFE drives a DPR-aware canvas scene with a small state machine (`start → idle → walking → [setpiece] → card → … → finale`). Story text comes from `_data/magic_cats.yml` via Liquid templates — no text in JS or canvas.

**Tech Stack:** Jekyll 4.4/Liquid, vanilla JS (pointer events, WebAudio, canvas 2D), CSS. Puppeteer-core (already in scratchpad) for verification.

## Global Constraints

- URL exactly `/books/magic-cats/play`; back-link to `/books/magic-cats`; book page links here from hero + after end mark.
- Same language system as the book page: `data-lang` on `<html>`, localStorage key `magic-cats-lang`, `[lang]` spans; canvas contains no text.
- localStorage: progress `magic-cats-play-stop` (int delivered stops), sound `magic-cats-play-sound` ("1"/"0", default off).
- `prefers-reduced-motion: reduce`: no twinkle/pulse; hops become short fades; beam/constellation render final state fast; progression fully works.
- rAF pauses while a card/overlay is open (`document.hidden` too); cards animate via CSS only; canvas keeps last frame (frozen set-piece visuals are intentional).
- Works at 390×844 touch and 1280×900 mouse; `touch-action: manipulation` on the stage.
- Nothing pushed until Roman approves. Branch: `magic-cats-play`.
- Commit trailer on every commit: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` + `Claude-Session: https://claude.ai/code/session_01Ta555igjGtpd33W2wjZUv3`.

## Contracts (used across tasks)

- Canvas: `#mcp-canvas` inside `.mcp-stage`; veil `#mcp-veil`; card `#mcp-card`; start overlay `#mcp-start`; progress `#mcp-progress`; sound toggle `#mcp-sound`; card templates `#mcp-tpl-<sectionId>` and `#mcp-tpl-finale` inside a `[hidden]` container.
- Logical world: design height 600; `scale = canvasCssHeight/600`; ground y=520, crown walk y≈350, window center y=290, sill y=302. Moon is screen-anchored at (110,110) logical, radius 46.
- Stops: 7 houses, `houseX = 900 + i*620`; 2–3 trees between consecutive stops; cat starts on a tree at x=300.
- Debug/test hook (read-only): `window.__mcp = { state(), stop(), beaconXY(), moonXY(), advance(), dismissCard(), moonTap() }` — the XY getters return **CSS-pixel canvas coordinates** for real event dispatch in tests; the imperative functions exist for reduced-flakiness fallback.
- States: `'start' | 'idle' | 'walking' | 'moonGate' | 'drinking' | 'delivering' | 'card' | 'joining' | 'finale'`.

---

### Task 1: Static shell — layout hook, CSS, page skeleton, book-page buttons

**Files:**
- Modify: `_layouts/book.html` (head: extra_css hook)
- Create: `css/magic-cats-play.css`
- Create: `books/magic-cats-play.html` (no game script yet — script tag placeholder comment)
- Modify: `books/magic-cats.html` (two play buttons)

**Interfaces:**
- Produces: all DOM ids/classes from Contracts; trilingual UI strings; Liquid-rendered card templates. Task 2+ inserts `<script>` where the placeholder comment sits.

- [ ] **Step 1: Add hook to `_layouts/book.html`** — after the magic-cats.css link:

```html
  <link rel="stylesheet" href="/css/magic-cats.css">
  {% if page.extra_css %}<link rel="stylesheet" href="{{ page.extra_css }}">{% endif %}
```

- [ ] **Step 2: Create `css/magic-cats-play.css`:**

```css
/* Magic cats play page — The Delivery Round */
html, body { height: 100%; }
body.mcp-body { overflow: hidden; overscroll-behavior: none; }

.mcp-stage {
  position: fixed;
  inset: 0;
  touch-action: manipulation;
  background: linear-gradient(180deg, #131a38 0%, #1b2447 100%);
}
#mcp-canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }

.mcp-veil {
  position: absolute; inset: 0;
  background: linear-gradient(180deg, rgba(141, 122, 165, 0.55), rgba(141, 122, 165, 0.15));
  opacity: 0; transition: opacity 1.2s ease; pointer-events: none;
}
.mcp-veil.mcp-on { opacity: 1; }

/* Top bar: reuse .mc-topbar/.mc-home/.mc-langs from magic-cats.css */
.mcp-progress { display: flex; gap: 0.3rem; align-items: center; }
.mcp-progress span {
  width: 10px; height: 10px; border-radius: 3px;
  background: rgba(243, 239, 230, 0.28); display: inline-block;
  transition: background-color 0.4s ease, box-shadow 0.4s ease;
}
.mcp-progress span.mcp-done {
  background: #ffd76e; box-shadow: 0 0 6px rgba(255, 215, 110, 0.8);
}

.mcp-sound {
  font-size: 0.95rem; line-height: 1;
  background: transparent; border: 1px solid rgba(243, 239, 230, 0.4);
  border-radius: 999px; padding: 0.25rem 0.55rem; cursor: pointer; color: #f3efe6;
}
.mcp-sound:focus-visible { outline: 2px solid #ffd76e; outline-offset: 2px; }

/* Story card */
.mcp-card {
  position: absolute; left: 50%; bottom: 0; transform: translate(-50%, 8%);
  width: min(40rem, calc(100% - 1.5rem));
  max-height: 60vh; overflow-y: auto;
  background: rgba(19, 26, 56, 0.94);
  border: 1px solid rgba(243, 239, 230, 0.18);
  border-radius: 14px 14px 0 0;
  padding: 1.1rem 1.3rem 0.9rem;
  color: #f3efe6;
  font-family: 'Iowan Old Style BT', 'Iowan Old Style', Georgia, serif;
  opacity: 0; transition: opacity 0.45s ease, transform 0.45s ease;
  z-index: 5;
}
.mcp-card.mcp-in { opacity: 1; transform: translate(-50%, 0); }
.mcp-card p { font-size: clamp(1rem, 2.4vw, 1.15rem); line-height: 1.65; margin: 0 0 1rem; hyphens: auto; -webkit-hyphens: auto; }
.mcp-card .mcp-next {
  display: block; margin: 0.2rem auto 0.1rem;
  font-size: 1.3rem; color: #ffd76e; background: transparent;
  border: 1px solid rgba(255, 215, 110, 0.5); border-radius: 999px;
  padding: 0.3rem 1.4rem; cursor: pointer;
}
.mcp-card .mcp-next:focus-visible { outline: 2px solid #ffd76e; outline-offset: 2px; }
@media (max-height: 480px) { .mcp-card { max-height: 50vh; } }

/* Start / finale overlay */
.mcp-overlay {
  position: absolute; inset: 0; z-index: 6;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 1.5rem;
  background: rgba(19, 26, 56, 0.82);
  color: #f3efe6;
  font-family: 'Iowan Old Style BT', 'Iowan Old Style', Georgia, serif;
  opacity: 1; transition: opacity 0.5s ease;
}
.mcp-overlay[hidden] { display: none; }
.mcp-overlay h1 { font-size: clamp(1.5rem, 5vw, 2.3rem); line-height: 1.25; margin: 0 0 0.6rem; max-width: 22ch; }
.mcp-overlay p { font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem; color: #c9c4b4; max-width: 34ch; margin: 0 0 1.4rem; }
.mcp-overlay .mcp-btn {
  font-family: 'Space Grotesk', sans-serif; font-size: 1rem; font-weight: 500;
  color: #131a38; background: #ffd76e; border: none; border-radius: 999px;
  padding: 0.6rem 1.8rem; margin: 0.25rem; cursor: pointer;
}
.mcp-overlay .mcp-btn.mcp-ghost { background: transparent; color: #f3efe6; border: 1px solid rgba(243, 239, 230, 0.5); }
.mcp-overlay .mcp-btn:focus-visible { outline: 2px solid #ffd76e; outline-offset: 2px; }

.mcp-hint {
  position: absolute; top: 4.2rem; left: 50%; transform: translateX(-50%);
  font-family: 'Space Grotesk', sans-serif; font-size: 0.9rem; color: #ffd76e;
  background: rgba(19, 26, 56, 0.8); border-radius: 999px; padding: 0.35rem 1rem;
  z-index: 4; opacity: 0; transition: opacity 0.4s ease; pointer-events: none;
}
.mcp-hint.mcp-on { opacity: 1; }

@media (prefers-reduced-motion: reduce) {
  .mcp-card, .mcp-overlay, .mcp-veil, .mcp-progress span { transition: none; }
}
```

- [ ] **Step 3: Create `books/magic-cats-play.html`** (script placeholder at end):

```html
---
layout: book
title: "Play: Волшебные коты, разносящие сказки — an interactive bedtime story"
description: "Help the magic cat deliver seven fairy tales through the night city — a gentle interactive version of the trilingual bedtime story, for phones and computers."
permalink: /books/magic-cats/play
extra_css: /css/magic-cats-play.css
image: /img/magic-cats/cover.jpg
---
{% assign book = site.data.magic_cats %}
<div class="mcp-stage" id="mcp-stage">
  <canvas id="mcp-canvas"></canvas>
  <div class="mcp-veil" id="mcp-veil" aria-hidden="true"></div>

  <nav class="mc-topbar">
    <a class="mc-home" href="/books/magic-cats">← <span lang="en">book</span><span lang="de">Buch</span><span lang="ru">книжка</span></a>
    <div class="mcp-progress" id="mcp-progress" aria-hidden="true"></div>
    <div class="mc-langs" role="group" aria-label="Language / Sprache / Язык">
      <button type="button" data-set-lang="en" aria-pressed="true" aria-label="English">EN</button>
      <button type="button" data-set-lang="de" aria-pressed="false" aria-label="Deutsch">DE</button>
      <button type="button" data-set-lang="ru" aria-pressed="false" aria-label="Русский">RU</button>
    </div>
    <button type="button" class="mcp-sound" id="mcp-sound" aria-pressed="false" title="Sound">🔕</button>
  </nav>

  <div class="mcp-hint" id="mcp-hint" role="status">
    <span lang="en">Tap the moon!</span><span lang="de">Tippe auf den Mond!</span><span lang="ru">Нажми на луну!</span>
  </div>

  <div class="mcp-card" id="mcp-card" hidden aria-live="polite"></div>

  <div class="mcp-overlay" id="mcp-start">
    <h1>{% for l in book.langs %}<span lang="{{ l }}">{{ book.meta.title[l] }}</span>{% endfor %}</h1>
    <p>
      <span lang="en">Tap the glowing star and help the cat deliver the tales.</span>
      <span lang="de">Tippe auf den leuchtenden Stern und hilf der Katze, die Märchen auszutragen.</span>
      <span lang="ru">Нажимай на светящуюся звёздочку и помоги коту разнести сказки.</span>
    </p>
    <div>
      <button type="button" class="mcp-btn" id="mcp-begin">
        <span lang="en">Begin</span><span lang="de">Los geht's</span><span lang="ru">Начать</span>
      </button>
      <button type="button" class="mcp-btn mcp-ghost" id="mcp-continue" hidden>
        <span lang="en">Continue</span><span lang="de">Weiter</span><span lang="ru">Продолжить</span>
      </button>
    </div>
    <noscript><p><a href="/books/magic-cats" style="color:#ffd76e">JavaScript is off — read the book instead / Lies das Buch / Читать книжку</a></p></noscript>
  </div>

  <div hidden>
    {% for section in book.sections %}
    <div class="mcp-tpl" id="mcp-tpl-{{ section.id }}">
      {% for p in section.paragraphs %}{% for l in book.langs %}<p lang="{{ l }}">{{ p[l] }}</p>{% endfor %}{% endfor %}
    </div>
    {% endfor %}
    <div class="mcp-tpl" id="mcp-tpl-finale">
      <p><span lang="en">All the tales are delivered. Good night!</span><span lang="de">Alle Märchen sind ausgetragen. Gute Nacht!</span><span lang="ru">Все сказки разнесены. Спокойной ночи!</span></p>
    </div>
  </div>
</div>
<!-- GAME_SCRIPT -->
```

- [ ] **Step 4: Add play buttons to `books/magic-cats.html`.** In the hero after `.mc-byline`:

```html
  <p class="mc-play-link"><a href="/books/magic-cats/play">✨ <span lang="en">Play the story</span><span lang="de">Spiel die Geschichte</span><span lang="ru">Сыграть в сказку</span></a></p>
```

and the same `<p class="mc-play-link">…</p>` line right after the `.mc-end` div. Add to `css/magic-cats.css`:

```css
/* ── Play link ── */
.mc-play-link { position: relative; text-align: center; font-family: var(--sans); margin: 0 0 2rem; }
.mc-play-link a {
  display: inline-block; color: #ffd76e; text-decoration: none;
  border: 1px solid rgba(255, 215, 110, 0.5); border-radius: 999px;
  padding: 0.45rem 1.3rem; font-size: 0.95rem;
}
.mc-play-link a:hover, .mc-play-link a:focus-visible { background: rgba(255, 215, 110, 0.12); }
body[data-scene="day-yellow"] .mc-play-link a, body[data-scene="day-green"] .mc-play-link a { color: inherit; border-color: currentColor; }
```

(hero one sits before `.mc-cover`; end one after `.mc-end`, margin handled by the class).

- [ ] **Step 5: Build + verify shell**

Run: `bundle exec jekyll build && f=_site/books/magic-cats/play/index.html; ls -la _site/books/magic-cats/ ; grep -c 'mcp-tpl-' $f; grep -c 'magic-cats-play.css' $f; grep -c 'mc-play-link' _site/books/magic-cats.html`
Expected: play output exists (as `play/index.html` or `play.html` — use whichever exists), 8 templates (7 sections + finale), 1 css link, 2 play links.

- [ ] **Step 6: Commit** `git add -A && git commit -m "Add static shell for magic cats play page"`

---

### Task 2: World + renderer — the living night city (no game logic yet)

**Files:**
- Modify: `books/magic-cats-play.html` (replace `<!-- GAME_SCRIPT -->` with `<script>` IIFE part 1)

**Interfaces:**
- Produces (inside IIFE): `PAL` palette; `rng(seed)` (mulberry32); `WORLD = buildWorld()` with `stops[i] = {id, houseX, variant, trees:[{x,crownY,r,eye}], sillX, sillY}` and `WORLD.trees` (flat, incl. lead-in trees), `WORLD.width`; `cam = {x}`; `sizeCanvas()`, `worldToScreen(wx,wy)`, `screenToWorld(sx,sy)`; draw fns `drawFrame(t)` composing `drawStars/drawMoon/drawGround/drawTree/drawHouse/drawWindowGlow/drawCat(c)/drawBundle/drawBeacon` etc.; `cat`, `kitten` objects `{x, y, dir, phase, visible}`; `REDUCED` flag; rAF loop with `running` flag + `document.hidden` pause.
- On load (temporary until Task 3): scene renders with cat on start tree, beacon over first house, loop running.

Key implementation notes (write real code following these):
- Seeded wobble: every tree/house gets jitter from `rng(i*7+13)` at build time; no randomness during draw.
- Houses: variant 0 = tall pink `#e8b7d5` w/ white gable trim, 1 = blue `#7f9bd0` white-snow gable, 2 = brick `#8a4a3a`; dark plum outline `#2a2136` width 3; arched dark windows `#4a2340`; the STOP window at `(sillX, 290)` drawn lit `#ffe27a` with warm glow when delivered/target.
- Trees: trunk `#7a5a33`, crown circles `#3f7d3a`/`#5ba04f`, eye-knot (dark circle + two white dots) on trees where `eye` true (~every 4th).
- Cat: `#3a2b45` body, white bundle circle when carrying; tail = quadratic curve swaying with `sin(t*3+phase)`; hop handled in Task 3 (here standing pose).
- Stars: ~70 seeded points, alpha `0.4+0.6*sin(t*ω+φ)` unless REDUCED (static 0.7).
- Moon: screen-anchored (110,110,r46) pale `#f4ecc2` + halo; craters two darker dots.
- Beacon: 5-point star path at target, pulse `1+0.15*sin(t*4)` (static if REDUCED), color `#ffd76e`, glow shadowBlur 18.
- Parallax: stars ×0.15, moon ×0 (fixed), world ×1.

- [ ] **Step 1: Write the script** (structure):

```js
(function () {
  'use strict';
  var canvas = document.getElementById('mcp-canvas');
  var ctx = canvas.getContext('2d');
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var PAL = { skyTop:'#131a38', skyBot:'#1b2447', outline:'#2a2136', pink:'#e8b7d5',
    blue:'#7f9bd0', brick:'#8a4a3a', gable:'#eef2f7', winDark:'#4a2340', winLit:'#ffe27a',
    trunk:'#7a5a33', crownA:'#3f7d3a', crownB:'#5ba04f', grass:'#233b2c', grassDab:'#2f5040',
    cat:'#3a2b45', kitten:'#8a8496', bundle:'#f6f2e8', moon:'#f4ecc2', star:'#fff6d8',
    beacon:'#ffd76e', saucer:'#eef2f7', beam:'rgba(244,236,194,0.35)' };
  function rng(seed){ return function(){ seed|=0; seed=(seed+0x6D2B79F5)|0;
    var t=Math.imul(seed^(seed>>>15),1|seed); t=(t+Math.imul(t^(t>>>7),61|t))^t;
    return ((t^(t>>>14))>>>0)/4294967296; }; }
  // … buildWorld(), sizeCanvas(), worldToScreen(), draw fns, loop …
})();
```

(Complete drawing code is authored in this step directly in the file; iterate visually via screenshots — take `Bash` + puppeteer screenshot after implementing, adjust shapes until the scene reads as the book's naive style. Load the **frontend-design skill** before this step's art pass.)

- [ ] **Step 2: Screenshot check** — puppeteer: goto page, click `#mcp-begin`… not wired yet, so for this task temporarily auto-hide overlay via `?debugscene=1` query handling (`if (location.search.indexOf('debugscene')>-1) document.getElementById('mcp-start').hidden = true;`). Screenshot 1280×900 and 390×844; verify: gradient sky, moon top-left, stars, ≥3 house variants visible when panning `cam.x`, cat visible on tree, beacon pulsing.

- [ ] **Step 3: Commit** `git add books/magic-cats-play.html && git commit -m "Render the night city scene for play page"`

---

### Task 3: Game loop — state machine, input, cards, progress, persistence

**Files:**
- Modify: `books/magic-cats-play.html` (extend IIFE)

**Interfaces:**
- Produces: `state` var + `setState(s)`; `advance()` builds hop path & walks; `openCard(id)`/`dismissCard()`; `beaconTarget()` → `{wx,wy}` (next crown/sill); progress dots render; localStorage progress; overlay Start/Continue wiring; keyboard + pointer input per Contracts; `window.__mcp` debug hook.
- Playable end-to-end WITHOUT set pieces: 7 stops, cards from templates, finale card with Replay + book link (finale uses `#mcp-tpl-finale` + two buttons injected).

Implementation notes:
- Hop path: from cat.x to stop house: hops crown→crown→sill; each hop = `{x0,y0,x1,y1,t0,dur}`; position = lerp + arc `-h*sin(π·p)` (h=42); REDUCED: dur 150ms, no arc (fade via globalAlpha dip).
- `walking` finishes → `delivering` (600ms bundle floats from mouth to window, window lights) → `openCard(stop.id)`; card node = clone of template + appended `<button class="mcp-next" aria-label…>✵</button>`; card dismiss → stop counter++, saved, dots update, next beacon; stop index 2 → `joining` (kitten runs in from left edge to behind cat, 900ms) then idle; after stop 7 → finale: cat (+kitten) hop to roof ridge of last house, curl (two circles + tail wrap), then finale card (template + Replay `#mcp-again` + link `<a class="mcp-btn" href="/books/magic-cats">`). Replay: clear storage, reset to stop 0, cat back to start, overlay hidden, idle.
- Input rules: overlay open → only its buttons. card open → `.mcp-next`, backdrop tap (pointerdown on stage while card open), Space/Enter/→ all dismiss. `moonGate` (Task 4) → moon tap or Enter. idle → tap beacon or any point with `wx > cat.x - 40`, or →/Space/Enter.
- Continue button shows when saved stop ∈ [1,6]; also "start over" ghost btn (`#mcp-begin` doubles as start-over when continue shown — set its label spans to Start-over variant… simpler: keep both buttons, `#mcp-begin` always restarts from 0).
- `aria-live` card announces text (already `aria-live="polite"` on container).

- [ ] **Step 1: Implement** (following notes; full code in file).
- [ ] **Step 2: Puppeteer drive-through** — script clicks Begin, then loops: reads `window.__mcp.state()`; when `idle` dispatches real `pointerdown` at `beaconXY()`; when `card` clicks `.mcp-next`; asserts stops reach 7 and finale card contains "Good night" (EN); asserts `localStorage['magic-cats-play-stop']` increments; zero console errors. (Moon gate not yet present.)
- [ ] **Step 3: Commit** `git commit -am "Playable delivery round: state machine, cards, progress"`

---

### Task 4: Set pieces, audio, finale polish, reduced motion

**Files:**
- Modify: `books/magic-cats-play.html`

**Interfaces / notes:**
- Candle: house 1 window shows candle (small rect + flame flicker `sin(t*9)` scale; REDUCED: static flame).
- Kitten join (already Task 3 anim): from stop 3 onward kitten replays cat's hop segments delayed 420ms, carries tiny bundle from stop 4+.
- Moon gate at stop 3: after `walking` → place saucer on sill, `setState('moonGate')`, show `#mcp-hint.mcp-on`; moon tap (screen hit `dist<r+14`) → hide hint → beam animation 900ms (trapezoid from moon screen pos to saucer world pos) fills saucer arc → `drinking`: kitten first (900ms, head-bob), then cat (900ms) → `delivering` → card. Enter key triggers moonTap for a11y. REDUCED: beam+fill instant (200ms), drinking 400ms total.
- Tree-library: trees flanking stop 4 get 1 hanging bag each (yellow + red rounded rect on a strap under a branch); a red bird sits on stop-4 tree crown from stop-3 completion; tap (world hit r 26) → hop + chirp (audio) — available, never required.
- Dream veil + bubble at stop 5: on `delivering` start, `#mcp-veil` gets `.mcp-on`; bubble (three white circles + tiny white calf: rounded body, head, two ear dots, lavender field arc) drawn above roof during delivering so it stays frozen behind the open card; veil removed on card dismiss.
- Constellation after card 6 dismiss: over the next 6s (or instantly if REDUCED) draw chalk polyline fish + spiral cloud (stroke `rgba(255,255,255,0.35)`, lineWidth 2, dashed reveal by path-length progress), anchored in sky screen-space right of moon; chime when complete (if sound on).
- Feather at stop 7: during delivering, a pale feather (two arcs) falls past the window with sway.
- Audio object: `ensureCtx()` on first gesture; `bell()` triangle 880→660 Hz 0.35s; `purr()` two low sines 110/130 Hz amp-mod 0.5s; `chirp()` 1400→1800 Hz 90ms; `chime()` 660/990 Hz pair. Toggle `#mcp-sound` flips `🔕/🔔`, aria-pressed, persists `magic-cats-play-sound`; default off.
- Finale scene: sky slowly deepens (lerp sky colors by 10%), stars brighten; cats curled on roof with breathing scale `1+0.02 sin(t)`.

- [ ] **Step 1: Implement all set pieces + audio.**
- [ ] **Step 2: Extend puppeteer drive-through**: at stop 3 assert `state==='moonGate'`, dispatch pointerdown at `moonXY()`, assert progresses; enable sound toggle → assert `aria-pressed` + localStorage; full round to finale; screenshots at every stop (desktop + 390×844) — visually review each against the naive style; reduced-motion pass (`page.emulateMediaFeatures`) completes a full round.
- [ ] **Step 3: Commit** `git commit -am "Set pieces, audio and finale for play page"`

---

### Task 5: Final verification, polish pass, merge

**Files:**
- Possibly modify: all task files (fixes only)

- [ ] **Step 1: Language mid-game test** — puppeteer: play to stop 2 card, click DE pill → assert visible card text is German ("Zauberkatzen" present in visible paragraphs), HUD spans switch; reload → Continue offered, language persists (shared `magic-cats-lang`).
- [ ] **Step 2: Perf sanity** — dev run logs average `drawFrame` ms over 300 frames (temporary `?debugperf=1` console.log); expect < 8ms desktop headless; remove nothing (log stays behind query flag).
- [ ] **Step 3: Full build checks** — `bundle exec jekyll build`; play page + updated book page in `_site`; grep: 2 play links on book page; play page has 8 templates, no `Mechinskaya`-era strings (name = Inese Mecinska via shared YAML — automatic).
- [ ] **Step 4: Visual review** — final screenshot set (start overlay, mid-walk, moon gate with beam, card open EN/RU, constellation, finale) sent to Roman.
- [ ] **Step 5: Merge** — `git checkout master && git merge --no-ff magic-cats-play`, final build on master. No push (Roman's call).

## Self-Review Notes

- Spec coverage: loop ✓ (T3), 7 set pieces ✓ (T4: candle/kitten/moon/bird+bags/veil+bubble/constellation/feather), finale ✓, onboarding + Continue ✓ (T3), HUD/progress/sound ✓ (T1/T4), shared language system ✓ (T1 via layout), reduced motion ✓ (T2–T4), no-JS noscript ✓ (T1), links both ways ✓ (T1), puppeteer verification incl. phone viewport + mid-game language switch ✓ (T3–T5).
- The rAF-pause-during-card + frozen-frame trick is used intentionally for the stop-5 bubble (documented in T4).
- Naming consistency: states and ids in Contracts are the single source; tasks reference them verbatim.
