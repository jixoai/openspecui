# Research Plan — renew-website-v9-surface

## Objective facts (verified against the workspace)

- Published product line: `openspecui` **9.0.1** (`packages/cli/package.json`).
- OpenSpec CLI admission: accepted `>=1.8.0 <1.10.0`, current/recommended `>=1.9.0 <1.10.0`
  (`packages/core/src/openspec-compat.ts`). Prereleases and other series are blocked by default.
- Command surface (`packages/cli/src/cli-command.ts`, `README.md`):
  - `openspecui [project]` ≡ `serve [project]` — default port 3100; interactive TTY asks once about the
    App daemon; non-interactive opens Direct Project Web.
  - `--app` ensures the daemon and attaches the project as a Workspace; `--web` opens the browser surface;
    both conflict; `--app=<url>` is retired and errors.
  - `start` / `stop` / `restart` manage the user-level App daemon (`restart --web` switches host).
  - `export -o <dir> [-f html|json] [--base-path] [--references include|omit]` publishes a static snapshot;
    `@openspecui/web` also ships the standalone `openspecui-ssg` bin.
  - `--auth` generates a 256-bit Bearer credential for the whole access gate (HTTP, tRPC, PTY, files,
    terminal, notifications); `--password <secret>` is its explicit-secret form.
- App mode is native since 7+: user-level daemon + bundled same-version App shell hosted by OpenTray
  (retained window, tray, self-drawn titlebar). App information architecture is Workspaces + Stores.
  PWA is fully retired (no manifest / service worker / install prompt anywhere in `packages/app`).
- Website package: SvelteKit 5 static (`adapter-static`, prerendered), EN/ZH typed locale modules,
  Tailwind v4 sharing `packages/web/src/index.css` tokens, mdsvex + Shiki hooks guide, vitest + jsdom,
  deployed to Cloudflare Pages by manual `wrangler` (no CI deployment).

## Content decisions

| Surface       | Decision                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hero          | Eyebrow `OPENSPECUI 9 — visual projection of OpenSpec`, large-type lead + red accent title, summary, surface badges, COPY quick-start (`npx openspecui@latest`) primary CTA, GitHub secondary |
| Terminal card | Boot Log typing card (`$ npx openspecui@latest`, 4 output lines) — hero right column ≥1100px, own row below copy otherwise, before WHAT'S INSIDE                                              |
| Features      | 8 numbered full-width rows: OPSX change workflow, Dashboard, Config workbench, Agent delivery, Terminals, Git view, Search, Reactive kernel — sticky index rail with scroll-spy ≥1000px       |
| Surfaces      | Three cards: Native App (`openspecui start`), Direct Web (`openspecui --web`), Static export (`openspecui export -o ./dist`)                                                                  |
| Run it        | Inverted band: runner select (npm/pnpm/bun, persisted), App/Web flag toggle with summary swap, SERVE / STATIC EXPORT / PROTECT IT (`--auth`) command rows, compatibility footnote             |
| Footer        | Ghost word `OPENSPECUI` + links row (app.openspecui.com / openspec.dev / GitHub) + copyright                                                                                                  |
| Omitted       | Translation platform (owner expects major rework), PWA (retired), hooks page content (unchanged and still accurate)                                                                           |

## Implementation map

```
packages/website/src/lib/
├─ i18n/schema.ts                      # WebsiteContent rebuilt (no backward compat)
├─ i18n/locales/{en,zh}.ts             # full v9 rewrite
├─ actions/reveal.ts                   # new: IO reveal action (rise | rule variants)
├─ theme/theme-bootstrap.server.ts     # adds html.js marker for reveal gating
├─ styles/app.css                      # reveal CSS + reduced-motion guards
├─ components/home/
│  ├─ hero-section.svelte              # two-col hero + copy CTA
│  ├─ terminal-card.svelte             # typing effect (SSR-full, animate on hydrate)
│  ├─ features-section.svelte          # rail + numbered rows + scroll-spy
│  ├─ surfaces-section.svelte          # three surface cards
│  └─ run-it-section.svelte            # runner/flag/commands inverted band
├─ components/site-footer.svelte       # ghost word + links + copyright
└─ pages/home-page.svelte              # assembly only
```

## Verification plan

1. `pnpm --filter @openspecui/website typecheck` / `test` / `build` (prerender must succeed for
   `/en/ /zh/ /en/hooks/ /zh/hooks/` plus the root redirect).
2. Root `pnpm format:check` and `pnpm lint:ci` over the touched scope.
3. Agent browser walkthrough on the dev server and on the built `dist` output: both languages, both pages,
   theme switch, language switch, runner persistence, App/Web toggle, copy feedback, reveal + typing +
   scroll-spy motion (including narrow-viewport hero degradation).
4. Regression guards in tests: v9 compatibility copy, no PWA language, no translation-feature mention.
