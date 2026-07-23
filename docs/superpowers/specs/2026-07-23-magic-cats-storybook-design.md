# Magic Cats Storybook Page — Design

**Date:** 2026-07-23
**Status:** Approved (design sections approved in conversation; Roman delegated remaining reviews — proceeding autonomously, nothing pushed until he approves)

## Overview

A single-page, trilingual (EN / DE / RU) interactive web version of «Волшебные коты, разносящие сказки» — a bedtime story written by Roman Vorushin in 2012, illustrated by Inessa Mechinskaya, and printed in a tiny run of ~10–20 physical copies. The page becomes part of vorushin.github.io at `/books/magic-cats`.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Experience | Calm vertical scroll storybook: illustration + text per section, gentle ambient touches |
| Illustrations | Launch with existing art (6 extracted PNGs + crops from book photos); AI-regenerated/upscaled art can replace files later with no layout changes |
| Translations | Natural retelling register for EN/DE (drafted by Claude, reviewed by Roman) — reads like it was written in each language, keeps all story beats and warm tone |
| Integration | Immersive standalone page, own minimal layout, no site navbar; small `← vorushin.io` link; URL `/books/magic-cats`; not in navbar for now |
| Afterword | "About this book" section with backstory + 2 photos of the printed book |
| Architecture | One page + `_data/magic_cats.yml` holding all three languages; Liquid renders all languages; CSS/JS switcher |

## Page structure

Reading column ~600–640px wide, centered. Order:

1. **Hero** — night-sky background with CSS star field; book title in active language; byline "by Roman Vorushin · illustrated by Inessa Mechinskaya" (localized); language switcher (EN · DE · RU) top-right; `← vorushin.io` link top-left; cover art (`cover.jpg`).
2. **Story sections** (image → text, following the printed book's pairings):
   | # | id | image | text |
   |---|---|---|---|
   | 1 | candle | candle.png (image1) | ¶1 — the city where cats deliver bedtime tales |
   | 2 | summer-tree | summer-tree.png (image2) | ¶2 treetop paths, ¶3 kittens learning the trade |
   | 3 | moon-milk | moon-milk.jpg (crop from back-cover photo) | ¶4 moon milk |
   | 4 | tree-library | tree-library.png (image3) | ¶5 trees, hammocks, tree libraries |
   | 5 | lavender-calf | lavender-calf.png (image4) | ¶6 grown children start dreaming tales |
   | 6 | night-garden | night-garden.png (image5) | ¶7 dream worlds: water towers, cloud dwellers |
   | 7 | angel | angel.png (image6) | ¶8 the world of the magical cats, fairy-tale garden |
3. **End mark** — "✵" divider with a small static cat silhouette.
4. **Afterword** — "About this book": 3–4 sentences (all three languages) on the 2012 origin, the illustrator friend, the tiny print run; two photos: `printed-books.jpg` (DSCF2402) and `printed-spread.jpg` (one open spread on grass).

## Visual design

- **Mood:** dark bedtime page. Deep night-blue base (≈ the cover's blue) with warm off-white text.
- **Section hue shifts:** each section's background gently echoes the printed spread it comes from — night blue → warm yellow-green (summer tree) → night blue (moon milk) → green (tree library) → dusky lavender (calf) → soft white-blue (angel) → night blue (end/afterword). Slow CSS transitions.
- **Typography:** Iowan Old Style BT/Georgia serif for story text (~1.25rem, generous line-height, read-aloud pacing); Space Grotesk for UI (switcher, byline, captions). Text nodes carry proper `lang` attributes; `hyphens: auto` so German wraps well on phones.
- **Images:** column width, soft rounded corners, faint glow on dark sections, `loading="lazy"` below the fold, localized `alt` text.
- **Ambient touches** (all guarded by `prefers-reduced-motion`):
  - Twinkling stars in the hero (pure CSS, a few dozen dots)
  - Sections fade/rise in softly on first scroll into view (IntersectionObserver)
  - No walking-cat animation in v1

## Language switcher

- Three pill buttons EN · DE · RU in the hero; sticky thin translucent bar on scroll.
- Instant client-side switch, no reload, scroll position preserved.
- Active language = `data-lang` attribute on `<html>`; CSS rule `[data-lang="X"] [lang]:not([lang="X"]) { display: none }` hides inactive languages (elements without `lang` are always visible). `<html lang>` also updates for accessibility.
- Priority on load: `?lang=` URL param > localStorage > browser language (`ru*`→RU, `de*`→DE, else EN) > EN.
- Choice persisted to localStorage. Switch also swaps `<title>` and hero title.
- Static default is EN → page fully readable without JS.

## Technical implementation

New files:

- `books/magic-cats.html` — the page. Front matter: `layout: book`, `permalink: /books/magic-cats`, SEO title/description, `image:` → cover art for og:image. Body: Liquid loop over `site.data.magic_cats.sections` rendering every paragraph in all three languages.
- `_layouts/book.html` — minimal standalone layout: charset/viewport, `{% seo %}`, favicons, Space Grotesk from Google Fonts, `css/magic-cats.css`, inline JS (~60 lines, no dependencies).
- `_data/magic_cats.yml` — all content. Schema:
  ```yaml
  meta:
    title: {en, de, ru}        # displayed + <title>
    byline: {en, de, ru}
  sections:
    - id: candle
      image: candle.png
      alt: {en, de, ru}
      paragraphs:
        - {en, de, ru}
  afterword:
    heading: {en, de, ru}
    paragraphs: [...]
    photos:
      - {file: printed-books.jpg, alt: {en, de, ru}}
  ```
- `css/magic-cats.css` — page stylesheet (star field, hue shifts, pills, fade-ins, reduced-motion guards).
- `img/magic-cats/` — processed art: `cover.jpg`, `moon-milk.jpg` (cropped/straightened/color-lifted from photos), `candle.png`, `summer-tree.png`, `tree-library.png`, `lavender-calf.png`, `night-garden.png`, `angel.png` (the 6 PNGs extracted from `book_cats/text_with_inline_pictures.md`), `printed-books.jpg`, `printed-spread.jpg` (downscaled photos).
  **Filenames are the stable contract** — Phase 2 AI-upscaled art replaces files one-by-one, zero layout changes.

Content sources:

- Canonical Russian text: `book_cats/text_russian.md` (the inline-pictures variant has a typo «на площадки»). Title from `text_with_inline_pictures.md`: «Волшебные коты, разносящие сказки».
- Working titles (drafts, reviewed with all translations): EN "The Magical Cats Who Deliver Fairy Tales"; DE "Die Zauberkatzen, die Märchen bringen".

Housekeeping:

- Add `book_cats/` to `.gitignore` (raw sources/photos stay local, not in the public repo) and to Jekyll `exclude` in `_config.yml` (so local builds don't copy it into `_site`).

## Verification

- `bundle exec jekyll build` passes; `/books/magic-cats/` output contains all three languages.
- Local serve + Chrome checks: switcher (all three languages, localStorage persistence, `?lang=de` link override), phone-width portrait and landscape, `prefers-reduced-motion`, no-JS fallback shows EN, og/meta tags present in built HTML.
- Roman reviews EN/DE translations on the rendered page before publishing (nothing is pushed until approved).

## Out of scope (Phase 2+)

- AI-regenerated/upscaled illustrations (drop-in file replacement)
- Walking-cat scroll animation
- Navbar/homepage linking to the page
- Per-language URLs / hreflang SEO
