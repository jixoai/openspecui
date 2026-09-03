<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Specify CLI discovery, execution, workflow mapping, error projection, config access, and Store fault tolerance.

Compromise: these six tightly coupled CLI-integration concerns remain in one capability spec because splitting them would break the established public capability identity during the OpenSpecUI 7 / OpenSpec CLI 1.7 adaptation.

Original request (2026-07-15): "CLI 1.6 兼容性门禁。"
Original request (2026-07-31): "开始发布6.1.0；目前这个版本先给它支持1.7.*，因为基本兼容。"
Owner clarification (2026-07-31): "6.* 本身就是适配 1.6.*；对于 1.7 只是兼容而已。"
Original request (2026-07-15): "sync、update 的完整交付链。"
Original request (2026-08-01): "openspec@v1.7.* 已经发布，我们开始 openspecui@v7.* 的适配计划。"
-->

# openspec-cli-integration Specification

## Purpose

Define how OpenSpecUI integrates with the OpenSpec CLI to execute OPSX workflows and stream command output across the active version line.

## Requirements

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

### Requirement: CLI Error Handling

OpenSpecUI SHALL surface CLI errors without losing last known UI state.

#### Scenario: Command failure

- **GIVEN** a CLI command exits with non-zero status
- **WHEN** OpenSpecUI receives the failure
- **THEN** the UI SHALL display an error message
- **AND** retain previous successful data

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

### Requirement: OpenSpec 1.7 Workflow Contract

OpenSpecUI SHALL preserve the complete observable OpenSpec 1.7 Status and operation-instruction contracts without
re-parsing OpenSpec files to invent missing facts.

#### Scenario: Preserve skipped artifacts

- **GIVEN** Status reports an artifact with `status: skipped` and `requires`
- **WHEN** workflow state is projected
- **THEN** the artifact SHALL satisfy downstream dependencies
- **AND** SHALL NOT be presented as done, ready, blocked, missing, or a physical output file

#### Scenario: Keep operation guidance separate

- **GIVEN** project configuration contains artifact rules and operation guidance
- **WHEN** Apply or Archive Instructions are projected
- **THEN** `operationGuidance` SHALL remain operation input
- **AND** artifact `rules` SHALL remain artifact-creation input
- **AND** neither SHALL be synthesized from the other

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

OpenSpecUI SHALL support `validate --archived --json` as a typed CLI validation result for admitted OpenSpec
CLI 1.12 sessions. It SHALL preserve archive identifiers, validation issues, totals, root, and exit/failure
evidence without writing, repairing, or archiving project files. Strict-mode escalation of warnings, including
the Purpose-placeholder warning class, SHALL remain CLI-owned.

#### Scenario: Render an archived validation failure

- **GIVEN** the admitted OpenSpec CLI reports incomplete archived tasks through `validate --archived --json`
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
