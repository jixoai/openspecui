<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Keep implementation reality synchronized with the approved research plan.
2. Record scope updates, key decisions, and loopback triggers as they happen.
-->

## Implementation Log

### CP0 — Planning (2026-10-29)

- Evidence report `references/openspec-1.15.0-report.md` completed from three
  parallel investigations (1.14.2/1.14.3 inventory, 1.15.0 deep dive,
  OpenSpecUI rotation-surface map) plus executed-CLI evidence against fresh
  npm installs of 1.15.0 (positive) and 1.14.3 (boundary).
- Worktree `openspecui-cli-115-line` on branch `target-openspec-cli-115-line`;
  submodule gitlink pinned to `v1.15.0` (`8e0288df`) and staged.
- Change artifacts: intake → research-plan → implementation → checkpoints.

### Phase execution

<!-- Appended per phase: P0 pin barrier, P1 core contracts, P2 registry,
     P3 fixtures, P4 server/web/cli + docs. Record deviations as loopback
     triggers with the decision that resolved them. -->

### Pause point (2026-10-29 ~14:40, owner request: stop until 18:00)

Completed and verified before the pause:

- P0 pin barrier DONE + verified: gitlink `v1.15.0` (`8e0288df`) staged;
  `prepare-openspec-reference.mjs` + `upstream-contract-regression.test.ts`
  (8/8 green incl. new UpdatePlan source anchors) + server cold-start and W2
  playwright pin guards rotated; stale `check-openspec-reference.mjs`
  repaired (prints `OK: v1.15.0`).
- P1 core contracts DONE: `openspec-compat.ts` window/capability
  (`updateDryRun`) + tests 10/10 green; `CliUpdatePlanSchema` family +
  `install.scope` `'standalone'` + typed `updatePlan` executor method;
  `setup-example.ts` mirror rotated. Mirrored `config.ts` needs no edit
  (imports the series constant).
- P2 registry constants DONE (series '1.15', provenance union, order map,
  parser, staleness baseline `1.15.0`, headers); core `typecheck` all lanes
  green.
- P3 partially DONE: `openspec-cli-115` alias (1.15.0) + `openspec-cli-114`
  rotated to 1.14.3, installed and version-verified; new
  `official-cli-v15-fixtures.ts` helper written.

Interrupted mid-flight (resume from here):

- Fixture-migration subagent was stopped after completing only **2 of 15** (the 15th being opsx-kernel-schemas-root, counted 13 renames among the v14-named files)
  files (`official-cli-v14-agent-delivery-fixtures.test.ts`,
  `-apply-readiness-`); the remaining 13 positive-matrix files, the v13
  boundary retirement, and the new v14 boundary suite are NOT done. Re-dispatch
  with the same brief (git status shows exactly which files it touched).
- `tool-init-state.test.ts` translation NOT applied (my edit aborted safely on
  an assertion before writing; file clean). Plan: rotate the 15 `'1.14.0'`
  stamps expecting `initialized` to `'1.15.0'`; runtime-match pair to
  `'1.15.3'`/`'1.15.1'`; every-stable-patch test to `1.15.x`; below-admitted
  list gains `'1.14.2'`; retired-series list gains `'1.14.1'`; registry
  selection `'1.14.2'`→`'1.15.2'` (`registry114`→`registry115`); pinned
  fallback expectations `'1.14.0'`→`'1.15.0'`; header per law. Then rerun the
  focused file (was 14 failed / 14 passed pre-rotation — all failures are the
  expected new-currency staleness).
- Known pre-pause fallout to re-check after P3: `agent-delivery-registry.test.ts`,
  `agent-command-content.test.ts`, `cli-contracts/workflow.test.ts` (UpdatePlan
  contract tests not yet written), plus P4 (server dry-run preview + web) and
  P5 (docs/changeset) entirely.

### Resumed (2026-10-29 18:05, scheduled automation)

- P3 finished: remaining 13 positive-matrix files migrated and individually run green
  (34 fixture tests total against the pinned 1.15.0 executable); v13 boundary suite
  retired; new `official-cli-v14-boundary-fixtures.test.ts` proves 1.14.3 identity,
  unsupported classification, `--dry-run` rejection both plain and `--json`, and the
  admitted-line three-key plan contrast (never asserting v14-era member absence);
  `tsconfig.workflow-contract-tests.json` lane entries rotated; positive files renamed
  `official-cli-v14-*` → `official-cli-v15-*` via git mv with all four tsconfig lanes
  rotated (boundary name preserved); the zero-consumer v14 helper retired per the
  v12/v13-helper precedent.
- `tool-init-state.test.ts` currency rotated (28/28 green: stamps/runtime to 1.15.x,
  '1.14.2' joins below-admitted, '1.14.1' joins retired-series selection);
  `agent-delivery-registry.test.ts` rotated (58/58); workflow contract tests rotated to
  `capabilities115` and gained the UpdatePlan contract lock (69/69).
- P4 server: `agentIntegrations.updatePlanPreview` read transport through
  `runPlanningRootRead` + the typed gated executor, with a 4-test router lane
  (`agent-update-plan-preview-router.test.ts`) covering executed plan argv/force,
  exit-0-with-failures data semantics, the `update_error` envelope beside exit 1, and
  the pre-argv unavailable refusal; server findings-router fixtures rotated to 1.15.
- P4 web: `AgentIntegrationsCommandDialog` gains the preview evidence section (action
  chips, wrapped mono paths, notes by code, amber would-fail rows, failed-command alert,
  muted unavailable line) fed by `config-agents.tsx` fetching
  `agentIntegrations.updatePlanPreview` when Update/Repair opens; 4 browser-lane tests
  green; `change-view.test.tsx` admitted fixture rotated to 1.15.
- P5 docs: README.md/README-zh.md tables+narrative+compat sections rotated with
  verbatim legacy snapshots (README-1.14.0.md / README-zh-1.14.0.md);
  `packages/cli/README.md` rotated; AGENTS.md gains the v15 architecture decision plus
  pin bullet and clean-build law rotation; changeset `openspec-115-line-adaptation.md`
  (major ×4); living spec `openspec-cli-integration` admission law rotated with the new
  "Accept the current 1.14 line" era scenario.
- Full-gate fallout fixed: `opsx-kernel-cli-projection.test.ts` fixture seam rotates
  (admitted model 1.15.0 / retired model 1.14.0, fake gate `startsWith('1.15')`,
  18/18 green); server admitted-version fixtures rotate in
  `tool-subscription-router` / `agent-delivery-projection-service` /
  `change-diff-evidence-service` tests (versions, generatedBy stamps, install-command
  assertion; 23/23 green); `prepare-openspec-reference.mjs` run locally to build the
  pinned dist for the runner-fixture lanes (exit 0 at the new SHA).

### Adversarial review round 1 (independent subagent, 2026-10-29 evening)

Score 8/10 (first-round baseline; contract fidelity, gate discipline, fixture rules,
and honesty laws all verified against upstream source). Findings and resolution:

- P1 living-spec contradiction (the "Accept the current 1.13 line" scenario kept the
  v14 range literal) — fixed to `>=1.15.0 <1.16.0`; the grep gate now truly runs clean.
- P2-1 stale AGENTS.md release-README-law parenthetical ("v14 today") — rotated to v15.
- P2-2 flagship contract lacked a real-binary non-empty plan positive — new
  `official-cli-v15-update-plan-fixtures.test.ts` proves init→corrupt/delete→plan
  (`update`+`add` rows, sorted, disk unwritten) → settle → empty re-plan (green), and
  the workflow-contract typecheck lane registers it.
- P3 batch: stale v14 wording in cli-health-gate/settings-diagnostics headers and the
  cold-start describe title rotated; dialog empty-plan branch now renders notes;
  config-agents preview fetch gains a generation guard so a late closed-dialog
  response can never repaint the newer dialog; loop counts reconciled (13 renames).
- Environmental repair (no committed change): the worktree's better-sqlite3 native
  binary was fetched for the wrong ABI; the v22 prebuilt restored the translation-cache
  lane locally.

### Delivery (2026-10-29 night)

- Full gates: format:check (70 files), lint:ci (0 errors), typecheck all four packages
  (all lanes), core 859 passed, server 673 passed + 2 skipped, web unit 1232 passed,
  dialog browser lane 4/4, prepare script builds at 8e0288df, reference check prints
  `OK: v1.15.0`.
- Three-commit delivery on `target-openspec-cli-115-line`: core rotation
  (1f0648d9), server/web preview + fixture rotation (6f161f91), docs/governance
  (a0bef65f). PR #315 opened with the evidence summary.
- Residual watch item for CI: none known; the worktree-local better-sqlite3 ABI repair
  is environment-only and touches nothing committed.
