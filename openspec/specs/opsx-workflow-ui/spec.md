# opsx-workflow-ui Specification

## Purpose

Define OpenSpecUI behavior so OPSX workflow UI is kernel-first, CLI-aligned, and strictly reactive for supported OpenSpec CLI projects.

## Requirements

### Requirement: Kernel-First OPSX Read Model

OpenSpecUI SHALL serve OPSX read data from the in-memory kernel state, with CLI/file-system work performed by
reactive kernel streams. For admitted OpenSpec CLI 1.11 sessions, status-list loading MAY use the single-spawn
`status --all` batch transport behind the capability gate; the `opsx-status-list` Work identity, per-change
reactive dependencies, planning-completion semantics, and Apply progress semantics SHALL remain identical to
the per-change transport. Admitted 1.10 sessions SHALL keep the per-change transport.

#### Scenario: Serve reads from memory state

- **GIVEN** OPSX data has been warmed or ensured in kernel streams
- **WHEN** any OPSX read endpoint is requested
- **THEN** the server SHALL read from kernel memory state
- **AND** SHALL NOT run duplicate ad-hoc read logic in router handlers

#### Scenario: Recover from warmup failure

- **GIVEN** kernel warmup fails due to transient CLI or file-system issues
- **WHEN** a later request requires OPSX data
- **THEN** the kernel SHALL allow re-warm/re-ensure
- **AND** SHALL NOT remain permanently locked in a failed warmup state

#### Scenario: Batch transport preserves projection identity

- **GIVEN** an admitted OpenSpec CLI 1.11 session loads the full status list in one spawn
- **WHEN** the batch envelope is projected
- **THEN** the `opsx-status-list` Work identity and per-change dependencies SHALL match the per-change
  transport's semantics
- **AND** a per-change load failure SHALL surface as that change's evidence without failing unrelated changes

#### Scenario: Non-batch sessions keep the serial path

- **GIVEN** an admitted OpenSpec CLI 1.10.x session loads the status list
- **WHEN** statuses are fetched
- **THEN** the kernel SHALL use the per-change transport
- **AND** SHALL NOT invoke `--all`

### Requirement: CLI-Driven Artifact Status

Artifact state SHALL preserve OpenSpec 1.7 `done`, `ready`, `blocked`, and `skipped` values plus exact dependency
arrays. `skipped` SHALL be dependency-satisfied but SHALL NOT imply a physical artifact or completed work.

#### Scenario: Render artifact readiness from CLI

- **GIVEN** an active change exists
- **WHEN** OpenSpecUI requests status
- **THEN** the UI SHALL display each artifact with CLI-provided `done/ready/blocked` status
- **AND** SHALL NOT infer readiness from local file parsing

#### Scenario: Refresh status reactively

- **GIVEN** files under `openspec/changes/` change
- **WHEN** watcher events are observed by reactive streams
- **THEN** status streams SHALL re-execute and push updated artifact states

#### Scenario: Render an intentionally skipped artifact

- **GIVEN** Status reports `status: skipped`
- **WHEN** the Change workflow is rendered
- **THEN** the artifact SHALL be identified as intentionally skipped
- **AND** SHALL NOT expose Create, Edit, or missing-file actions
- **AND** dependent ready artifacts SHALL remain actionable when all other requirements are satisfied

### Requirement: CLI-Driven Artifact Instructions

Workflow actions SHALL consume the exact selected-Root instruction contract for artifacts, Apply, and Archive.

#### Scenario: Load instructions for selected artifact

- **GIVEN** a user selects an artifact in the graph
- **WHEN** OpenSpecUI requests instructions
- **THEN** the UI SHALL render CLI-provided template, dependencies, and output path
- **AND** SHALL display blocking dependencies reported by CLI

#### Scenario: Persist artifact output by outputPath

- **GIVEN** instructions specify an output path
- **WHEN** the user saves artifact content
- **THEN** the UI SHALL write to the CLI-provided output path
- **AND** trigger status refresh

#### Scenario: Load apply instructions with multiple context files

- **GIVEN** OpenSpec CLI reports apply `contextFiles` with one or more paths per artifact id
- **WHEN** the kernel warms apply instructions
- **THEN** OpenSpecUI SHALL preserve every CLI-provided context file path
- **AND** legacy single-path values SHALL be normalized into one-item path arrays

#### Scenario: Compose Apply with runtime inputs

- **WHEN** Apply is invoked
- **THEN** the Agent/CLI composition SHALL include CLI-provided project `context` and Apply `operationGuidance`
- **AND** preserve their provenance separately from artifact rules

#### Scenario: Compose Archive with runtime inputs

- **WHEN** Archive is invoked
- **THEN** the action SHALL first consume Archive Instructions for the selected Root
- **AND** include CLI-provided `context` and Archive `operationGuidance`
- **AND** SHALL NOT substitute Status evidence

### Requirement: Config-Centered Schema Metadata

OpenSpecUI SHALL expose configuration and schema metadata through a single config bundle subscription path.

#### Scenario: Load config bundle in one subscription

- **GIVEN** the user opens Config or Schemas view
- **WHEN** the frontend subscribes to the config bundle
- **THEN** the server SHALL return schemas plus schema detail/resolution maps in one payload stream

#### Scenario: No split schema subscription path

- **GIVEN** config bundle exists
- **WHEN** schema metadata is consumed by frontend pages
- **THEN** frontend SHALL NOT depend on legacy split schema subscriptions for list/detail/resolution

#### Scenario: Progressive schema readiness

- **GIVEN** schema detail/resolution for some schemas is still warming
- **WHEN** config bundle is emitted
- **THEN** those entries MAY be `null` initially
- **AND** SHALL be updated reactively when streams become ready

### Requirement: Schema and Project Configuration Visibility

OpenSpecUI SHALL surface schema, template, and configuration data in the Config view.

#### Scenario: Display available schemas

- **GIVEN** the project contains built-in or local schemas
- **WHEN** the Config view queries `openspec schemas --json`
- **THEN** the UI SHALL list schemas with their descriptions and source metadata

#### Scenario: Display a schema definition

- **GIVEN** a user selects a schema
- **WHEN** the UI resolves the schema path via `openspec schema which --json`
- **THEN** the UI SHALL display artifact definitions, dependencies, and apply requirements from schema.yaml

#### Scenario: Display template mappings

- **GIVEN** template mappings are available
- **WHEN** the Config view calls `openspec templates --json`
- **THEN** the UI SHALL list artifacts with their template paths and sources within schema detail

#### Scenario: Display project configuration

- **GIVEN** `openspec/config.yaml` exists
- **WHEN** the Config view loads
- **THEN** the UI SHALL render the configuration content
- **AND** indicate if the file is missing

#### Scenario: Edit project configuration

- **GIVEN** config.yaml exists
- **WHEN** the user enters Edit mode
- **THEN** the UI SHALL allow editing and Save/Cancel

#### Scenario: Edit schema assets when allowed

- **GIVEN** a schema source is project or user
- **WHEN** the user opens schema.yaml or a template
- **THEN** the UI SHALL allow editing with explicit Save/Cancel

#### Scenario: Prevent edits to package sources

- **GIVEN** a schema source is package
- **WHEN** the user opens schema.yaml or templates
- **THEN** the UI SHALL render read-only content

### Requirement: OPSX Command Alignment

OpenSpecUI SHALL expose only `/opsx:*` commands and map each action to official CLI commands.

#### Scenario: Present OPSX actions in UI

- **GIVEN** a change is active
- **WHEN** user opens action panel
- **THEN** UI SHALL list `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:apply`, `/opsx:verify`, `/opsx:sync`, `/opsx:archive`, `/opsx:bulk-archive`, and `/opsx:onboard`
- **AND** SHALL NOT display legacy `/openspec:*` commands

#### Scenario: Execute CLI-backed action

- **GIVEN** user triggers an OPSX action
- **WHEN** action runs
- **THEN** OpenSpecUI SHALL execute corresponding CLI command
- **AND** stream output to terminal panel

### Requirement: OPSX Agent Invocation Modes

OpenSpecUI SHALL support both compose-mode and command-mode agent handoff for OPSX workflows, with compose mode as the default.

#### Scenario: Persist invocation preference

- **GIVEN** the user changes OPSX agent invocation mode
- **WHEN** OpenSpecUI saves runtime settings
- **THEN** the preference SHALL be persisted as `opsx.agentInvocationMode`
- **AND** default `compose` values SHALL NOT require a persisted config file

#### Scenario: Quick Propose uses compose by default

- **GIVEN** the invocation mode is unset or `compose`
- **WHEN** the user sends Quick Propose to a terminal
- **THEN** OpenSpecUI SHALL send a self-contained compose prompt for the OpenSpec propose workflow
- **AND** SHALL NOT require `/opsx:propose` to be installed

#### Scenario: Command-equivalent actions honor command mode

- **GIVEN** `opsx.agentInvocationMode` is `command`
- **WHEN** the user dispatches Quick Propose, apply, or archive to an agent terminal
- **THEN** OpenSpecUI SHALL send the corresponding `/opsx:*` command payload

#### Scenario: Artifact-specific actions fall back to compose

- **GIVEN** `opsx.agentInvocationMode` is `command`
- **WHEN** the user dispatches a selected-artifact continue or fast-forward action
- **THEN** OpenSpecUI SHALL keep compose mode
- **AND** SHALL explain that selected artifact context requires compose mode

### Requirement: Skills-Based Tool Detection

Agent integration detection SHALL model OpenSpec 1.7 delivery capabilities and physical artifacts rather than
assuming every tool has the same skills and command layout.

#### Scenario: Detect configured tools via skills

- **GIVEN** a tool has a skills directory configured
- **WHEN** UI checks tool configuration
- **THEN** the tool SHALL be treated as configured only if `skills/<skill>/SKILL.md` exists

#### Scenario: Refresh tool status on skills changes

- **GIVEN** a skills directory changes
- **WHEN** watcher detects the change
- **THEN** UI SHALL refresh tool detection state

#### Scenario: Detect Codex skills-only delivery

- **GIVEN** OpenSpec-managed Codex skills are current and no managed Codex command artifacts exist
- **WHEN** Agent state is projected
- **THEN** Codex SHALL be initialized and current for skills-only delivery
- **AND** missing command files SHALL NOT create a partial state

#### Scenario: Report migration and cleanup

- **GIVEN** OpenSpec-managed artifacts remain in a retired or renamed tool location
- **WHEN** Agent state is projected
- **THEN** the UI SHALL identify the exact migration/cleanup requirement
- **AND** SHALL NOT delete artifacts until the official CLI operation is explicitly executed

#### Scenario: Preserve complete 1.7 inventory

- **WHEN** the Agent registry is listed
- **THEN** CodeArts Agent, Hermes, ZCode, Devin alias behavior, Qwen Markdown command format, and all other official
  1.7 tools SHALL preserve their declared capability and physical metadata

### Requirement: CLI Health and Version Enforcement

OpenSpecUI SHALL block OPSX usage when required CLI capability is missing.

#### Scenario: CLI unavailable

- **GIVEN** CLI is missing
- **WHEN** OpenSpecUI initializes
- **THEN** UI SHALL present a blocking notice with install/upgrade guidance
- **AND** prevent OPSX actions until resolved

#### Scenario: Enforce OpenSpecUI 3.x CLI compatibility

- **GIVEN** OpenSpecUI 3.x evaluates a project runtime
- **WHEN** compatibility is evaluated
- **THEN** UI SHALL accept OpenSpec CLI `>=1.2.0 <1.4.0`
- **AND** SHALL treat OpenSpec CLI `>=1.3.0 <1.4.0` as the current target line
- **AND** SHALL treat OpenSpec CLI `>=1.2.0 <1.3.0` as legacy-compatible
- **AND** SHALL block versions outside `>=1.2.0 <1.4.0`

#### Scenario: Missing project config or required skills

- **GIVEN** `openspec/config.yaml` or required skills are missing
- **WHEN** UI initializes
- **THEN** UI SHALL prompt user to run `openspec init` or `openspec update`

### Requirement: Reactive Refresh Pipeline and Error Behavior

OpenSpecUI SHALL refresh via reactive watcher-driven streams and preserve last-known-good data on refresh failures.

#### Scenario: Change metadata update triggers refresh

- **GIVEN** `.openspec.yaml` changes for an active change
- **WHEN** watcher event is received
- **THEN** status/instructions streams SHALL refresh

#### Scenario: Schema file updates trigger refresh

- **GIVEN** files under `openspec/schemas/` change
- **WHEN** watcher event is received
- **THEN** config bundle and related schema streams SHALL refresh

#### Scenario: CLI error during reactive refresh

- **GIVEN** a CLI command fails during refresh
- **WHEN** UI receives the error
- **THEN** UI SHALL keep previous successful data
- **AND** show an actionable error with retry

#### Scenario: Instructions refresh failure

- **GIVEN** instruction retrieval fails after previously successful load
- **WHEN** UI receives the failure
- **THEN** UI SHALL keep previous instruction content visible
- **AND** mark it as stale until a successful refresh arrives

### Requirement: Schema-Neutral Entity Detail Model

OpenSpecUI SHALL expose active and archived OPSX detail data as schema-neutral entities whose primary truth is their readable file tree.

#### Scenario: Entity identity is directory identity

- **GIVEN** a directory exists at `openspec/changes/<change-id>` or `openspec/changes/archive/<archive-id>`
- **WHEN** OpenSpecUI reads detail data for that id and stage
- **THEN** the entity SHALL be considered present
- **AND** root `proposal.md`, `tasks.md`, `design.md`, or `specs/**/spec.md` SHALL NOT be required for entity existence

#### Scenario: Entity detail preserves readable files

- **GIVEN** an OPSX entity directory contains readable files
- **WHEN** OpenSpecUI builds entity detail
- **THEN** the detail SHALL include those files with paths relative to the entity root
- **AND** it SHALL include hidden metadata files when readable

#### Scenario: Schema metadata is optional

- **GIVEN** `.openspec.yaml` is missing, invalid, or references a schema that cannot be resolved
- **WHEN** OpenSpecUI builds entity detail
- **THEN** it SHALL still return entity detail with readable files
- **AND** it SHALL attach non-fatal diagnostics describing the metadata or schema issue

### Requirement: Shared OPSX Entity Utilities

OpenSpecUI SHALL centralize OPSX entity detail construction in shared utility functions used by live server, static export, and static runtime code.

#### Scenario: Single artifact matching implementation

- **GIVEN** live mode, static export, and static runtime need to match files to schema artifact output paths
- **WHEN** they build or consume OPSX entity detail
- **THEN** they SHALL use the same shared artifact matching semantics
- **AND** they SHALL NOT maintain separate hardcoded fallback mappings for proposal, tasks, design, or delta specs

#### Scenario: Archive surfaces consume entity file truth

- **GIVEN** an archive is surfaced in detail, search, dashboard, static export, or static runtime
- **WHEN** OpenSpecUI needs objective archive content or archive existence
- **THEN** it SHALL use the schema-neutral entity file model
- **AND** it SHALL NOT depend on parsing a legacy spec-driven `Change` projection

#### Scenario: Direct and glob artifact outputs

- **GIVEN** a schema artifact output path is either a direct path or a glob pattern
- **WHEN** entity files are matched to artifacts
- **THEN** direct paths SHALL match normalized relative file paths
- **AND** glob paths SHALL match normalized relative file paths deterministically

#### Scenario: Tolerant schema detail parsing

- **GIVEN** schema YAML contains fields unknown to the current OpenSpecUI version
- **WHEN** OpenSpecUI parses schema detail for entity display
- **THEN** it SHALL preserve supported artifact identity and output path fields when possible
- **AND** it SHALL report unsupported or invalid portions as diagnostics instead of discarding the entity

### Requirement: Generic Document Identity for Artifacts

OpenSpecUI SHALL identify schema artifact documents through a generic artifact document kind.

#### Scenario: Build artifact document ref

- **GIVEN** an entity artifact file is processed for view, search, or export
- **WHEN** OpenSpecUI calls `onReadDocument`
- **THEN** the document ref SHALL use `kind: "artifact"`
- **AND** it SHALL include stage, change id, concrete relative path, schema name when known, artifact id when known, and artifact output path when known

#### Scenario: Preserve legacy document kinds only as explicit file identities

- **GIVEN** a file path is `proposal.md`, `tasks.md`, `design.md`, or `specs/<id>/spec.md`
- **WHEN** that file is read outside schema artifact context
- **THEN** OpenSpecUI MAY expose the legacy document kind for that explicit file
- **AND** it SHALL NOT require those legacy kinds to build entity detail

### Requirement: Explicit Planning Completion Projection

For supported OpenSpec CLI 1.10.x and 1.11.x, OpenSpecUI SHALL project `isPlanningComplete` as the completion
fact for planning artifacts. It SHALL NOT use planning completion to claim implementation task completion,
validation, sync, archive, or release readiness. The retained `isComplete` field MAY be preserved as raw CLI
evidence but SHALL not become an ambiguous user-facing completion authority.

#### Scenario: Planning is complete while implementation work remains

- **GIVEN** Status reports `isPlanningComplete: true`
- **AND** Apply Instructions report remaining tasks
- **WHEN** the Change is rendered
- **THEN** OpenSpecUI SHALL identify planning as complete
- **AND** SHALL continue to show implementation progress as incomplete

### Requirement: CLI Apply Progress Is Authoritative

OpenSpecUI SHALL preserve CLI-owned implementation progress from both the Change-list task summary and
`instructions apply --json` `progress.total`, `progress.complete`, and `progress.remaining` when those projections
are available. Change List, Dashboard, and ReadonlyKanban MAY show the CLI list summary as `completed/total` and a
proportional visual signal. Detail SHALL show the source-attributed Apply progress when Apply Instructions are loaded.
The actionable `tasks` list and locally parsed checklists SHALL remain separate projections and SHALL NOT redefine the
CLI progress denominator or phase.

#### Scenario: Planning completion does not hide applied CLI work

- **GIVEN** Status reports `isPlanningComplete: true`
- **AND** CLI task evidence reports `completedTasks: 31` and `totalTasks: 33`
- **WHEN** a Change is rendered in Change List or Dashboard
- **THEN** the phase SHALL be `Applying`
- **AND** the row SHALL show `Tasks 31/33`
- **AND** the row MAY show a proportional progress signal
- **AND** it SHALL NOT show `Planning Complete` as the only phase signal

#### Scenario: CLI list summary remains valid before Detail Apply Instructions load

- **GIVEN** Change List has a CLI-owned task summary but Detail Apply Instructions have not been loaded
- **WHEN** the Change row renders
- **THEN** the row MAY show the CLI `completed/total` summary and proportional signal
- **AND** the summary SHALL be labeled or attributable to the CLI

#### Scenario: Aggregate Status loading does not mask CLI Apply evidence

- **GIVEN** a Change List or Dashboard primary row carries CLI `completedTasks: 31` and `totalTasks: 33`
- **AND** the separately admitted aggregate Status projection has not returned for that Change
- **WHEN** the row first renders
- **THEN** its phase SHALL be `Applying`, not `Unknown`
- **AND** it SHALL expose CLI `Tasks 31/33`
- **AND** artifact status MAY remain visibly loading or unavailable without relabeling the CLI Apply fact

#### Scenario: Blank task description remains in CLI progress

- **GIVEN** a supported CLI reports a checkbox task with an empty description that is omitted from `tasks`
- **WHEN** Apply progress is projected
- **THEN** the displayed implementation total SHALL equal CLI `progress.total`
- **AND** SHALL NOT equal `tasks.length` when they differ

#### Scenario: Indented checkbox task is included

- **GIVEN** a supported CLI reports progress for an indented checkbox task
- **WHEN** Apply progress is projected
- **THEN** the progress total and completion SHALL preserve the CLI result
- **AND** local checklist analytics SHALL not overwrite it

#### Scenario: Tracked analytics never replace CLI evidence

- **GIVEN** a Change has CLI `31/33` evidence and divergent local tracked values `1/100`
- **WHEN** Change List, Dashboard, or ReadonlyKanban renders
- **THEN** the implementation evidence SHALL remain `31/33`
- **AND** the phase and proportional signal SHALL derive from the CLI values
- **AND** `1/100` SHALL NOT be shown as implementation progress

#### Scenario: Missing CLI evidence stays absent

- **GIVEN** a Change has local tracked task data but no CLI task summary
- **WHEN** a list surface renders
- **THEN** it SHALL omit implementation task counts and progress signals
- **AND** it MAY still show planning/artifact status

#### Scenario: List does not relabel tracked analytics as implementation progress

- **GIVEN** Change List has Status and locally tracked task data but has not loaded any CLI task summary
- **WHEN** it renders a Change row
- **THEN** it MAY show planning/artifact workflow phase
- **AND** it SHALL NOT label tracked totals, a tracked percentage, or a tracked completion state as implementation
  task progress

#### Scenario: Detail always shows available Apply progress

- **GIVEN** Change Detail has Apply Instructions with a progress payload
- **WHEN** tracked analytics agree with the CLI Apply count
- **THEN** it SHALL display the source-attributed CLI Apply progress
- **AND** tracked analytics SHALL remain absent or clearly secondary unless divergence requires comparison

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against pinned OpenSpec 1.10.0 and 1.11.0 executables.
A hand-authored payload alone SHALL NOT establish support for either CLI line, and a fixture for one line
SHALL NOT be reused as evidence for the other.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against OpenSpec 1.10.0 and 1.11.0
- **WHEN** it evaluates Status and Apply Instructions
- **THEN** each executable SHALL satisfy the typed planning-completion and progress contracts

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the pinned 1.10.0 executable receives `status --all` or `show --diff`
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the rejections SHALL be recorded as the 1.11-only capability evidence
- **AND** the 1.11.0 executable SHALL prove both payloads

### Requirement: MODIFIED Delta Diff Evidence Surface

Change Detail SHALL present the CLI-provided per-requirement `diff` and `warning` fields for MODIFIED deltas as
evidence when an admitted OpenSpec CLI 1.11 session provides them. The display SHALL render the unified diff
body and the exact upstream warning text, SHALL identify the evidence as CLI-owned, and SHALL degrade to the
existing delta presentation when the fields are absent or the session is below 1.11.

#### Scenario: Render a MODIFIED requirement diff

- **GIVEN** an admitted 1.11 session and a change with one MODIFIED delta carrying a diff
- **WHEN** Change Detail renders the delta
- **THEN** the diff SHALL be visible in the direct evidence layer with CLI provenance
- **AND** SHALL NOT be recomputed from local parsing

#### Scenario: Degrade without diff evidence

- **GIVEN** an admitted 1.10 session or a delta without diff fields
- **WHEN** Change Detail renders the delta
- **THEN** the existing delta presentation SHALL remain unchanged
- **AND** no fabricated diff or warning SHALL appear
