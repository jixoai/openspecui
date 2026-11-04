<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Rotate the pinned-positive/boundary fixture roles to 1.16.0 / 1.15.0.
2. Add the two 1.16.0 executable proofs: the config-failure validate envelope and the
   scenario step-coverage WARNING class.

Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。"
-->

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.16.0 executable, and
SHALL prove capability-boundary rejections with the retained pinned 1.15.0 executable (the line the v16 gate
revoked). A hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a
retired line SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.16.0 as the positive line and 1.15.0 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.16.0 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.15.0 executable is evaluated against the OpenSpecUI 16 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** 1.15.0 SHALL be recorded as below-admitted for the v16 window
- **AND** the 1.16-only project-config failure surface SHALL be absent on the boundary: with a broken
  `openspec/config.yaml`, 1.15.0 SHALL still answer with the ordinary validate report, never the bare
  `{ status: [...] }` failure envelope
- **AND** the 1.16.0 executable SHALL prove the accepted payloads

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.16.0 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion

## ADDED Requirements

### Requirement: Project Config Failure Validate Envelope Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.16.0 project-config failure as an executable fact:
when `openspec/config.yaml` cannot be read or is not valid YAML, `validate` SHALL exit non-zero and answer
with a bare `{ status: [...] }` envelope rather than a report. The envelope SHALL carry the code
`unreadable_config` or `unparseable_config`; its `message` and `fix` SHALL name the absolute config path
(neither is a separate field).

#### Scenario: A broken project config fails validate with the diagnostic envelope

- **GIVEN** a project whose `openspec/config.yaml` is not valid YAML
- **WHEN** `validate --all --json` runs on the pinned 1.16.0 executable
- **THEN** the exit code SHALL be non-zero
- **AND** stdout SHALL be exactly the diagnostic envelope shape (a `status` array, no `items`/`summary`/
  `root`/`version`)
- **AND** the single diagnostic SHALL carry severity `error`, code `unparseable_config`, the absolute
  config path, and a `fix` string
- **WHEN** the same project is validated with `--report findings --json`
- **THEN** the answer SHALL be the same diagnostic envelope, never a `validation-findings` document

#### Scenario: An unreadable project config is its own code

- **GIVEN** a project whose `openspec/config.yaml` exists but cannot be read
- **WHEN** `validate --json` runs on the pinned 1.16.0 executable
- **THEN** the diagnostic code SHALL be `unreadable_config`
- **AND** the message SHALL name the absolute path and the underlying read failure

### Requirement: Healthy Validate Shapes Fixture Proof

The pinned fixture matrix SHALL prove that a healthy project keeps the OpenSpec 1.16.0 validate report and
findings document shapes unchanged, so the failure envelope added by this line stays a distinct decode
branch rather than a reshaped report.

#### Scenario: A healthy project keeps the report shapes

- **GIVEN** a project whose config is absent or valid
- **WHEN** bulk validation and the findings transport run on the pinned 1.16.0 executable
- **THEN** the ordinary report SHALL carry `items`/`summary`/`root`/`version`
- **AND** the findings transport SHALL carry `itemFindings`/`report`/`root`/`summary`
- **AND** neither answer SHALL be mistaken for the diagnostic envelope

### Requirement: Scenario Step Coverage Warning Fixture Proof

The pinned fixture matrix SHALL prove the OpenSpec 1.16.0 scenario step-coverage class as an executable fact:
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
- **WHEN** the pinned 1.16.0 executable validates it
- **THEN** the step-coverage check SHALL NOT report that child as an incomplete scenario

#### Scenario: Main-spec scope reports the same class

- **GIVEN** an admitted main spec whose requirement carries a scenario with a body but no THEN step
- **WHEN** `validate --specs` runs on the pinned 1.16.0 executable
- **THEN** the requirement SHALL carry a WARNING naming the missing step
- **AND** the spec SHALL stay valid without `--strict` and fail with it
