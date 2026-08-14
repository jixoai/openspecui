<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define the implementation handoff and evidence-recording format for OpenSpecUI 9.
2. Prevent planning artifacts from being misreported as production implementation.
3. Record hard loopback conditions for future implementation agents.

Original request (2026-08-15): "我会让其它Agent来开发，不是你负责。"
-->

# OpenSpecUI 9 implementation handoff

## Implementation State

```text
Planning author      complete planning only
Production code      complete through slices 1-7
Release              preparation only (changeset + consumed 8.0.0 base); no publish
Final browser walk   Owner-only, pending
```

Implementation started from the approved order in `loop/research-plan.md`. Each slice first added or demonstrated
its named red case, then changed one primary owner, then passed its named green case and focused review. Do not
begin the next slice after a failed review.

## Decisions Taken

```text
OpenSpecUI 9 compatibility
  accepted:    >=1.8.0 <1.10.0
  recommended: >=1.9.0 <1.10.0

Status                         Apply instructions
isPlanningComplete             progress.total/complete/remaining
planning readiness             implementation task truth

OpenSpecUI observes and projects CLI results.
The OpenSpec CLI owns archive mutation, retirement, and Agent artifact mutation.
```

The Change contains delta Specs for `openspec-cli-integration`, `opsx-workflow-ui`, `opsx-config-center`, and
`projection-contract-truth`. Any implementation that changes this contract needs an explicit loopback before code
is written.

## Evidence Record Format

For every completed slice, append a short entry here:

```text
Slice:
Primary owner:
Red case and command:
Green case and command:
Focused review result:
Files changed:
Residual risk:
```

Record fixture versions exactly. A test named after 1.9 that uses a hand-written payload is not sufficient evidence
for 1.8/1.9 support unless a separate test proves that payload against each pinned executable.

## Evidence Record

```text
Slice 1 - v9 admission classifier and copy
Primary owner: packages/core/src/openspec-compat.ts; packages/web/src/components/{cli-health-gate,settings/openspec-settings-diagnostics}.tsx
Red case and command: classifyOpenSpecCliVersion('1.8.0') returned status 'unsupported' and blocked core interactions (pre-change openspec-compat.test.ts).
Green case and command: npx vitest run src/openspec-compat.test.ts (core) and src/components/cli-health-gate.test.tsx (web) - 1.8.x supported non-current, 1.9.x current, 1.7.x/1.10.x/prereleases/unparseable blocked with both ranges named.
Focused review result: green; classifier expresses accepted-but-non-current without weakening the block condition.
Files changed: openspec-compat.ts, openspec-compat.test.ts, cli-health-gate.test.tsx, openspec-settings-diagnostics.tsx.
Residual risk: none identified.

Slice 2 - workflow contracts, schemas sum type, archived validate
Primary owner: packages/core/src/cli-contracts/{workflow,executor}.ts; packages/core/src/opsx-kernel.ts
Red case and command: a valid { schemas: [], root: null, status } payload failed the bare-array CliSchemasSchema and surfaced as opaque contract drift; contracts.validate had no --archived argv (vitest before the owner change).
Green case and command: npx vitest run src/cli-contracts/workflow.test.ts src/cli-executor-contracts.test.ts src/opsx-kernel-cli-projection.test.ts - failure envelope decodes with diagnostics/root null, Kernel rejects it as typed CLI evidence, Status requires isPlanningComplete, Archive preserves warnings.
Focused review result: green; the failure envelope never becomes an empty successful catalog.
Files changed: cli-contracts/workflow.ts, cli-contracts/executor.ts, cli-contracts/command-result.test.ts, cli-executor-contracts.test.ts, opsx-kernel.ts, fixtures repinned to openspec-cli-18/19.
Residual risk: 1.8 schemas has no root selector; the canonical envelope is pinned as a 1.9 obligation only.

Slice 3 - planning completion and authoritative Apply progress
Primary owner: packages/core/src/opsx-types.ts; packages/core/src/opsx-kernel.ts; Web summaries
Red case and command: ChangeStatus carried the ambiguous isComplete authority; a fully planned change could read as Apply-complete (fixture survey before the rename).
Green case and command: pinned matrix 'keeps Apply progress authoritative over the actionable task list' on OpenSpec 1.8.0 and 1.9.0 (progress.total 3 vs tasks.length 2) plus the opsx-types.test.ts transform proof; web/server suites green after the isPlanningComplete rename.
Focused review result: green; CLI progress stays the denominator and local checklist divergence stays explicit.
Files changed: opsx-types.ts, opsx-kernel.ts, change-workflow-phase.ts, change-list.tsx, dashboard.tsx, static-data-provider.ts, affected fixtures.
Residual risk: none identified.

Slice 4 - Agent delivery registry rebuild
Primary owner: packages/core/src/agent-delivery-registry.ts; packages/core/src/tool-init-state.ts; packages/server/src/agent-delivery-projection-service.ts
Red case and command: registry pinned the 1.7 inventory (no Command Code/MiniMax/Rovo Dev, Codex at .codex, agents unavailable) - registry/state/service tests failed against the new law before the owner change.
Green case and command: npx vitest run src/agent-delivery-registry.test.ts src/tool-init-state.test.ts src/agent-command-content.test.ts (core) and agent-delivery-projection-service/tool-subscription-router/agent-integrations-router tests (server) - official 38-entry inventory, Codex .agents current root with .codex legacy migration, MiniMax user-global observation, restart metadata.
Focused review result: green; global roots are observed and never cleaned or migrated locally; the official CLI stays the sole mutation owner.
Files changed: agent-delivery-registry.ts, tool-init-state.ts, agent-delivery-projection-service.ts, router.ts, and fixtures.
Residual risk: shared .agents ownership reconciliation stays CLI-owned; OpenSpecUI projects both readers of the shared root.

Slice 5 - Config Agent facts and Change Evidence surfaces
Primary owner: packages/web/src/routes/config-agents.tsx; packages/web/src/components/archived-validation-evidence.tsx; packages/server/src/router.ts
Red case and command: restart/global-root/legacy facts were absent from the Config Agent evidence; archived validation had no typed surface; exit-1 report content initially rendered as failure-only evidence (caught in component tests).
Green case and command: npx vitest run src/routes/config-agents.test.tsx src/components/archived-validation-evidence.test.tsx (web) and router.test.ts -t 'archived validation' (server) - global/legacy/scope/restart facts visible, typed archived report with no repair action, static snapshot identifies unavailability.
Focused review result: green; Config remains the sole mutation owner and no archive logic is duplicated.
Files changed: config-agents.tsx, archived-validation-evidence.tsx (+test), change-view.tsx, router.ts, router.test.ts.
Residual risk: none identified.

Slice 6 - executable fixture matrix breadth
Primary owner: packages/core/src/official-cli-19-*.test.ts; packages/core/src/__tests__/official-cli-v9-fixtures.ts
Red case and command: hand-authored payloads cannot establish 1.8/1.9 support (research-plan slice 6 rule).
Green case and command: npx vitest run src/official-cli-19-workflow-fixtures.test.ts src/official-cli-19-nested-spec-fixtures.test.ts src/official-cli-19-default-store-fixtures.test.ts src/official-cli-19-validation-fixtures.test.ts - both pinned executables prove planning/task separation, schemas success arrays, the 1.9 failure envelope, archived validation ('3 incomplete tasks (1/4 completed)'), and the 1.8 boundaries.
Focused review result: green; every accepted contract has at least one executable-backed assertion.
Files changed: official-cli-v9-fixtures.ts, the four fixture files, tsconfig registrations, core package.json (openspec-cli-18/19 devDeps).
Residual risk: fixture runtime adds roughly 40 seconds to the core suite.

Slice 7 - changeset and distribution gates
Primary owner: .changeset/openspecui-9-cli-18-19.md; package.json versions; READMEs
Red case and command: source tests pass while packed CLI/Web assets still carry the v7 gate (research-plan stale-distributable risk).
Green case and command: pnpm run build:deps && pnpm run typecheck && pnpm run build:packages && pnpm run build:cli; npm pack in packages/cli; isolated npm install of the tarball; grep evidence of 1.8.0/1.9.0 admission constants, isPlanningComplete, CliSchemasFailure, and minimax facts in the installed bundle; installed CLI starts. Major changeset added with the 8.0.0 base consumed so the release publishes as 9.0.0.
Focused review result: green; source and distribution shapes agree. No publish/release action.
Files changed: .changeset/openspecui-9-cli-18-19.md, packages/*/package.json, README.md, README-zh.md, README-1.7.0.md, README-zh-1.7.0.md.
Residual risk: Owner must still run changeversion/release; targeted 1.9 strict validation of this Change stays green.
```

## Divergence Notes

- references/openspec was rebuilt (pnpm run build) so bin/openspec.js serves the v1.9.0 dist; the prepare script and CI reference check now pin 2826b8889e5223a9a8095d4428b60b56597e1020.
- The pinned executable fixtures moved from the reference checkout bin to the official npm executables (openspec-cli-18, openspec-cli-19 devDependencies), matching the existing 1.4/1.5/1.6 fixture pattern; the reference checkout remains the source-contract regression pin.
- Two pre-existing unrelated failures remain on main and this branch alike: Core reactive-fs/path-realpath (macOS symlinked temp root) and Server translation-cache-adapter (sqlite environment). They are baseline constraints, not v9 regressions.
- The vp pre-commit hook cannot run in this environment (vp CLI not installed); equivalent prettier + oxlint checks were run over every changed file before each commit.

## Loopback Triggers

- A v1.8 and v1.9 executable produce incompatible JSON for a supported command.
- A required upstream behavior lacks one objective UI/Server owner.
- Supporting the schema failure envelope requires a public wire-contract change outside the listed delta Specs.
- Agent global-root observation cannot be represented without broad filesystem access or unsafe deletion scope.
- Archive behavior requires reimplementing or simulating a CLI destructive action.
- Focused evidence fails, or a distribution gate exposes source/dist divergence.
- Any request broadens the version range beyond `<1.10.0` or asks for publish, merge, archive, or Owner acceptance.
