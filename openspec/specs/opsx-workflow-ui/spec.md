# opsx-workflow-ui Specification

## Purpose
Define the OpenSpecUI behavior and data model so the UI fully aligns with the OpenSpec 1.x OPSX workflow, using official CLI outputs as the single source of truth.

## Requirements

### Requirement: CLI-Driven Artifact Status
OpenSpecUI SHALL derive artifact status solely from `openspec status --json` output.

#### Scenario: Render artifact readiness from CLI
- **GIVEN** an active change exists
- **WHEN** OpenSpecUI requests status
- **THEN** the UI SHALL display each artifact with the CLI-provided `done/ready/blocked` status
- **AND** the UI SHALL NOT infer readiness from local file parsing

#### Scenario: Refresh status on file changes
- **GIVEN** files under `openspec/changes/` change
- **WHEN** the file watcher detects a modification
- **THEN** OpenSpecUI SHALL re-fetch `openspec status --json`
- **AND** update the rendered artifact states

### Requirement: CLI-Driven Artifact Instructions
OpenSpecUI SHALL obtain artifact instructions exclusively from `openspec instructions --json`.

#### Scenario: Load instructions for selected artifact
- **GIVEN** a user selects an artifact in the graph
- **WHEN** OpenSpecUI requests instructions
- **THEN** the UI SHALL render the CLI-provided template, dependencies, and output path
- **AND** the UI SHALL display any blocking dependencies reported by the CLI

#### Scenario: Persist artifact output by outputPath
- **GIVEN** instructions specify an output path
- **WHEN** the user saves the artifact content
- **THEN** the UI SHALL write to the CLI-provided output path
- **AND** trigger a status refresh

### Requirement: OPSX Command Alignment
OpenSpecUI SHALL expose only `/opsx:*` commands and map each action to the official CLI command.

#### Scenario: Present OPSX actions in the UI
- **GIVEN** a change is active
- **WHEN** the user opens the action panel
- **THEN** the UI SHALL list `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:apply`, `/opsx:verify`, `/opsx:sync`, `/opsx:archive`, `/opsx:bulk-archive`, and `/opsx:onboard`
- **AND** the UI SHALL NOT display legacy `/openspec:*` commands

#### Scenario: Execute a CLI-backed action
- **GIVEN** the user triggers an OPSX action from the UI
- **WHEN** the action runs
- **THEN** OpenSpecUI SHALL execute the corresponding CLI command and stream output to the terminal panel

### Requirement: Schema and Configuration Visibility
OpenSpecUI SHALL surface schema and configuration data from OpenSpec projects.

#### Scenario: Display available schemas
- **GIVEN** the project contains built-in or local schemas
- **WHEN** the UI queries `openspec schemas --json`
- **THEN** the UI SHALL list schemas with their descriptions

#### Scenario: Display a schema definition
- **GIVEN** a user selects a schema
- **WHEN** the UI calls `openspec schema show --json`
- **THEN** the UI SHALL display artifact definitions, dependencies, and apply requirements

#### Scenario: Display project configuration
- **GIVEN** `openspec/config.yaml` exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL render the configuration content
- **AND** indicate if the file is missing

### Requirement: Skills-Based Tool Detection
OpenSpecUI SHALL determine configured tools using skills directories rather than legacy slash-command files.

#### Scenario: Detect configured tools via skills
- **GIVEN** a tool has a skills directory configured
- **WHEN** the UI checks tool configuration
- **THEN** the UI SHALL treat the tool as configured only if `skills/<skill>/SKILL.md` exists

#### Scenario: Refresh tool status on skills changes
- **GIVEN** a skills directory changes
- **WHEN** the file watcher detects the change
- **THEN** the UI SHALL refresh tool detection state

### Requirement: CLI Health and Upgrade Enforcement
OpenSpecUI SHALL block usage when the CLI is missing or below the required version.

#### Scenario: CLI version requirement
- **GIVEN** the CLI is missing or reports a version below 1.0.0
- **WHEN** OpenSpecUI initializes
- **THEN** the UI SHALL present a blocking notice with upgrade instructions
- **AND** prevent OPSX actions until resolved

#### Scenario: Enforce 1.1.x baseline only
- **GIVEN** the project targets OpenSpec CLI 1.1.x
- **WHEN** OpenSpecUI evaluates compatibility
- **THEN** the UI SHALL require CLI version 1.1.x or newer
- **AND** the UI SHALL NOT implement backward-compatibility logic for pre-1.1.x releases

#### Scenario: Missing config or skills
- **GIVEN** `openspec/config.yaml` or required skills are missing
- **WHEN** the UI initializes
- **THEN** the UI SHALL prompt the user to run `openspec init` or `openspec update`

### Requirement: Reactive Refresh Pipeline
OpenSpecUI SHALL use file watchers to trigger CLI refreshes without local parsing.

#### Scenario: Change metadata updates
- **GIVEN** a change metadata file `.openspec.yaml` is updated
- **WHEN** the watcher detects the update
- **THEN** OpenSpecUI SHALL refresh status and instructions

#### Scenario: Schema updates
- **GIVEN** files under `openspec/schemas/` change
- **WHEN** the watcher detects the change
- **THEN** the UI SHALL refresh schema listings and artifact status

### Requirement: CLI Error Handling
OpenSpecUI SHALL preserve the last known good state on CLI errors.

#### Scenario: CLI error during refresh
- **GIVEN** a CLI command fails during status refresh
- **WHEN** the UI receives the error
- **THEN** the UI SHALL keep the previous status data
- **AND** display an error toast with a retry action

#### Scenario: Instructions failure
- **GIVEN** instructions retrieval fails
- **WHEN** the UI receives the error
- **THEN** the UI SHALL keep the previous instructions visible
- **AND** mark them as stale until a refresh succeeds
