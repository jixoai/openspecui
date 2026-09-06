> Execution law: implementation is delegated work; visual acceptance and
> Cloudflare deployment stay with the Owner.

## 1. Registry bootstrap

- [x] 1.1 Create `components.json` FIRST (hand-write following the unipty
  www precedent: shadcn schema fields, `tsx: true` is schema-mandatory even
  for a Svelte site — record the quirk in NOTES; aliases with
  `ui → src/lib/ui`, css `src/lib/styles/app.css`,
  `registries.@jixoai = "https://ui.jixoai.com/r/{name}.json"`) —
  `jixoai-ui init` refuses to run without it. Then
  `npx jixoai-ui init --hue 27` in `packages/website`.
- [x] 1.2 Add `scrollbar-measure` (root layout import), `website-scaffold`,
  `terminal-header`, `terminal-footer`, `theme-toggle`, `press-button`,
  `section-card`, `terminal-card`, `card-grid`, `hero-section`, `llms-txt`.
  Then LOCK THE DEPENDENCY CLOSURE (shadcn installs dependencies but only
  explicit names enter `jixoai-ui.lock`) — explicitly `npx jixoai-ui add`
  every closure item that landed on disk (`icons`, `defaults`, `utils`,
  `jixoai-theme`, `navigation-menu`, `popover`, `density`, `paint`,
  `separator`, `figure`, `context-plugin`, `toc-engine` …as actually
  present); record exclusions in NOTES.

## 2. Chrome swap

- [x] 2.1 Map site-header → terminal-header, site-footer → terminal-footer,
  theme-switcher → theme-toggle (preserve the no-flash server bootstrap and
  the three-state contract), press-button/section-card → registry versions.
  Keep language-switcher, external-link, hook-reference, home/* project-owned.
- [x] 2.2 Token migration WITHOUT visual regression: jixoai-theme
  (`--brand-hue: 27`) becomes the palette source, and the
  `packages/web/src/index.css` import is replaced by a site-local supplement
  that carries the STRUCTURAL tokens the registry sheet does not provide —
  the Tailwind v4 ladders (`--spacing`, `--radius-*`, `--shadow-*` incl.
  the neubrutalism hard-shadow series) and `--font-serif` — because
  project-owned files (hook-reference.svelte, routes) consume their
  utilities and would silently fall back to Tailwind soft defaults.
  `packages/web` itself is NOT touched; the cross-package Tailwind
  `@source` directive is an explicit decision recorded in NOTES.
- [x] 2.3 Re-express theme persistence against the registry theme contract
  (localStorage `theme`, `.dark` + `colorScheme`); keep the mdsvex hooks
  pages and Shiki pipeline rendering correctly (they are css-coupling-free
  — verify visually).

## 3. AI export + verification

- [x] 3.1 Wire `llms-txt` with ONE generation point fitting the existing
  vite config (the `llmsTxt()` vite plugin is the documented fit for this
  site; `config.locale.segments` covers the en/zh mirrors); byte-identical
  re-run.
- [x] 3.2 `pnpm build` + typecheck + tests pass; wrangler pages output
  contract unchanged (`dist`, `_headers` intact).
- [x] 3.3 jixoai-website skill verification checklist reviewed; deviations
  recorded in the website README/NOTES; friction log reported.
