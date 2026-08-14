<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Record source- and CLI-backed OpenSpec 1.8/1.9 research facts.
2. Define the approved OpenSpecUI 9 compatibility decision and procedural implementation topology.
3. Assign one production owner and exact red/green evidence to each implementation slice.
4. State risk, validation, release, and Owner-only acceptance boundaries.

Original request (2026-08-15): "这次v9的适配需要同时适配 1.8和1.9。"
-->

# OpenSpecUI 9 research and implementation plan

## Research Findings

The full evidence is recorded in `references/openspec-1.9.0-report.md`. The planning-critical facts are:

```text
CLI 1.8 / 1.9 status
  isPlanningComplete = planning artifacts are complete
  isComplete         = retained upstream alias; not implementation completion

CLI 1.8 / 1.9 apply
  progress            = exact checkbox total/completion truth
  tasks               = actionable descriptions only; may omit blank-description checkboxes

CLI 1.9 schemas
  success             = SchemaInfo[]
  selected-root error = { schemas: [], root: null, status }

CLI 1.9 validation
  validate --archived --json = normal validation-report envelope
```

The pinned v1.9 source additionally establishes the official Agent roots and metadata: Codex uses `.agents` with
`.codex` as a legacy detection/migration root; MiniMax Code uses the user-global `~/.minimax/skills`; Rovo Dev,
Shared `.agents` skills, and Command Code are distinct official targets; and some IDE integrations require a
restart notice. Archive remains entirely CLI-owned, including `retire_capabilities`, scenario-loss checks, and
duplicate-requirement rejection.

The current OpenSpecUI 7 source is intentionally single-line 1.7-only:

```text
packages/core/src/openspec-compat.ts
  accepted:    >=1.7.0 <1.8.0
  recommended: >=1.7.0 <1.8.0

packages/core/src/cli-contracts/workflow.ts
  schemas: bare array only
  status:  isComplete only

packages/core/src/tool-init-state.ts
  generator evidence pinned to 1.7.0
```

## Decision & Plan (For Approval)

### Compatibility law

```text
                    stable 1.8.x             stable 1.9.x
OpenSpecUI 9         supported                current + recommended
Admission             allowed                  allowed
Compatibility badge   supported non-current    current

all prereleases, <1.8.0, >=1.10.0, unknown -> blocked by default
```

The existing current-page-only version-bypass law remains unchanged. Bypass never rewrites compatibility evidence
or support claims and does not conceal later protocol failures.

### Procedural topology

```text
pinned 1.8 / 1.9 executable fixtures
                 |
                 v
Core CLI contracts + compatibility classification
                 |
                 +------------------+-------------------+
                 v                  v                   v
workflow projection       Agent physical projection    archive evidence
                 |                  |                   |
                 +------------------+-------------------+
                                    v
                         Server reactive read model
                                    |
                                    v
                    Web / Config / Change Evidence owners
                                    |
                                    v
                    focused owner review -> package gates -> Owner acceptance
```

### Ordered implementation slices

| Order | Slice and production owner | Precise red case | Green case and focused gate |
| --- | --- | --- | --- |
| 1 | `packages/core/src/openspec-compat.ts` and compatibility UI copy | `1.8.0` is blocked or `1.9.0-rc.1` is admitted | `1.8.x` is supported non-current; `1.9.x` current; all rejected lines block. Run `openspec-compat.test.ts` before touching broader UI tests. |
| 2 | `packages/core/src/cli-contracts/workflow.ts`, `executor.ts`, `cli-executor.ts` | a valid schema failure object is parsed as an array or crashes Config; a v1.9 archived validation report is rejected | typed discriminated success/failure contracts preserve diagnostics/root null and normal validate report. Run workflow/executor contract tests. |
| 3 | Core OPSX types/task progress plus Server workflow invocation/read-model owners | a fully planned Change is presented as Apply-complete; blank/indented checkbox tasks make displayed totals disagree with CLI progress | `isPlanningComplete` drives planning readiness only; Apply `progress` remains the task denominator and local checklist divergence stays explicit. Run Core/Server workflow and task tests. |
| 4 | `agent-delivery-registry.ts`, `tool-init-state.ts`, Agent command content, and `agent-delivery-projection-service.ts` | Codex `.agents` is missed, `.codex` is treated as current, MiniMax global root is projected as project-local, or Command Code/Rovo Dev is absent | physical expected/present/legacy/migration/cleanup evidence is exact for 1.8/1.9 inventory; official CLI owns mutations. Run registry/state/service tests. |
| 5 | Config Agent page and Change Archive/Evidence owners | Agent restart/global-root facts disappear in UI; archive warning/retirement or `--archived` failure is rendered as success | Config shows objective state without parallel mutation owner; Change Evidence preserves CLI-owned result, diagnostics, and provenance. Run focused Web component tests. |
| 6 | Real fixture harnesses under Core/Server | a hand-authored 1.7 fixture is used to prove 1.8/1.9 behavior | pinned 1.8.0 and 1.9.0 executable fixture matrix proves every accepted contract and source label. Run matrix tests independently first. |
| 7 | Changesets, changelogs, package build/pack scripts, reference pin | source tests pass while packed CLI/Web assets still carry v7 gate | one v9 major Changeset and generated package evidence prove source and distribution shape. No publish/release action. |

Slice 6 may prepare the fixture runner before earlier slices, but its assertions must land with the owner slice they
prove. Slice 7 starts only after focused checks for slices 1-6 pass. No broad gate is a substitute for a failed
focused owner review.

### Required implementation decisions

1. Replace the binary `current | unsupported | unknown` compatibility model with a representation that can express
   accepted-but-non-current 1.8.x without weakening the block condition. All public copy must name the accepted
   range and recommended line precisely.
2. Model `schemas --json` as a sum type. Successful schema information and a selected-root failure must remain
   distinct through Core, Server, Web, and static/read-only boundaries; an error is never an empty successful
   catalog.
3. Treat `isPlanningComplete` as the required status field for v9 fixtures. Retain upstream `isComplete` only as
   raw compatibility evidence where useful; never infer task completion from either field.
4. Keep the existing `instructions apply` progress source. Do not patch around upstream parser semantics by
   filtering/recounting the returned `tasks` list.
5. Rebuild OpenSpecUI's Agent registry from the v1.8/v1.9 official registry rather than making one-off additions.
   Model `skillsDir`, `legacySkillsDirs`, `globalSkillsDir`, detection paths, command adapter path, and IDE restart
   metadata explicitly. Observe global roots safely; never make project cleanup delete them directly.
6. Make archive validation and retirement evidence a typed CLI result. The only destructive command remains the
   official CLI, after user confirmation through the existing action owner.
7. Keep v9 static output source-aware: static exports may publish captured compatibility/policy facts but must not
   fabricate live CLI validation, archive, or Agent filesystem evidence.

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI 9 admits stable CLI 1.8.x and 1.9.x, and recommends 1.9.x.
- Workflow projection distinguishes planning completion from implementation progress.
- Config consumes typed Schema-resolution failures and preserves diagnostics.
- Agent delivery projection exposes v1.8/v1.9 official roots, paths, restart metadata, migration, and cleanup.
- Change Evidence can present `validate --archived --json` results and archive retirement warnings faithfully.

### Modified Behavior

- 1.7.x changes from adapted to blocked in OpenSpecUI 9.
- Existing 1.7-pinned agent generator/version expectations move to real 1.8/1.9 fixture facts.
- Any UI using a generic `isComplete` label must become explicit about planning versus Apply task state.

## Risks and Mitigations

| Risk | Mitigation |
| --- | --- |
| 1.8 passes admission but is only tested against 1.9 | pin and execute separate 1.8.0/1.9.0 fixture cases for every accepted JSON contract. |
| Array-only schema parser converts failure into a crash or empty state | use a typed union with a red failure-envelope fixture; retain last known good only as display history. |
| Agent migration deletes user state or writes wrong physical scope | display mutation plan/evidence from official CLI; only observe project and allowlisted global paths. |
| Archive warnings become false success | preserve exit status, diagnostics, root, and warning payload without locally replaying archive. |
| Green source test hides stale distributable output | build Web/App/CLI, pack the CLI, install the tarball in an isolated temporary directory, and inspect the installed admission path. |
| `validate --all` is red for historical work | validate this Change directly and record unrelated failures as baseline constraints. |

## Verification Strategy

```text
per slice:
  red regression -> production owner change -> green focused test -> focused review

after all slices:
  typecheck/lint/test affected packages
  build Web/App/CLI
  pack and isolated-install openspecui tarball
  verify packaged v9 compatibility artifacts
  changeset and changelog review

owner boundary:
  manual browser/App walkthrough, PR approval, merge, release, archive
```

Implementation agents must record the exact commands and outputs in `loop/implementation.md` and update only the
relevant checkpoint when its evidence exists. Browser tests, Storybook tests, and agent-run Playwright are
preparation evidence only; they must not mark the Owner final acceptance checkpoint complete.
