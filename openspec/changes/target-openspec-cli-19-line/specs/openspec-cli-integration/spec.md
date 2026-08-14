<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define the OpenSpecUI 9 CLI admission law.
2. Define typed OpenSpec 1.8/1.9 Schema and archived-validation contracts.
3. Preserve upstream archive behavior as CLI-owned evidence.

Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
-->

## ADDED Requirements

### Requirement: OpenSpecUI 9 CLI Admission Law

OpenSpecUI 9 SHALL support stable OpenSpec CLI `>=1.8.0 <1.10.0`. Stable 1.9.x SHALL be current and recommended;
stable 1.8.x SHALL be supported non-current. OpenSpec CLI `<1.8.0`, every prerelease, `>=1.10.0`, and an
unparseable version SHALL be blocked by default. A current-page-only bypass MAY retain its existing risk boundary
but SHALL NOT rewrite compatibility evidence or product support claims.

#### Scenario: Admit a supported non-current CLI

- **GIVEN** OpenSpecUI 9 detects OpenSpec CLI 1.8.0
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as supported non-current

#### Scenario: Admit the current CLI line

- **GIVEN** OpenSpecUI 9 detects OpenSpec CLI 1.9.0
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as current and recommended

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 9 detects CLI 1.7.x, 1.9.0-rc.1, 1.10.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL remain blocked by default
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

### Requirement: Schema Resolution JSON Sum Type

OpenSpecUI SHALL decode `openspec schemas --json` as either a successful schema array or a selected-Root failure
envelope containing `schemas`, `root: null`, and diagnostic `status`. The failure envelope SHALL remain objective
CLI evidence and SHALL NOT be rendered as a successful empty schema catalog.

#### Scenario: Preserve successful schema discovery

- **GIVEN** `openspec schemas --json` returns a schema array
- **WHEN** Config loads its schema inventory
- **THEN** OpenSpecUI SHALL preserve schema name, source, description, and artifacts

#### Scenario: Preserve schema resolution failure

- **GIVEN** `openspec schemas --json` returns `{ schemas: [], root: null, status }`
- **WHEN** Config receives the result
- **THEN** it SHALL preserve the diagnostic and absent Root as failure evidence
- **AND** it SHALL NOT claim that the selected Root has no schemas

### Requirement: Archived Validation Evidence

OpenSpecUI SHALL support OpenSpec 1.9 `validate --archived --json` as a typed CLI validation result. It SHALL
preserve archive identifiers, validation issues, totals, root, and exit/failure evidence without writing, repairing,
or archiving project files.

#### Scenario: Render an archived validation failure

- **GIVEN** OpenSpec 1.9 reports incomplete archived tasks through `validate --archived --json`
- **WHEN** OpenSpecUI projects the result
- **THEN** the validation failure SHALL remain visible with its CLI diagnostics
- **AND** OpenSpecUI SHALL NOT mark the archive valid or perform repair automatically

### Requirement: CLI-Owned Capability Retirement

OpenSpecUI SHALL preserve the result of upstream archive capability retirement, scenario-loss checks, and duplicate
requirement rejection as CLI evidence. It SHALL NOT reproduce archive merge or capability deletion logic locally.

#### Scenario: Archive retirement is blocked upstream

- **GIVEN** an archive operation reports a retirement, scenario-loss, or duplicate-requirement diagnostic
- **WHEN** OpenSpecUI renders Archive evidence
- **THEN** it SHALL retain the command outcome and diagnostic provenance
- **AND** SHALL NOT represent the operation as successful or mutate the capability itself
