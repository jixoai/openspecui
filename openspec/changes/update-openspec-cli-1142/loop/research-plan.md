<!--
Orthogonal intents (created 2026-10-16 Asia/Shanghai):
1. Convert the verified 1.14.2 patch delta into ordered slices with owners and evidence.

Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.2 patch research plan

Evidence source: `references/openspec-1.14.2-report.md` (pinned `v1.14.2` @ `f80d860f`).

## Decision & Plan

### CP0 — Planning baseline

Worktree `openspecui-worktrees/update-openspec-cli-1142`, branch `target/openspec-cli-1142-patch`
off `origin/main` (`10427891`); submodule pinned `v1.14.2` (`f80d860fc510ba4f51180c8ddde35b91b32de657`);
evidence report + change artifacts committed before Codex review. Codex change review gates
implementation freeze.

### Slice 1 — Pin rotation (single serial batch)

Owners:
- `packages/core/package.json` — `openspec-cli-114` alias `@1.14.1` -> `@1.14.2`; regenerate
  lockfile (single install; no parallel batches yet).
- `packages/core/src/__tests__/official-cli-v14-fixtures.ts` — `PINNED_OPENSPEC_V14_VERSIONS =
  ['1.14.2']`; bins key rotates; header intent line.
- `scripts/prepare-openspec-reference.mjs` — `EXPECTED_COMMIT` -> `f80d860fc510ba4f51180c8ddde35b91b32de657`.
- Live pin guards — `upstream-contract-regression.test.ts`,
  `root-context-cold-start.integration.test.ts`, `w2-project-binding-playwright.ts`: rotate commit
  constants AND version literals.
- Round-A folds (research channel, verified by orchestrator grep): two missed pin surfaces join the
  batch — `official-cli-v13-boundary-fixtures.test.ts:92,110,120` (three live `'1.14.1'` literals;
  the v13-prefixed filename escapes the `official-cli-v14-*` glob) and
  `opsx-kernel-schemas-root.fixtures.test.ts:46` (local `PINNED_BINS` key; the file's own header
  documents this exact stale-key crash as a past incident). Audit method upgraded from "listed
  guarded files" to a whole-repo mechanical grep over `1.14.1 | 1.14.0 | 87c3595 | f80d860 |
  openspec-cli-114 | PINNED_OPENSPEC | EXPECTED_COMMIT` with per-hit classification (live /
  frozen history / mock data / unrelated dep) — result: exactly the ten live surfaces above, no
  further strays.
- `CLAUDE.md` — session pointer -> `references/openspec-1.14.2-report.md`; historical list gains
  the 1.14.1 report.
- Round-A fold: `AGENTS.md` line 568 (clean-build law) embeds the full previous SHA — rotate it with
  line 489, not just the evidence-map line.

Red: alias bumped, constants untouched -> identity assertion fails (`--version` expected 1.14.1,
received 1.14.2). Green: full v14 fixture matrix green against the 1.14.2 executable with zero
assertion relaxations; message-text updates only where 1.14.2 texts fire.

### Slice 2 — Fixture evidence + docs + changeset

Owners:
- v14 fixture additions where cheap: `.openspec.yaml` with an `x-tracker` key asserts no
  unknown-key warning (and `X-Foo` still warns); a >16-level brace output pattern asserts the CLI's
  depth-rejection error where the harness builds one cheaply — otherwise report-level evidence.
- Round-A fold (verbatim-evidence provenance): `status-warnings-notice.test.tsx` and
  `change-view-status-warnings.test.tsx:161` hardcode the 1.14.1-era unknown-key message (trailing
  `...have no effect.`); 1.14.2 appends the `x-` hint to the same input. Update the strings (or
  annotate the collecting version) so the "captured from the pinned CLI" claim stays true.
- `AGENTS.md` evidence-map pin line -> 1.14.2 (`f80d860f`), historical list gains v1.14.1; README
  audit for explicit `1.14.1` runtime claims (expected none).
- `.changeset/*.md` — `openspecui` patch bump note.

## Verification Strategy

Focused: `pnpm --filter @openspecui/core exec vitest run src/official-cli-v1*.test.ts
src/opsx-kernel-schemas-root.fixtures.test.ts src/upstream-contract-regression.test.ts` +
server cold-start guard + `tsc --noEmit` (Round-A fold: the widened glob covers the v13-prefixed
boundary file that the v14-only glob missed). Broad gates serial before PR; vision-subagent ego-browser walkthrough
prepares the Owner's final walkthrough.
