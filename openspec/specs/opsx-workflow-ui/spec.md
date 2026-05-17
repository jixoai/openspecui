# opsx-workflow-ui Specification

## Purpose

Define OpenSpecUI behavior so OPSX workflow UI is kernel-first, CLI-aligned, and strictly reactive for supported OpenSpec CLI projects.

## Requirements

### Requirement: Kernel-First OPSX Read Model

OpenSpecUI SHALL serve OPSX read data from the in-memory kernel state, with CLI/file-system work performed by reactive kernel streams.

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

### Requirement: CLI-Driven Artifact Status

OpenSpecUI SHALL derive artifact status solely from `openspec status --json` output.

#### Scenario: Render artifact readiness from CLI

- **GIVEN** an active change exists
- **WHEN** OpenSpecUI requests status
- **THEN** the UI SHALL display each artifact with CLI-provided `done/ready/blocked` status
- **AND** SHALL NOT infer readiness from local file parsing

#### Scenario: Refresh status reactively

- **GIVEN** files under `openspec/changes/` change
- **WHEN** watcher events are observed by reactive streams
- **THEN** status streams SHALL re-execute and push updated artifact states

### Requirement: CLI-Driven Artifact Instructions

OpenSpecUI SHALL obtain artifact instructions exclusively from `openspec instructions --json`.

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

OpenSpecUI SHALL determine configured tools using skills directories rather than legacy slash-command files.

#### Scenario: Detect configured tools via skills

- **GIVEN** a tool has a skills directory configured
- **WHEN** UI checks tool configuration
- **THEN** the tool SHALL be treated as configured only if `skills/<skill>/SKILL.md` exists

#### Scenario: Refresh tool status on skills changes

- **GIVEN** a skills directory changes
- **WHEN** watcher detects the change
- **THEN** UI SHALL refresh tool detection state

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
