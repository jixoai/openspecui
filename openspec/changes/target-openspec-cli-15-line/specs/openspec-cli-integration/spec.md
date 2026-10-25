<!--
Orthogonal intents (updated 2026-10-25 Asia/Shanghai):
1. Spec delta: v15 admission window (MODIFIED), standalone install scope (ADDED),
   fixture-role rotation incl. the 113 retirement (MODIFIED Kilo scenario).

Original request (2026-10-25): "开工"
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 15 SHALL classify stable OpenSpec CLI `>=1.15.0 <1.16.0` as supported, current, and recommended.
OpenSpec CLI `<1.15.0` (including the whole 1.14.x window that OpenSpecUI 14 admitted, and every older line),
every prerelease, `>=1.16.0`, and an unparseable version SHALL be incompatible and blocked by default.
When an incompatible executable is available, the mismatch Dialog MAY expose `Skip version check`; that
action SHALL bypass only the current Web page runtime's admission gate and SHALL NOT change the detected
version, compatibility evidence, CLI payloads, downstream errors, or product support claim.

Scenario titles below are inherited scenario identity: an "Accept ..." title names that line's historical
admission era, while every scenario body states the OpenSpecUI 15 classification (retired and blocked).

#### Scenario: Accept the current 1.14 line

- **GIVEN** OpenSpecUI 15 detects a stable OpenSpec CLI 1.14.x executable that OpenSpecUI 14 admitted
- **WHEN** admission is evaluated
- **THEN** the retired 1.14 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v15 accepted and recommended ranges `>=1.15.0 <1.16.0`

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 15 detects CLI 1.15.0-beta.1, the stable upper bound 1.16.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Retire the v13 admission window

- **GIVEN** OpenSpecUI 15 detects a stable OpenSpec CLI 1.13.x executable that OpenSpecUI 13 admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v15 accepted and recommended ranges

### Requirement: Agent Registry Kilo Command Path Rotation

The Agent delivery registry snapshot for the admitted series SHALL carry Kilo Code's command delivery path as
`.kilo/command/opsx-{workflow}.md` with `.kilocode/workflows/opsx-{workflow}.md` preserved as legacy path
evidence, and the skills directory SHALL remain `.kilocode`. The registry's raw cleanup patterns SHALL cover
exactly the two legacy generations of the old folder (`.kilocode/workflows/opsx-*.md`,
`.kilocode/workflows/openspec-*.md`) and SHALL NOT mark the live `.kilo/command/` folder as cleanup-owned.

#### Scenario: Pinned executable generates the new path

- **GIVEN** the pinned positive-line fixture executable initializing the `kilocode` tool in a fixture repository
- **WHEN** command generation runs
- **THEN** files SHALL be generated under `.kilo/command/opsx-<id>.md`

## ADDED Requirements

### Requirement: Standalone Install Scope

The `version --json` install contract SHALL accept `scope: 'standalone'` as a legal value alongside
`global|project|temporary|source` (OpenSpec CLI 1.15 standalone distribution), decoded verbatim. Absence of
the value on older CLIs is unchanged behavior; no UI integration is in scope for this line.

#### Scenario: A standalone install's version payload decodes

- **GIVEN** a `version --json` payload whose `install.scope` is `'standalone'`
- **WHEN** the payload is decoded through `CliVersionSchema`
- **THEN** the decode SHALL succeed with the scope preserved verbatim

#### Scenario: The four historical scope values still decode

- **GIVEN** `version --json` payloads whose `install.scope` is respectively `'global'`, `'project'`,
  `'temporary'`, or `'source'`
- **WHEN** each payload is decoded through `CliVersionSchema`
- **THEN** every decode SHALL succeed with the scope preserved verbatim
