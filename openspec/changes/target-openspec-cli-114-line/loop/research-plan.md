<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Convert the verified 1.14 protocol delta into ordered implementation slices with owners and evidence.
2. Keep every slice red/green case executable against a named fixed point.
3. Record batch topology and the shared-file integrator rule.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

# OpenSpecUI 14 research plan

Evidence: `references/openspec-1.14.0-report.md` (pinned `v1.14.0` @ `94ca9c1e`; executed npm observations).

## Spec hygiene

**Known legacy (recorded, not silently kept):** several inherited scenario titles read "Accept <retired
line>" while their bodies (correctly) specify blocked-by-default for OpenSpecUI 14. Titles are scenario
identity that archive refuses to drop, and the validator offers no verified rename path today; renaming
them speculatively risks archive rejection. Disposition: bodies remain the normative text; this change
proposes a separate spec-hygiene change to verify a rename/retirement process on an isolated copy before
touching live specs (Owner decision). New scenarios added by this change never carry a title whose meaning
their body contradicts.

Scenario titles are current-spec identity (archive refuses drops); bodies carry v14 semantics. Historical
titles ("Zed is a 1.10-line skills-only target", "SourceCraft enters at 1.12") describe introduction facts;
`minCliSeries` values never rotate while `AgentCliSeries` does.

## Slice 1 — Compatibility window and mirrors

Owners: `packages/core/src/openspec-compat.ts`(+test) — MAJOR 14, series `'1.14'`, ranges
`>=1.14.0 <1.15.0`, NEXT_SERIES `'1.15.0'`, tag pattern `v1.14.*`; `scripts/diagnose-cli-runner.mjs`(+test)
and `scripts/setup-example.ts` mirrors with boundary assertions (1.13 rejected / 1.14 accepted).
Red: constants-first run against current assertions (record 5+ failures incl. stable 1.13.x → unsupported).
Green: compat + diagnose focused tests; core typecheck.

## Slice 2 — Typed contracts through the full projection chains (Round-A B1/B2 hardened)

Owners (complete chains, v13-B1 lesson; every "projection" claim names the physical copy site):

- Apply tasks: `cli-contracts/workflow.ts` `CliApplyTaskSchema` + `opsx-types.ts` `ApplyTaskSchema` gain
  optional `sourcePath`/`line`; contract tests pin the executed 1.14 payload (both members present, absolute
  path, 1-based line) plus an older-shape payload without them.
- Status warnings — **full chain including the kernel rebuild**: `CliWorkflowStatusSuccessSchema` (single) and
  the batch envelope schema gain optional top-level `warnings: string[]`; `opsx-types.ts` status
  input/projection schemas likewise; and `packages/core/src/opsx-kernel.ts` `projectWorkflowStatus` (the
  explicit `ChangeStatusSchema.parse({...})` object rebuild used by BOTH the single and batch status paths)
  MUST copy `data.warnings` through — decode-time `.passthrough()` is stripped there today (Round-A B2).
  Server transport (`planning-cli-projection-service`/router status procedures) carries the member by
  schema, pinned by test. Red: a real 1.14 status payload (the executed `skip_design` warning, full string
  in the report) driven through the Kernel single AND batch paths, asserting the verbatim string at the
  Server-visible projection output — fails today; absent member stays absent (UI synthesizes nothing).
- List members: the change-list CLI contract gains the ONE new member `archived` (per-entry optional);
  `nested` and top-level `warnings` are 1.13.1 members already covered by the existing nested-directory
  contract — v14 only migrates their fixtures (no second ownership).
- Show spec names (Round-A B1): `cli-contracts/workflow.ts` `CliSpecRequirementSchema` and its scenario
  schema gain optional `name`; the Spec Catalog chain (`CliShowSpecDocument` consumers, server spec
  transports) preserves both names by CLI value. Tests: a real 1.14 `show <spec> --type spec --json`
  document asserts requirement and scenario names; an old-shape document without names still parses with
  the members absent; a non-string `name` is rejected rather than silently accepted.
- Version command: a new typed contract for `{schemaVersion:1, version, install, update?}` with an executor
  method (`version({check})`); no capability flag (admitted-window invariant).
- Store edit roots: no schema change (same array shape) — BOTH branches are executable-fixture obligations
  in Slice 5 (declaring-project branch `[implementationRoot, projectRoot]`; no-declaring-project branch
  `[projectRoot]` with the ask-the-user constraint; plus the non-store control).

Red: schema-drop reds per surface (parse executed payloads through the projection schema asserting the
member survives; fails today) plus the kernel-rebuild red above. Green: contract + opsx-types + kernel
focused tests; core typecheck.

## Slice 3 — Agent registry rotation (largest slice)

Baseline note: the 2026-09-27 `update-openspec-cli-1132` change already rotated the Kilo Code command root
to `.kilo/command/` — that physical fact carries forward unchanged. This slice rotates the series and adds
the ten 1.14 entries.

Owners: `packages/core/src/agent-delivery-registry.ts`(+test): `AgentCliSeries = '1.14'` (minor 13 → 14 in
the resolver), provenance union retains `'1.12'`/`'1.13'`; **ten new entries** in official order —
`amp` (`.agents` root, detection `.amp`), `gsd` (`.agents` root, detection `.gsd`), `atomcode`, `codestudio`
(restart true), `dsh` (skills-only), `easycode` (TOML commands), `gigacode`, `grok` (skills-only), `veai`
(skills-only), `warp` (detection `WARP.md`); label `IBM Bob`; Devin Desktop "(formerly Windsurf)" label
note. `tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION = '1.14.0'`; series-aware staleness
(1.13.x-generated → stale). Server tests rotate (`agent-delivery-projection-service`,
`agent-integrations-router`, agent parts of `tool-subscription-router`).

Red: rotate PINNED first, record the 1.13.0-generated-stays-current assertion failures.
Green: registry/state suites + server agent suites.

## Slice 4 — Status warnings Web surface

Owners: `packages/web/src/routes/change-view.tsx` status region + the v13 summary-row component pattern
(`apply-progress-notice.tsx` or a sibling advisory component): status `warnings` render as ONE always-visible
summary row (count + CLI attribution) with verbatim expansion; absent member degrades silently; never gates
actions.

Red: component test asserting the row before the render change. Green: focused web tests + typecheck.

## Slice 5 — Reference pin and the complete fixture matrix

Owners: `scripts/prepare-openspec-reference.mjs` EXPECTED_COMMIT → `94ca9c1e...`;
`upstream-contract-regression.test.ts` pin rotation; `packages/web/scripts/w2-project-binding-playwright.ts`
pin; `packages/core/package.json` alias `"openspec-cli-114": "npm:@fission-ai/openspec@1.14.0"` (integrator
lockfile); `__tests__/official-cli-v14-fixtures.ts` helper.

**File-level matrix (Round-A B5 — counts resolve to exactly this list):**

Migrate (11 existing `official-cli-v13-*.test.ts`, each becoming its v14 counterpart on the 1.14.0
executable with `--version` provenance; `apply-readiness` KEEPS the 1132 tracking cases —
`taskTrackingConfigured`/`unavailableTrackingFiles` — as regression, not re-implementation — and additionally
asserts task `sourcePath`/`line`): `agent-delivery`, `apply-readiness`, `batch-status`, `default-store`,
`nested-change`, `nested-spec`, `show-diff`, `task-reading`, `validation-findings`, `validation-full`,
`workflow`.

New (2): `v14-version-report` (no-check envelope only, per no-network fixture discipline) and
`v14-change-list-inventory` (`--archived` and `--all`: archived entries `archived:true`, mixed `--all`
entries `archived:false/true`; nested regression kept in `nested-change`'s counterpart). Show-name contract
evidence lives in the `show-diff` counterpart (scope widened to the `show` suite) — it runs BOTH
`show <change> --json --diff` (existing) and `show <spec> --type spec --json` name assertions (new).

Boundary (Round-A B4, Round-B B1/B2): the **1.13.2 executable (`openspec-cli-113` alias) proves the v14
gate rejects the just-retired line** — `official-cli-v12-boundary-fixtures.test.ts` is replaced by
`official-cli-v13-boundary-fixtures.test.ts` asserting: `--version` = 1.13.2 identity, the unsupported
classification against the v14 gate, and that the **1.14-only members are absent from 1.13.2 output**
(task `sourcePath`/`line`, list `archived`, show names, status `warnings`) — it never claims v13-era members
(taskTrackingConfigured etc.) are absent, they are 1.13.2's own. The v12 boundary suite and the v12 fixture
helper retire (deletion proof `git diff --name-status` + orphan scan); **the `openspec-cli-112` npm alias
stays installed** — `tool-init-state.test.ts` and `agent-command-content.test.ts` consume it as historical
generator evidence outside this matrix (Round-B B2); pre-delete check `rg -n 'openspec-cli-112'
packages/core/src` must show only those two historical consumers. Store edit-roots (Round-A B3): inside the `default-store`
counterpart (the suite that already builds a registered store), two executable scenarios assert the
declaring-project branch (`[implementationRoot, projectRoot]` order + the declaring-repo constraint) and the
no-declaring-project branch (`[projectRoot]` + ask-the-user constraint), beside the existing non-store
control.

Red: alias-resolution failure before install; pin-guard failure before rotation; boundary suite fails while
the gate still admits 1.13 (record the ordering honestly — boundary lands after Slice 1).
Green: joint v14 gate (13 files) + boundary + upstream-contract-regression; core typecheck; lockfile diff +
shim check. Mutation red: bins-map → wrong alias fails `--version` identity.


## Slice 6 — Cross-package alignment (four owner groups)

1. Web compat copy: `cli-health-gate`(+test), settings diagnostics, `use-cli-runner` — ranges/labels derive
   from shared constants; rotate literal expectations (1.13→1.14, retired window now includes 1.13).
2. Server evidence: `router.test.ts`, `change-diff-evidence-service.test.ts`,
   `cli-validate-findings-router.test.ts`, `root-context-cold-start.integration.test.ts` (commit pin),
   `tool-subscription-router.test.ts` compat assertion.
3. Web evidence: `change-view.test.tsx` admitted fixtures, `validation-findings-evidence`(+test),
   `archived-validation-evidence`(+test).
4. CLI/scripts: `worktree-instance-manager.test.ts`, setup-example consumers.

Red/green per group, recorded separately.

## Slice 7 — Release preparation (integrator)

Changeset (major: core/server/web/openspecui); README law (repo en/zh `@^13` row + archived 1.13 copies +
CLI package README scoped to v14); CLAUDE.md pointer to the 1.14 report; AGENTS.md architecture decision +
submodule pin line. Full gates: format/lint/typecheck/browser + per-package test runs (explicit list, not
recursive-only); disclose pre-existing flakes honestly (path-realpath, load-sensitive startup timing).

## Batch topology

- Batch A (parallel): Slices 1, 2, 3 (disjoint file sets).
- Batch B (parallel): Slices 4, 5, 6 (each depends only on Batch A constants/schemas).
- Batch C: Slice 7 integrator-only.

## Stop-loss

Any slice whose red cannot be produced honestly, or whose focused green fails twice for unrelated reasons,
escalates before proceeding; no unrelated defects merge into this change.
