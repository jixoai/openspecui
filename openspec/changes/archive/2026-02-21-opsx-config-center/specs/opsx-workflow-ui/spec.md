# Delta for opsx-workflow-ui

## MODIFIED Requirements

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
