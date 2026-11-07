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

### Requirement: Project Config Failure Validate Envelope Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.16.1 project-config failure as an executable fact:
when `openspec/config.yaml` cannot be read or is not valid YAML, `validate` SHALL exit non-zero and answer
with a bare `{ status: [...] }` envelope rather than a report. The envelope SHALL carry the code
`unreadable_config` or `unparseable_config`; its `message` and `fix` SHALL name the absolute config path
(neither is a separate field).

#### Scenario: A broken project config fails validate with the diagnostic envelope

- **GIVEN** a project whose `openspec/config.yaml` is not valid YAML
- **WHEN** `validate --all --json` runs on the pinned 1.16.1 executable
- **THEN** the exit code SHALL be non-zero
- **AND** stdout SHALL be exactly the diagnostic envelope shape (a `status` array, no `items`/`summary`/
  `root`/`version`)
- **AND** the single diagnostic SHALL carry severity `error`, code `unparseable_config`, the absolute
  config path, and a `fix` string
- **WHEN** the same project is validated with `--report findings --json`
- **THEN** the answer SHALL be the same diagnostic envelope, never a `validation-findings` document

#### Scenario: An unreadable project config is its own code

- **GIVEN** a project whose `openspec/config.yaml` exists but cannot be read
- **WHEN** `validate --json` runs on the pinned 1.16.1 executable
- **THEN** the diagnostic code SHALL be `unreadable_config`
- **AND** the message SHALL name the absolute path and the underlying read failure

### Requirement: Healthy Validate Shapes Fixture Proof

The pinned fixture matrix SHALL prove that a healthy project keeps the OpenSpec 1.16.1 validate report and
findings document shapes unchanged, so the failure envelope added by this line stays a distinct decode
branch rather than a reshaped report.

#### Scenario: A healthy project keeps the report shapes

- **GIVEN** a project whose config is absent or valid
- **WHEN** bulk validation and the findings transport run on the pinned 1.16.1 executable
- **THEN** the ordinary report SHALL carry `items`/`summary`/`root`/`version`
- **AND** the findings transport SHALL carry `itemFindings`/`report`/`root`/`summary`
- **AND** neither answer SHALL be mistaken for the diagnostic envelope

### Requirement: Scenario Step Coverage Warning Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.16.1 scenario step-coverage class as an executable fact:
a counted scenario that has a body but carries no `WHEN`/`GIVEN` step, or no `THEN` step, SHALL be reported
as a WARNING inside the existing finding shape — in change deltas and in main specs — while plain validation
stays green and `--strict` fails.

#### Scenario: Missing steps are warnings that only strict fails on

- **GIVEN** a change whose ADDED requirement carries one complete scenario and three incomplete ones
  (no trigger and no outcome, trigger only, outcome only)
- **WHEN** change-scope validation runs without `--strict`
- **THEN** the item SHALL stay valid and the exit code SHALL be zero
- **AND** exactly the three incomplete scenarios SHALL each carry one `WARNING` naming its scenario and the
  missing step
- **WHEN** the same validation runs with `--strict`
- **THEN** the exit code SHALL be non-zero and the item SHALL fail

#### Scenario: Non-scenario level-4 children stay prose

- **GIVEN** a requirement whose `#### Notes` child has no step markers
- **WHEN** the pinned 1.16.1 executable validates it
- **THEN** the step-coverage check SHALL NOT report that child as an incomplete scenario

#### Scenario: Main-spec scope reports the same class

- **GIVEN** an admitted main spec whose requirement carries a scenario with a body but no THEN step
- **WHEN** `validate --specs` runs on the pinned 1.16.1 executable
- **THEN** the requirement SHALL carry a WARNING naming the missing step
- **AND** the spec SHALL stay valid without `--strict` and fail with it

## ADDED Requirements

### Requirement: Unrecognized Delta Section Severity Fixture Proof

The pinned fixture matrix SHALL prove the 1.16.1 verdict for a requirement authored under a section header
that reads as a delta operation but is not one (`## Add Requirements`, `## DEPRECATED Requirements`,
`## Requirements`): validation reports it as an ERROR — so plain validation already fails, not only
`--strict` — and archive refuses the change instead of silently dropping the block. The same block under a
prose section SHALL remain a WARNING with the change still valid, and the retained 1.15.0 boundary SHALL
report that same orphan as a WARNING without failing, so the escalation is attributable to this line and
the boundary is shown to detect the shape rather than merely stay quiet.

#### Scenario: A near-miss delta header is an error that already fails plain validation

- **GIVEN** a change delta whose requirement sits under `## Add Requirements`
- **WHEN** `validate --json` runs on the pinned 1.16.1 executable without `--strict`
- **THEN** the finding SHALL carry `level: 'ERROR'` and name the requirement and its section
- **AND** the item SHALL be invalid with a non-zero exit code
- **WHEN** the same validation runs with `--strict`
- **THEN** it SHALL fail as well

#### Scenario: Prose sections keep the warning

- **GIVEN** the same requirement under `## Notes`
- **WHEN** `validate --json` runs on the pinned 1.16.1 executable
- **THEN** the finding SHALL carry `level: 'WARNING'`
- **AND** the item SHALL remain valid with a zero exit code

#### Scenario: Archive refuses rather than dropping the block

- **GIVEN** a change carrying that unrecognized header
- **WHEN** `archive --json --yes` runs on the pinned 1.16.1 executable
- **THEN** the typed answer SHALL carry `archive: null` and an `error` status whose code is
  `archive_validation_failed`
- **AND** its `fix` SHALL point at `validate` for the requirement-level detail
- **AND** the change SHALL remain unarchived

#### Scenario: The retired line does not own this verdict

- **GIVEN** the same authored shape on the retained 1.15.0 boundary executable
- **WHEN** `validate --json` runs
- **THEN** no `ERROR` of this class SHALL be reported
- **AND** the orphan SHALL still be reported as a `WARNING`, so the boundary proves a severity change
  rather than missing detection
- **AND** the change SHALL remain valid

### Requirement: Section-Heading Closing-Run and Comment Masking Fixture Proof

The pinned fixture matrix SHALL prove the 1.16.1 parser acceptance that the CLI contract OpenSpecUI decodes
depends on: an ATX closing `#` run on a **section** heading (`## Requirements ##` in a main spec,
`## ADDED Requirements ##` in a delta) is not part of the section title, so the section is recognized and a
delta authored under it applies on archive; and the orphan scan masks HTML comments, so a requirement
written inside a comment is not reported as dropped. Requirement-heading normalization
(`### Requirement: Foo ###` to `Foo`) predates this line: it SHALL be asserted as carried-forward evidence,
never credited to this line's parser change.

#### Scenario: Closing runs are not part of a section title

- **GIVEN** a main spec whose sections are `## Requirements ##` and `### Requirement: Foo ###`
- **WHEN** validation and `show --type spec --json` run on the pinned 1.16.1 executable
- **THEN** the spec SHALL be accepted and the requirement SHALL be projected
- **AND** the requirement's name SHALL normalize to the title without the closing run
- **AND** the retained 1.15.0 executable SHALL reject the same document for having no Requirements section

#### Scenario: A closing-run delta header applies

- **GIVEN** a delta spec whose section header is `## ADDED Requirements ##`
- **WHEN** validation runs on the pinned 1.16.1 executable
- **THEN** the change SHALL be valid with no issues
- **AND** archiving it SHALL update the main spec with the requirement
- **AND** the retained 1.15.0 executable SHALL report no delta sections for the same document

#### Scenario: A commented-out draft is not an orphan

- **GIVEN** a delta spec carrying a requirement inside an HTML comment, plus an uncommented twin outside
  every delta section
- **WHEN** validation runs on the pinned 1.16.1 executable
- **THEN** the commented requirement SHALL NOT be reported
- **AND** the uncommented twin SHALL still be reported as a `WARNING`, so silence cannot pass for the
  wrong reason
- **AND** the retained 1.15.0 executable SHALL report the commented draft, so the masking is this line's fact
