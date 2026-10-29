<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Record the owner request and the objective scope for the OpenSpecUI 15 line.
2. Separate the CLI-admission rotation from the new typed contract projection.
3. State the acceptance boundary in verifiable gates.
-->

## User Input

Original request (2026-10-29): "检查一下上游openspec是否发布新版本，如果我们按照规范跟进更新"

Working mode: standard FULL-WORKFLOW in a dedicated worktree
(`openspecui-cli-115-line`, branch `target-openspec-cli-115-line`, based on
`main`). Codex terminal review is not enabled for this run; per the standing
restraint discipline the review loop uses independent ZCode subagents instead.

## Objective Scope

Upstream released `@fission-ai/openspec` 1.14.2 (2026-10-15), 1.14.3
(2026-10-17), and 1.15.0 (2026-10-24) after the current pin v1.14.1. This loop
adapts OpenSpecUI to the new **OpenSpecUI 15** line (one-line-per-series
cadence):

1. Pin `references/openspec` to `v1.15.0` (`8e0288df12d401b0e183e2f47254d22528c1dffb`),
   absorbing the unshipped in-window patches 1.14.2/1.14.3 without skipping any
   1.14.x protocol obligation (boundary fixture = 1.14.3).
2. Rotate the compat window to `>=1.15.0 <1.16.0` (single series) with all
   mirrored constants and classification tests.
3. Project the one new 1.15.0 typed contract end-to-end:
   `update --dry-run --json` (`UpdatePlan`), gated by a new
   `deriveOpenSpecCliCapabilities` capability, including the failure envelope
   (`status[]`, `code: 'update_error'`, exit 1) and the exit-0-with-failures
   semantics; surface it as an Agent-facing update preview in the Config
   Agents flow.
4. Extend `CliVersionSchema.install.scope` with `'standalone'` (typed contract
   only; no production install-facts UI in this loop).
5. Rotate the Agent registry series to `'1.15'` (constants only — upstream
   `config.ts` is byte-unchanged), the generator staleness baseline to
   `1.15.0`, and the fixture system (`openspec-cli-115` positive = 1.15.0,
   `openspec-cli-114` boundary = 1.14.3, v13 boundary suite retires).
6. Rotate every pin guard to the new commit; repair or retire the stale
   v9-era `scripts/check-openspec-reference.mjs` assertion in the same PR.
7. Documentation: evidence report `references/openspec-1.15.0-report.md`,
   root README + README-zh + `packages/cli/README.md` version tables, AGENTS.md
   architecture decision, changeset.

## Non-Goals

- No standalone-binary distribution support in OpenSpecUI (npm package
  consumption is unchanged; `install [version]` command is not surfaced).
- No production UI projecting CLI install facts (`getCliInstallInfo` remains
  fixture-only evidence).
- No Agent-registry content changes (zero upstream tool delta).
- No new product features beyond the dry-run preview projection; no
  14.x-widening release (new major, per cadence).
- No release execution in this loop (publish happens after owner confirmation
  per Manager Mode).

## Acceptance Boundary

1. `pnpm --filter @openspecui/core exec vitest run` passes including the
   rotated fixture matrix (v15 positive + v14 boundary) and
   `upstream-contract-regression.test.ts` asserting `8e0288df…`.
2. `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, and the scoped
   `test:ci` lanes pass locally (CI-equivalent subset for the touched
   packages).
3. `scripts/prepare-openspec-reference.mjs` verifies the gitlink at the new
   commit; the stale `check-openspec-reference.mjs` no longer asserts v9.
4. The evidence report exists at `references/openspec-1.15.0-report.md` with
   the executed-CLI evidence section; the dry-run preview renders a real
   `UpdatePlan` (add/update/delete, notes, failures) from the pinned 1.15.0
   executable in focused tests.
5. Boundary: 1.14.3 executable is classified unsupported and proves
   1.15-only members absent; `>=1.16.0`, prereleases, and `<1.15.0` remain
   blocked by default.
6. Docs rotation complete (README tables ×2 + CLI README + AGENTS.md decision)
   and a changeset is included.
