# openspec-cli-integration Specification

## Purpose

Define how OpenSpecUI integrates with the OpenSpec CLI to execute OPSX workflows and stream command output across the active version line.
## Requirements
### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI SHALL select the OpenSpec CLI command based on availability and enforce the OpenSpecUI major-to-OpenSpec CLI minor version law for stable features.

#### Scenario: Enforce OpenSpecUI 4.x compatibility range

- **GIVEN** OpenSpecUI 4.x evaluates an OpenSpec CLI version outside `>=1.3.0 <1.6.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL block usage
- **AND** present upgrade instructions

#### Scenario: Treat 1.4 runtime as current in 4.x

- **GIVEN** OpenSpecUI 4.x evaluates OpenSpec CLI `>=1.4.0 <1.5.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL allow core interactions without a compatibility warning

#### Scenario: Treat 1.5 runtime as current in 4.x

- **GIVEN** OpenSpecUI 4.x evaluates OpenSpec CLI `>=1.5.0 <1.6.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL allow core interactions without a compatibility warning

#### Scenario: Accept legacy-compatible 1.3 runtime in 4.x

- **GIVEN** OpenSpecUI 4.x evaluates OpenSpec CLI `>=1.3.0 <1.4.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL allow core interactions
- **AND** SHALL show that the CLI is legacy-compatible and recommend OpenSpec CLI `>=1.4.0 <1.6.0`

#### Scenario: Preserve release-line directionality

- **GIVEN** OpenSpecUI release-line compatibility is evaluated
- **WHEN** version support is declared
- **THEN** OpenSpecUI 3.x SHALL correspond to OpenSpec CLI 1.3.x
- **AND** OpenSpecUI 4.x SHALL correspond to OpenSpec CLI 1.4.x and 1.5.x
- **AND** OpenSpecUI 4.x SHALL backward-support OpenSpec CLI 1.3.x

### Requirement: Safe CLI Execution

OpenSpecUI SHALL execute CLI commands without shell injection risk and with a clean environment.

#### Scenario: Execute commands without shell

- **GIVEN** a CLI command is invoked
- **WHEN** OpenSpecUI executes the command
- **THEN** the system SHALL use `shell: false`
- **AND** pass arguments as an array

#### Scenario: Remove pnpm environment noise

- **GIVEN** OpenSpecUI runs inside a pnpm workspace
- **WHEN** it executes CLI commands
- **THEN** the system SHALL remove pnpm-specific `npm_config_*` and `npm_package_*` variables
- **AND** avoid command pollution

### Requirement: Streaming CLI Output

OpenSpecUI SHALL provide real-time CLI output to the UI terminal panel.

#### Scenario: Stream stdout and stderr

- **GIVEN** a long-running CLI command executes
- **WHEN** output is produced
- **THEN** the system SHALL stream stdout and stderr events to the UI
- **AND** include a final exit event

#### Scenario: Show executed command

- **GIVEN** a CLI stream starts
- **WHEN** output begins
- **THEN** the UI SHALL display the full command line

### Requirement: OPSX Command Mapping

OpenSpecUI SHALL map UI actions to official OPSX CLI commands.

#### Scenario: Execute OPSX status

- **GIVEN** a status refresh is requested
- **WHEN** the UI calls the CLI
- **THEN** the system SHALL execute `openspec status --json`

#### Scenario: Execute OPSX instructions

- **GIVEN** an artifact is selected
- **WHEN** the UI requests instructions
- **THEN** the system SHALL execute `openspec instructions <artifact> --json`

#### Scenario: Execute OPSX apply instructions

- **GIVEN** apply guidance is requested for a change
- **WHEN** the UI requests apply instructions
- **THEN** the system SHALL execute `openspec instructions apply --json`
- **AND** normalize CLI-provided `contextFiles` into artifact-id to file-path-array mappings

### Requirement: CLI Error Handling

OpenSpecUI SHALL surface CLI errors without losing last known UI state.

#### Scenario: Command failure

- **GIVEN** a CLI command exits with non-zero status
- **WHEN** OpenSpecUI receives the failure
- **THEN** the UI SHALL display an error message
- **AND** retain previous successful data

### Requirement: CLI-backed Config Data Queries

OpenSpecUI SHALL retrieve configuration-related data from the OpenSpec CLI.

#### Scenario: Query schema list

- **GIVEN** the Config view needs schema listings
- **WHEN** the UI requests schema data
- **THEN** the system SHALL execute `openspec schemas --json`

#### Scenario: Query schema details

- **GIVEN** the Config view needs schema details
- **WHEN** the UI requests a schema definition
- **THEN** the system SHALL execute `openspec schema which --json`
- **AND** read the schema.yaml file from the resolved path

#### Scenario: Query template mappings

- **GIVEN** the Config view needs template paths
- **WHEN** the UI requests template mapping data
- **THEN** the system SHALL execute `openspec templates --json`

#### Scenario: Create a schema via CLI

- **GIVEN** the user adds a schema
- **WHEN** the UI requests schema creation
- **THEN** the system SHALL execute `openspec schema init <name>`

#### Scenario: Fork a schema via CLI

- **GIVEN** the user adds a schema based on an existing one
- **WHEN** the UI requests schema creation
- **THEN** the system SHALL execute `openspec schema fork <source> <name>`

### Requirement: Beta Feature Fault Tolerance

For beta-gated features (e.g., Stores), OpenSpecUI SHALL NOT rely on the stable version gate for availability. Instead it SHALL tolerate CLI absence or incompatibility at runtime so the UI never crashes, classifying failures into two kinds and reacting accordingly.

> **Rationale (manager directive, verbatim intent):**
> 对于 beta 功能，openspecui 不负责兼容性。但这也意味着所有功能在后台需要有较强的容错能力（没有这个功能也要能捕捉到错误），然后前端显示这个错误。这个错误一般是两种：
>
> 1. **数据不兼容** — 当前的 openspecui 不支持/不兼容 openspec-cli 提供的数据。通过 zod 对 CLI 输出做**宽松验证**，所以除非 openspec-cli 破坏性更新提供了不兼容的数据结构，我们才会异常。
> 2. **指令用法变了** — openspec-cli 直接修改了指令的用法，这属于 openspec 上了比较大的破坏性更新。
>
> 不论哪种情况，前端都不能因此崩溃。要么客观显示错误，并提供错误的**版本来源信息**（版本信息非常重要）。像 Store 这种 beta 功能是很弱的入口——低版本没有、当前版本不稳定：遇到异常一就直接客观显示版本信息即可；遇到异常二就直接隐藏入口。

#### Scenario: Lenient parsing of beta CLI output

- **GIVEN** a beta feature reads OpenSpec CLI JSON output
- **WHEN** the CLI returns extra or slightly reshaped fields
- **THEN** the system SHALL parse with a lenient (passthrough, optional-field) schema
- **AND** SHALL NOT treat additive CLI changes as an error

#### Scenario: Classify data-incompatible failures with version source

- **GIVEN** a beta feature's CLI command exits 0 but returns a structurally incompatible payload
- **WHEN** lenient parsing still fails
- **THEN** the system SHALL classify the failure as data-incompatible
- **AND** the surfaced error SHALL include the originating OpenSpec CLI version

#### Scenario: Classify command-change failures

- **GIVEN** a beta feature's CLI command is missing or its usage has changed (non-zero exit)
- **WHEN** the command cannot be used as expected
- **THEN** the system SHALL classify the failure as command-unavailable

#### Scenario: Never crash the frontend on beta failures

- **GIVEN** a beta feature encounters either failure kind
- **WHEN** the frontend renders
- **THEN** the UI SHALL NOT crash
- **AND** SHALL either display an objective error with version source (data-incompatible) or hide the entry (command-unavailable)

### Requirement: Stores CLI Query Mapping

OpenSpecUI SHALL retrieve registered-store discovery data from the OpenSpec CLI via the beta fault-tolerance model, without parsing the machine-local registry file directly.

#### Scenario: Query registered store list

- **GIVEN** the Stores panel needs the registered store list and the CLI supports it
- **WHEN** the UI requests store discovery data
- **THEN** the system SHALL execute `openspec store list --json`
- **AND** parse the `stores` array of `{id, root}` entries leniently

#### Scenario: Query store health

- **GIVEN** the Stores panel needs health diagnostics for a store
- **WHEN** the UI requests store health
- **THEN** the system SHALL execute `openspec store doctor --json` (optionally with a store id)
- **AND** surface `openspec_root.healthy`, `metadata`, and `git` facts per store when present

