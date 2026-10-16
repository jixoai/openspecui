<!--
Orthogonal intents (created 2026-10-16 Asia/Shanghai):
1. Record the implementation log for the 1.14.2 patch rotation.

Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.2 implementation log

## 2026-10-16 — Planning baseline (CP0)

- Delta investigated against the full `v1.14.1..v1.14.2` source diff; pure pin rotation triaged
  (see `references/openspec-1.14.2-report.md`).
- Context recovered: the 1.14 line was adapted by later sessions (14.0.0/14.0.1 released; the
  changeversion-submodule regression fixed by PR #303).
- Awaiting Codex Round-A change review before implementation freeze.

## 2026-10-16 — Round-A double-channel + Round-B approval

- research channel: 8/10, 2 P1 + 3 P2 + 5 P3 (both P1s independently verified by orchestrator grep).
- Codex channel (gpt-6.1-sol xhigh via new provider a6api): the provider sandbox executes commands
  remotely (/home/oai) with NO local filesystem, and after the first turn even the shell tool
  disappeared (NO-SHELL across restarts) — review re-run in inline-material mode (245-line packet:
  docs + verified audit + upstream diff excerpts + research findings for cross-examination).
  Round-A 7.5/10, findings converge with the research channel; Round-B on the folds: APPROVED,
  9.2/10. Both channels agree: zero-production-change triage holds WITH the completed pin/provenance
  surface list.
- Folds: 5b7299f0 (research channel) + 0551c1de (Codex residuals: fixture evidence-value order,
  timing-flake PR note).

## 2026-10-16 — Slices 1-2 implemented + Round-C approval

- Slice 1 (2cc57fc5): all ten pin surfaces rotated; red at the exact identity fixed point; 55+1
  tests green; ZERO assertion changes against the 1.14.2 executable (the zero-production-change
  triage now has executable proof); active 1.14.1/87c3595 references zero. Lockfile churn is pnpm
  10.22.0 layout compression (key sets verified identical).
- Slice 2 (14479403): x-tracker/X-Foo double-surface fixtures with real-binary evidence collection;
  brace-depth 16-boundary/17-rejection; unapplied-content WARNING; web verbatim re-collection
  (five version-anchored 1.14.0 mocks intentionally kept); README audit clean; four-package
  changeset. Gates: 7/7 + 6/6 + 5/5 + tsc green.
- Codex Round-C (inline-material): APPROVED 9.4/10, no P0/P1, scope-compliance confirmed. Light
  broad gates (format/lint/typecheck) green.

## 2026-10-16 — Vision ego-browser smoke walkthrough

- All scenarios PASS (see checkpoints). Precheck captured the real 1.14.2 warning text (501 chars,
  both new x- sentences) from the pinned binary; the UI projection matched it programmatically
  (exactMatch: true). Friction notes recorded: /api/health returns a JSON object (probe must not
  match bare "ok"); ego-browser CDP hooks do not survive page.goto (re-inject per document);
  prefer semantic selectors over ref=; assert lane display names from the a11y snapshot.

## 2026-10-16 — PR CI flake triage (as pre-agreed in the PR notes)

- First CI round: Fast/Windows/Browser gates failed on
  `tool-subscription-router.test.ts` — `waitForEmission('unexpected Launch explore command
  creation')` predicate timeout; the browser-shard verify step then failed on the skipped shard.
- Local rerun of the same file: 5/5 green (the test itself 1.5s). Failed-job rerun with ZERO code
  changes: full success. Classification per the agreed rule: rotation-sensitive timing surface
  (the file's CI budgets were tuned twice historically for 1.14.1 lazy-load dispatch); no timeout
  inflation applied. The 1.14.2 executable-evidence matrix itself was green in the first round
  (validation/apply fixtures passed inside the same Fast Gate log).
