<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. One falsifiable checkpoint per defect plus the delivery gates.
2. Record the real-export evidence as its own checkpoint (a green build is not export evidence).

Original request (2026-11-04): "同时，处理一下#319"
-->

# Issue #319 checkpoints

## CP0 — Reproduction

- [x] #1 reproduced: `$'` split the bootstrap JSON (`"proj-a\n  </body>\n</html>\nb"`).
- [x] #2 reproduced: `/assets/…` and `/logo.svg` stayed root-absolute under `/docs/`.
- [x] #3 confirmed at source (`import(absolutePath)`); POSIX tolerates it, Windows does not.
- [x] #4 confirmed at source (`toRelativeHref` keeps the router-rendered basepath).

## CP1 — Fixes

- [x] `template-insertion.ts` owns insertion with replacer functions + placeholder validation.
- [x] `cli.ts` loads the server entry through `pathToFileURL`.
- [x] `base-path-rewrite.ts` rewrites markup attributes and Vite-emitted modules; base `/` is a
      no-op.
- [x] `cli.ts` applies the base path to the template, the rendered markup, and the output tree.
- [x] Navigation normalizes through `normalizeNavigationHref`, so `navigate()` applies the base
      path once.

## CP2 — Focused gates

- [x] `template-insertion.test.ts` + `base-path-rewrite.test.ts`: 2 files / 21 tests, exit 0.
- [x] `nav-controller.test.ts` + `navigation.test.tsx`: 2 files / 44 tests, exit 0.

## CP3 — Real-export evidence

- [x] `$'` snapshot round-trips verbatim; one doctype; one bootstrap script.
- [x] `--base-path /docs/`: 31/31 attributes prefixed, CSS fonts rewritten, no residual
      `"/assets/` in JS.
- [x] Bounded rewrite proven end-to-end (snapshot text `/assets/foo.js` unchanged).

## CP4 — Delivery

- [ ] Broad gates: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`,
      `pnpm test:ci` (or a justified scoped subset), `pnpm test:browser:ci`.
- [ ] Independent subagent review of the diff; findings folded.
- [ ] PR from `fix/static-export-319`, CI green, merged with `mergedAt` verified.
- [ ] Issue #319 replied with the four fixes and the deferred determinism item.
- [x] Owner browser-walkthrough boundary unchanged; the export fix ships no new visual surface.
