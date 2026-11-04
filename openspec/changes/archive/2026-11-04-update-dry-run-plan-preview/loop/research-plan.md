<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Convert the intake into the executed plan with the contract facts anchored to upstream sources.
-->

## Research Findings

F1. `UpdatePlan` contract (pinned v1.15.0, `src/core/update-plan.ts` + `src/cli/index.ts`): three
keys always present arrays; `action ∈ {add, update, delete}`; `notes` closed enum
`legacy-tool-directories | legacy-artifacts`; sorted by `path.localeCompare`; `path` three display
forms; `tool` open string with reserved `'openspec'`; per-tool `failures` keep exit 0; command
failure → empty plan keys + `status[]` `code: 'update_error'`, exit 1; `--json` without `--dry-run`
→ empty stdout, stderr text, exit 1 (executed evidence recorded on the superseded line).

F2. Main's 15.0.0 line (PR #312-#314) already rotated window/registry/fixtures/docs and recorded
this projection as deferred B1; the superseded duplicate line (PR #315) built the projection
independently against the same pin — its pieces port directly.

F3. The stale v9-era `check-openspec-reference.mjs` fake green gate survived both lines.

## Decision & Plan (For Approval)

Graft onto origin/main: capability + typed schema + executor method; server preview transport; web
dialog/route preview; new real-binary fixture; UpdatePlan source anchors; gate repair; minor
changeset ×4. Batch topology: core → server/web parallel → docs/gates.

## Capability Impact

### New or Expanded Behavior

- Update/Repair preview evidence in Config Agents (capability-gated; never gates the mutation).

### Modified Behavior

- None — the real mutation streams are unchanged.

## Risks and Mitigations

R1. Duplicated-line drift — every grafted file re-verified against main's current tree; the stale
tsconfig.workflow-contract-tests lane (v14 names for renamed files) repaired to the actual v15
names in the same delivery.

## Verification Strategy

Focused vitest lanes + full core suite + all-package typecheck + format/lint + gate scripts; PR CI
via workflow_dispatch (the pull_request event does not fire on this repo currently).
