# opsx-ui-views Specification

## Purpose

Define the OpenSpecUI screens and navigation model for OPSX workflows, driven entirely by supported OpenSpec CLI outputs.

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

The UI SHALL surface runtime settings and tool status, including app shell base URL configuration for hosted workspace launch mode and document translation settings.

#### Scenario: Display tool configuration state

- **GIVEN** skills directories are present
- **WHEN** the settings view loads
- **THEN** the UI SHALL display tool configuration status derived from skills detection

#### Scenario: Hide OPSX project configuration

- **GIVEN** OPSX project configuration exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL NOT render config.yaml, schema, or change metadata panels
- **AND** those panels SHALL belong to the Config view

#### Scenario: Show hosted app base URL setting with official placeholder

- **GIVEN** the settings view is open
- **WHEN** hosted workspace launch settings are rendered
- **THEN** the UI SHALL show an `appBaseUrl` field
- **AND** the field placeholder SHALL be `https://app.openspecui.com`

#### Scenario: Persist empty app base URL without storing the official default

- **GIVEN** the user leaves `appBaseUrl` empty
- **WHEN** runtime settings are saved
- **THEN** the persisted value SHALL remain an empty string
- **AND** the UI SHALL continue to present the official placeholder as the implied hosted base URL

#### Scenario: Persist a custom hosted app base URL

- **GIVEN** the user enters `https://intranet.example.com/openspecui`
- **WHEN** runtime settings are saved
- **THEN** the persisted value SHALL equal that custom base URL
- **AND** subsequent hosted workspace launches without a CLI override SHALL use the saved base URL

#### Scenario: Show translation settings

- **GIVEN** the settings view is open in dynamic mode
- **WHEN** runtime settings are rendered
- **THEN** the UI SHALL include a dedicated Translation section
- **AND** that section SHALL expose translation enablement, target language, translation display mode, and browser translation capability state

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

### Requirement: OPSX Invocation Mode Settings

The UI SHALL surface OPSX agent invocation preference controls in runtime settings.

#### Scenario: Show OPSX invocation mode setting

- **GIVEN** the settings view is open in dynamic mode
- **WHEN** runtime settings are rendered
- **THEN** the UI SHALL show an OPSX invocation mode control with compose and command options
- **AND** selecting an option SHALL save the project-level `opsx.agentInvocationMode` preference

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

### Requirement: Desktop Navigation Collapse

The UI SHALL allow desktop navigation to collapse into an icon-only rail without changing route ownership.

#### Scenario: Collapse desktop sidebar

- **GIVEN** the desktop sidebar is expanded
- **WHEN** the user activates the sidebar collapse control
- **THEN** the OpenSpec logo SHALL be hidden
- **AND** navigation labels SHALL be hidden
- **AND** navigation icons SHALL remain visible with accessible names
- **AND** drag handles and drag/drop navigation affordances SHALL be hidden

#### Scenario: Expand desktop sidebar

- **GIVEN** the desktop sidebar is collapsed
- **WHEN** the user activates the sidebar expand control
- **THEN** the OpenSpec logo SHALL be visible
- **AND** navigation labels SHALL be visible
- **AND** drag/drop navigation affordances SHALL be available again

### Requirement: Git Worktree Responsive Actions

The UI SHALL render Git worktree handoff actions without causing horizontal overflow in narrow layouts.

#### Scenario: Render compact worktree switch action

- **GIVEN** the Git page lists other available worktrees
- **WHEN** the worktree switch action is rendered
- **THEN** the action SHALL be an icon-only button with an accessible name
- **AND** the worktree summary and action SHALL wrap or reflow to fit narrow containers without omitting branch or path content
- **AND** the action SHALL continue to use the existing worktree handoff behavior

### Requirement: Document Translation Entry in Reading Views

The UI SHALL provide a shared translation entry point for supported document reading views.

#### Scenario: Render translation button in ToC header

- **GIVEN** a supported document view renders with the shared ToC surface
- **WHEN** the ToC header renders in wide or narrow layouts
- **THEN** the UI SHALL render a translation icon button at the header inline-end position
- **AND** that button SHALL remain available in both wide and narrow layouts

#### Scenario: ToC consumes projected labels without translation-specific logic

- **GIVEN** a supported document view projects heading labels into the DOM
- **WHEN** the shared ToC builds its navigation labels
- **THEN** the UI SHALL read `data-toc-label` before falling back to heading text content
- **AND** the ToC implementation SHALL remain generic rather than branching on translation mode

#### Scenario: Show untranslated state

- **GIVEN** the current document is not translated
- **WHEN** the translation button renders
- **THEN** it SHALL use the primary-border visual state

#### Scenario: Show translated state

- **GIVEN** the current document is rendered in translated mode
- **WHEN** the translation button renders
- **THEN** it SHALL use the primary-filled visual state

#### Scenario: Show translating and allow cancel

- **GIVEN** a document translation request is currently in progress
- **WHEN** the translation button renders
- **THEN** it SHALL show a translating state
- **AND** activating it again SHALL cancel the in-flight translation

#### Scenario: Jump to translation settings when feature is disabled

- **GIVEN** translation is not enabled in runtime settings
- **WHEN** the user activates the translation button on a supported document view
- **THEN** the UI SHALL navigate to the Settings page
- **AND** SHALL focus or anchor the Translation settings section

#### Scenario: Respect document translation display mode

- **GIVEN** a supported document view renders translated content
- **WHEN** the user has configured direct or bilingual display mode in Settings
- **THEN** the document view SHALL render according to that configured mode

#### Scenario: Bilingual ToC shows source labels while direct mode shows translated labels

- **GIVEN** a supported document view renders translated content
- **WHEN** the user switches between direct and bilingual display mode
- **THEN** the document view SHALL update the projected ToC label source accordingly
- **AND** the ToC SHALL continue reading labels through the same generic contract

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

### Requirement: Change Delta Spec Document Rendering

The UI SHALL render active change delta spec artifact previews through the same path-aware Markdown viewer entry used by main spec detail pages.

#### Scenario: Render delta spec artifacts with spec document semantics

- **GIVEN** a change artifact output path resolves to `specs/<spec>/spec.md`
- **WHEN** the user opens that artifact in the change detail view
- **THEN** the UI SHALL render the Markdown through the shared `MarkdownViewer` entry with that artifact path
- **AND** requirement and scenario headings SHALL expose the same OpenSpec semantic metadata as the main spec detail page

#### Scenario: Select OpenSpec rendering by path

- **GIVEN** a Markdown document is passed to the shared viewer with path `specs/<spec>/spec.md`
- **WHEN** the viewer prepares render plugins
- **THEN** the OpenSpec spec rendering plugin SHALL activate from the path
- **AND** the page SHALL NOT use a separate spec-only Markdown component as the rendering entry

#### Scenario: Preserve ordinary artifact rendering for non-spec files

- **GIVEN** a change artifact output path does not match `specs/<spec>/spec.md`
- **WHEN** the user opens that artifact in the change detail view
- **THEN** the UI SHALL render it through the ordinary artifact Markdown reader
- **AND** SHALL NOT infer OpenSpec spec semantics for proposal, tasks, or other non-spec artifacts

#### Scenario: Render translation entry for spec document artifacts

- **GIVEN** a change delta spec artifact is rendered through the shared Markdown viewer with path `specs/<spec>/spec.md`
- **WHEN** its ToC header renders
- **THEN** the UI SHALL expose the document translation action in the same ToC header surface used by main spec detail pages
- **AND** the translation action SHALL be available in both narrow and wide ToC layouts

#### Scenario: Preserve a single root ToC for glob artifacts

- **GIVEN** a change artifact output glob contains one or more Markdown files
- **WHEN** the glob preview renders nested file contents
- **THEN** the UI SHALL keep one root ToC and one root scroll container for the artifact preview
- **AND** nested spec documents SHALL register their document actions into that root ToC header
- **AND** the UI SHALL NOT create independent full-page ToC layouts for each nested spec file

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

### Requirement: Path-Driven Markdown Render Plugins

The UI SHALL keep `MarkdownViewer` as a schema-neutral rendering entrypoint whose document-specific behavior is selected by file path and Markdown content, not by page-owned schema props.

#### Scenario: Apply spec rendering from path in nested viewers

- **GIVEN** Markdown content is rendered inside another `MarkdownViewer`
- **AND** the nested viewer receives a path matching `specs/<spec-id>/spec.md`
- **WHEN** the Markdown contains OpenSpec requirements and scenarios
- **THEN** the nested viewer SHALL apply the same OpenSpec semantic render plugin used by the spec detail page
- **AND** requirement labels, scenario labels, ToC labels, and OpenSpec reading styles SHALL remain consistent with the spec detail page

#### Scenario: Avoid page-owned OpenSpec props

- **GIVEN** a page renders a spec Markdown document through `MarkdownViewer`
- **WHEN** it wants OpenSpec-specific rendering effects
- **THEN** it SHALL pass the Markdown content and concrete path only
- **AND** it SHALL NOT pass parsed `Spec` data, requirement counts, or other OpenSpec-specific props into the generic viewer

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
