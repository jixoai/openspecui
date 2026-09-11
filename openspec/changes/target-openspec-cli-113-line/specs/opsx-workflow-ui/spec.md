<!--
Orthogonal intents (created 2026-09-12 Asia/Shanghai):
1. Rotate the pinned executable fixture requirement to the OpenSpecUI 13 line.
2. Add the Apply Readiness Guidance presentation surface.

Original request (2026-09-12): "Openspec 1.13.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.13.0 executable, and
SHALL prove capability-boundary rejections with the retained pinned OpenSpec 1.12.0 executable. A
hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a retired line
SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.13.0 as the positive line and OpenSpec 1.12.0 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.13.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.12.0 executable is evaluated against the OpenSpecUI 13 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the 1.12.0 line SHALL be recorded as below-admitted for the v13 window
- **AND** the 1.13.0 executable SHALL prove the accepted payloads (including the findings report and the
  Apply Instructions readiness guidance fields)

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.13.0 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion

## ADDED Requirements

### Requirement: Apply Readiness Guidance Surface

Change Detail SHALL present CLI-owned Apply readiness guidance when an admitted OpenSpec CLI session provides
it. `warnings` SHALL render on the direct plane with CLI provenance and exact upstream text, without hover or
expansion being required to discover a predicted validation failure. `missingPrerequisites` SHALL render as
readable build-order next-step evidence, visually distinct from blockers. Both SHALL degrade to the existing
presentation when the fields are absent, and neither SHALL gate or relabel the Apply action itself.

#### Scenario: Warning renders on the direct plane

- **GIVEN** an admitted 1.13 session provides Apply Instructions with the no-delta-specs warning
- **WHEN** Change Detail renders apply guidance
- **THEN** the warning text SHALL be visible in the direct evidence layer with CLI provenance
- **AND** it SHALL NOT exist only inside Tooltip or collapsed disclosure content

#### Scenario: Build-order chain is readable evidence

- **GIVEN** Apply Instructions report `missingPrerequisites`
- **WHEN** Change Detail renders apply guidance
- **THEN** the chain SHALL be presented as ordered artifact ids
- **AND** it SHALL NOT be styled or labeled as a blocker when `state` is `ready`

#### Scenario: Degrade without the fields

- **GIVEN** Apply Instructions omit `warnings` and `missingPrerequisites`
- **WHEN** Change Detail renders apply guidance
- **THEN** the existing presentation SHALL remain unchanged
- **AND** no fabricated warning or chain SHALL appear

#### Scenario: Guidance does not gate Apply

- **GIVEN** an Apply Instructions warning is rendered
- **WHEN** Apply availability is evaluated
- **THEN** the Apply action's own gating SHALL remain unchanged
- **AND** the warning SHALL remain advisory evidence, not a UI-side lock
