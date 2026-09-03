<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Advance the pinned executable fixture requirement to the OpenSpecUI 12 line with split positive/boundary
   fixture roles.
2. Add the validation findings evidence surface requirement.
3. Advance the kernel read model, planning-completion projection, and delta diff surface wording to the
   admitted 1.12 line (Round-A review correction).

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

## MODIFIED Requirements

### Requirement: Kernel-First OPSX Read Model

OpenSpecUI SHALL serve OPSX read data from the in-memory kernel state, with CLI/file-system work performed by
reactive kernel streams. For admitted OpenSpec CLI 1.12 sessions, status-list loading MAY use the single-spawn
`status --all` batch transport behind the capability gate; the `opsx-status-list` Work identity, per-change
reactive dependencies, planning-completion semantics, and Apply progress semantics SHALL remain identical to
the per-change transport. Sessions without the batch capability, including page-level bypasses of retired
lines, SHALL keep the per-change transport.

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

- **GIVEN** an admitted OpenSpec CLI 1.12 session loads the full status list in one spawn
- **WHEN** the batch envelope is projected
- **THEN** the `opsx-status-list` Work identity and per-change dependencies SHALL match the per-change
  transport's semantics
- **AND** a per-change load failure SHALL surface as that change's evidence without failing unrelated changes

#### Scenario: Non-batch sessions keep the serial path

- **GIVEN** a session without the batch capability, such as a page-level bypass of a retired stable 1.10.x
  executable, loads the status list
- **WHEN** statuses are fetched
- **THEN** the kernel SHALL use the per-change transport
- **AND** SHALL NOT invoke `--all`

### Requirement: Explicit Planning Completion Projection

For admitted OpenSpec CLI 1.12.x, OpenSpecUI SHALL project `isPlanningComplete` as the completion
fact for planning artifacts. It SHALL NOT use planning completion to claim implementation task completion,
validation, sync, archive, or release readiness. The retained `isComplete` field MAY be preserved as raw CLI
evidence but SHALL not become an ambiguous user-facing completion authority.

#### Scenario: Planning is complete while implementation work remains

- **GIVEN** Status reports `isPlanningComplete: true`
- **AND** Apply Instructions report remaining tasks
- **WHEN** the Change is rendered
- **THEN** OpenSpecUI SHALL identify planning as complete
- **AND** SHALL continue to show implementation progress as incomplete

### Requirement: MODIFIED Delta Diff Evidence Surface

Change Detail SHALL present the CLI-provided per-requirement `diff` and `warning` fields for MODIFIED deltas as
evidence when an admitted OpenSpec CLI session with the requirement-diff capability provides them. The display
SHALL render the unified diff body and the exact upstream warning text, SHALL identify the evidence as
CLI-owned, and SHALL degrade to the existing delta presentation when the fields are absent or the session
lacks the capability.

#### Scenario: Render a MODIFIED requirement diff

- **GIVEN** an admitted session with the requirement-diff capability and a change with one MODIFIED delta
  carrying a diff
- **WHEN** Change Detail renders the delta
- **THEN** the diff SHALL be visible in the direct evidence layer with CLI provenance
- **AND** SHALL NOT be recomputed from local parsing

#### Scenario: Degrade without diff evidence

- **GIVEN** a session without the requirement-diff capability, or a delta without diff fields
- **WHEN** Change Detail renders the delta
- **THEN** the existing delta presentation SHALL remain unchanged
- **AND** no fabricated diff or warning SHALL appear

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.12.0 executable, and
SHALL prove capability-boundary rejections with the retained pinned OpenSpec 1.11.0 executable. A
hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a retired line
SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.12.0 as the positive line and OpenSpec 1.11.0 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.12.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.11.0 executable receives `validate --report findings`
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the rejection SHALL be recorded as the findings-capability boundary evidence
- **AND** the 1.12.0 executable SHALL prove the findings payloads

## ADDED Requirements

### Requirement: Validation Findings Evidence Surface

The validation evidence surface SHALL render a findings document with its CLI provenance, showing the filtered
item findings with `INFO` presented as an informational class distinct from warnings and errors, and the
preserved full-run totals. It SHALL identify the findings view as filtered (`returnedItems` of `totalItems`)
rather than presenting it as the complete validation result.

#### Scenario: The filtered view is labeled honestly

- **GIVEN** a findings document reports `returnedItems: 1` of `totalItems: 5`
- **WHEN** the findings evidence renders
- **THEN** the surface SHALL show both counts with CLI provenance
- **AND** SHALL NOT present the filtered set as the complete validation result

#### Scenario: Informational findings render distinctly

- **GIVEN** an item carries `INFO` merge-conflict advisory findings while remaining valid
- **WHEN** the findings evidence renders
- **THEN** the findings SHALL appear as informational items, not warnings
- **AND** the item's validity SHALL remain presented as the CLI reported it
