# opsx-ui-views Specification

## Purpose
Define the OpenSpecUI screens and navigation model for OPSX workflows, driven entirely by OpenSpec CLI 1.1.x outputs.

## Requirements

### Requirement: Dashboard Status Overview
The UI SHALL render a dashboard status overview using CLI-driven status data.

#### Scenario: Show active change progress
- **GIVEN** at least one active change exists
- **WHEN** the dashboard loads
- **THEN** the UI SHALL show change name, schema, and artifact completion ratio
- **AND** the UI SHALL derive progress from `openspec status --json`

#### Scenario: Handle no active changes
- **GIVEN** no active changes exist
- **WHEN** the dashboard loads
- **THEN** the UI SHALL show an empty-state call to action for `/opsx:new`

### Requirement: Change View Layout
The UI SHALL present a change detail view aligned to the OPSX artifact workflow.

#### Scenario: Display artifact graph and editor
- **GIVEN** a change is selected
- **WHEN** the change view loads
- **THEN** the UI SHALL display an artifact graph
- **AND** the UI SHALL display an artifact editor panel
- **AND** the UI SHALL show a terminal output panel for CLI actions

#### Scenario: Update view on artifact selection
- **GIVEN** the artifact graph is visible
- **WHEN** a user selects an artifact
- **THEN** the UI SHALL load instructions for the selected artifact
- **AND** update the editor and action panels accordingly

### Requirement: Schema Browser View
The UI SHALL provide a schema browser backed by CLI schema data.

#### Scenario: List schemas
- **GIVEN** schemas are available
- **WHEN** the schema view loads
- **THEN** the UI SHALL list schema names and descriptions from `openspec schemas --json`

#### Scenario: Show schema details
- **GIVEN** a schema is selected
- **WHEN** the UI requests its details
- **THEN** the UI SHALL display artifacts, dependencies, and apply requirements
- **AND** data SHALL come from `openspec schema show --json`

### Requirement: Settings View Content
The UI SHALL surface project configuration and tool status.

#### Scenario: Display config.yaml content
- **GIVEN** `openspec/config.yaml` exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL display its contents

#### Scenario: Display change metadata
- **GIVEN** a change `.openspec.yaml` exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL display the metadata file content

#### Scenario: Display tool configuration state
- **GIVEN** skills directories are present
- **WHEN** the settings view loads
- **THEN** the UI SHALL display tool configuration status derived from skills detection

### Requirement: OPSX Command Panel
The UI SHALL present OPSX actions with enablement based on CLI status.

#### Scenario: Show OPSX commands
- **GIVEN** the action panel is visible
- **WHEN** it renders
- **THEN** the UI SHALL list `/opsx:new`, `/opsx:continue`, `/opsx:ff`, `/opsx:apply`, `/opsx:verify`, `/opsx:sync`, `/opsx:archive`, `/opsx:bulk-archive`, and `/opsx:onboard`

#### Scenario: Disable blocked actions
- **GIVEN** required artifacts are not complete
- **WHEN** the action panel renders
- **THEN** the UI SHALL disable actions that are blocked
- **AND** show the blocking requirements as hints

