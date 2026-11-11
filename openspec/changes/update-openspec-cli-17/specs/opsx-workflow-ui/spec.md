<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. The pinned-fixture requirement states 1.17.0 while 1.16.1 stays the below-admitted boundary.
2. The four baseline fixture requirements rotate their literals to the 1.17 line.
3. The two behavior requirements from the 1.16 line now prove carry-forward on the 1.16.1 boundary
   instead of first appearance against 1.15.0 (that historical proof retired with the v16 window).

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.17.0 executable, and
SHALL prove capability-boundary rejections with the retained pinned 1.16.1 executable (the line the v17 gate
revoked). A hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a
retired line SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.17.0 as the positive line and 1.16.1 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.17.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.16.1 executable is evaluated against the OpenSpecUI 17 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** 1.16.1 SHALL be recorded as below-admitted for the v17 window
- **AND** the 1.17-only artifact reconcile SHALL be absent on the boundary: after
  `config set delivery skills`, both `update` and `init` SHALL delete every command file including edited
  ones on 1.16.1, while 1.17.0 SHALL remove the untouched files and keep and list the edited one
- **AND** a legacy `.agent/workflows` root SHALL be detected as a configured tool on 1.17.0 (planning its
  migration in `update --dry-run --json`) and SHALL NOT be detected on 1.16.1
- **AND** the 1.17.0 executable SHALL prove the accepted payloads

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.17.0 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion

### Requirement: Project Config Failure Validate Envelope Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.17.0 project-config failure as an executable fact:
when `openspec/config.yaml` cannot be read or is not valid YAML, `validate` SHALL exit non-zero and answer
with a bare `{ status: [...] }` envelope rather than a report. The envelope SHALL carry the code
`unreadable_config` or `unparseable_config`; its `message` and `fix` SHALL name the absolute config path
(neither is a separate field).

#### Scenario: A broken project config fails validate with the diagnostic envelope

- **GIVEN** a project whose `openspec/config.yaml` is not valid YAML
- **WHEN** `validate --all --json` runs on the pinned 1.17.0 executable
- **THEN** the exit code SHALL be non-zero
- **AND** stdout SHALL be exactly the diagnostic envelope shape (a `status` array, no `items`/`summary`/
  `root`/`version`)
- **AND** the single diagnostic SHALL carry severity `error`, code `unparseable_config`, the absolute
  config path, and a `fix` string
- **WHEN** the same project is validated with `--report findings --json`
- **THEN** the answer SHALL be the same diagnostic envelope, never a `validation-findings` document

#### Scenario: An unreadable project config is its own code

- **GIVEN** a project whose `openspec/config.yaml` exists but cannot be read
- **WHEN** `validate --json` runs on the pinned 1.17.0 executable
- **THEN** the diagnostic code SHALL be `unreadable_config`
- **AND** the message SHALL name the absolute path and the underlying read failure

### Requirement: Healthy Validate Shapes Fixture Proof

The pinned fixture matrix SHALL prove that a healthy project keeps the OpenSpec 1.17.0 validate report and
findings document shapes unchanged, so the failure envelope added by this line stays a distinct decode
branch rather than a reshaped report.

#### Scenario: A healthy project keeps the report shapes

- **GIVEN** a project whose config is absent or valid
- **WHEN** bulk validation and the findings transport run on the pinned 1.17.0 executable
- **THEN** the ordinary report SHALL carry `items`/`summary`/`root`/`version`
- **AND** the findings transport SHALL carry `itemFindings`/`report`/`root`/`summary`
- **AND** neither answer SHALL be mistaken for the diagnostic envelope

### Requirement: Scenario Step Coverage Warning Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.17.0 scenario step-coverage class as an executable fact:
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
- **WHEN** the pinned 1.17.0 executable validates it
- **THEN** the step-coverage check SHALL NOT report that child as an incomplete scenario

#### Scenario: Main-spec scope reports the same class

- **GIVEN** an admitted main spec whose requirement carries a scenario with a body but no THEN step
- **WHEN** `validate --specs` runs on the pinned 1.17.0 executable
- **THEN** the requirement SHALL carry a WARNING naming the missing step
- **AND** the spec SHALL stay valid without `--strict` and fail with it

### Requirement: Unrecognized Delta Section Severity Fixture Proof

The pinned fixture matrix SHALL prove the 1.17.0 verdict for a requirement authored under a header that
reads as a delta operation but is not one: validation reports it as an ERROR, so plain validation already
fails, and archive refuses the change instead of silently dropping the block. A prose section SHALL stay a
WARNING with the change valid, and the retained 1.16.1 boundary SHALL report the same verdicts, so the
behavior is proven to be carried forward rather than reintroduced.

#### Scenario: A near-miss delta header is an error that already fails plain validation

- **GIVEN** a change delta whose requirement sits under `## Add Requirements`
- **WHEN** `validate --json` runs on the pinned 1.17.0 executable without `--strict`
- **THEN** the finding SHALL carry `level: 'ERROR'` and name the requirement and its section
- **AND** the item SHALL be invalid with a non-zero exit code
- **WHEN** the same validation runs with `--strict`
- **THEN** it SHALL fail as well
- **WHEN** `validate --json` runs on the retained 1.16.1 boundary executable
- **THEN** the same `ERROR` SHALL be reported and the change SHALL be invalid, proving carry-forward

#### Scenario: Prose sections keep the warning

- **GIVEN** the same requirement under `## Notes`
- **WHEN** `validate --json` runs on the pinned 1.17.0 executable
- **THEN** the finding SHALL carry `level: 'WARNING'`
- **AND** the item SHALL remain valid with a zero exit code

#### Scenario: Archive refuses rather than dropping the block

- **GIVEN** a change carrying that unrecognized header
- **WHEN** `archive --json --yes` runs on the pinned 1.17.0 executable
- **THEN** the typed answer SHALL carry `archive: null` and an `error` status whose code is
  `archive_validation_failed`
- **AND** its `fix` SHALL point at `validate` for the requirement-level detail
- **AND** the change SHALL remain unarchived

### Requirement: Section-Heading Closing-Run and Comment Masking Fixture Proof

The pinned fixture matrix SHALL prove the 1.17.0 parser acceptance the CLI contract OpenSpecUI decodes
depends on: an ATX closing `#` run on a section heading is not part of the title, so the section is
recognized and a delta authored under it applies on archive, and the orphan scan masks HTML comments so
a commented-out requirement is not reported. Requirement-name normalization predates this line and SHALL
stay carried-forward evidence.

#### Scenario: Closing runs are not part of a section title

- **GIVEN** a main spec whose requirements section header is `## Requirements ##`
- **WHEN** validation and `show --type spec --json` run on the pinned 1.17.0 executable
- **THEN** the spec SHALL be accepted and the requirement SHALL be projected
- **WHEN** the same `show` runs on the retained 1.16.1 boundary executable
- **THEN** it SHALL accept the same document, proving the acceptance is carried forward

#### Scenario: Requirement-name normalization is carried forward

- **GIVEN** a requirement heading `### Requirement: Foo ###`
- **WHEN** `show --type spec --json` runs on the pinned 1.17.0 executable
- **THEN** the projected name SHALL be `Foo`, with no closing run
- **AND** the fixture SHALL report this as carried-forward evidence, because the patch only extracted the
  existing normalization

#### Scenario: A closing-run delta header applies

- **GIVEN** a delta spec whose section header is `## ADDED Requirements ##`
- **WHEN** validation runs on the pinned 1.17.0 executable
- **THEN** the change SHALL be valid with no issues
- **AND** archiving it SHALL update the main spec with the requirement
- **WHEN** validation runs on the retained 1.16.1 boundary executable
- **THEN** it SHALL also report no issues, proving the header is carried forward

#### Scenario: A commented-out draft is not an orphan

- **GIVEN** a delta spec carrying a requirement inside an HTML comment, plus an uncommented twin outside
  every delta section
- **WHEN** validation runs on the pinned 1.17.0 executable
- **THEN** the commented requirement SHALL NOT be reported
- **AND** the uncommented twin SHALL still be reported as a `WARNING`, so silence cannot pass for the
  wrong reason
- **WHEN** validation runs on the retained 1.16.1 boundary executable
- **THEN** the commented draft SHALL also be masked, proving the masking is carried forward
