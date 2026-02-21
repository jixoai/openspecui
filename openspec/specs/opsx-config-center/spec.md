# opsx-config-center Specification

## Purpose
TBD - created by archiving change opsx-config-center. Update Purpose after archive.
## Requirements
### Requirement: Dedicated Config view for OPSX configuration
The system SHALL replace the legacy Project view with a single-word “Config” view that presents OPSX configuration data in a dedicated screen.

#### Scenario: Replace Project navigation entry
- **GIVEN** the OpenSpecUI navigation is rendered
- **WHEN** the user views the primary navigation
- **THEN** the UI SHALL show a “Config” entry
- **AND** the legacy “Project” entry SHALL NOT be displayed

#### Scenario: Config view is CLI-driven
- **GIVEN** the Config view is opened
- **WHEN** the UI loads its data
- **THEN** the UI SHALL source OPSX configuration data from official CLI JSON outputs where available
- **AND** the UI SHALL use schema.yaml from resolved paths only when CLI lacks detailed schema output

### Requirement: Config view uses tabs
The system SHALL organize the Config view into tabs to reduce visual stacking.

#### Scenario: Render Config tabs
- **GIVEN** the Config view is open
- **WHEN** the UI renders
- **THEN** the UI SHALL present tabs for Config, Schemas, and Changes

### Requirement: Config view surfaces project configuration
The system SHALL display `openspec/config.yaml` content with clear missing-state messaging and explicit edit controls.

#### Scenario: Config.yaml exists
- **GIVEN** `openspec/config.yaml` exists
- **WHEN** the Config view loads
- **THEN** the UI SHALL render the configuration content in a read-only viewer
- **AND** expose an explicit Edit action that enables Save/Cancel

#### Scenario: Config.yaml missing
- **GIVEN** `openspec/config.yaml` is absent
- **WHEN** the Config view loads
- **THEN** the UI SHALL show a missing-state message that points to `openspec init`

#### Scenario: Edit config.yaml
- **GIVEN** config.yaml is displayed in read-only mode
- **WHEN** the user enters Edit mode and saves changes
- **THEN** the UI SHALL persist the updated config.yaml content to disk
- **AND** return to read-only mode

### Requirement: Config view surfaces schema resolution
The system SHALL show schema resolution information derived from `openspec schemas --json` and `openspec schema which --json`.

#### Scenario: List schemas with source information
- **GIVEN** schemas are available
- **WHEN** the Config view loads
- **THEN** the UI SHALL list schemas with their source (project/user/package) and descriptions

#### Scenario: Display schema details
- **GIVEN** a schema is selected
- **WHEN** the UI requests schema detail
- **THEN** the UI SHALL display artifacts, dependencies, and apply requirements from the resolved schema.yaml

### Requirement: Schema preview is structured (no raw YAML in read-only)
The system SHALL present a structured, read-only schema preview derived from schema.yaml.

#### Scenario: Show schema preview
- **GIVEN** a schema is selected
- **WHEN** the Schemas tab is in Preview mode
- **THEN** the UI SHALL show schema name, description, artifacts, and apply requirements
- **AND** it SHALL NOT dump raw schema.yaml content in the preview

### Requirement: Config view surfaces template mapping
The system SHALL show artifact template mappings derived from `openspec templates --json` within the selected schema detail.

#### Scenario: Display template map
- **GIVEN** template mappings are available
- **WHEN** the Config view loads
- **THEN** the UI SHALL list each artifact with its template path and source alongside schema details

#### Scenario: Embed template preview in schema view
- **GIVEN** a schema is selected
- **WHEN** the Schemas tab is in Preview mode
- **THEN** the UI SHALL render the template content as a read-only preview within the schema view
- **AND** it SHALL render the template content inline under the template path line for each artifact

### Requirement: Config view allows schema/template editing when permitted
The system SHALL allow editing schema.yaml and template files for project/user sources while keeping package sources read-only.

#### Scenario: Edit project schema assets
- **GIVEN** the selected schema source is project or user
- **WHEN** the user enters Edit mode for schema.yaml or a template
- **THEN** the UI SHALL allow edits and Save/Cancel

#### Scenario: Package schema assets are read-only
- **GIVEN** the selected schema source is package
- **WHEN** the user views schema.yaml or templates
- **THEN** the UI SHALL render content in read-only mode

#### Scenario: Edit mode uses file list + editor
- **GIVEN** the Schemas tab is in Edit mode
- **WHEN** the UI renders
- **THEN** the UI SHALL present a file list (schema.yaml + templates)
- **AND** display the selected file in a text editor

#### Scenario: Preview validates edit output
- **GIVEN** a user edits schema.yaml or templates
- **WHEN** they switch to Preview mode
- **THEN** the UI SHALL render the structured schema view derived from the saved files

### Requirement: Render known and unknown artifact fields
The system SHALL render all artifact fields from schema.yaml, including unknown keys for forward compatibility.

#### Scenario: Render all artifact fields
- **GIVEN** a schema artifact contains known and unknown fields
- **WHEN** the Schemas tab renders the artifact preview
- **THEN** the UI SHALL render known fields with type-appropriate formatting
- **AND** render unknown fields in a generic key/value view

### Requirement: Manage schemas
The system SHALL allow adding and deleting schemas for project/user sources.

#### Scenario: Add schema
- **GIVEN** the user chooses to add a schema
- **WHEN** they confirm a schema name
- **THEN** the system SHALL create a new schema under `openspec/schemas/<name>/`

#### Scenario: Delete schema
- **GIVEN** a schema source is project or user
- **WHEN** the user deletes the schema
- **THEN** the system SHALL remove the schema directory after confirmation

### Requirement: Config view surfaces change metadata
The system SHALL display `.openspec.yaml` change metadata with a change selector.

#### Scenario: Select change metadata
- **GIVEN** more than one change exists
- **WHEN** the user selects a change
- **THEN** the UI SHALL display the selected change’s `.openspec.yaml` content

#### Scenario: Explain missing change metadata
- **GIVEN** a change has no `.openspec.yaml` file
- **WHEN** the Config view renders the Changes tab
- **THEN** the UI SHALL explain that metadata is created by `/opsx:new` and stored at `openspec/changes/<change>/.openspec.yaml`

### Requirement: Config view supports static export
The system SHALL include Config view data in static export snapshots.

#### Scenario: Static snapshot includes config data
- **GIVEN** a static export is generated
- **WHEN** the Config view loads in static mode
- **THEN** the UI SHALL render config, schema, template, and change metadata data from the snapshot

