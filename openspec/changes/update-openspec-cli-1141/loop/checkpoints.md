<!--
Orthogonal intents (created 2026-10-06 Asia/Shanghai):
1. Define the acceptance checkpoints and their evidence for the 1.14.1 patch rotation.
2. Keep every checkpoint falsifiable against a named command or artifact.
3. Record the Owner-only acceptance boundary and the agent-side walkthrough boundary.

Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
-->

# OpenSpec CLI 1.14.1 checkpoints

## CP0 — Planning baseline (planning)

- [x] Worktree `openspecui-worktrees/update-openspec-cli-1141`, branch
      `target/openspec-cli-1141-patch` off `main` (`b63478b0`).
- [x] `references/openspec` submodule checked out `v1.14.1`
      (`87c3595ace6a2e22957f39ebe5b74c2f2316e0cb`); gitlink staged with the rotation (repairs the
      `06dec8b9` revert recorded in the intake).
- [x] `references/openspec-1.14.1-report.md` written with source-diff + executed-CLI evidence.
- [x] Change artifacts (loop docs + spec delta) written.

## CP1 — Pin rotation (implementation)

- [x] Red recorded first: alias bumped to 1.14.1 + lockfile regenerated while
      `PINNED_OPENSPEC_V14_VERSIONS = ['1.14.0']`; the identity assertion failed at
      `expectPinnedVersion` (`official-cli-v14-version-report-fixtures.test.ts`, 1 failed).
- [x] `packages/core/package.json` alias `openspec-cli-114` -> `@fission-ai/openspec@1.14.1`;
      lockfile regenerated; workspace install clean.
- [x] `PINNED_OPENSPEC_V14_VERSIONS = ['1.14.1']`; bins-map key rotated; header intent lines
      added.
- [x] Every pin guard rotated: `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT`,
      `upstream-contract-regression.test.ts`, `root-context-cold-start.integration.test.ts`
      (+ observed `cli.version` expectations), `w2-project-binding-playwright.ts`
      (+ `--version` assertion).
- [x] Consumer-literal sweep: boundary suite admitted-line literals (3x `'1.14.0'` ->
      `'1.14.1'`; retired line stays 1.13.2), `opsx-kernel-schemas-root` local `PINNED_BINS` key.
- [x] `CLAUDE.md` session pointer reads `references/openspec-1.14.1-report.md`.
- [x] Guard firing proof: the first `prepare-openspec-reference.mjs` run failed on the
      unstaged gitlink (`must remain pinned to 87c3595…, but resolved 9d4e5974…`) until the
      new gitlink was staged — the PR-time drift guard works exactly as the incident
      narrative claims; after staging it validated the pin and built the CLI dist.
- [x] Fixture matrix green against the 1.14.1 executable with zero assertion relaxations:
      15 files / 47 tests (including the boundary negatives on the retained 1.13.2 executable).

## CP2 — New fixture proofs (implementation)

- [x] Apply all_done completion/archive-separation case green (state value unchanged;
      completion + review wording present; retired `ready to be archived` phrasing absent from
      the serialized payload).
- [x] Validate overlength case green: >500-char ADDED requirement is a `WARNING`
      (`cap-overlength/spec.md`) with non-strict change-scope exit 0 and `--strict` exit 1
      (`{items:1, passed:0, failed:1}`); helper description length re-checked at repeat(3)
      after a repeat(2) draft landed under the 500-char boundary.
- [x] Matrix total after CP2: 16 files / 49 tests.

## CP3 — Evidence docs + specs (implementation)

- [x] `references/openspec-1.14.1-report.md` (P1-P6 delta, owner map, release gate).
- [x] Spec delta: `opsx-workflow-ui` MODIFIED pin requirement + ADDED patch-rotation proofs.
- [x] `AGENTS.md` architecture decision (2026-10-06) + live-pin line + historical pins list.
- [x] README audit: no runtime text names `1.14.0` as the pinned executable (window-scoped
      tables and generator-staleness baseline constants only).

## CP4 — Review, gates, delivery

- [x] Broad gates green on the frozen tree: `pnpm format:check` (21 files),
      `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci` (full frozen rerun, inner exit 0
      after the Round-A fold), `pnpm test:browser:ci` (green after the machine-local
      Playwright chromium install; first run was environmental).
- [x] Codex Round-A implementation review (gpt-6.1-sol xhigh, 2026-10-06): 6.8/10 REVISE —
      4 delivery-discipline blockers (changeset, format, stale AGENTS clean-build pin,
      frozen full-gate evidence) all folded and re-verified; Round-B recorded in the
      implementation log.
- [ ] PR opened from `target/openspec-cli-1141-patch`, `pr-quality.yml` green (the CI pin guard
      proves the repaired gitlink against `EXPECTED_COMMIT` for the first time since the
      regression), merged per Manager Mode; change archived after merge; herdr resources
      released; worktree retained for follow-up iterations until the Owner's cleanup instruction.
- [x] Owner final browser walkthrough boundary unchanged (2026-07-20 law); no UI change ships,
      so no additional agent E2E walkthrough is required beyond the existing browser suites.
