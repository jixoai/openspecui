<!--
Orthogonal intents (updated 2026-08-15 Asia/Shanghai):
1. Record the verified OpenSpec 1.8 and 1.9 protocol baseline for OpenSpecUI 9 planning.
2. Separate upstream CLI-owned behavior from OpenSpecUI projection and admission responsibilities.
3. Map each observable protocol change to a production owner, exact regression case, and release gate.
4. Preserve the external validation constraints that the v9 Change must not silently repair.

Original request (2026-08-15): "openspec 已经升级到1.9 ，我们目前的适配还在1.7 . 不过这两次版本更不不算大，请你准备我们openspecui v9的开发，直接跳过1.8的适配。"
-->

# OpenSpec 1.8 + 1.9 -> OpenSpecUI 9 adaptation report

## Decision

```text
OpenSpecUI 9
  adapted / supported      OpenSpec CLI >=1.8.0 <1.10.0
  current / recommended    OpenSpec CLI >=1.9.0 <1.10.0
  supported, non-current   OpenSpec CLI 1.8.x
  rejected                 <1.8.0, prereleases, >=1.10.0, unparseable
```

OpenSpecUI 9 deliberately skips a separate v8 release. It is not a 1.9-only gate: every behavior accepted by the
v9 admission range is an implementation and fixture obligation. `1.8.x` is supported non-current, not a legacy
escape hatch.

## Evidence baseline

```text
Observed                 2026-08-15 Asia/Shanghai
Package                  @fission-ai/openspec
npm latest               1.9.0
Reference repository     references/openspec
Pinned tag               v1.9.0
Pinned commit            2826b8889e5223a9a8095d4428b60b56597e1020
Previous OpenSpecUI pin  v1.7.0 / 4e16790d90d8f54d4773ad9a5e71a57cd9f1e86b
Current OpenSpecUI line  7.x
```

Sources inspected:

- `references/openspec/src/commands/workflow/status.ts` and workflow templates for planning completion.
- `references/openspec/src/utils/task-progress.ts` for checkbox counting and Apply task projection.
- `references/openspec/src/commands/workflow/schemas.ts` for successful and failure JSON shapes.
- `references/openspec/src/commands/validate.ts` and validation/archive sources for archived validation and
  retirement protection.
- `references/openspec/src/core/config.ts`, `docs/agent-contract.md`, and the Command Code adapter for Agent
  inventory and physical delivery metadata.
- Current OpenSpecUI owners and tests under `packages/core`, `packages/server`, and `packages/web`.

## Verified CLI observations

All commands below used the published executable, not a source-only inference:

```text
npm exec --yes --package=@fission-ai/openspec@<version> -- openspec <command>
```

| Command and fixture | 1.7.x | 1.8.x | 1.9.x | v9 consequence |
| --- | --- | --- | --- | --- |
| `status --change integrate-app-mode-with-opentray --json` | `isComplete` | `isPlanningComplete` and `isComplete` | same | Planning completion is explicit protocol truth. |
| `schemas --json` from a resolved root | bare array | bare array | bare array | Preserve successful array parsing. |
| schema resolution failure as JSON | older shape not v9 scope | root-selection transition | `{ schemas: [], root: null, status }` | Accept typed failure envelope without asserting schemas are available. |
| `instructions apply --json` with indented and blank checkbox tasks | older parser behavior | totals count every checkbox; task list omits blank descriptions | same | `progress` is authoritative; do not recompute totals from actionable tasks. |
| `validate --archived --json` | unknown option | unknown option | validation report; incomplete archived task files fail | Add 1.9 executor/contract/evidence support only. |

The v1.9 command run against this repository also proves `validate --archived --json` reports archived task
incompleteness using the ordinary validation-report envelope. The same run finds historical archived Changes with
incomplete tasks. That is pre-existing repository evidence, not a v9 implementation defect.

`validate --all --json` on 1.8 and 1.9 additionally finds missing-scenario errors in the unrelated active
`reshape-app-workspaces-and-stores` Change. The v9 work must use targeted validation of
`target-openspec-cli-19-line`; it must not modify either unrelated Change merely to turn a whole-repository command
green.

## Protocol delta

```text
1.8
  +-- status.isPlanningComplete
  +-- parser-level checkbox total truth
  +-- Agent delivery: .agents, MiniMax global skills, Rovo Dev
  +-- archive retirement / scenario-loss / duplicate-requirement protections
  `-- root-selection and Schema-resolution error semantics

1.9
  +-- Command Code Agent adapter
  +-- validate --archived --json
  +-- canonical selected-Root failure envelope for schemas
  `-- retained 1.8 protocol obligations
```

### 1. Planning completion is not implementation completion

`isPlanningComplete` tells a client that required planning artifacts are present. It does not certify Apply tasks,
validation, sync, archive, or release. `instructions apply --json` remains the source for implementation progress.
OpenSpecUI must stop using ambiguous completion naming in its internal workflow projection and visual summary.

### 2. Task listing and task totals are intentionally not equivalent

The upstream parser counts indented checkboxes and empty-description checkbox lines in `progress`. The JSON `tasks`
array hides empty-description entries because it is an actionable presentation list. A projection that uses
`tasks.length` as a denominator silently lies. The exact CLI `progress.{total,complete,remaining}` fields remain
the product's primary implementation-progress fact; local parsed checklists remain separately labeled analytics.

### 3. `schemas --json` has a sum type

Success remains a bare `SchemaInfo[]`. A root-selection failure is a JSON object containing an empty schema list,
`root: null`, and diagnostic `status`. Treating every payload as an array turns an objective failure into a Zod
exception or a misleading empty Config catalog. The v9 contract must decode success and failure separately and
carry the failure through the existing last-known-good/reactive-error path.

### 4. Agent delivery is a physical artifact protocol

The official registry now contains fields OpenSpecUI 7 does not model consistently:

```text
Codex          current project skills: .agents/skills
               legacy observation:    .codex/skills
MiniMax Code   global skills root:     ~/.minimax/skills
Rovo Dev CLI   project skills root:    .rovodev/skills
Command Code   commands:               .commandcode/commands/opsx-<id>.md
Shared agents  project skills root:    .agents/skills
IDE tools      requiresIdeRestart metadata where declared upstream
```

The registry, detection, generated-by version, migration, cleanup, project/global ownership, and update outcome
must travel together. OpenSpecUI observes and invokes the official CLI; it must not hand-write, delete, or rename
Agent files as a compensating migration.

### 5. Archive is a CLI-owned destructive operation

`retire_capabilities: true` permits upstream archive behavior to remove a fully retired main capability. Upstream
also rejects scenario loss and duplicate requirement operations before destructive completion. OpenSpecUI must
preserve those warnings and exit/failure facts as Archive evidence, never translate a warning into success, and
never duplicate archive merging locally. `validate --archived --json` is a v1.9 diagnostic/evidence capability;
it does not authorize UI-side repair or automatic archive.

## Current owner map

| Surface | Primary production owner | Existing evidence owner | v9 change |
| --- | --- | --- | --- |
| compatibility gate and copy | `packages/core/src/openspec-compat.ts` | `openspec-compat.test.ts` | v9 accepted/current classification |
| workflow JSON contracts | `packages/core/src/cli-contracts/workflow.ts` | `workflow.test.ts` | planning, schema sum type, archived validate |
| CLI execution | `packages/core/src/cli-executor.ts` and `cli-contracts/executor.ts` | executor contract tests | exact command and JSON outcome transport |
| task progress | `packages/core/src/task-progress.ts` | `task-progress.test.ts` | CLI progress remains authoritative |
| workflow read model | Core OPSX types/services plus Server workflow invocation | `official-cli-17-workflow-fixtures.test.ts` | planning versus Apply projection |
| Agent registry/state | `agent-delivery-registry.ts`, `tool-init-state.ts` | registry/state tests | official 1.8/1.9 inventory and physical roots |
| Agent delivery projection | `packages/server/src/agent-delivery-projection-service.ts` | service tests | global-root observation and migration evidence |
| Config Agent UI | `/config/agents` and Config bundle | Web component tests | objective presentation of delivery states |
| archive evidence | workflow invocation/Change Evidence owner | workflow and Web tests | warnings, retirement facts, archived validation |
| distribution release | Changesets plus package build/pack scripts | release/package tests | major v9 preparation only |

## Scope boundary

In scope:

- OpenSpecUI 9 compatibility, typed contracts, read models, Agent delivery projection, and evidence presentation for
  every supported 1.8.x and 1.9.x behavior above.
- Real pinned 1.8.0 and 1.9.0 fixtures, focused owner tests, package build/pack preparation, a major-version
  Changeset, changelog/release copy, and reference pin publication.

Out of scope:

- A separate OpenSpecUI 8 release or a 1.8-only compatibility line.
- Supporting OpenSpec CLI `<1.8.0`, prereleases, or `>=1.10.0`.
- Changing OpenSpec source, replicating archive logic, migration scripts, or repairing unrelated historical Changes.
- Publishing, PR merge, archive, release, and final end-to-end browser acceptance. Those remain later owner actions.

## Execution rule

Each implementation slice starts with one production owner, one precise red case, and one green case. A failed
focused review stops the slice before broader gates. Only after all focused evidence passes may the implementation
agent run package, build, and distribution checks. Browser automation remains preparation evidence; the final
interactive walkthrough is Owner-only.
