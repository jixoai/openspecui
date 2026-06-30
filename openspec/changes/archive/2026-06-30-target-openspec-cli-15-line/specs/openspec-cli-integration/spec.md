# openspec-cli-integration Specification Delta

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI SHALL select the OpenSpec CLI command based on availability and enforce the OpenSpecUI major-to-OpenSpec CLI minor version law for stable features. The law is a strict 1:1 mapping: one OpenSpecUI major line targets exactly one OpenSpec CLI minor line (2.x→1.2, 3.x→1.3, 4.x→1.4, 5.x→1.5). The immediately previous CLI minor line is accepted as legacy-compatible; older lines are unsupported.

#### Scenario: Enforce OpenSpecUI 5.x compatibility range

- **GIVEN** OpenSpecUI 5.x evaluates an OpenSpec CLI version outside `>=1.4.0 <1.6.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL block usage
- **AND** present upgrade instructions

#### Scenario: Treat 1.5 runtime as current in 5.x

- **GIVEN** OpenSpecUI 5.x evaluates OpenSpec CLI `>=1.5.0 <1.6.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL allow core interactions without a compatibility warning

#### Scenario: Accept legacy-compatible 1.4 runtime in 5.x

- **GIVEN** OpenSpecUI 5.x evaluates OpenSpec CLI `>=1.4.0 <1.5.0`
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL allow core interactions
- **AND** SHALL show that the CLI is legacy-compatible and recommend OpenSpec CLI `>=1.5.0 <1.6.0`

#### Scenario: Drop support for 1.3 and older runtimes in 5.x

- **GIVEN** OpenSpecUI 5.x evaluates OpenSpec CLI `1.3.x` or older
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL block usage as unsupported

#### Scenario: Preserve release-line directionality

- **GIVEN** OpenSpecUI release-line compatibility is evaluated
- **WHEN** version support is declared
- **THEN** OpenSpecUI 3.x SHALL correspond to OpenSpec CLI 1.3.x
- **AND** OpenSpecUI 4.x SHALL correspond to OpenSpec CLI 1.4.x
- **AND** OpenSpecUI 5.x SHALL correspond to OpenSpec CLI 1.5.x
- **AND** each OpenSpecUI major line SHALL backward-support exactly the previous CLI minor line (no further)
