<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define the OpenSpecUI 9 CLI admission law.
2. Define typed OpenSpec 1.8/1.9 Schema and archived-validation contracts.
3. Preserve upstream archive behavior as CLI-owned evidence.

Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 9 SHALL classify stable OpenSpec CLI `>=1.8.0 <1.10.0` as supported. Stable 1.9.x SHALL be current
and recommended; stable 1.8.x SHALL be supported non-current. OpenSpec CLI `<1.8.0`, every prerelease,
`>=1.10.0`, and an unparseable version SHALL be incompatible and blocked by default. When an incompatible
executable is available, the mismatch Dialog MAY expose `Skip version check`; that action SHALL bypass only the
current Web page runtime's admission gate and SHALL NOT change the detected version, compatibility evidence, CLI
payloads, downstream errors, or product support claim.

#### Scenario: Accept the supported non-current 1.8 line

- **GIVEN** OpenSpecUI 9 detects a stable OpenSpec CLI 1.8.x executable
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as supported non-current

#### Scenario: Accept the current 1.9 line

- **GIVEN** OpenSpecUI 9 detects a stable OpenSpec CLI 1.9.x executable
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as current and recommended

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 9 detects CLI 1.7.x, 1.9.0-rc.1, 1.10.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 9 detects a stable OpenSpec CLI 1.7.x executable that OpenSpecUI 7 admitted as its adapted
  line
- **WHEN** admission is evaluated
- **THEN** the retired 1.7 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v9 accepted range `>=1.8.0 <1.10.0` and recommended range
  `>=1.9.0 <1.10.0`

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 9 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify the v9 accepted and recommended ranges

#### Scenario: Bypass only the current page runtime

- **GIVEN** an available incompatible executable is blocked
- **WHEN** the user explicitly selects `Skip version check`
- **THEN** the current Web page runtime MAY admit interactions at the user's risk
- **AND** compatibility evidence SHALL remain incompatible
- **AND** downstream protocol or execution failures SHALL remain visible
- **WHEN** the page runtime is reconstructed, refreshed, or reopened
- **THEN** the bypass SHALL be absent and the mismatch Dialog SHALL block again

#### Scenario: Never persist the bypass

- **WHEN** a version bypass is active
- **THEN** browser storage, Workspace state, project configuration, Server state, and exported snapshots SHALL NOT
  contain it

#### Scenario: Bypass does not admit a version-specific capability or inventory

- **GIVEN** an unsupported, prerelease, or unparseable CLI has a page-local version bypass
- **WHEN** OpenSpecUI derives CLI capabilities or an Agent delivery inventory
- **THEN** it SHALL retain the incompatible classification
- **AND** it SHALL NOT select 1.8 or 1.9 version-specific capability facts or a fallback 1.9 inventory
- **AND** downstream execution SHALL fail through its typed availability boundary rather than a simulated supported CLI

### Requirement: OPSX Command Mapping

OpenSpecUI SHALL map workflow actions, schema resolution, and project setup to official OpenSpec 1.8/1.9 commands
with exact selected-Root or Launch Project ownership. It SHALL derive command availability from the admitted running
CLI version before invocation, rather than exposing a 1.9-only command to a supported 1.8 session.

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

#### Scenario: Invoke update from a change action

- **GIVEN** a user selects Update for an existing change
- **WHEN** command invocation mode is active
- **THEN** the system SHALL produce `/opsx:update <change-id>`
- **AND** preserve `update` as the workflow action passed through the public hook contract

#### Scenario: Invoke sync from a change action

- **GIVEN** a user selects Sync for an existing change
- **WHEN** command invocation mode is active
- **THEN** the system SHALL produce `/opsx:sync <change-id>`
- **AND** preserve `sync` as the workflow action passed through the public hook contract

#### Scenario: Request Apply Instructions with runtime inputs

- **GIVEN** an active Change and current selected Root
- **WHEN** Apply guidance is requested
- **THEN** OpenSpecUI SHALL execute `openspec instructions apply --change <id> --json` with the current Root selector
- **AND** preserve CLI-provided `context`, `operationGuidance`, `contextFiles`, and Root evidence as typed facts

#### Scenario: Request Archive Instructions

- **GIVEN** an active Change and current selected Root
- **WHEN** Archive guidance is requested
- **THEN** OpenSpecUI SHALL execute `openspec instructions archive --change <id> --json` with the current Root selector
- **AND** preserve CLI-provided `context`, `operationGuidance`, and Root evidence
- **AND** SHALL NOT derive Archive input from Status or artifact rules

#### Scenario: Resolve schemas through the selected 1.9 Root

- **GIVEN** a stable OpenSpec CLI 1.9.x session has selected Root `store-a`
- **WHEN** Config requests its schema catalog
- **THEN** the system SHALL execute `openspec schemas --json --store store-a`
- **AND** preserve either its successful catalog or its selected-Root failure envelope as the selected Root's CLI fact

#### Scenario: Resolve schemas without a 1.9-only selector on 1.8

- **GIVEN** a stable OpenSpec CLI 1.8.x session
- **WHEN** Config requests its schema catalog
- **THEN** the system SHALL execute `openspec schemas --json` without `--store`
- **AND** SHALL NOT attempt a synthetic selected-Root operation

#### Scenario: Restrict archived validation to OpenSpec 1.9

- **GIVEN** a stable OpenSpec CLI 1.9.x session
- **WHEN** Change Evidence requests archived validation
- **THEN** the system SHALL execute `openspec validate --archived --json`
- **GIVEN** a stable OpenSpec CLI 1.8.x session
- **WHEN** Change Evidence renders archived validation
- **THEN** it SHALL report the capability as unavailable before command execution
- **AND** SHALL NOT invoke an unknown `--archived` option

#### Scenario: Initialize only the Launch Project

- **GIVEN** the Launch Project has no local OpenSpec initialization
- **WHEN** the user explicitly confirms Initialize Project
- **THEN** OpenSpecUI SHALL execute `openspec init <launch-project> --tools=none`
- **AND** SHALL NOT target an external Active Root or Store
- **AND** SHALL NOT select, install, migrate, or clean Agent artifacts
- **AND** SHALL stream command and final settlement evidence

### Requirement: CLI-backed Config Data Queries

OpenSpecUI SHALL retrieve configuration-related data from the OpenSpec CLI using only commands available to the
admitted CLI version.

#### Scenario: Query schema list

- **GIVEN** the Config view needs schema listings for a stable OpenSpec CLI 1.9.x selected Root
- **WHEN** the UI requests schema data
- **THEN** the system SHALL execute `openspec schemas --json` with that selected Root selector
- **GIVEN** the Config view needs schema listings for a stable OpenSpec CLI 1.8.x session
- **WHEN** the UI requests schema data
- **THEN** the system SHALL execute `openspec schemas --json` without the unavailable selector

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

## ADDED Requirements

### Requirement: Schema Resolution JSON Sum Type

OpenSpecUI SHALL decode `openspec schemas --json` as either a successful schema array or a selected-Root failure
envelope containing `schemas`, `root: null`, and diagnostic `status`. The 1.9 selected-Root call SHALL be made
through the product's current Root selector. The failure envelope SHALL remain objective CLI evidence and SHALL NOT
be rendered as a successful empty schema catalog.

#### Scenario: Preserve successful schema discovery

- **GIVEN** `openspec schemas --json` returns a schema array
- **WHEN** Config loads its schema inventory
- **THEN** OpenSpecUI SHALL preserve schema name, source, description, and artifacts

#### Scenario: Preserve schema resolution failure

- **GIVEN** a selected 1.9 Root causes `openspec schemas --json --store <selected-store>` to return
  `{ schemas: [], root: null, status }`
- **WHEN** Config receives the result
- **THEN** it SHALL preserve the diagnostic and absent Root as failure evidence
- **AND** it SHALL NOT claim that the selected Root has no schemas

### Requirement: Archived Validation Evidence

OpenSpecUI SHALL support OpenSpec 1.9 `validate --archived --json` as a typed CLI validation result. It SHALL
preserve archive identifiers, validation issues, totals, root, and exit/failure evidence without writing, repairing,
or archiving project files. For an admitted OpenSpec 1.8.x session, this is a typed unavailable capability rather
than a CLI execution failure.

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
