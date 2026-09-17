<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Define the acceptance checkpoints and their evidence for the 1.13.1 patch rotation.
2. Keep every checkpoint falsifiable against a named command or artifact.
3. Record the Owner-only acceptance boundary.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpec CLI 1.13.1 patch checkpoints

## CP0 — Planning baseline (planning)

- [x] Worktree `openspecui-worktrees/update-openspec-cli-1131`, branch
      `target/openspec-cli-1131-patch` off `main` (`eb2fb118`).
- [x] `references/openspec` submodule pinned `v1.13.1`
      (`634c557bd0470eec37861b46172c3f503d283c1b`).
- [x] `references/openspec-1.13.1-report.md` written with source-diff evidence.
- [x] Change artifacts (specs deltas + loop docs) written.
- [ ] Codex change review approved (Round-A blockers folded; Round-B recorded here with score).

## CP1 — Pin rotation (implementation)

- [ ] `packages/core/package.json` alias `openspec-cli-113` -> `@fission-ai/openspec@1.13.1`;
      lockfile regenerated; workspace install clean.
- [ ] `PINNED_OPENSPEC_V13_VERSIONS = ['1.13.1']`; fixture identity assertions green against the
      1.13.1 executable across all `official-cli-v13-*.test.ts`.
- [ ] `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` =
      `634c557bd0470eec37861b46172c3f503d283c1b`; header intent updated.
- [ ] `CLAUDE.md` session pointer reads `references/openspec-1.13.1-report.md`.
- [ ] Red recorded: identity assertion against the stale `1.13.0` constant.

## CP2 — Change-list nested/warnings (implementation)

- [ ] Contract: `nested?: string[]` on entries; top-level `warnings?` typed
      (`nested_change_directory`); absent-when-empty preserved; `workflow.test.ts` green with new cases.
- [ ] Kernel projection: entries with `nested` excluded from actionable `entries`; `warnings` projected;
      `planning-cli-projection.test.ts` + `opsx-kernel-cli-projection.test.ts` green; red recorded
      (warnings dropped + nested actionable today).
- [ ] Server inheritance: changes/dashboard projections prove a namespaced directory never renders as a
      change row or CLI task summary; no second filter implementation.
- [ ] Web: Changes page amber warnings region, verbatim upstream message, no row/no `Tasks 0/0`/no detail
      link for namespaced directories; TestingLibrary red recorded before the fix.
- [ ] Spec deltas applied (`openspec-cli-integration`, `opsx-workflow-ui`).

## CP3 — Task-line reading parity (implementation)

- [ ] `task-progress.ts` pattern mirrors the CLI semantics (markers, ordered, indentation, single-token
      markers, whitespace-only boxes, link guard, CRLF, no `$` anchor); done iff `x`/`X`.
- [ ] `toggleMarkdownTask` operates on widened forms writing canonical `[x]`/`[ ]`.
- [ ] New unit cases green (documented in research plan); existing narrow-syntax cases unchanged.
- [ ] Divergence regression: `+`-marker tasks no longer produce a false tracked-task-mismatch badge.
- [ ] CLI-progress authority tests stay green (local reading never redefines CLI denominators).

## CP4 — Fixture extension, docs, changeset (implementation)

- [ ] Namespace-folder fixture repository asserts executable `list --json` `warnings` + `nested`.
- [ ] `+`/ordered-marker tasks fixture asserts CLI counts; parity confirmed against local reading.
- [ ] `AGENTS.md` evidence-map pin line updated to 1.13.1 (`634c557`); README verified untouched (or
      explicit-runtime-claim audit recorded).
- [ ] `.changeset/*.md` for `openspecui` patch release.

## CP5 — Gates and delivery (implementation)

- [ ] `pnpm --filter @openspecui/core exec tsc --noEmit` green after each core slice.
- [ ] Focused suites per slice green; broad gates `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`,
      `pnpm test:ci`, `pnpm test:browser:ci` green (or scoped subset justified in PR notes).
- [ ] Changed-file header audit complete (every changed TS/TSX file, tests included).
- [ ] Codex implementation review approved; score recorded.
- [ ] PR open from `target/openspec-cli-1131-patch`; Owner walkthrough boundary stated in PR notes.
