<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Convert the verified 1.13 protocol delta into ordered implementation slices with owners and evidence.
2. Keep every slice red/green case executable against a named fixed point.
3. Record the parallel batch topology and the shared-file integrator rule.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

# OpenSpecUI 13 research plan

Evidence source: `references/openspec-1.13.0-report.md` (pinned `v1.13.0` @ `9d4e5974`). Every slice below names
its production owner, its red case (as it fails today, or the honest statement why a red cannot be captured
pre-implementation), and its green case.

## CP0 — Planning baseline (done before slices)

Worktree `openspecui-113` on branch `target-openspec-cli-113-line`; submodule `references/openspec` pinned to
`v1.13.0` (`9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`); evidence report written; change artifacts written;
committed before review.

## Slice 1 — Compatibility window and constants rotation

Owners:

- `packages/core/src/openspec-compat.ts` (+ `openspec-compat.test.ts`): `OPENSPECUI_TARGET_MAJOR = 13`;
  `OPENSPEC_CLI_TARGET_SERIES = '1.13'`; `SUPPORTED_SERIES = ['1.13']`; min/target/recommended `1.13.0`;
  `NEXT_SERIES_MIN_VERSION = '1.14.0'`; accepted/recommended ranges `>=1.13.0 <1.14.0`;
  `REFERENCE_TAG_PATTERN = 'v1.13.*'`; classification messages name v13.
- `scripts/diagnose-cli-runner.mjs` and `scripts/setup-example.ts`: `OPENSPEC_CLI_TARGET_SERIES` mirrors.
- Header comments updated with the 2026-09-12 original request line.

Red: `openspec-compat.test.ts` cases asserting 1.12-current classification and `>=1.12.0 <1.13.0` ranges fail
after the window moves (assertions are updated in the same slice; the red is captured by running the old
assertions against the new constants before rewriting them — record the failing output). Boundary facts: 1.12.x
stable must now classify `unsupported` with v13 ranges in the message.

Green: focused `pnpm --filter @openspecui/core test -- src/openspec-compat.test.ts`; then
`node scripts/diagnose-cli-runner.mjs --help`-level smoke (script parses; no full probe run required in the
slice).

## Slice 2 — Apply Instructions typed contract extension

Owners:

- `packages/core/src/cli-contracts/workflow.ts`: `CliApplyInstructionsSuccessSchema` gains
  `missingPrerequisites: z.array(z.string()).optional()` and `warnings: z.array(z.string()).optional()`.
- Contract tests in the same file's test owner (find the existing apply-instructions contract test file):
  parse the executed 1.13.0 documents embedded in the report (blocked with the four-id chain; ready with the
  one-warning array and `[specs, design]`).

Red: today the typed schema does not expose the fields, so a test asserting
`result.data.missingPrerequisites` on the pinned 1.13 payload fails to compile/assert — record the compile or
assertion failure before the schema change.

Green: focused contract test file green; `pnpm --filter @openspecui/core typecheck`.

## Slice 3 — Planning projection and Web surface

Owners:

- `packages/core/src/planning-cli-projection.ts` (+ its server projection service
  `packages/server/src/planning-cli-projection-service.ts`): preserve the two new fields as typed projection
  facts.
- Change Detail apply-guidance owner in `packages/web` (the Action-owned bounded Apply dialog plus the Change
  detail evidence regions): render `warnings` on the direct plane (CLI-owned provenance, exact upstream text,
  never fabricated when absent) and `missingPrerequisites` as readable build-order next-step evidence.

Red: a Web component test rendering apply instructions with a warning asserts the warning text appears in the
direct plane — fails today because the projection drops the field (record the failing assertion).

Green: focused component test green; no horizontal overflow introduced (Change Detail evidence law).

## Slice 4 — Agent registry, generator staleness, and delivery evidence

Owners:

- `packages/core/src/agent-delivery-registry.ts`: `AgentCliSeries = '1.13'`; `resolveAgentCliSeries` admits
  `minor === 13`; registry header records that 1.13 carries forward every 1.12 physical fact (no new tool
  entries upstream); `minCliSeries` values unchanged (SourceCraft stays `'1.12'` — a physical fact of its
  introduction).
- `packages/core/src/tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION = '1.13.0'`; staleness comparison
  stays series-aware (1.13.x-generated artifacts not stale; 1.12.x-generated now below-admitted → stale).
- Registry/state tests (`agent-delivery-registry`, `tool-init-state`, server
  `agent-delivery-projection-service`, `agent-integrations-router`): rotate expected series/generator values.

Red: `tool-init-state.test.ts` staleness case asserting `generatedBy: 1.12.0` artifacts stay current fails once
the pinned generator rotates (below-admitted) — record before rewriting expectations.

Green: focused registry/state test files green.

## Slice 5 — Reference pin guard and executable fixture matrix

Owners:

- `scripts/prepare-openspec-reference.mjs`: `EXPECTED_COMMIT` → `9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`;
  header intents updated.
- `packages/core/package.json`: add `"openspec-cli-113": "npm:@fission-ai/openspec@1.13.0"` (integrator-owned:
  lockfile regenerated once, centrally).
- `packages/core/src/__tests__/official-cli-v13-fixtures.ts`: new helper mirroring the v12 helper (pinned bins
  map, isolated env, hidden-console runner, JSON stream discipline).
- `packages/core/src/official-cli-v13-agent-delivery-fixtures.test.ts` and
  `official-cli-v13-batch-status-fixtures.test.ts` (new, mirroring the v12 pair): prove accepted contracts on
  1.13.0 — version identity, agent delivery inventory parity (6 skills + 6 commands isolated default profile),
  batch status envelope, requirement diff, findings report, and the new Apply Instructions fields against a
  fixture repository created inside the test.
- Existing `official-cli-v12-*` fixture tests: retain as boundary negatives only (the 1.12.0 executable must
  classify unsupported against the v13 gate); update their role comments accordingly. The v11 helper and its
  boundary tests stay untouched.

Red: before the alias lands, the new fixture test file cannot resolve `openspec-cli-113/bin/openspec.js` —
record the resolution failure. Post-implementation mutation red: pointing the bins map at the 112 alias fails
the `--version` identity assertion.

Green: focused v13 fixture tests green; `pnpm --filter @openspecui/core test -- src/official-cli-v13-...`.

## Slice 6 — Cross-package window/copy alignment

Owners:

- `packages/web` copy/tests referencing the v12 window (cli-health-gate, settings diagnostics, use-cli-runner,
  change-view, validation-findings, archived-validation, cli-validate-findings-router, evidence-workspace and
  their tests).
- `packages/server` router copy/tests (`router.test.ts`, `root-context-cold-start.integration.test.ts`,
  `tool-subscription-router.test.ts`, `change-diff-evidence-service.test.ts`,
  `agent-delivery-projection-service.test.ts`, `cli-validate-findings-router.test.ts`).
- `packages/cli` (`worktree-instance-manager.test.ts`) and `scripts/setup-example.ts` test expectations.
- Headers updated in every touched file.

Red: run the named focused test files before the copy change and record the mismatch-dialog/range assertions
that fail against the new constants.

Green: each named focused file green.

## Slice 7 — Release preparation (integrator-owned)

- `.changeset/*.md`: major bump for publishable packages (`@openspecui/core`, `@openspecui/server`,
  `@openspecui/web` private-check, `openspecui` CLI) describing the v13 line.
- README law: repository `README.md` version table gains the v13 line (`>=1.13.0 <1.14.0`); current
  documentation scoped to 1.13.x; historical archive links preserved; `packages/cli/README.md` updated in the
  same delivery scoped to the v13 line only.
- `AGENTS.md` architecture-decision entry for the v13 admission (after implementation settles).
- Full local gates: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci` (or the justified scoped subset recorded in the PR notes).

## Batch topology

- Batch A (parallel): Slice 1, Slice 2, Slice 4 (disjoint file sets; Slice 2's schema file is not touched by
  1 or 4).
- Batch B (parallel): Slice 3 (depends on Slice 2 schema), Slice 5 (depends on Slice 1 constants for boundary
  negatives), Slice 6 (depends on Slice 1 constants).
- Batch C: Slice 7 integrator-only after A+B are green.
- Shared files (`package.json` devDeps, lockfile, AGENTS.md, README files, `.changeset/`) are integrator-owned.

## Stop-loss

Any slice whose red case cannot be produced honestly, or whose focused green fails twice for unrelated
reasons, escalates to integrator review before proceeding — per the 6.11 decomposition law, do not merge
unrelated defects into this change.
