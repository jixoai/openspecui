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

OpenSpecUI 7 SHALL classify only OpenSpec CLI `>=1.7.0 <1.8.0` as supported and adapted. Every other detected
version SHALL be incompatible and blocked by default. When an incompatible executable is available, the mismatch
Dialog MAY expose `Skip version check`; that action SHALL bypass only the current Web page runtime's admission gate
and SHALL NOT change the detected version, compatibility evidence, CLI payloads, downstream errors, or product
support claim.

#### Scenario: Accept the adapted 1.7 line

- **GIVEN** OpenSpecUI 7 detects OpenSpec CLI `>=1.7.0 <1.8.0`
- **WHEN** admission is evaluated
- **THEN** normal interactions SHALL be admitted
- **AND** no version mismatch Dialog SHALL be shown

#### Scenario: Block OpenSpec CLI 1.6

- **GIVEN** OpenSpecUI 7 detects an available OpenSpec CLI 1.6.x executable
- **WHEN** admission is evaluated
- **THEN** the mismatch Dialog SHALL block normal interactions
- **AND** SHALL identify 1.7.x as the required line

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

OpenSpecUI SHALL map workflow actions and project setup to official OpenSpec 1.7 commands with exact selected-Root
or Launch Project ownership.

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
