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
  constants AND version literals; audit ALL version literals in these files (not only `1.14.1`).
- `CLAUDE.md` — session pointer -> `references/openspec-1.14.2-report.md`; historical list gains
  the 1.14.1 report.

Red: alias bumped, constants untouched -> identity assertion fails (`--version` expected 1.14.1,
received 1.14.2). Green: full v14 fixture matrix green against the 1.14.2 executable with zero
assertion relaxations; message-text updates only where 1.14.2 texts fire.

### Slice 2 — Fixture evidence + docs + changeset

Owners:
- v14 fixture additions where cheap: `.openspec.yaml` with an `x-tracker` key asserts no
  unknown-key warning (and `X-Foo` still warns); a >16-level brace output pattern asserts the CLI's
  depth-rejection error where the harness builds one cheaply — otherwise report-level evidence.
- `AGENTS.md` evidence-map pin line -> 1.14.2 (`f80d860f`), historical list gains v1.14.1; README
  audit for explicit `1.14.1` runtime claims (expected none).
- `.changeset/*.md` — `openspecui` patch bump note.

## Verification Strategy

Focused: `pnpm --filter @openspecui/core exec vitest run src/official-cli-v14-*.test.ts` + pin
guards + `tsc --noEmit`. Broad gates serial before PR; vision-subagent ego-browser walkthrough
prepares the Owner's final walkthrough.
