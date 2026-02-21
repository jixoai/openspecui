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
The UI SHALL surface runtime settings and tool status.

#### Scenario: Display tool configuration state
- **GIVEN** skills directories are present
- **WHEN** the settings view loads
- **THEN** the UI SHALL display tool configuration status derived from skills detection

#### Scenario: Hide OPSX project configuration
- **GIVEN** OPSX project configuration exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL NOT render config.yaml, schema, or change metadata panels
- **AND** those panels SHALL belong to the Config view

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

### Requirement: Config View
The UI SHALL provide a Config view dedicated to OPSX project configuration.

#### Scenario: Replace Project view
- **GIVEN** OpenSpecUI renders navigation
- **WHEN** the primary navigation is displayed
- **THEN** the UI SHALL present a single “Config” entry
- **AND** the legacy “Project” entry SHALL NOT appear

#### Scenario: Render config sections
- **GIVEN** the Config view is open
- **WHEN** it renders
- **THEN** the UI SHALL display tabs for Config, Schemas, and Changes
- **AND** each tab SHALL scope its respective content (config.yaml, schema/templates, change metadata)

#### Scenario: Config view uses CLI data
- **GIVEN** the Config view requests data
- **WHEN** data is fetched
- **THEN** the UI SHALL use CLI JSON outputs for schemas and templates

#### Scenario: Config edit mode is explicit
- **GIVEN** config.yaml is visible
- **WHEN** the user has not entered Edit mode
- **THEN** the UI SHALL present config.yaml as read-only
- **AND** provide a clear Edit action to enable Save/Cancel

#### Scenario: Schemas tab supports Preview and Edit modes
- **GIVEN** the Schemas tab is open
- **WHEN** the user toggles Preview/Edit
- **THEN** the UI SHALL switch between structured preview and file editor views

#### Scenario: Add/delete schema controls are available
- **GIVEN** the Schemas tab is open
- **WHEN** the user is allowed to manage schemas
- **THEN** the UI SHALL provide Add and Delete actions

