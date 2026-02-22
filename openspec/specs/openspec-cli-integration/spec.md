# openspec-cli-integration Specification

## Purpose

Define how OpenSpecUI integrates with the OpenSpec CLI 1.1.x to execute OPSX workflows and stream command output.

## Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI SHALL select the OpenSpec CLI command based on availability and enforce a 1.1.x baseline.

#### Scenario: Prefer global openspec

- **GIVEN** a global `openspec` command is available
- **WHEN** OpenSpecUI resolves the CLI command
- **THEN** the system SHALL use the global `openspec`
- **AND** record its version for display

#### Scenario: Fallback to npx

- **GIVEN** a global `openspec` command is not available
- **WHEN** OpenSpecUI resolves the CLI command
- **THEN** the system SHALL use `npx @fission-ai/openspec`

#### Scenario: Enforce 1.1.x baseline

- **GIVEN** the CLI reports a version below 1.1.0
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL block usage
- **AND** present upgrade instructions

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
