<!--
Orthogonal intents (created 2026-11-07 Asia/Shanghai):
1. Spec delta: the pinned-fixture requirement states 1.16.1 while 1.15.0 stays the boundary.
2. Two new executable-proof requirements for the verdict changes 1.16.1 introduced.
3. Rotate literals only where they are the pin; keep the line's historical facts intact.

Original request (2026-11-07): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.16.1 executable, and
SHALL prove capability-boundary rejections with the retained pinned 1.15.0 executable (the line the v16 gate
revoked). A hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a
retired line SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.16.1 as the positive line and 1.15.0 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.16.1 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.15.0 executable is evaluated against the OpenSpecUI 16 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** 1.15.0 SHALL be recorded as below-admitted for the v16 window
- **AND** the 1.16-only project-config failure surface SHALL be absent on the boundary: with a broken
  `openspec/config.yaml`, 1.15.0 SHALL still answer with the ordinary validate report, never the bare
  `{ status: [...] }` failure envelope
- **AND** the 1.16.1 executable SHALL prove the accepted payloads

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.16.1 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion

## ADDED Requirements

### Requirement: Unrecognized Delta Section Severity Fixture Proof

The pinned fixture matrix SHALL prove the 1.16-line verdict for a requirement authored under a section
header that reads as a delta operation but is not one (`## Add Requirements`, `## DEPRECATED Requirements`,
`## Requirements`): validation reports it as an ERROR, and archive refuses the change instead of silently
dropping the block. The same block under a prose section SHALL remain a WARNING, and the escalation SHALL
NOT be attributed to the retired 1.15 line.

#### Scenario: A near-miss delta header is an error, not a warning

- **GIVEN** a change delta whose requirement sits under `## Add Requirements`
- **WHEN** `validate --json` runs on the pinned 1.16.1 executable
- **THEN** the finding SHALL carry `level: 'ERROR'` and name the section
- **AND** plain validation SHALL stay valid while `--strict` fails

#### Scenario: Prose sections keep the warning

- **GIVEN** the same requirement under `## Notes`
- **WHEN** `validate --json` runs on the pinned 1.16.1 executable
- **THEN** the finding SHALL carry `level: 'WARNING'`
- **AND** the item SHALL remain valid

#### Scenario: Archive refuses rather than dropping the block

- **GIVEN** a change carrying that unrecognized header
- **WHEN** `archive` runs on the pinned 1.16.1 executable
- **THEN** it SHALL fail with an error naming the requirement and its section
- **AND** the change SHALL remain unarchived

#### Scenario: The retired line does not own this verdict

- **GIVEN** the same authored shape on the retained 1.15.0 boundary executable
- **WHEN** `validate --json` runs
- **THEN** no `ERROR` of this class SHALL be reported

### Requirement: Heading Closing-Run and Comment Masking Fixture Proof

The pinned fixture matrix SHALL prove the 1.16-line parser acceptance that our projections surface as
authored truth: an ATX closing run on a section or requirement heading (`## Requirements ##`,
`### Requirement: Foo ###`) is not part of the title, and a requirement written inside an HTML comment is
not reported as an orphaned block.

#### Scenario: Closing runs are not part of the name

- **GIVEN** a main spec whose requirement heading ends in `###` and whose section header is `## Requirements ##`
- **WHEN** validation runs on the pinned 1.16.1 executable
- **THEN** the spec SHALL be accepted
- **AND** the requirement's name SHALL normalize to the title without the closing run

#### Scenario: A commented-out draft is not an orphan

- **GIVEN** a delta spec carrying a requirement inside an HTML comment, plus an uncommented twin outside
  every delta section
- **WHEN** validation runs on the pinned 1.16.1 executable
- **THEN** the commented requirement SHALL NOT be reported
- **AND** the uncommented twin SHALL still be reported, so silence cannot pass for the wrong reason
