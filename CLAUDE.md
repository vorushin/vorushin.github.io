# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
bundle install              # Install Ruby dependencies
bundle exec jekyll serve    # Local dev server (http://localhost:4000)
bundle exec jekyll build    # Production build (output: _site/)
```

Requires Ruby 3.3+ and Bundler. CI uses `bundle exec jekyll build --baseurl ""` with `JEKYLL_ENV=production`.

## Architecture

Jekyll 4.3 blog hosted on GitHub Pages. Deploys automatically on push to `master` via `.github/workflows/jekyll.yml`.

### Bilingual Post System

- **English posts** (primary, shown on homepage `/index.html`): use `layout: post-en`, set `lang: en`
- **Russian posts** (legacy archive at `/ru/`): use `layout: post` (default via `_config.yml`)
- Templates filter by `lang` field: `site.posts | where: "lang", "en"`
- Date formats differ: English `%B %d, %Y`, Russian `%d.%m.%Y`
- Use `published: false` in front matter for drafts
- Use `hidden: true` to publish a post accessible via direct link but hidden from the homepage

### Post Front Matter

```yaml
# English post
---
layout: post-en
title: "Post Title"
lang: en
permalink: /blog/slug-here
---

# Russian post (lang/layout from defaults)
---
layout: post
title: "Заголовок"
permalink: /blog/123-slug
---
```

Use `<!--more-->` separator for homepage excerpts.

### Interactive Canvas Visualizations

`_includes/` contains self-contained HTML+JS+CSS canvas visualizations (e.g., `all-gather-ring.html`, `reduce-scatter-ring.html`, `all-to-all-ring.html`, `all-to-all-ring-balanced.html`). Each follows the same pattern:

- IIFE-scoped to avoid conflicts when multiple diagrams appear on one page
- 720x680 logical canvas with DPR=2 for retina
- Element IDs and CSS classes prefixed per diagram (e.g., `allGather`, `reduceScatter`, `allToAllBalanced`)
- Precomputed simulation states, then animated with `requestAnimationFrame`
- Link traffic split into CW/CCW arrays; pills show "A + B" format; headers show CW/CCW breakdown
- Finish stats Y positions must match Hop stats Y positions (both at `CY + 30 * S` and `CY + 50 * S`) to avoid visual jumps
- Play/Pause and Reset controls

Include in posts via `{% include diagram-name.html %}`.

### Styling

`css/main.css` — custom theme with CSS variables, dark mode support (`prefers-color-scheme: dark`), Bootstrap 5.3 for layout. Fonts: Inter (body), Roboto Mono (code). Canvas diagrams use IBM Plex Sans/Mono independently. Diagram containers have `max-width: 600px` set in main.css.
