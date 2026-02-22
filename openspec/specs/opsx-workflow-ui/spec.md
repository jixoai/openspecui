# opsx-workflow-ui Specification

## Purpose

Define OpenSpecUI behavior so OPSX workflow UI is kernel-first, CLI-aligned, and strictly reactive for OpenSpec 1.x projects.

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

#### Scenario: Enforce 1.1.x baseline only

- **GIVEN** project targets OpenSpec CLI 1.1.x
- **WHEN** compatibility is evaluated
- **THEN** UI SHALL require CLI 1.1.x or newer
- **AND** SHALL NOT implement backward compatibility for pre-1.1.x releases

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
