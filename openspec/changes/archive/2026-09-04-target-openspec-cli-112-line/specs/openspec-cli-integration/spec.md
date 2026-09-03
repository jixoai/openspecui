<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Advance the OpenSpec CLI admission, batch, diff, language, stream, and archived-validation contracts to
   the OpenSpecUI 12 line.
2. Add the validate findings report contract and the informational merge-conflict findings discipline.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

## MODIFIED Requirements

### Requirement: CLI Discovery and Version Enforcement

OpenSpecUI 12 SHALL classify stable OpenSpec CLI `>=1.12.0 <1.13.0` as supported, current, and recommended.
OpenSpec CLI `<1.12.0` (including the whole 1.10.x/1.11.x window that OpenSpecUI 11 admitted, and every older
line), every prerelease, `>=1.13.0`, and an unparseable version SHALL be incompatible and blocked by default.
When an incompatible executable is available, the mismatch Dialog MAY expose `Skip version check`; that action
SHALL bypass only the current Web page runtime's admission gate and SHALL NOT change the detected version,
compatibility evidence, CLI payloads, downstream errors, or product support claim.

#### Scenario: Accept the current 1.12 line

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.12.x executable
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** compatibility evidence SHALL identify the CLI as current and recommended

#### Scenario: Block unsupported version forms

- **GIVEN** OpenSpecUI 12 detects CLI 1.12.0-rc.1, 1.13.0, or an unparseable version
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** the mismatch evidence SHALL name the accepted and recommended ranges

#### Scenario: Retire the v11 admission window

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.10.x or 1.11.x executable that OpenSpecUI 11
  admitted
- **WHEN** admission is evaluated
- **THEN** the retired line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v12 accepted range `>=1.12.0 <1.13.0` and recommended range
  `>=1.12.0 <1.13.0`

#### Scenario: Accept the supported non-current 1.10 line

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.10.x executable that OpenSpecUI 11 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.10 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v12 accepted and recommended ranges

#### Scenario: Accept the current 1.11 line

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.11.x executable that OpenSpecUI 11 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.11 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v12 accepted and recommended ranges

#### Scenario: Accept the supported non-current 1.8 line

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.8.x executable that OpenSpecUI 9 admitted as its
  supported non-current line
- **WHEN** admission is evaluated
- **THEN** the retired 1.8 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v12 accepted and recommended ranges

#### Scenario: Accept the current 1.9 line

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.9.x executable that OpenSpecUI 9 admitted as its
  current and recommended line
- **WHEN** admission is evaluated
- **THEN** the retired 1.9 line SHALL be blocked by default
- **AND** the mismatch evidence SHALL name the v12 accepted and recommended ranges

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 12 detects a stable OpenSpec CLI 1.7.x executable that OpenSpecUI 7 admitted as its adapted
  line
- **WHEN** admission is evaluated
- **THEN** the retired 1.7 line SHALL remain blocked by default
- **AND** the mismatch evidence SHALL name the v12 accepted and recommended ranges

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 12 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify the v12 accepted and recommended ranges

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
- **AND** it SHALL NOT select line-specific capability facts or a fallback inventory
- **AND** downstream execution SHALL fail through its typed availability boundary rather than a simulated
  supported CLI

### Requirement: OPSX Command Mapping

OpenSpecUI SHALL map workflow actions, schema resolution, and project setup to official OpenSpec 1.12
commands with exact selected-Root or Launch Project ownership. It SHALL derive command availability from the
admitted running CLI's capabilities before invocation, rather than exposing a capability-gated command (batch
status, requirement diff, validation findings) to a session without that capability.

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
- **AND** preserve CLI-provided `context`, `operationGuidance`, Root evidence
- **AND** SHALL NOT derive Archive input from Status or artifact rules

#### Scenario: Resolve schemas through the selected 1.9 Root

- **GIVEN** an admitted OpenSpec CLI 1.12.x session has selected Root `store-a`
- **WHEN** Config requests its schema catalog
- **THEN** the system SHALL execute `openspec schemas --json --store store-a`
- **AND** preserve either its successful catalog or its selected-Root failure envelope as the selected Root's CLI fact

#### Scenario: Resolve schemas without a 1.9-only selector on 1.8

- **GIVEN** an admitted OpenSpec CLI session on the supported line
- **WHEN** Config requests its schema catalog with a selected Root
- **THEN** the system SHALL resolve through the selected-Root selector on the admitted line
- **AND** the retired 1.8 selector restriction SHALL NOT downgrade any admitted session to a selectorless query

#### Scenario: Restrict archived validation to OpenSpec 1.9

- **GIVEN** an admitted OpenSpec CLI 1.12.x session
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

### Requirement: Batch Status Envelope Contract

OpenSpecUI SHALL provide a typed `status --all --json` contract for admitted OpenSpec CLI 1.12 sessions. The
batch envelope SHALL be decoded as a sum type whose healthy entries are the single-change status payload,
whose failure entries are `{ changeName, status: [diagnostic] }` records preserved in place, whose empty set
MAY carry a `message` key, and whose root-selection failure is the `{ changes: [], root: null }` null shape
with its diagnostic `status` array preserved through the shared JSON failure contract. Healthy entries carry
the single-change status payload fields without a per-entry root; the envelope-level `root` is the batch's
root fact.
Decoding SHALL NOT consult the process exit code, because a partial failure exits 1 while stdout remains one
complete valid JSON document. OpenSpecUI SHALL NOT pass `--all` on sessions not admitted to the batch-status
capability, including page-level bypasses of retired lines.

#### Scenario: Decode a partial-failure batch

- **GIVEN** `status --all --json` exits 1 with one change-level load failure
- **WHEN** the envelope is decoded
- **THEN** every healthy entry SHALL parse as a single-change status payload
- **AND** the failed change SHALL surface its diagnostics as per-change evidence
- **AND** the transport SHALL NOT be classified as a CLI transport failure

#### Scenario: Capability-gate the batch invocation

- **GIVEN** a session whose CLI does not carry the batch-status capability, such as a bypassed stable 1.10.x
  executable
- **WHEN** the status list is loaded
- **THEN** OpenSpecUI SHALL use the per-change `status --change` transport
- **AND** SHALL NOT pass `--all` to any argv

### Requirement: Requirement Diff Evidence Contract

OpenSpecUI SHALL provide a typed `show <change> --json --diff` contract for admitted OpenSpec CLI 1.12
sessions. The contract SHALL accept the optional `diff` and `warning` fields on `MODIFIED` deltas only and
SHALL preserve their exact upstream strings. OpenSpecUI SHALL NOT recompute requirement diffs locally, SHALL
NOT relax the strict local delta schema to absorb these fields, and SHALL NOT pass `--diff` on sessions not
admitted to the requirement-diff capability.

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
`--language <value>` for admitted OpenSpec CLI sessions. The persisted result SHALL be surfaced as the
existing Active Root `context` field evidence; OpenSpecUI SHALL NOT expose a language input in the Initialize
Project Alert, whose mutation SHALL remain exactly `openspec init <launch-project> --tools=none`.

#### Scenario: Pass-through without a new UI surface

- **GIVEN** a caller supplies a language option to the CLI execution layer
- **WHEN** `openspec init` runs
- **THEN** the argv SHALL contain `--language <value>`
- **AND** the Initialize Project Alert UI SHALL NOT gain a language input

### Requirement: JSON Stream Discipline for Admitted CLIs

Typed JSON invocations against admitted OpenSpec CLI 1.12 sessions SHALL keep stdout as a single JSON
document: the first-run telemetry notice and completions tip print to stderr and are deferred on JSON runs.
OpenSpecUI SHALL NOT relax the eager-JSON early-termination condition that requires an empty stderr, and
SHALL NOT treat the deferred notice/tip stderr lines of non-JSON runs as command diagnostics.

#### Scenario: JSON runs observe stream purity

- **GIVEN** the pinned 1.12.0 executable answers a `--json` command
- **WHEN** stdout and stderr are captured
- **THEN** stdout SHALL parse as exactly one JSON document

### Requirement: Archived Validation Evidence

OpenSpecUI SHALL support `validate --archived --json` as a typed CLI validation result for admitted OpenSpec
CLI 1.12 sessions. It SHALL preserve archive identifiers, validation issues, totals, root, and exit/failure
evidence without writing, repairing, or archiving project files. Strict-mode escalation of warnings, including
the Purpose-placeholder warning class, SHALL remain CLI-owned.

#### Scenario: Render an archived validation failure

- **GIVEN** the admitted OpenSpec CLI reports incomplete archived tasks through `validate --archived --json`
- **WHEN** OpenSpecUI projects the result
- **THEN** the validation failure SHALL remain visible with its CLI diagnostics
- **AND** OpenSpecUI SHALL NOT mark the archive valid or perform repair automatically

## ADDED Requirements

### Requirement: Validation Findings Report Contract

OpenSpecUI SHALL provide a typed `validate --report findings --json` contract for admitted OpenSpec CLI 1.12
sessions, invoked only with an explicit bulk scope (`--all`, `--changes`, `--specs`, or `--archived`), never
combined with an item name, and never combining archived and active scopes. The document SHALL decode as a
`report` block (`kind: 'validation-findings'`, `version`, `scope`, `returnedItems`, `totalItems`) plus
`itemFindings` carrying only items with at least one issue, `summary`, and `root`, where `summary` and `root`
are the full-run values. Decoding SHALL NOT consult the process exit code. A findings document is filtered
evidence and SHALL NOT replace the full validate report as the validation truth source. Invalid report
requests SHALL surface through the shared diagnostic-failure envelope with code
`invalid_validation_report_request` and their `fix` string preserved. OpenSpecUI SHALL NOT pass `--report`
argv on sessions not admitted to the findings capability.

#### Scenario: Decode a populated findings document

- **GIVEN** the pinned 1.12.0 executable answers `validate --all --report findings --json` with one item
  carrying informational findings only
- **WHEN** the document is decoded
- **THEN** `report.returnedItems` SHALL be less than or equal to `report.totalItems`
- **AND** every `itemFindings` entry SHALL carry at least one issue
- **AND** the process exit code SHALL remain the full-run rule

#### Scenario: Decode an empty-scope findings document

- **GIVEN** the pinned 1.12.0 executable answers `validate --specs --report findings --json` on a project
  with zero specs
- **WHEN** the document is decoded
- **THEN** it SHALL decode as a normal success document with `returnedItems: 0` and `totalItems: 0`
- **AND** SHALL NOT be classified as a failure sum type

#### Scenario: Surface a findings request error

- **GIVEN** `--report findings` is requested without a bulk scope, with an item name, with an unknown value,
  or combining archived and active scopes
- **WHEN** the CLI answers
- **THEN** the shared diagnostic-failure envelope SHALL decode with code `invalid_validation_report_request`
- **AND** the `fix` string SHALL be preserved verbatim
- **AND** the request SHALL NOT be retried with a mutated scope

#### Scenario: Capability-gate the findings invocation

- **GIVEN** a session whose CLI does not carry the findings capability, such as a pinned or bypassed stable
  1.11.x executable
- **WHEN** validation evidence is loaded
- **THEN** OpenSpecUI SHALL NOT pass `--report` to any argv

### Requirement: Merge-Conflict Informational Findings Discipline

OpenSpecUI SHALL present CLI-reported informational validation findings as a first-class informational class,
distinct from warnings and errors. Merge-conflict advisory findings (`Archive would refuse this delta: ...`
and `Could not check archive merge conflicts: ...`) SHALL remain visible with their exact CLI text without
changing validity, progress, or exit-status evidence. OpenSpecUI SHALL NOT recompute, deduplicate beyond the
CLI's own already-reported filter, or suppress informational findings locally, and validity arithmetic plus
strict-mode escalation SHALL remain CLI-owned.

#### Scenario: Informational findings stay informational

- **GIVEN** a validated change is `valid: true` while carrying an `INFO` merge-conflict finding
- **WHEN** the validation evidence is projected
- **THEN** the finding SHALL render as an informational item with CLI provenance
- **AND** the change's validity and the validation totals SHALL remain unchanged

#### Scenario: No local merge re-derivation

- **GIVEN** a delta MODIFIED against a spec that fails structural validation
- **WHEN** the CLI reports the structural error and suppresses its merge-conflict counterpart for the same
  path
- **THEN** OpenSpecUI SHALL render exactly the CLI-reported findings
- **AND** SHALL NOT locally run or simulate an archive merge to add or remove findings
