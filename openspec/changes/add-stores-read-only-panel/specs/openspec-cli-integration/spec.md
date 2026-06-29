# openspec-cli-integration Specification Delta

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI SHALL select the OpenSpec CLI command based on availability and enforce the OpenSpecUI major-to-OpenSpec CLI minor version law.

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

### Requirement: Stores CLI Query Mapping

OpenSpecUI SHALL retrieve registered-store discovery data from the OpenSpec CLI (1.5.0+) without parsing the machine-local registry file directly.

#### Scenario: Query registered store list

- **GIVEN** the Stores panel needs the registered store list
- **WHEN** the UI requests store discovery data
- **THEN** the system SHALL execute `openspec store list --json`
- **AND** parse the `stores` array of `{id, root}` entries

#### Scenario: Query store health

- **GIVEN** the Stores panel needs health diagnostics for a store
- **WHEN** the UI requests store health
- **THEN** the system SHALL execute `openspec store doctor --json` (optionally with a store id)
- **AND** surface `openspec_root.healthy`, `metadata`, and `git` facts per store

#### Scenario: Degrade when CLI lacks store support

- **GIVEN** the resolved OpenSpec CLI is older than 1.5.0 or unavailable
- **WHEN** the Stores panel requests discovery data
- **THEN** the system SHALL return an empty store list with an availability flag
- **AND** the UI SHALL show a beta-gated degradation message instead of raising an error
