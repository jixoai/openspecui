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

## Spec hygiene (Round-A B4)

Scenario titles inside MODIFIED deltas are **current-spec scenario identity**, preserved so archive refuses to
drop them; behavior is defined by the complete GIVEN/THEN bodies, not the titles. Titles such as
`SourceCraft Code Assistant enters at 1.12`, `Zed is a 1.10-line skills-only target`, or
`Accept the current 1.12 line` therefore describe _historical introduction or historical admission_, while
their bodies state the v13 semantics (admitted 1.13.x appears; older lines blocked/unavailable). Two facts an
implementer must not conflate: `minCliSeries: '1.12'` on SourceCraft is the physical introduction fact and
does NOT rotate; `AgentCliSeries` and the pinned generator DO rotate to the 1.13 line. A focused spec-review
checklist item (CP2/CP3) re-reads each renamed-semantics scenario before its slice lands.

## CP0 — Planning baseline (done before slices)

Worktree `openspecui-113` on branch `target-openspec-cli-113-line`; submodule `references/openspec` pinned to
`v1.13.0` (`9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`); evidence report written; change artifacts written;
committed before review. Round-A review (herdr `v13-change-reviewer`, gpt-5.6-terra xhigh, 2026-09-12,
5.8/10 REVISE) blockers B1–B4 are folded into the slices below.

## Slice 1 — Compatibility window and constants rotation

Owners:

- `packages/core/src/openspec-compat.ts` (+ `openspec-compat.test.ts`): `OPENSPECUI_TARGET_MAJOR = 13`;
  `OPENSPEC_CLI_TARGET_SERIES = '1.13'`; `SUPPORTED_SERIES = ['1.13']`; min/target/recommended `1.13.0`;
  `NEXT_SERIES_MIN_VERSION = '1.14.0'`; accepted/recommended ranges `>=1.13.0 <1.14.0`;
  `REFERENCE_TAG_PATTERN = 'v1.13.*'`; classification messages name v13.
- `scripts/diagnose-cli-runner.mjs` **and its test `scripts/diagnose-cli-runner.test.mjs`** (Round-A B3): the
  mirror `OPENSPEC_CLI_TARGET_SERIES = '1.12'` rotates to `'1.13'`; the test gains boundary assertions — a
  1.12.x probe resolution is rejected/flagged by the rotated mirror while the 1.13 fallback spec resolves.
- `scripts/setup-example.ts` (mirror `OPENSPEC_CLI_TARGET_SERIES`) and its callers/tests
  (`scripts/setup-example` consumers in `packages/cli` test expectations, Slice 6). Slice 1 green includes a
  static mirror assertion that the setup-example series constant equals the rotated value (Round-B n1).
- Header comments updated with the 2026-09-12 original request line.

Red (fixed command, per Round-A non-blocking 1): run
`pnpm --filter @openspecui/core test -- src/openspec-compat.test.ts` against the current assertions after
landing only the constants change — the 1.12-current classification and `>=1.12.0 <1.13.0` range assertions
fail with the recorded diff output (capture `vitest` failure text; do not mix typecheck failures into this
red). The new boundary fact: stable 1.12.x must classify `unsupported` with v13 ranges in the message.

Green: focused `src/openspec-compat.test.ts` plus `node --test scripts/diagnose-cli-runner.test.mjs` (or the
repo's runner for `.test.mjs`) green; record both commands.

## Slice 2 — Apply Instructions typed contract extension through the whole projection chain

Round-A B1: the decode schema alone does not carry the fields across the Kernel/Projection/Server boundary.
Owners (complete chain):

- `packages/core/src/cli-contracts/workflow.ts` (+ `packages/core/src/cli-contracts/workflow.test.ts`):
  `CliApplyInstructionsSuccessSchema` gains `missingPrerequisites: z.array(z.string()).optional()` and
  `warnings: z.array(z.string()).optional()`; contract tests parse the executed 1.13.0 documents embedded in
  the report (blocked with the four-id chain; ready with the one-warning array and `[specs, design]`).
- `packages/core/src/opsx-types.ts` (+ `packages/core/src/opsx-types.test.ts`): `ApplyInstructionsInputSchema`
  and `ApplyInstructionsProjectionSchema` gain the same optional members so the fields survive input decode
  and projection parse (today both schemas list only `missingArtifacts` and the members would be dropped).
- `packages/core/src/planning-cli-projection.ts`: no new branching — the projection copies the typed members
  through; add/extend its focused test to pin the pass-through.

Red (fixed command): extend `opsx-types.test.ts` first with a parse of the report's ready-state 1.13 payload
through `ApplyInstructionsProjectionSchema` asserting `warnings` survives — run
`pnpm --filter @openspecui/core test -- src/opsx-types.test.ts` and record the failing assertion (field
`undefined`) before touching production schemas.

Green: the three focused files green; `pnpm --filter @openspecui/core typecheck`; both new members stay
optional with no default empty arrays anywhere in Core → Server.

## Slice 3 — Server transport and Web surface

Round-A non-blocking 2: the exact render owner is locked before coding and recorded in `implementation.md`;
the candidate set from current code is fixed now:

- `packages/server/src/planning-cli-projection-service.ts` (+ `planning-cli-projection-service` test) and the
  `opsx` apply-instructions transport in `packages/server/src/router.ts` (+ `router.test.ts` apply-instruction
  cases): preserve the two fields as typed projection facts end-to-end.
- `packages/web/src/lib/use-opsx.ts` (typed hook surface) and the Change Detail apply-guidance render owners
  `packages/web/src/routes/change-view.tsx` + `packages/web/src/components/apply-progress-notice.tsx` (+
  `change-view.test.tsx`): `warnings` render on the direct plane with CLI provenance and exact upstream text;
  `missingPrerequisites` render as readable build-order next-step evidence, visually distinct from blockers.
  The implementer must verify which of the candidate components physically renders apply guidance and record
  the final owner file set in `implementation.md` before writing the component change. The Web test writes the
  three assertions as separate cases — direct-plane warning, next-step chain, absent-field degradation
  (Round-B n2).

Red: a Web component test feeding apply instructions with the report's ready-state warning asserts the warning
text appears in the direct plane — fails today because the projection drops the field (record the failing
assertion output).

Green: focused component test green; no horizontal overflow introduced (Change Detail evidence law).

## Slice 4 — Agent registry, generator staleness, and delivery evidence

Owners:

- `packages/core/src/agent-delivery-registry.ts` (+ its tests): `AgentCliSeries = '1.13'`;
  `resolveAgentCliSeries` admits `minor === 13`; registry header records that 1.13 carries forward every 1.12
  physical fact (no new tool entries upstream); `minCliSeries` values unchanged (SourceCraft stays `'1.12'` —
  a physical fact of its introduction, not an admission line; see Spec hygiene).
- `packages/core/src/tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION = '1.13.0'`; staleness comparison
  stays series-aware (1.13.x-generated artifacts not stale; 1.12.x-generated now below-admitted → stale).
- Registry/state tests (`agent-delivery-registry`, `tool-init-state`, server
  `agent-delivery-projection-service`, `agent-integrations-router`): rotate expected series/generator values.

Red: `tool-init-state.test.ts` staleness case asserting `generatedBy: 1.12.0` artifacts stay current fails once
the pinned generator rotates (below-admitted) — record before rewriting expectations.

Green: focused registry/state test files green.

## Slice 5 — Reference pin guard and the complete executable fixture matrix

Round-A B2: the positive matrix is the full v13 obligation, not two files. Owners:

- `scripts/prepare-openspec-reference.mjs`: `EXPECTED_COMMIT` → `9d4e5974e5c0d9a09b9c6c1e1eb0975e80ec4461`;
  header intents updated.
- `packages/core/src/upstream-contract-regression.test.ts`: the reference-commit pin assertion rotates from
  `e062b957...` to `9d4e5974...` (ZCode-found gap, same class as B2/B3).
- `packages/core/package.json`: add `"openspec-cli-113": "npm:@fission-ai/openspec@1.13.0"` (integrator-owned:
  lockfile regenerated once, centrally; acceptance evidence per Round-A non-blocking 3: `pnpm install` lockfile
  diff shows the new alias edge, and the installed shim resolves to
  `node_modules/openspec-cli-113/bin/openspec.js`).
- `packages/core/src/__tests__/official-cli-v13-fixtures.ts`: new helper mirroring the v12 helper (pinned bins
  map, isolated env, hidden-console runner, JSON stream discipline).
- **Full v13 positive matrix** — for every v12 positive suite that proves a still-accepted contract, a v13
  counterpart runs the same contract against the 1.13.0 executable (`openspec-cli-113`), each asserting
  `--version` provenance first:
  - `official-cli-v13-workflow-fixtures.test.ts` (from v12 workflow suite)
  - `official-cli-v13-default-store-fixtures.test.ts` (from v12 default-store suite)
  - `official-cli-v13-nested-spec-fixtures.test.ts` (from v12 nested-spec suite)
  - `official-cli-v13-show-diff-fixtures.test.ts` (from v12 show-diff suite)
  - `official-cli-v13-validation-full-fixtures.test.ts` (from v12 validation-full suite)
  - `official-cli-v13-validation-findings-fixtures.test.ts` (from v12 validation-findings suite)
  - `official-cli-v13-batch-status-fixtures.test.ts` (from v12 batch-status suite)
  - `official-cli-v13-agent-delivery-fixtures.test.ts` (from v12 agent-delivery suite; isolated default
    profile 6 skills + 6 commands parity)
  - **plus** `official-cli-v13-apply-readiness-fixtures.test.ts` (new): the two executed report scenarios —
    blocked chain `[proposal, specs, design, tasks]` and ready warning text — against a fixture repository
    created inside the test.
- Boundary role: the retained `openspec-cli-112` executable proves below-admitted rejections against the v13
  gate (`official-cli-v12-boundary-fixtures.test.ts` rotates its role; other v12 suites are retired from the
  positive matrix once their v13 counterparts land — deleted in this slice, not left as stale positives, with
  the retirement proven by `git diff --name-status` against the fixture inventory and no orphaned helper
  references, Round-B n3). The v11 helper and its boundary tests stay untouched.

Red: before the alias lands, the new v13 fixture files cannot resolve `openspec-cli-113/bin/openspec.js` —
record the resolution failure. Post-implementation mutation red: pointing a bins-map entry at the 112 alias
fails the `--version` identity assertion.

Green: all v13 fixture files green via
`pnpm --filter @openspecui/core test -- src/official-cli-v13-`; boundary suite green; the retired v12 positive
suites are deleted in the same commit as their v13 counterparts.

## Slice 6 — Cross-package window/copy alignment (grouped by owner class)

Round-A non-blocking 4: four independent red/green units instead of one wide gate:

1. Compatibility copy (Web): `cli-health-gate` (+test), `settings` diagnostics, `use-cli-runner`,
   `openspec-settings-diagnostics` (+tests) — mismatch-dialog copy and pinned-install spec strings.
2. Server evidence: `router.test.ts`, `root-context-cold-start.integration.test.ts`,
   `tool-subscription-router.test.ts`, `change-diff-evidence-service.test.ts`,
   `agent-delivery-projection-service.test.ts`, `cli-validate-findings-router.test.ts`.
3. Web evidence: `change-view.test.tsx`, `validation-findings-evidence` (+test),
   `archived-validation-evidence` (+test), `evidence-workspace` (+test).
4. CLI/scripts: `packages/cli/src/worktree-instance-manager.test.ts`, `scripts/setup-example.ts` consumers.

Red: run each group's focused files before the copy change and record the assertions that fail against the
new constants (range strings, series labels).

Green: each group's focused files green, recorded per group.

## Slice 7 — Release preparation (integrator-owned)

- `.changeset/*.md`: major bump for publishable packages (`@openspecui/core`, `@openspecui/server`,
  `@openspecui/web` private-check, `openspecui` CLI) describing the v13 line.
- README law: repository `README.md` version table gains the v13 line (`>=1.13.0 <1.14.0`); current
  documentation scoped to 1.13.x; historical archive links preserved; `packages/cli/README.md` updated in the
  same delivery scoped to the v13 line only.
- `AGENTS.md` architecture-decision entry for the v13 admission (after implementation settles).
- Full local gates: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`,
  `pnpm test:browser:ci` (or the justified scoped subset recorded in the PR notes).
- Known pre-existing environmental failure (not this change's regression, verified on unmodified `main`):
  `packages/core/src/reactive-fs/path-realpath.test.ts` — macOS `/var` vs `/private/var` TMPDIR symlink
  expectation. Recorded in PR notes as an upstream-of-this-change flake; not silently skipped.

## Batch topology

- Batch A (parallel): Slice 1, Slice 2, Slice 4 (disjoint file sets; Slice 2's schema files are not touched
  by 1 or 4).
- Batch B (parallel): Slice 3 (depends on Slice 2 schemas), Slice 5 (depends on Slice 1 constants for
  boundary negatives), Slice 6 (depends on Slice 1 constants).
- Batch C: Slice 7 integrator-only after A+B are green.
- Shared files (`package.json` devDeps, lockfile, AGENTS.md, README files, `.changeset/`) are integrator-owned.

## Stop-loss

Any slice whose red case cannot be produced honestly, or whose focused green fails twice for unrelated
reasons, escalates to integrator review before proceeding — per the 6.11 decomposition law, do not merge
unrelated defects into this change.
