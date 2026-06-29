# openspec-cli-integration Specification Delta

## MODIFIED Requirements

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

## ADDED Requirements

### Requirement: Beta Feature Fault Tolerance

For beta-gated features (e.g., Stores), OpenSpecUI SHALL NOT rely on the stable version gate for availability. Instead it SHALL tolerate CLI absence or incompatibility at runtime so the UI never crashes, classifying failures into two kinds and reacting accordingly.

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
