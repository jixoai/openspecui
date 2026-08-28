<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Advance the CLI admission law to the OpenSpecUI 11 line.
2. Define typed 1.10/1.11 batch-status, diff-evidence, and init-language contracts.
3. Keep stdout/stderr discipline explicit for machine consumption.
4. Advance OPSX command mapping and Config query semantics to the admitted lines.

Original request (2026-08-28): "我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"

Note: scenario titles such as "Accept the adapted 1.7 line" are historical names preserved verbatim because
the upstream scenario-loss guard forbids dropping or renaming scenarios inside a MODIFIED block; each body
states the current line's law.
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 11 SHALL classify stable OpenSpec CLI `>=1.10.0 <1.12.0` as supported. Stable 1.11.x SHALL be
current and recommended; stable 1.10.x SHALL be supported non-current. OpenSpec CLI `<1.10.0` (including
1.8.x and 1.9.x), every prerelease, `>=1.12.0`, and an unparseable version SHALL be incompatible and blocked
by default. When an incompatible executable is available, the mismatch Dialog MAY expose `Skip version check`;
that action SHALL bypass only the current Web page runtime's admission gate and SHALL NOT change the detected
version, compatibility evidence, CLI payloads, downstream errors, or product support claim.

#### Scenario: Accept the supported non-current 1.10 line

- **GIVEN** OpenSpecUI 11 detects a stable OpenSpec CLI 1.10.x executable
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as supported non-current

#### Scenario: Accept the current 1.11 line

- **GIVEN** OpenSpecUI 11 detects a stable OpenSpec CLI 1.11.x executable
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as current and recommended

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 11 detects CLI 1.9.x, 1.11.0-rc.1, 1.12.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.8 line

- **GIVEN** OpenSpecUI 11 detects a stable OpenSpec CLI 1.8.x executable that OpenSpecUI 9 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.8 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v11 accepted range `>=1.10.0 <1.12.0` and recommended range
  `>=1.11.0 <1.12.0`

#### Scenario: Accept the current 1.9 line

- **GIVEN** OpenSpecUI 11 detects a stable OpenSpec CLI 1.9.x executable that OpenSpecUI 9 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.9 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v11 accepted and recommended ranges

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 11 detects a stable OpenSpec CLI 1.7.x executable that OpenSpecUI 7 admitted as its adapted
  line
- **WHEN** admission is evaluated
- **THEN** the retired 1.7 line SHALL remain blocked by default
- **AND** the mismatch evidence SHALL name the v11 accepted and recommended ranges

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 11 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify the v11 accepted and recommended ranges

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
- **AND** it SHALL NOT select 1.10 or 1.11 version-specific capability facts or a fallback 1.11 inventory
- **AND** downstream execution SHALL fail through its typed availability boundary rather than a simulated
  supported CLI

### Requirement: Schema Resolution JSON Sum Type

OpenSpecUI SHALL decode `openspec schemas --json` as either a successful schema array or a selected-Root failure
envelope containing `schemas`, `root: null`, and diagnostic `status`. The selected-Root call SHALL be made
through the product's current Root selector using the admitted CLI's store-aware root semantics. The failure
envelope SHALL remain objective CLI evidence and SHALL NOT be rendered as a successful empty schema catalog.

#### Scenario: Preserve successful schema discovery

- **GIVEN** `openspec schemas --json` returns a schema array
- **WHEN** Config loads its schema inventory
- **THEN** OpenSpecUI SHALL preserve schema name, source, description, and artifacts

#### Scenario: Preserve schema resolution failure

- **GIVEN** a selected Root causes `openspec schemas --json --store <selected-store>` to return
  `{ schemas: [], root: null, status }`
- **WHEN** Config receives the result
- **THEN** it SHALL preserve the diagnostic and absent Root as failure evidence
- **AND** it SHALL NOT claim that the selected Root has no schemas

### Requirement: Archived Validation Evidence

OpenSpecUI SHALL support `validate --archived --json` as a typed CLI validation result for both admitted
OpenSpec CLI 1.10.x and 1.11.x sessions. It SHALL preserve archive identifiers, validation issues, totals,
root, and exit/failure evidence without writing, repairing, or archiving project files. Strict-mode escalation
of warnings, including the 1.11 Purpose-placeholder warning class, SHALL remain CLI-owned.

#### Scenario: Render an archived validation failure

- **GIVEN** the admitted OpenSpec CLI reports incomplete archived tasks through `validate --archived --json`
- **WHEN** OpenSpecUI projects the result
- **THEN** the validation failure SHALL remain visible with its CLI diagnostics
- **AND** OpenSpecUI SHALL NOT mark the archive valid or perform repair automatically

### Requirement: OPSX Command Mapping

OpenSpecUI SHALL map workflow actions, schema resolution, and project setup to official OpenSpec 1.10/1.11
commands with exact selected-Root or Launch Project ownership. It SHALL derive command availability from the
admitted running CLI version before invocation, rather than exposing a 1.11-only command (batch status,
requirement diff) to a supported 1.10 session.

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

- **GIVEN** an admitted OpenSpec CLI 1.10.x or 1.11.x session has selected Root `store-a`
- **WHEN** Config requests its schema catalog
- **THEN** the system SHALL execute `openspec schemas --json --store store-a`
- **AND** preserve either its successful catalog or its selected-Root failure envelope as the selected Root's CLI fact

#### Scenario: Resolve schemas without a 1.9-only selector on 1.8

- **GIVEN** an admitted OpenSpec CLI session on either supported line
- **WHEN** Config requests its schema catalog with a selected Root
- **THEN** the system SHALL resolve through the selected-Root selector on both admitted lines
- **AND** the retired 1.8 selector restriction SHALL NOT downgrade any admitted session to a selectorless query

#### Scenario: Restrict archived validation to OpenSpec 1.9

- **GIVEN** an admitted OpenSpec CLI 1.10.x or 1.11.x session
- **WHEN** Change Evidence requests archived validation
- **THEN** the system SHALL execute `openspec validate --archived --json`
- **AND** the retired 1.8 unavailability branch SHALL NOT downgrade any admitted session

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

- **GIVEN** the Config view needs schema listings for an admitted OpenSpec CLI selected Root on either
  supported line
- **WHEN** the UI requests schema data
- **THEN** the system SHALL execute `openspec schemas --json` with that selected Root selector
- **AND** the retired selectorless 1.8 branch SHALL NOT be used for any admitted session

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

### Requirement: Batch Status Envelope Contract

OpenSpecUI SHALL provide a typed `status --all --json` contract for admitted OpenSpec CLI 1.11 sessions. The
batch envelope SHALL be decoded as a sum type whose healthy entries are the single-change status payload,
whose failure entries are `{ changeName, status: [diagnostic] }` records preserved in place, whose empty set
MAY carry a `message` key, and whose root-selection failure is the `{ changes: [], root: null }` null shape
with its diagnostic `status` array preserved through the shared JSON failure contract. Healthy entries carry
the single-change status payload fields without a per-entry root; the envelope-level `root` is the batch's
root fact.
Decoding SHALL NOT consult the process exit code, because a partial failure exits 1 while stdout remains one
complete valid JSON document. OpenSpecUI SHALL NOT invoke `--all` on sessions admitted below 1.11.

#### Scenario: Decode a partial-failure batch

- **GIVEN** `status --all --json` exits 1 with one change-level load failure
- **WHEN** the envelope is decoded
- **THEN** every healthy entry SHALL parse as a single-change status payload
- **AND** the failed change SHALL surface its diagnostics as per-change evidence
- **AND** the transport SHALL NOT be classified as a CLI transport failure

#### Scenario: Capability-gate the batch invocation

- **GIVEN** an admitted OpenSpec CLI 1.10.x session
- **WHEN** the status list is loaded
- **THEN** OpenSpecUI SHALL use the per-change `status --change` transport
- **AND** SHALL NOT pass `--all` to any argv

### Requirement: Requirement Diff Evidence Contract

OpenSpecUI SHALL provide a typed `show <change> --json --diff` contract for admitted OpenSpec CLI 1.11
sessions. The contract SHALL accept the optional `diff` and `warning` fields on `MODIFIED` deltas only and
SHALL preserve their exact upstream strings. OpenSpecUI SHALL NOT recompute requirement diffs locally, SHALL
NOT relax the strict local delta schema to absorb these fields, and SHALL NOT invoke `--diff` below 1.11.

#### Scenario: Carry MODIFIED-only diff fields

- **GIVEN** a change contains one MODIFIED delta with a textual change
- **WHEN** `show <change> --json --diff` is decoded
- **THEN** that delta SHALL carry the unified `diff` body
- **AND** ADDED, REMOVED, and RENAMED deltas SHALL remain unchanged in shape

#### Scenario: Preserve upstream warnings verbatim

- **GIVEN** a MODIFIED requirement header differs from the main spec only in case or spacing
- **WHEN** the diff payload is decoded
- **THEN** the delta SHALL carry the upstream warning text unchanged
- **AND** the UI SHALL NOT replace it with a locally authored message

### Requirement: Initialization Language Pass-Through

OpenSpecUI's CLI execution layer SHALL pass an optional language option through to `openspec init` as
`--language <value>` for admitted OpenSpec CLI 1.10+ sessions. The persisted result SHALL be surfaced as the
existing Active Root `context` field evidence; OpenSpecUI SHALL NOT expose a language input in the Initialize
Project Alert, whose mutation SHALL remain exactly `openspec init <launch-project> --tools=none`.

#### Scenario: Pass-through without a new UI surface

- **GIVEN** a caller supplies a language option to the CLI execution layer
- **WHEN** `openspec init` runs
- **THEN** the argv SHALL contain `--language <value>`
- **AND** the Initialize Project Alert UI SHALL NOT gain a language input

### Requirement: JSON Stream Discipline for Admitted CLIs

Typed JSON invocations against admitted OpenSpec CLI 1.10/1.11 sessions SHALL keep stdout as a single JSON
document: the first-run telemetry notice and completions tip print to stderr and are deferred on JSON runs.
OpenSpecUI SHALL NOT relax the eager-JSON early-termination condition that requires an empty stderr, and
SHALL NOT treat the deferred notice/tip stderr lines of non-JSON runs as command diagnostics.

#### Scenario: JSON runs observe stream purity

- **GIVEN** the pinned 1.10.0 and 1.11.0 executables each answer a `--json` command
- **WHEN** stdout and stderr are captured for both
- **THEN** each stdout SHALL parse as exactly one JSON document
- **AND** each stderr SHALL remain free of telemetry and completions tip output
