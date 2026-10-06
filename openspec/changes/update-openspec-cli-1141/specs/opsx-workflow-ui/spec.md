<!--
Orthogonal intents (created 2026-10-06 Asia/Shanghai):
1. Rotate the pinned positive executable fact for the OpenSpecUI 14 in-window patch line.
2. Add the two 1.14.1 patch-rotation behaviors as executable fixture proofs.

Original request (2026-10-06): "官方发布了 v1.14.1，请按照规范更新跟进这个版本"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.14.1 executable, and
SHALL prove capability-boundary rejections with a retained pinned retired executable. A hand-authored
payload alone SHALL NOT establish support for the CLI line, and a fixture for a retired line SHALL NOT be
reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.14.1 as the positive line and a retired executable as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.14.1 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned retired executable is evaluated against the OpenSpecUI 14 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the retired line SHALL be recorded as below-admitted for the v14 window
- **AND** the 1.14.1 executable SHALL prove the accepted payloads

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.14.1 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion

## ADDED Requirements

### Requirement: Apply Completion Archive-Separation Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.14.1 apply `all_done` semantics as an
executable fact: the state value and chain stay unchanged while the instruction reports
tracked-task completion and asks for review or verification before archiving, and the retired
archive-readiness phrasing never appears in the payload.

#### Scenario: all_done reports completion without archive readiness

- **GIVEN** a change whose tracked tasks are all complete on the pinned 1.14.1 executable
- **WHEN** `instructions apply --change <id> --json` is executed
- **THEN** the payload SHALL carry `state: "all_done"` with the CLI's own progress counts
- **AND** the `instruction` SHALL report that all tracked tasks are complete and ask for review or
  verification before archiving
- **AND** the serialized payload SHALL NOT contain the retired `ready to be archived` phrasing

### Requirement: Overlength Requirement Strict-Escalation Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.14.1 overlength severity as an executable
fact: a requirement description over 500 characters, including an ADDED requirement inside a
change, is a WARNING-level validation issue that leaves non-strict validation green while
`--strict` fails.

#### Scenario: Overlength requirements fail strict validation only

- **GIVEN** a change whose ADDED requirement description exceeds 500 characters
- **WHEN** change-scope validation runs without `--strict`
- **THEN** the item SHALL stay valid with the overlength advisory carried as a WARNING-level issue
  naming the delta spec path
- **WHEN** the same validation runs with `--strict`
- **THEN** the exit code SHALL be non-zero and the item SHALL fail on that WARNING
