> Orthogonal intents (maintained 2026-09-06 Asia/Shanghai): website design
> system adoption; i18n/docs surface preservation; AI export.
>
> Original request (2026-09-06 Asia/Shanghai): 更新 ./openspecui 的官网站点
> （背景：./jixoai-ui 发布了新版本 0.3.0）。

## Why

`packages/website` carries the jixoai visual identity by hand: its own token
sheet (imported from `packages/web/src/index.css`), hand-rolled site chrome
(site-header/site-footer/theme-switcher/press-button/section-card), and no
`@jixoai` registry consumption. jixoai-ui 0.3.0 now publishes the complete
website surface (jixoai-theme token sheet, `website-scaffold`,
`terminal-header/footer`, `theme-toggle`, `llms-txt`), and the family law
says sites take their identity from the registry — the One-Hue value for
openspecui is 27, which is exactly the hue the site already renders.

## What Changes

- Bootstrap registry consumption in `packages/website`:
  `npx jixoai-ui init --hue 27` (components.json + `@jixoai` namespace +
  jixoai-theme token sheet applied at the site's css entry).
- Replace hand-rolled chrome with locked registry items where a registry
  equivalent exists: `website-scaffold`, `terminal-header`,
  `terminal-footer`, `theme-toggle`, `press-button`, `section-card`,
  `terminal-card`, `card-grid`, `hero-section` (as applicable), plus
  `scrollbar-measure` (imported once in the root layout). Keep
  openspecui-specific components (external-link, hook-reference,
  language-switcher, home/*) as project-owned code.
- Token migration: the website stops importing
  `packages/web/src/index.css` for its palette; jixoai-theme
  (`--brand-hue: 27`) becomes the website's only color source. The React
  `packages/web` is NOT touched. Framework-agnostic helper reuse (theme
  logic) is re-expressed against the registry theme contract
  (localStorage `theme`, `.dark` + `colorScheme`) with the no-flash
  bootstrap preserved.
- Preserve the entire functional surface: `[lang=locale]` en/zh routing,
  mdsvex hooks docs (syntax-highlight pipeline), Shiki dual themes,
  Cloudflare Pages build (`dist` output contract, `_headers`), custom
  domain behavior.
- Add the AI export layer (`llms-txt` item) — one generation point (vite
  plugin or final orchestration call, whichever fits the existing vite
  config), absolute URLs, both locales' pages mirrored.

## Capabilities

### Modified Capabilities

- `website-surface`: identity sourced from the registry; AI export output.

## Non-goals

- No change to `packages/web`, the React component API, or product tokens.
- No new content sections; copy stays as-is except chrome wording the
  component swap implies.
