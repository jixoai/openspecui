# OpenSpecUI Website Implementation Notes

Private static site for `www.openspecui.com` (`@openspecui/website`,
SvelteKit + adapter-static, Cloudflare Pages).

## Registry adoption (2026-09-06) — @jixoai / jixoai-ui 0.3.0

The site takes its identity from the official jixoai registry
(<https://ui.jixoai.com>) instead of borrowing `packages/web/src/index.css`
(OpenSpec Change `2026-09-06-website-jixoai-registry-adoption`).

### Install inventory (`jixoai-ui.lock`, 22 items)

Primary (explicit `add`): `jixoai-theme` (via `init --hue 27`),
`website-scaffold`, `terminal-header`, `terminal-footer`, `theme-toggle`,
`press-button`, `section-card`, `terminal-card`, `card-grid`,
`hero-section`, `scrollbar-measure`, `llms-txt`.

Dependency closure (installed by shadcn's resolution, locked via
`jixoai-ui adopt` — the purpose-built baseline command; piping `y` into
shadcn's overwrite prompt is the fragile alternative):
`utils` (+ npm `clsx`, `tailwind-merge`), `icons`, `defaults`, `density`,
`paint`, `context-plugin`, `separator`, `figure`, `navigation-menu`,
`popover` (ships `lib/surface-motion.ts`). `jixoai-theme` also installs
`@fontsource-variable/jetbrains-mono` + `@fontsource/share-tech-mono`.

**Exclusions**: `toc-engine` — nothing in this site's dependency tree
consumes it (no ToC surface; the hooks page is a two-card layout). It was
listed in the task as "as actually present"; it is not present.

**Installed but not yet composed into pages**: `website-scaffold`,
`hero-section`, `terminal-card`, `card-grid` are locked for convergence
and future use; the landing site keeps its document-flow layout and its
project-owned `home/*` components (per the adoption decision map —
`home/hero-section.svelte` and `home/terminal-card.svelte` are the
site-local originals the registry items were derived FROM).

### Layout of installed files (shadcn `@`-target quirk)

shadcn 3.8 ignores the registry items' alias-relative `target` field and
writes `@lib/…`/`@ui/…` as LITERAL directories under `src/`. Every add was
followed by relocating `src/@lib/* → src/lib/` and `src/@ui/* →
src/lib/ui/` to match the paths `jixoai-ui.lock` and `jixoai-ui
hue/upgrade` compute from `components.json` aliases. The `llms-txt` item
lands at `src/vite-plugins/` for the same reason and was moved to
`vite-plugins/llms-txt.mjs` (project root) to match its lock key.

### components.json quirks (unipty precedent)

- `tsx: true` is REQUIRED by the shadcn config schema even for this
  Svelte/SvelteKit site (schema-only field; nothing emits JSX).
- `tailwind.css` points at `src/lib/styles/app.css`; the registry injects
  NO cssVars (items ship whole-file token sheets), so the css entry stays
  hand-owned.
- `jixoai.brandHue: 27` — the single per-project color fact; `jixoai-ui
  init/add/hue/upgrade` rewrites `--brand-hue` in `src/lib/jixoai.css`.

### Token migration (app.css)

`src/lib/styles/app.css` is now `@import 'tailwindcss'` +
`@import '../jixoai.css'` (the verbatim registry token sheet, hue 27
applied) plus SITE SUPPLEMENTS only:

- Structural ladders the registry sheet does not provide, values
  byte-parity with the retired `packages/web` borrow:
  `--radius-*: initial` reset + `--radius-sm/md/lg/xl` ladder (registry
  maps only `--radius`; without the reset, `rounded-*` utilities silently
  fall back to Tailwind's soft default scale), `--shadow-lg/xl/2xl`
  (registry dropped them as dead rungs — kept here as insurance; grep
  2026-09-06 found no direct site consumers yet), `--font-serif`,
  `--spacing` (documentation-parity, equals the Tailwind default).
- Base layer parity (`* { border-border; corner-shape: bevel;
  accent-color }`, body bg/text/mono font, `.font-nav`, `button {
  cursor: pointer }`) plus the jixoai site-family `:focus-visible` ring
  and `::selection` tint (unipty law; the pre-registry site had browser
  defaults — deliberate small deviation so registry chrome and
  project-owned controls share one focus/selection language).
- Site-only surfaces: anchor smooth scroll (+reduced-motion kill), Shiki
  dual-theme coupling (`.shiki-code` rules, unchanged).
- Dropped with the migration: the cross-package Tailwind
  `@source '../../../../web/src'` directive (EXPLICIT decision: the web
  package is no longer scanned for utility candidates — nothing outside
  `src/` is), the `@plugin '@tailwindcss/typography'` load that arrived
  implicitly with the web import (zero `prose` consumers on this site),
  and the `--openspec-reading-*` / `--toc-page-sidebar-*` layout tokens
  (zero site consumers).
- `html.js [data-reveal]` rules retired: entrances are the registry
  sheet's scroll-driven `[data-reveal]` CSS (static markup; the
  IntersectionObserver action `src/lib/actions/reveal.ts` was deleted and
  `use:reveal` call sites became static `data-reveal=""` /
  `data-reveal="rule"` attributes). The bootstrap's `root.js` class
  stays — card-grid's entrance keys on it.

### Local patches to registry files (upstream-fix candidates)

Four registry files carry small `(site patch, 2026-09-06)` markers —
mechanical, semantics-neutral TypeScript 5.9 fixes that the registry's
own mirror app never surfaces (it runs no svelte-check):

- `src/lib/context-plugin.svelte.ts` — brand/readOnly assignments go
  through mutable carrier casts instead of the readonly branded
  interfaces.
- `src/lib/defaults.svelte.ts` — the slot brand lands via
  `Object.defineProperty` (TS 5.9 widens computed unique-symbol keys in
  `Object.assign`'s inferred type); one double cast in `resolve()`.
- `src/lib/ui/press-button/press-button.svelte` — the `flat` `$derived`
  moved below `resolvedRaised` (lazy evaluation; order-only change).

These survive `jixoai-ui upgrade` (the lock stores CANONICAL hashes, so a
converged upgrade writes nothing). A future registry item whose hash
changes WILL overwrite the patch — re-apply or drop it if upstream fixed
the typing.

### Theme contract

The no-flash bootstrap (`src/lib/theme/theme-bootstrap.server.ts`, inline
in `app.html` before first paint) and the client sync
(`src/lib/theme/theme-bootstrap.ts`) speak the registry theme contract
verbatim: localStorage key `theme` (`light|dark|system`), `.dark` class +
`style.colorScheme` on `<html>`, `system` tracks `prefers-color-scheme`.
`theme-bootstrap.ts` no longer imports `@openspecui/web-src/lib/theme`
(that cross-package borrow retired with the palette import); it is a
local re-expression with the same surface (`getWebsiteStoredTheme` /
`persistWebsiteTheme` / `applyWebsiteTheme` / `installWebsiteThemeSync`).
The registry `theme-toggle` (full variant, in the header switcher slot)
drives the same contract; its group aria-label is the component's own
hardcoded `Color theme` (not localized like the retired hand-rolled
switcher's label — accepted, registry items stay verbatim).

### AI export layer

`vite.config.ts` wires the `llmsTxt()` vite plugin (registry item
`llms-txt`) — ONE generation point, running in the SSR build's
`closeBundle` AFTER adapter-static wrote `dist`. Config:
`siteUrl https://www.openspecui.com`, `locale.segments ['en','zh']`
(default `en`; root `llms.txt` is the en edition and links the zh
edition; `llms-full.txt` follows the default locale), root
`index.html` (the JS locale redirect) and `404.html` excluded. Outputs:
`llms.txt`, `llms-full.txt`, `en/llms.txt`, `zh/llms.txt`, per-page
`.md` mirrors for all four locale pages — verified byte-identical across
repeated builds.

### Functional surface (verified after the swap)

- `/en/`, `/zh/`, `/en/hooks/`, `/zh/hooks/` prerender with the registry
  chrome (terminal-header nav + indicator, theme-toggle, terminal-footer
  ghost wordmark) — checked headless-Chromium: zero console/page errors,
  `--primary` computes `oklch(0.6489 0.237 27)`, dark mode is pure
  black, theme toggle persists and applies `dark` + `colorScheme`.
- mdsvex `.svx` hooks pages + Shiki dual themes (rose-pine-dawn / red)
  render unchanged (2 highlighted blocks per hooks page, visually
  verified in both modes).
- Build contract: `dist/` + `_headers` intact; `wrangler.jsonc`
  untouched; dev port 13006 unchanged.
- `jixoai-ui upgrade`: first AND second run report `updated 0,
  unchanged 61` — zero writes, lock stable.
