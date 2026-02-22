# Delta for opsx-artifact-editor

## MODIFIED Requirements

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
