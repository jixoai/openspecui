# opsx-artifact-editor Specification

## Purpose

Define the artifact editor behavior for creating and updating OPSX artifacts from CLI instructions.

## Requirements

### Requirement: Template-First Editing

The editor SHALL initialize content from CLI-provided templates and remain read-only until the user explicitly enters edit mode.

#### Scenario: Default to read-only

- **GIVEN** an artifact is loaded and its dependencies are satisfied
- **WHEN** the editor renders
- **THEN** the editor SHALL display content in read-only mode
- **AND** present an explicit “Edit” action to enter edit mode

#### Scenario: Enter edit mode explicitly

- **GIVEN** the editor is read-only
- **WHEN** the user activates the “Edit” action
- **THEN** the editor SHALL switch to editable mode
- **AND** expose save/cancel controls

### Requirement: Dependency Awareness

The editor SHALL surface CLI-reported dependencies and blocking state.

#### Scenario: Display dependencies

- **GIVEN** instructions include dependencies
- **WHEN** the editor renders
- **THEN** the UI SHALL list dependency paths and completion state

#### Scenario: Block editing when dependencies missing

- **GIVEN** the CLI marks the artifact as blocked
- **WHEN** the editor opens
- **THEN** the editor SHALL be read-only
- **AND** display the missing dependencies

### Requirement: Output Path Persistence

The editor SHALL save to the CLI-provided output path.

#### Scenario: Save artifact content

- **GIVEN** the editor has content changes
- **WHEN** the user saves
- **THEN** the UI SHALL write to the CLI output path
- **AND** trigger a status refresh

#### Scenario: Save failure handling

- **GIVEN** a save operation fails
- **WHEN** the error occurs
- **THEN** the UI SHALL show an error message
- **AND** retain the unsaved editor content

### Requirement: Stale Instruction Handling

The editor SHALL indicate when instructions are stale due to CLI errors.

#### Scenario: Mark stale on instruction failure

- **GIVEN** instruction refresh fails
- **WHEN** the editor is showing prior instructions
- **THEN** the UI SHALL mark the instructions as stale
- **AND** offer a retry action
