<!--
Orthogonal intents (created 2026-10-02 Asia/Shanghai):
1. Rotate the pinned executable fixture requirement to the OpenSpecUI 14 line.
2. Add the status advisory warnings direct-plane surface.

Original request (2026-10-02): "Openspec v1.14.0 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。完成后关于 github 上的相关 issue"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.14.0 executable, and
SHALL prove capability-boundary rejections with a retained pinned retired executable. A hand-authored
payload alone SHALL NOT establish support for the CLI line, and a fixture for a retired line SHALL NOT be
reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.14.0 as the positive line and a retired executable as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.14.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned retired executable is evaluated against the OpenSpecUI 14 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the retired line SHALL be recorded as below-admitted for the v14 window
- **AND** the 1.14.0 executable SHALL prove the accepted payloads

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.14.0 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion

## ADDED Requirements

### Requirement: Status Advisory Warnings Surface

Change Detail SHALL present CLI-owned status advisory warnings (unrecognized `.openspec.yaml` keys) when an
admitted OpenSpec CLI session provides them, following the Apply-readiness summary-row law: ONE
always-visible summary row naming the warning count and owning CLI command, with the verbatim warning text
one explicit expansion away on the same direct plane. Absent members SHALL degrade silently, and warnings
SHALL NOT gate any action.

#### Scenario: Warning summary renders on the direct plane

- **GIVEN** an admitted 1.14 session provides status warnings
- **WHEN** Change Detail renders its status region
- **THEN** one summary row SHALL be visible naming the warning count with CLI attribution without hover
- **AND** the verbatim warning text SHALL become visible with one explicit expansion

#### Scenario: Degrade without warnings

- **GIVEN** a status payload omits the warnings member
- **WHEN** Change Detail renders
- **THEN** no warning surface SHALL be synthesized

#### Scenario: Warnings never gate actions

- **GIVEN** status warnings are rendered
- **WHEN** Apply or Archive availability is evaluated
- **THEN** action gating SHALL remain unchanged
