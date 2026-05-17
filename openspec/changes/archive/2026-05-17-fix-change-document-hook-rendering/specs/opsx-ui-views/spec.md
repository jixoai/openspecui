# Delta for opsx-ui-views

## ADDED Requirements

### Requirement: Processed Document Reading Views

The UI SHALL render OpenSpec Markdown reading surfaces from processed document results while preserving explicit source editor surfaces as unprocessed source views.

#### Scenario: Active change delta spec preview uses processed Markdown

- **GIVEN** an active change contains `openspec/changes/<change>/specs/<spec>/spec.md`
- **AND** the project has an `onReadDocument` hook that transforms processed document reads
- **WHEN** the user opens the rendered artifact preview for that delta spec
- **THEN** the UI SHALL render the hook-processed Markdown for that `delta-spec` document
- **AND** the document identity SHALL include the `change` stage and `delta-spec` kind

#### Scenario: Active change tasks preview uses processed Markdown

- **GIVEN** an active change contains `openspec/changes/<change>/tasks.md`
- **AND** the project has an `onReadDocument` hook that transforms processed document reads
- **WHEN** the user opens the rendered artifact preview for tasks
- **THEN** the UI SHALL render the hook-processed Markdown for that `tasks` document
- **AND** the behavior SHALL NOT differ between initial load and subscription updates

#### Scenario: Archived change reading views use processed Markdown

- **GIVEN** an archived change contains `tasks.md` or `specs/<spec>/spec.md`
- **AND** the project has an `onReadDocument` hook that transforms processed document reads
- **WHEN** the user opens a rendered archive reading view for those documents
- **THEN** the UI SHALL render hook-processed Markdown with the `archive` stage and correct document kind

#### Scenario: Source editor views stay unprocessed

- **GIVEN** a user opens a folder or code-editor style view for a change file
- **WHEN** the file content is displayed for source inspection
- **THEN** the UI SHALL show the unprocessed source Markdown
- **AND** source inspection SHALL NOT be treated as a rendered document reading surface
