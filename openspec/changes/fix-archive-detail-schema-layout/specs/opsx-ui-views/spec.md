# Delta for opsx-ui-views

## ADDED Requirements

### Requirement: Schema-Neutral Archive Detail

The UI SHALL render archive detail from a schema-neutral OPSX entity detail model rather than from the legacy spec-driven `Change` projection.

#### Scenario: Render archive directory without proposal

- **GIVEN** an archived entity directory exists at `openspec/changes/archive/<archive-id>`
- **AND** that directory does not contain root `proposal.md`
- **WHEN** the user opens `/archive/<archive-id>`
- **THEN** the UI SHALL render a detail page for that archived entity
- **AND** it SHALL NOT show `Archived change not found:`

#### Scenario: Render stale schema archive objectively

- **GIVEN** an archived entity directory contains `.openspec.yaml` that references a schema unavailable to the current project
- **AND** the directory contains readable Markdown files
- **WHEN** the user opens `/archive/<archive-id>`
- **THEN** the UI SHALL render the readable files as objective archive content
- **AND** it SHALL show non-fatal schema diagnostics when surfaced by the backend
- **AND** it SHALL NOT hide the archive because structured schema binding failed

#### Scenario: Render known schema artifacts

- **GIVEN** an archived entity references a schema that can be resolved
- **AND** the schema defines artifact output paths
- **WHEN** the user opens `/archive/<archive-id>`
- **THEN** the UI SHALL render artifact tabs or sections derived from those schema output paths
- **AND** it SHALL NOT branch on a hardcoded schema name

#### Scenario: Preserve file tree access

- **GIVEN** archive detail renders artifact-oriented content
- **WHEN** the user opens the file view
- **THEN** the UI SHALL render the archive file tree from the same entity detail files
- **AND** it SHALL include hidden metadata files when they are readable

### Requirement: Generic Artifact Markdown Projection

The UI SHALL render schema artifact Markdown through the shared Markdown rendering and document-reading pipeline.

#### Scenario: Render artifact Markdown through shared viewer

- **GIVEN** an archive artifact contains Markdown content
- **WHEN** the UI renders that artifact
- **THEN** it SHALL use the shared `MarkdownViewer`
- **AND** it SHALL pass the concrete entity-relative file path into the viewer

#### Scenario: Apply document hooks to custom artifacts

- **GIVEN** a project hook implements `onReadDocument`
- **AND** an archive artifact Markdown file is read for detail rendering
- **WHEN** the backend processes that file
- **THEN** the hook context SHALL identify the document as `kind: "artifact"`
- **AND** the context SHALL include the entity stage, change id, schema name when known, artifact id when known, and concrete relative path

### Requirement: Static Archive Entity Parity

Static export mode SHALL preserve archive entity files and artifact grouping with the same schema-neutral semantics as live mode.

#### Scenario: Static archive detail renders custom schema archive

- **GIVEN** a static export snapshot contains an archived entity without root `proposal.md`
- **WHEN** the static UI opens `/archive/<archive-id>`
- **THEN** it SHALL render the stored entity files and artifact groups
- **AND** it SHALL NOT synthesize a legacy spec-driven `Change` merely to make the page load

#### Scenario: Static and live artifact grouping match

- **GIVEN** live mode groups archive files by schema artifact output paths
- **WHEN** the project is exported to static mode
- **THEN** static mode SHALL preserve the same artifact ids, output paths, matched files, and diagnostics
