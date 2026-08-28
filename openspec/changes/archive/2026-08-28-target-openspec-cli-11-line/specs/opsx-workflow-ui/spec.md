<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Advance the status loading transport to the capability-gated batch path.
2. Rename the version-bound fixture requirement to the pinned-series form.
3. Define the Change Detail MODIFIED-delta diff evidence surface.
4. Advance the planning-completion projection wording to the admitted 1.10/1.11 lines.

Original request (2026-08-28): "我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
-->

## MODIFIED Requirements

### Requirement: Kernel-First OPSX Read Model

OpenSpecUI SHALL serve OPSX read data from the in-memory kernel state, with CLI/file-system work performed by
reactive kernel streams. For admitted OpenSpec CLI 1.11 sessions, status-list loading MAY use the single-spawn
`status --all` batch transport behind the capability gate; the `opsx-status-list` Work identity, per-change
reactive dependencies, planning-completion semantics, and Apply progress semantics SHALL remain identical to
the per-change transport. Admitted 1.10 sessions SHALL keep the per-change transport.

#### Scenario: Serve reads from memory state

- **GIVEN** OPSX data has been warmed or ensured in kernel streams
- **WHEN** any OPSX read endpoint is requested
- **THEN** the server SHALL read from kernel memory state
- **AND** SHALL NOT run duplicate ad-hoc read logic in router handlers

#### Scenario: Recover from warmup failure

- **GIVEN** kernel warmup fails due to transient CLI or file-system issues
- **WHEN** a later request requires OPSX data
- **THEN** the kernel SHALL allow re-warm/re-ensure
- **AND** SHALL NOT remain permanently locked in a failed warmup state

#### Scenario: Batch transport preserves projection identity

- **GIVEN** an admitted OpenSpec CLI 1.11 session loads the full status list in one spawn
- **WHEN** the batch envelope is projected
- **THEN** the `opsx-status-list` Work identity and per-change dependencies SHALL match the per-change
  transport's semantics
- **AND** a per-change load failure SHALL surface as that change's evidence without failing unrelated changes

#### Scenario: Non-batch sessions keep the serial path

- **GIVEN** an admitted OpenSpec CLI 1.10.x session loads the status list
- **WHEN** statuses are fetched
- **THEN** the kernel SHALL use the per-change transport
- **AND** SHALL NOT invoke `--all`

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against pinned OpenSpec 1.10.0 and 1.11.0 executables.
A hand-authored payload alone SHALL NOT establish support for either CLI line, and a fixture for one line
SHALL NOT be reused as evidence for the other.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against OpenSpec 1.10.0 and 1.11.0
- **WHEN** it evaluates Status and Apply Instructions
- **THEN** each executable SHALL satisfy the typed planning-completion and progress contracts

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the pinned 1.10.0 executable receives `status --all` or `show --diff`
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the rejections SHALL be recorded as the 1.11-only capability evidence
- **AND** the 1.11.0 executable SHALL prove both payloads

### Requirement: Explicit Planning Completion Projection

For supported OpenSpec CLI 1.10.x and 1.11.x, OpenSpecUI SHALL project `isPlanningComplete` as the completion
fact for planning artifacts. It SHALL NOT use planning completion to claim implementation task completion,
validation, sync, archive, or release readiness. The retained `isComplete` field MAY be preserved as raw CLI
evidence but SHALL not become an ambiguous user-facing completion authority.

#### Scenario: Planning is complete while implementation work remains

- **GIVEN** Status reports `isPlanningComplete: true`
- **AND** Apply Instructions report remaining tasks
- **WHEN** the Change is rendered
- **THEN** OpenSpecUI SHALL identify planning as complete
- **AND** SHALL continue to show implementation progress as incomplete

## RENAMED Requirements

- FROM: `### Requirement: v9 Workflow Fixtures Are Executable`
- TO: `### Requirement: Pinned Workflow Fixtures Are Executable`

## ADDED Requirements

### Requirement: MODIFIED Delta Diff Evidence Surface

Change Detail SHALL present the CLI-provided per-requirement `diff` and `warning` fields for MODIFIED deltas as
evidence when an admitted OpenSpec CLI 1.11 session provides them. The display SHALL render the unified diff
body and the exact upstream warning text, SHALL identify the evidence as CLI-owned, and SHALL degrade to the
existing delta presentation when the fields are absent or the session is below 1.11.

#### Scenario: Render a MODIFIED requirement diff

- **GIVEN** an admitted 1.11 session and a change with one MODIFIED delta carrying a diff
- **WHEN** Change Detail renders the delta
- **THEN** the diff SHALL be visible in the direct evidence layer with CLI provenance
- **AND** SHALL NOT be recomputed from local parsing

#### Scenario: Degrade without diff evidence

- **GIVEN** an admitted 1.10 session or a delta without diff fields
- **WHEN** Change Detail renders the delta
- **THEN** the existing delta presentation SHALL remain unchanged
- **AND** no fabricated diff or warning SHALL appear
