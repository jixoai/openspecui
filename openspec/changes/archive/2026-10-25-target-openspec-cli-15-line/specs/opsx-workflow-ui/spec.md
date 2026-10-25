<!--
Orthogonal intents (updated 2026-10-25 Asia/Shanghai):
1. Spec delta: pinned workflow fixtures rotate to the v15 positive line with the 1.14.3 boundary.

Original request (2026-10-25): "开工"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.15.0 executable, and
SHALL prove capability-boundary rejections with the retained pinned 1.14.3 executable (the last 1.14 patch,
version unchanged from the v14 line). A hand-authored payload alone SHALL NOT establish support for the CLI
line, and a fixture for a retired line SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.15.0 as the positive line and 1.14.3 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.15.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.14.3 executable is evaluated against the OpenSpecUI 15 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** 1.14.3 SHALL be recorded as below-admitted for the v15 window
- **AND** `update --dry-run` SHALL fail as an unknown option and `install` SHALL fail as an unknown
  command on the boundary executable (the 1.15-only surfaces absent)
- **AND** the 1.15.0 executable SHALL prove the accepted payloads

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.15.0 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion
