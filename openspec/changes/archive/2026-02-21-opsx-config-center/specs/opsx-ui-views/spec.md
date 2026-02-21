# Delta for opsx-ui-views

## MODIFIED Requirements

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

## ADDED Requirements

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
