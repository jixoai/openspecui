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
- [x] Navigation normalizes before `navigate()`, so the base path is applied exactly once — via the
      dependency-free `base-path-href.ts` (`toBaseRelativeHref`). The first attempt borrowed
      `normalizeNavigationHref` from a module 10+ tests partially mock, which regressed six real
      Router tests (`expected '/specs' to be '/specs/owned/auth'`); the shipped owner imports nothing.

## CP2 — Focused gates

- [x] `template-insertion.test.ts` + `base-path-rewrite.test.ts`: 2 files / 21 tests, exit 0.
- [x] `nav-controller.test.ts` + `navigation.test.tsx`: 2 files / 44 tests, exit 0.

## CP3 — Real-export evidence

- [x] `$'` snapshot round-trips verbatim; one doctype; one bootstrap script.
- [x] `--base-path /docs/`: 31/31 attributes prefixed, CSS fonts rewritten, no residual
      `"/assets/` in JS.
- [x] Bounded rewrite proven end-to-end (snapshot text `/assets/foo.js` unchanged).

## CP4 — Delivery

- [x] Broad gates: PR #320 ran the full suite — Changeset Gate, CI Scope, Fast Gate, Windows
      Portability Gate, CI Scope, and both browser shards all green (after a round that failed the
      Changeset Gate for a missing changeset and one Fast-Gate retry on the known
      `change-diff-evidence` timing flake, which cleared with zero code change).
- [ ] Independent subagent review of the diff was **not** recorded for this change. What the
      delivery does carry is CP0 reproduction and CP3 real-export evidence for each of the four
      defects, plus the deciding cross-check that settled the `nav-controller` regression: the
      unmodified branch passed 4/4 while the borrowing version failed, which located the fault in the
      change rather than in the suite. Recorded here as an honest gap, not as a completed review.
- [x] PR #320 merged with `mergedAt` verified (9af2ead3, 2026-11-04T11:47:31Z).
- [x] Issue #319 replied with the four fixes and the deferred determinism item (a product decision,
      with a `--generated-at` override plus `--no-timestamps` proposed as the default).
- [x] Owner browser-walkthrough boundary unchanged; the export fix ships no new visual surface.
