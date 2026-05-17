# Delta for opsx-workflow-ui

## ADDED Requirements

### Requirement: Schema-Neutral Entity Detail Model

OpenSpecUI SHALL expose active and archived OPSX detail data as schema-neutral entities whose primary truth is their readable file tree.

#### Scenario: Entity identity is directory identity

- **GIVEN** a directory exists at `openspec/changes/<change-id>` or `openspec/changes/archive/<archive-id>`
- **WHEN** OpenSpecUI reads detail data for that id and stage
- **THEN** the entity SHALL be considered present
- **AND** root `proposal.md`, `tasks.md`, `design.md`, or `specs/**/spec.md` SHALL NOT be required for entity existence

#### Scenario: Entity detail preserves readable files

- **GIVEN** an OPSX entity directory contains readable files
- **WHEN** OpenSpecUI builds entity detail
- **THEN** the detail SHALL include those files with paths relative to the entity root
- **AND** it SHALL include hidden metadata files when readable

#### Scenario: Schema metadata is optional

- **GIVEN** `.openspec.yaml` is missing, invalid, or references a schema that cannot be resolved
- **WHEN** OpenSpecUI builds entity detail
- **THEN** it SHALL still return entity detail with readable files
- **AND** it SHALL attach non-fatal diagnostics describing the metadata or schema issue

### Requirement: Shared OPSX Entity Utilities

OpenSpecUI SHALL centralize OPSX entity detail construction in shared utility functions used by live server, static export, and static runtime code.

#### Scenario: Single artifact matching implementation

- **GIVEN** live mode, static export, and static runtime need to match files to schema artifact output paths
- **WHEN** they build or consume OPSX entity detail
- **THEN** they SHALL use the same shared artifact matching semantics
- **AND** they SHALL NOT maintain separate hardcoded fallback mappings for proposal, tasks, design, or delta specs

#### Scenario: Archive surfaces consume entity file truth

- **GIVEN** an archive is surfaced in detail, search, dashboard, static export, or static runtime
- **WHEN** OpenSpecUI needs objective archive content or archive existence
- **THEN** it SHALL use the schema-neutral entity file model
- **AND** it SHALL NOT depend on parsing a legacy spec-driven `Change` projection

#### Scenario: Direct and glob artifact outputs

- **GIVEN** a schema artifact output path is either a direct path or a glob pattern
- **WHEN** entity files are matched to artifacts
- **THEN** direct paths SHALL match normalized relative file paths
- **AND** glob paths SHALL match normalized relative file paths deterministically

#### Scenario: Tolerant schema detail parsing

- **GIVEN** schema YAML contains fields unknown to the current OpenSpecUI version
- **WHEN** OpenSpecUI parses schema detail for entity display
- **THEN** it SHALL preserve supported artifact identity and output path fields when possible
- **AND** it SHALL report unsupported or invalid portions as diagnostics instead of discarding the entity

### Requirement: Generic Document Identity for Artifacts

OpenSpecUI SHALL identify schema artifact documents through a generic artifact document kind.

#### Scenario: Build artifact document ref

- **GIVEN** an entity artifact file is processed for view, search, or export
- **WHEN** OpenSpecUI calls `onReadDocument`
- **THEN** the document ref SHALL use `kind: "artifact"`
- **AND** it SHALL include stage, change id, concrete relative path, schema name when known, artifact id when known, and artifact output path when known

#### Scenario: Preserve legacy document kinds only as explicit file identities

- **GIVEN** a file path is `proposal.md`, `tasks.md`, `design.md`, or `specs/<id>/spec.md`
- **WHEN** that file is read outside schema artifact context
- **THEN** OpenSpecUI MAY expose the legacy document kind for that explicit file
- **AND** it SHALL NOT require those legacy kinds to build entity detail
