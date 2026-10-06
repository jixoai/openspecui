<!--
Orthogonal intents (created 2026-10-06 Asia/Shanghai):
1. Log the executed implementation batches with commands and evidence for the 1.14.1 rotation.
2. Record every drift found by the executable matrix and its exact repair.
3. Keep the red/green evidence falsifiable at named fixed points.

Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
-->

# OpenSpec CLI 1.14.1 patch implementation log

Worktree `openspecui-worktrees/update-openspec-cli-1141`, branch
`target/openspec-cli-1141-patch` off `main` (`b63478b0`). All commands run from the worktree
root unless noted; fixture commands use the `pnpm --filter @openspecui/core exec vitest run`
form (exec passthrough) per the runner-audit law.

## Batch 1 — Pin rotation (Slice 1)

1. `git submodule update --init references/openspec` checked out the regressed gitlink
   `9d4e5974` (v1.13.0) — the `06dec8b9` revert reproduced on a clean worktree. Checked out
   `v1.14.1` (`87c3595ace6a2e22957f39ebe5b74c2f2316e0cb`) in the submodule.
2. Bumped `packages/core/package.json` `openspec-cli-114` alias to
   `npm:@fission-ai/openspec@1.14.1`; `pnpm install --frozen-lockfile` failed on the manifest
   mismatch (expected), `pnpm install` regenerated the lockfile; the alias bin answered
   `--version` with `1.14.1`.
3. **Red recorded** (before the constant rotation):
   `pnpm --filter @openspecui/core exec vitest run src/official-cli-v14-version-report-fixtures.test.ts`
   -> 1 failed at `expectPinnedVersion` (`official-cli-v14-fixtures.ts:93`): the executable
   printed `1.14.1` while `PINNED_OPENSPEC_V14_VERSIONS` still demanded `1.14.0`. This is the
   falsifiable red for the rotation; no other assertion was touched to produce it.
4. Rotated the constants/guards: fixtures helper (`PINNED_OPENSPEC_V14_VERSIONS` + bins key +
   header), `prepare-openspec-reference.mjs` `EXPECTED_COMMIT` (+ incident note in the header),
   `upstream-contract-regression.test.ts` (title + assertion + header),
   `root-context-cold-start.integration.test.ts` (`PINNED_OPENSPEC_COMMIT` + two observed
   `cli.version` expectations), `w2-project-binding-playwright.ts` (`PINNED_OPENSPEC_COMMIT` +
   `--version` assertion), `CLAUDE.md` session pointer.
5. **Drift found by the matrix** (exactly the consumer-literal class the research plan
   predicted; both repaired, no assertion relaxation):
   - `official-cli-v13-boundary-fixtures.test.ts` (2 tests failed): three admitted-line
     literals `'1.14.0'` resolved `PINNED_V14_BINS[version] -> undefined`, spawning
     `…/project/undefined`. Rotated to `'1.14.1'`; the retired-line assertions stay `1.13.2`.
   - `opsx-kernel-schemas-root.fixtures.test.ts` (1 test failed): the local `PINNED_BINS` key
     `'1.14.0'` crashed `writeConfig` on `undefined.trim()` — the same failure class its header
     documents from the 1131 rotation. Key rotated to `'1.14.1'`.
6. Matrix green: 15 files / 47 tests, zero assertion relaxations. `tool-init-state.test.ts`
   `'1.14.0'` literals audited and deliberately untouched (generator-staleness baseline
   constants per the intake decision).

## Batch 2 — New fixture proofs (Slice 2)

Executed-CLI evidence first (1.14.1 alias bin, isolated `/tmp` project):

- `instructions apply --change done-smoke --json` -> `state: "all_done"`,
  `instruction: "All tracked tasks are complete.\nReview or verify the change as appropriate
before archiving."`, `'ready to be archived'` absent from the serialized payload; text mode
  ends with the same two-line instruction.
- Overlength change (`validate overlength --json` / `--json --strict`) -> exit 0 / exit 1 with
  a `WARNING` `cap-over/spec.md` issue whose message contains `Requirement text is very long
(>500 characters)`.
- `version --check --json` -> schemaVersion-1 envelope unchanged, `version: "1.14.1"`.

Then the two fixture cases landed (CP2). One draft defect caught before running: the
`createOverlengthChange` helper's description at `.repeat(2)` was ~436 characters (under the
boundary — it would have produced a vacuously-green non-warning test); corrected to
`.repeat(3)` (~654) before the first run. Both files green: validation-full 8 tests,
apply-readiness 6 tests. Matrix total 16 files / 49 tests.

## Batch 3 — Evidence docs + specs (Slice 3)

`references/openspec-1.14.1-report.md` (P1–P6, owner map, release gate), spec delta
(`opsx-workflow-ui` MODIFIED pin requirement + ADDED patch-rotation proofs), `AGENTS.md`
2026-10-06 architecture decision + pin lines, `CLAUDE.md` pointer, change docs. Upstream
verification recorded in the report: `src/index.ts` diff empty; zero commits under
agent-delivery surfaces; 13 commits in `v1.14.0..v1.14.1`.

One self-inflicted overlength caught by the rotated CLI itself: the first spec delta draft
put both new proofs in one requirement whose text exceeded 500 characters, and
`openspec validate update-openspec-cli-1141` flagged exactly the new 1.14.1 WARNING. Split
into two requirements per the advisory's advice; re-validation is clean.

## Batch 4 — Gates + review (Slice 4)

- `pnpm format:check`: first run flagged 4 files (including the regenerated `pnpm-lock.yaml`
  — main's lockfile is prettier-clean, so the regenerated one had to be re-formatted);
  `prettier --write` applied to exactly those 4 files, re-check green.
- `pnpm lint:ci` green; `pnpm typecheck` green.
- `node scripts/prepare-openspec-reference.mjs` produced one more guard proof before passing:
  the first run **failed** with `references/openspec must remain pinned to 87c3595…, but
resolved 9d4e5974…` — its own `git submodule update` had reset the submodule working tree
  to the branch's still-unstaged old gitlink. After staging the new gitlink
  (`git add references/openspec`, `9d4e5974..87c3595a` in the index) the script validated the
  pin, installed the submodule deps, and built `dist/cli/index.js`. This is the CI-side guard
  firing on drift exactly as the incident narrative claims.
- `pnpm test:ci`: every package green except two 20s-timeout cases in the CLI package's
  `worktree-instance-manager.test.ts` ("starts a process child …" / "starts the production
  worker child …") under full-suite parallel load. Isolated rerun of the file: 22/22 green;
  full `pnpm --filter openspecui test` rerun in the same environment: 31 files / 174 tests
  green. Classified as load/timing flakes in that child-process integration file (its own
  comments document CI teardown flakiness), not a 1.14.1 regression — the same rebuilt
  `references/openspec` dist and the same alias executable pass when the machine is not
  saturated. All other packages passed in the original run.
- `pnpm test:browser:ci`: first run failed environmentally — the worktree's Playwright
  expected `chromium_headless_shell-1208`, absent from the machine cache (main's Playwright
  revision differs). `pnpm --filter xterm-input-panel exec playwright install chromium`
  installed it; full rerun green (inner exit 0).
- Codex Round-A review (gpt-6.1-sol xhigh, 2026-10-06): **6.8/10 REVISE**. Independently
  confirmed the submodule pin, the 13-commit delta, the empty `src/index.ts` diff, all
  constant rotations, the `06dec8b9` revert, the new fixtures (14/14 + 46 related tests),
  and `openspec validate`. Four delivery-discipline blockers, all folded:
  1. Missing changeset — `changeset-check.mjs` fires on `packages/` paths after commit;
     added `.changeset/update-openspec-cli-1141.md` (four packages, patch) per the 1132
     precedent; intake decision 1 records the veto.
  2. `format:check` actually red on this log file (a post-prettier append) — re-formatted
     with the rest of the fold; final `format:check` re-run recorded below.
  3. Stale pin in `AGENTS.md` "Pinned CLI clean-build law" (v1.14.0/`94ca9c1e`) — rotated
     to v1.14.1/`87c3595`.
  4. No frozen full-gate evidence — after this fold the tree is frozen and the complete
     `pnpm test:ci` re-run is recorded below (the isolated reruns above were diagnostic
     only, never a substitute).
     Non-blocking folded: the report now states that `cap-over/` (ad-hoc smoke) and
     `cap-overlength/` (pinned fixture) are both fixture-local capability names, not contract
     facts.
- Frozen-tree gate evidence (2026-10-06, after the Round-A fold, no concurrent edits):
  `pnpm format:check` green over 21 files; full `pnpm test:ci` green end-to-end with the
  inner exit 0 — the two earlier CLI-package timeouts did not reproduce without concurrent
  load, closing blocker 4 with complete-suite evidence. `lint:ci`, `typecheck`, and
  `test:browser:ci` evidence stands from this same frozen tree (no source changed since).
- Codex Round-B review (gpt-6.1-sol xhigh, 2026-10-06, 39m): **8.8/10 APPROVE — no remaining
  blockers** (Round-A 6.8, +2.0). Independently re-verified all four folds (changeset coverage
  by the check script's own filter logic, format 21-file batch exit 0, the AGENTS clean-build
  pin at v1.14.1/`87c3595`, full `test:ci` + `test:browser:ci` inner exit 0), re-ran the two
  new fixtures (2 files / 14 tests), the frozen-lockfile install, the clean-build prepare
  script, and the upstream facts (13 commits, empty `src/index.ts` diff, `06dec8b9` revert).
  All four Owner-default decisions confirmed against the 1131/1132 precedents.
  Non-blocking follow-ups from Round-B:
  - Dangling "recorded below" lines in this log — fixed by this very entry.
  - Lockfile diff noise (~7015+/2401-): investigated and consciously kept. A minimal
    10-line semantic edit (main's compact style + the 1.14.1 specifier/version/integrity)
    was built and verified with `pnpm install --frozen-lockfile` plus the identity fixture,
    but `format:check` rejects it: the gate checks changed files against the current
    prettier, whose canonical YAML expands every `resolution: {integrity: …}` line — main's
    compact lockfile predates that style and was never gate-checked (the gate only sees
    changed files). Gate compliance wins; the noise is one-time canonicalization, and the
    semantic delta was proven to be exactly the alias rotation (snapshot bodies identical).
- PR delivery: recorded below as it completes.
