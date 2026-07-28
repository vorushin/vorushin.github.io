# Magic Cats Interactive Play Page — Design

**Date:** 2026-07-28
**Status:** Approved (Roman delegated design decisions — autonomous mode; nothing pushed until he approves)

## Overview

A separate interactive version of «Волшебные коты, разносящие сказки» at `/books/magic-cats/play`, linked from the existing book page. Concept: **The Delivery Round** — the player helps the magic cat deliver seven tale-bundles through a night city; each delivery reveals the next passage of the story in the active language (EN/DE/RU). Works with touch (phones) and mouse/keyboard (computers).

## Approaches considered

| Approach | Verdict |
|---|---|
| **A. Guided delivery-round game** — one continuous scrolling scene; story unlocks per stop | **Chosen**: mechanic comes from the story itself; single input; progression without failure; one coherent artifact |
| B. Touchable diorama spreads with prev/next | Safer but static-feeling; no progression pull |
| C. Mini-game collection (catch moon drops, memory) | Fragmented, bolted-on, more scope for less magic |

## Experience

### Core loop
1. A pulsing star-beacon marks the next stop (tree path → lit house window).
2. Player taps the beacon / taps anywhere ahead of the cat / presses `→` or `Space` (desktop) → cat hops tree-crown to tree-crown, white bundle in teeth; camera follows.
3. At the house: delivery animation (bundle floats to window → window glows warm, child silhouette settles).
4. Story card slides up from the bottom: the section's paragraphs in the active language (DOM text, scrollable if tall, max-height ≈ 60vh). Card has a "continue" affordance (✵ button + tap outside).
5. Dismiss → next beacon. Seven stops = the seven sections of `_data/magic_cats.yml`.

### Story-true set pieces
| Stop (section id) | Set piece |
|---|---|
| 1 candle | Candle flame flickers in the destination window |
| 2 summer-tree | After the card: a **kitten joins** and follows the cat with delayed, clumsy hops (kittens learn the trade) |
| 3 moon-milk | **Interactive gate**: card waits until player taps the moon → moonbeam pours → saucer on the sill fills → kitten drinks first, then the cat (story-accurate) → card appears |
| 4 tree-library | Book-bags hang from nearby trees; a red bird flutters down; tapping the bird makes it hop + chirp (optional delight, not required) |
| 5 lavender-calf | Sky tints dusk-lavender while the card is open (CSS veil over the canvas, since the rAF loop pauses during cards); dream bubble above the roof with a tiny white calf |
| 6 night-garden | A chalk-style constellation (fish + cloud swirl, echoing illustration 5) draws itself in the sky |
| 7 angel | A pale feather falls past the window |
| Finale | Cat + kitten curl up on the last rooftop; ✵ The End card: replay button + "Read the book" link back to `/books/magic-cats` |

### Onboarding
Start overlay on load: title in active language, one instruction line ("Tap the glowing star and help the cat deliver the tales" — localized), a large Start button. After Start, the first beacon pulses. If saved progress exists (localStorage `magic-cats-play-stop`), overlay offers Continue and Start over.

## UI / chrome

- Top bar (fixed, translucent, same styling family as the book page): `← book` link (to `/books/magic-cats`), EN·DE·RU pills (same behavior and **same localStorage key `magic-cats-lang`** as the book page — the preference is shared), sound toggle (default **off**, persisted as `magic-cats-play-sound`).
- Progress: seven tiny bundle icons in the top bar; delivered ones turn into small glowing windows.
- Language switch works at any moment: story cards, overlays, and HUD labels are DOM nodes carrying `lang` attributes; the existing `html[data-lang] [lang]:not([lang=…])` CSS from `css/magic-cats.css` does the showing/hiding. Canvas contains no text.

## Audio (optional, tiny)

WebAudio-synthesized (no asset files): soft bell on delivery, two-note purr while cats drink, faint chime when the constellation completes. Context created/resumed only on user gesture; entirely gated behind the sound toggle (default off — bedtime context).

## Art direction

Programmatic naive style matching the printed book (frontend-design skill to be loaded at implementation for the detailed pass):

- Night sky vertical gradient `#131a38 → #1b2447` (the book page's palette), soft star field, big pale-yellow moon with glow halo.
- Houses in the book's shapes: tall pink house with arched dark windows, blue house with white gable, small brick-red house (from the moon-milk art). Wobbly hand-drawn outlines (slight vertex jitter, dark plum stroke `#2a2136`), one warm yellow lit window per stop.
- Trees: brown trunks + blobby 3–4-circle crowns in two greens; a few trunks carry the cover's dark "eye-knot".
- Cat: dark-plum silhouette (body ellipse, round head, triangle ears, sine-animated tail), white bundle dot at the mouth; hop = squash-stretch arc between crowns. Kitten = 0.6-scale, lighter grey, hops with ~400 ms delay.
- Ground: dark grass strip with paint-dab texture dots (echoes the gouache grass in the art).

## Technical design

### Files
- `books/magic-cats-play.html` — the page. Front matter: `layout: book`, `permalink: /books/magic-cats/play`, `extra_css: /css/magic-cats-play.css`, SEO title/description, `image: /img/magic-cats/cover.jpg`. Body: HUD + overlay + canvas + seven hidden trilingual card templates rendered by Liquid from `site.data.magic_cats.sections` (+ finale card), and the game `<script>` (self-contained IIFE, vanilla JS — repo culture).
- `_layouts/book.html` — add optional `{% if page.extra_css %}<link rel="stylesheet" href="{{ page.extra_css }}">{% endif %}` in `<head>`.
- `css/magic-cats-play.css` — page styles: canvas layout, HUD, cards, overlays, reduced-motion guards.
- `books/magic-cats.html` — add "✨ Play the story" button (localized `lang` spans) in the hero under the byline and a second one after the end mark.

### Runtime structure (inside the IIFE)
- `WORLD` — declarative stop list built at load: x-positions of trees/houses per stop (generated with a seeded layout function, no `Math.random` at render time so the world is stable), house variants, set-piece flags.
- `SceneRenderer` — pure draw functions `drawSky/drawMoon/drawTrees/drawHouse/drawCat/...` over a camera transform; DPR-aware resize (clamp 2).
- `Game` — state machine: `idle → walking → arriving → setpiece? → card → idle … → finale`; advances on input events; owns progress persistence.
- `Input` — pointer events on canvas (tap targets: beacon/ahead, moon, bird), keyboard (`ArrowRight`/`Space`/`Enter`), `touch-action: manipulation` to kill double-tap zoom.
- `Audio` — lazy singleton behind the toggle.
- rAF loop pauses when `document.hidden` or when a card/overlay is open (cards animate via CSS only).

### Data flow
Liquid → hidden DOM templates (`<template>`-like divs `#mc-card-<id>`) containing all three languages → `Game` clones the active card into the overlay on arrival. No story text in JS.

### Failure modes
- No JS → page shows a static poster frame (CSS) with a "Read the book" link (`<noscript>` note). The static book page is the canonical no-JS experience.
- `prefers-reduced-motion: reduce` → no twinkle/parallax/hop arcs (position snaps + fades), set pieces render final states instantly; progression fully works.
- Small landscape phones (~390px height): HUD compresses, card max-height 50vh.

## Verification

- `bundle exec jekyll build`; built page contains all 7 cards × 3 languages; book page contains 2 play links.
- Puppeteer (installed in scratchpad): script plays the whole round — Start → 7 stops (including moon tap-gate) → finale; asserts card text matches active language, switches language mid-game, checks localStorage keys, zero console errors; runs at 390×844 (touch) and 1280×900; reduced-motion pass; screenshots at each stop reviewed visually.
- Performance sanity: rAF frame time logged in dev run; target < 8 ms/frame on desktop headless.

## Out of scope

- Sound design beyond the three synth cues; music.
- Multiplayer/scores/achievements — deliberately no failure states.
- Per-language URLs for the play page.
- Replacing canvas art with AI-generated sprites (Phase 2 of the main page may revisit).
