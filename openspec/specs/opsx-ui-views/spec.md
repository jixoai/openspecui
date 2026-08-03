<!--
Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
1. Specify OPSX-first project views and workflow actions.
2. Keep runtime Settings distinct from Config-owned project declarations.

Owner correction (2026-07-29): App shell location belongs to the local daemon, not Settings.
Original request (2026-08-01): redesign Config and complete the OpenSpec 1.7 projection in OpenSpecUI 7.
-->

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

Settings SHALL contain OpenSpecUI application preferences and a concise read-only Agent Integrations summary. It
SHALL NOT own OpenSpec initialization, Agent selection, profile/delivery/workflow mutation, update, repair, cleanup,
or execution Terminal state.

#### Scenario: Display tool configuration state

- **GIVEN** skills directories are present
- **WHEN** the settings view loads
- **THEN** the UI SHALL display tool configuration status derived from skills detection

#### Scenario: Hide OPSX project configuration

- **GIVEN** OPSX project configuration exists
- **WHEN** the settings view loads
- **THEN** the UI SHALL NOT render config.yaml, schema, or change metadata panels
- **AND** those panels SHALL belong to the Config view

#### Scenario: Do not expose App shell location

- **GIVEN** the Settings view is open
- **WHEN** runtime settings are rendered or saved
- **THEN** the UI SHALL NOT show or persist `appBaseUrl` or a Hosted App URL field
- **AND** App daemon host mode SHALL remain a CLI startup decision

#### Scenario: Show translation settings

- **GIVEN** the settings view is open in dynamic mode
- **WHEN** runtime settings are rendered
- **THEN** the UI SHALL include a dedicated Translation section
- **AND** that section SHALL expose translation enablement, target language, translation display mode, and browser translation capability state

#### Scenario: Open Agent summary in Settings

- **WHEN** the user views Agent Integrations in Settings
- **THEN** configured, partial, drifted, failed, and unavailable counts SHALL be readable
- **AND** direct failures SHALL remain visible
- **AND** a Manage action SHALL navigate to `/config/agents`

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

The Config view SHALL be the workbench described by `opsx-config-center`, with overview actions and route-backed
owner pages rather than a mixed fixed/dynamic tab strip.

#### Scenario: Replace Project view

- **GIVEN** OpenSpecUI renders navigation
- **WHEN** the primary navigation is displayed
- **THEN** the UI SHALL present a single “Config” entry
- **AND** the legacy “Project” entry SHALL NOT appear

#### Scenario: Config view uses CLI data

- **GIVEN** the Config view requests data
- **WHEN** data is fetched
- **THEN** the UI SHALL use CLI JSON outputs for schemas and templates

#### Scenario: Config edit mode is explicit

- **GIVEN** config.yaml is visible
- **WHEN** the user has not entered Edit mode
- **THEN** the UI SHALL present config.yaml as read-only
- **AND** provide a clear Edit action to enable Save/Cancel

#### Scenario: Schema owner supports Preview and Edit modes

- **GIVEN** a Schema owner route is open
- **WHEN** the user toggles Preview/Edit
- **THEN** the UI SHALL switch between structured preview and file editor views

#### Scenario: Add/delete schema controls are available

- **GIVEN** the Schema catalog owner is open
- **WHEN** the user is allowed to manage schemas
- **THEN** the UI SHALL provide Add and Delete actions

#### Scenario: Open Config actions

- **WHEN** the user opens Config overview
- **THEN** Init SHALL be available only when local setup is absent
- **AND** Guide and Resolved Context actions SHALL be available according to current projection state
- **AND** static mode SHALL not fabricate mutation authority

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
The handoff action SHALL rely on platform runtime compatibility checks before navigating to a sibling worktree server.

#### Scenario: Render compact worktree switch action

- **GIVEN** the Git page lists other available worktrees
- **WHEN** the worktree switch action is rendered
- **THEN** the action SHALL be an icon-only button with an accessible name
- **AND** the worktree summary and action SHALL wrap or reflow to fit narrow containers without omitting branch or path content
- **AND** the action SHALL continue to use the existing worktree handoff behavior

#### Scenario: Switch to compatible sibling worktree

- **GIVEN** a sibling worktree server reports the requested project directory
- **AND** the server reports a compatible runtime protocol and required capabilities
- **WHEN** the user switches to that worktree
- **THEN** OpenSpecUI SHALL navigate to the sibling server
- **AND** SHALL preserve the current route path, search, and hash

#### Scenario: Reject incompatible sibling worktree

- **GIVEN** a sibling worktree server reports the requested project directory
- **AND** the server omits the required runtime protocol or capabilities
- **WHEN** the user switches to that worktree
- **THEN** OpenSpecUI SHALL reject the handoff before navigation
- **AND** SHALL surface an actionable handoff failure instead of rendering a broken shell

#### Scenario: Notification atom survives missing optional config

- **GIVEN** the runtime config payload omits the optional `notifications` section
- **WHEN** the notification provider renders
- **THEN** it SHALL use notification defaults
- **AND** it SHALL NOT crash the application root

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

### Requirement: Stores Discovery Panel (Beta)

OpenSpecUI SHALL provide a read-only Stores panel, gated behind a visible Beta badge, that lists machine-registered OpenSpec stores and their health. The panel SHALL follow the beta feature fault-tolerance model: it never crashes, it shows objective errors with version source on data-incompatible failures, and it hides its entry on command-change failures. It SHALL NOT mutate store registrations or switch the active project root.

#### Scenario: Show registered stores

- **GIVEN** at least one store is registered and the CLI returns compatible data
- **WHEN** the user opens the Stores panel
- **THEN** the UI SHALL list each store's id and root path
- **AND** SHALL display health facts derived from `openspec store doctor --json`

#### Scenario: Display Beta badge

- **GIVEN** the Stores panel is rendered
- **WHEN** the user views the panel title or navigation entry
- **THEN** the UI SHALL show a visible Beta badge

#### Scenario: Show data-incompatible error with version source

- **GIVEN** the CLI returns a structurally incompatible stores payload (data-incompatible)
- **WHEN** the Stores panel renders
- **THEN** the UI SHALL objectively display the error
- **AND** SHALL show the originating OpenSpec CLI version
- **AND** SHALL NOT crash or hide the entry

#### Scenario: Hide entry on command-change failure

- **GIVEN** the `store list`/`doctor` command is missing or its usage has changed (command-unavailable)
- **WHEN** the navigation is composed
- **THEN** the UI SHALL hide the Stores entry

#### Scenario: Refresh store list reactively

- **GIVEN** the Stores panel is open
- **WHEN** the local store registry changes
- **THEN** the UI SHALL update via a polling subscription (the registry lives outside the project directory) that the server polls and pushes to the frontend
- **AND** SHALL NOT expose polling cadence or registry-location details to the user
- **AND** SHALL NOT offer a manual refresh control

#### Scenario: Restrict to live mode

- **GIVEN** OpenSpecUI runs in static/SSG mode
- **WHEN** the navigation is composed
- **THEN** the UI SHALL NOT render the Stores panel or include stores data in the static snapshot

#### Scenario: Read-only guarantee

- **GIVEN** the Stores panel is displayed
- **WHEN** the user interacts with any store entry
- **THEN** the UI SHALL only show details (no setup/register/unregister/remove actions in this phase)
- **AND** SHALL NOT change the active project directory

### Requirement: Regional Realtime Projection Composition

The UI SHALL migrate current OPSX route, detail, and overlay projection surfaces to the shared realtime presentation model without changing their navigation, information architecture, or layout ownership.

#### Scenario: A Dashboard sibling remains current while another region waits

- **GIVEN** Dashboard Summary has a current projection and Trends or Code Git is loading, revalidating, or failed
- **WHEN** the Dashboard renders
- **THEN** the current Summary SHALL remain visible
- **AND** only the affected sibling region SHALL render its local lifecycle state

#### Scenario: A Change list receives progressive rows

- **GIVEN** the Changes projection emits batches and row errors
- **WHEN** the list renders before completion
- **THEN** received rows and row-level errors SHALL remain visible through `partial` presentation
- **AND** the UI SHALL not replace the list with a route-wide loading surface

#### Scenario: A detail or search surface waits locally

- **GIVEN** a detail pane, artifact output, file preview, or demand-driven Search result is pending
- **WHEN** its parent route already has readable content
- **THEN** only that local pane or result region SHALL show its lifecycle atom
- **AND** the parent route SHALL retain its existing content and layout

### Requirement: Objective Change Kanban Projection

OpenSpecUI SHALL project Changes into four fact-based lanes and SHALL NOT treat those lanes as a persisted or
prescriptive workflow.

```text
active + no-tasks     -> No tracked tasks
active + in-progress  -> Tasks remaining
active + complete     -> Tasks complete
archive               -> Archived
```

#### Scenario: Preserve upstream task semantics

- **GIVEN** active Changes carry OpenSpec `TrackedTaskProgress`
- **WHEN** a Kanban projection is derived
- **THEN** each active Change SHALL be placed by its exact `phase`
- **AND** `no-tasks` SHALL remain distinct from `complete`
- **AND** the UI SHALL NOT infer TODO, QA, verification, validation, sync, or archive readiness

#### Scenario: Present archived structure objectively

- **GIVEN** a Change exists under the archive stage
- **WHEN** the Kanban projection is derived
- **THEN** the Change SHALL appear in Archived
- **AND** Archived SHALL state structural location only, not quality or task completion

#### Scenario: Filter archived history by objective time

- **GIVEN** archived history may be unbounded
- **WHEN** the full Board opens
- **THEN** it SHALL default to `30d` and offer `7d`, `30d`, `90d`, and `all`
- **AND** the timestamp SHALL use a valid dated archive id before falling back to `updatedAt`

### Requirement: Shared Readonly Kanban

OpenSpecUI SHALL provide one readonly Kanban presentation for Dashboard and static publication.

#### Scenario: Replace only Dashboard Workflow Progress

- **GIVEN** Dashboard Summary has current Change phase counts and bounded archived summaries
- **WHEN** Dashboard renders
- **THEN** `ReadonlyKanban` SHALL replace Workflow Progress
- **AND** Dashboard Active Changes SHALL remain
- **AND** cards SHALL navigate to their Change or Archive detail
- **AND** the readonly component SHALL accept no mutation or drag callbacks

#### Scenario: Render static Board from the same model

- **GIVEN** a static export contains active and archived Change facts
- **WHEN** `/board` renders without a backend
- **THEN** it SHALL use the shared objective lane model and readonly presentation
- **AND** it SHALL expose no Apply, Archive, or drag capability

#### Scenario: Respond to the owned container without horizontal scrolling

- **GIVEN** `ReadonlyKanban` is embedded in Dashboard or a static surface
- **WHEN** its own available inline size changes
- **THEN** spacious containers SHALL render the four lanes as `4x1`
- **AND** constrained containers SHALL render them as `2x2`
- **AND** crowded containers SHALL render them as `1x4`
- **AND** the readonly surface SHALL NOT create horizontal scrolling

### Requirement: Interactive Kanban Operator Surface

The live `/board` route SHALL add commands around the objective projection without mutating lane state directly.

#### Scenario: Launch Apply through the production owner

- **GIVEN** an active Change and current Root and Change projections
- **WHEN** the user chooses Apply from its explicit card command
- **THEN** the Board SHALL open the same Compose Operator used by Change Detail
- **AND** the Board SHALL NOT execute Apply or mutate task state directly

#### Scenario: Launch Archive through the production owner

- **GIVEN** any active Change and current Root and Change projections
- **WHEN** the user chooses Archive or drags the card to Archived
- **THEN** the Board SHALL open the same Archive Operator used by Change Detail
- **AND** the drag SHALL NOT archive or mutate the card directly
- **AND** the explicit command SHALL remain available to keyboard and touch users

#### Scenario: Reject stale operation authority

- **GIVEN** Root authority or the corresponding live projection is loading, revalidating, failed, or retained-only
- **WHEN** a card is displayed
- **THEN** it MAY remain visible as display evidence
- **BUT** Apply, Archive, and archive drop SHALL be disabled
- **AND** a drop SHALL resolve its Change id against current rows before opening an Operator

#### Scenario: Own live Board scrolling explicitly

- **GIVEN** the live Board has more inline content than its available width and lanes may have different row counts
- **WHEN** `/board` renders within the application shell
- **THEN** the route SHALL consume and contain the shell's remaining block-size
- **AND** the lane grid SHALL be the only horizontal scrolling owner
- **AND** every lane header SHALL remain outside its lane's vertical scrolling region
- **AND** every lane body SHALL scroll vertically and independently without growing or scrolling the page

### Requirement: Regional Kanban Realtime Lifecycle

The interactive Board SHALL preserve Changes and Archives as independently settling regions.

#### Scenario: Render one region while its sibling waits

- **GIVEN** one projection has current rows and the other is loading or revalidating
- **WHEN** the Board renders
- **THEN** the current lanes SHALL remain visible
- **AND** only the affected region SHALL show its local lifecycle state

#### Scenario: Preserve progressive and failed evidence

- **GIVEN** Changes emit progressive batches, row errors, or a failed refresh with retained rows
- **WHEN** the Board updates
- **THEN** delivered rows SHALL remain visible in their objective lanes
- **AND** progress, row errors, refresh activity, and terminal region errors SHALL remain attributable
- **AND** list movement SHALL preserve visual continuity instead of flashing or replacing the full Board

### Requirement: OPSX-First Information Hierarchy

OpenSpecUI SHALL rank projected information by its effect on the current OPSX decision while preserving objective
access to all source facts.

#### Scenario: Keep workflow decisions directly visible

- **GIVEN** an OPSX workflow or Change surface has a current task, next action, mutation state, error, stale authority, or blocker
- **WHEN** the surface renders
- **THEN** the UI SHALL show that decision-relevant fact without requiring hover, focus, or disclosure expansion
- **AND** supporting Root, Store, Reference, schema, or provenance facts SHALL NOT visually outrank the workflow action

#### Scenario: Compress secondary scan facts accessibly

- **GIVEN** a surface has secondary Root source, Store, Reference, schema, freshness, source, or count facts
- **WHEN** the surface renders its compact summary
- **THEN** the UI SHALL represent those facts through concise status badges where appropriate
- **AND** each tooltip-backed badge SHALL be keyboard reachable and carry an accessible name
- **AND** the summary SHALL preserve unknown, unavailable, warning, and error distinctions without inventing aggregate health

#### Scenario: Disclose verbose evidence on demand

- **GIVEN** a surface has verbose paths, raw CLI envelopes, provenance, successful settlement history, or detailed diagnostics
- **WHEN** the surface first renders
- **THEN** the UI SHALL keep that evidence in a collapsed Accordion or equivalent disclosure region
- **AND** the user SHALL be able to reveal the original source-attributed evidence without navigating away

#### Scenario: Promote failures out of indirect space

- **GIVEN** a Root, Reference, transport, CLI, mutation, or projection failure affects the current surface
- **WHEN** the failure is present
- **THEN** the UI SHALL render the failure directly with its actionable message
- **AND** the failure SHALL NOT exist only inside a Tooltip, Popover, or collapsed disclosure

#### Scenario: Keep presentation owners pure

- **GIVEN** live and static surfaces reuse compact status and evidence disclosure components
- **WHEN** those components render
- **THEN** they SHALL consume already-resolved presentation facts
- **AND** they SHALL NOT acquire subscriptions, authorize mutations, infer aggregate health, or fork source semantics

### Requirement: Product task ownership remains explicit

OpenSpecUI SHALL assign each visible fact to the surface that can explain or edit it, rather than repeating a
clickable summary across navigation and content surfaces.

#### Scenario: Navigation does not duplicate Context

- **GIVEN** the project shell exposes navigation to `/context`
- **WHEN** the desktop or mobile navigation renders
- **THEN** it SHALL expose route navigation without a second clickable Planning identity summary
- **AND** Planning root, Launch project, Store, References, and action readiness SHALL remain owned by Context.

#### Scenario: Project Binding keeps declarations primary

- **GIVEN** the launch project has a `store:` declaration and zero or more `references:` declarations
- **WHEN** Project Binding renders
- **THEN** editable declarations and Save remain directly visible
- **AND** Store editing SHALL allow a keyboard-accessible freeform id plus optional registry suggestions
- **AND** suggestion loading/failure SHALL not block a valid explicit id from being saved.

#### Scenario: Context answers the operational question first

- **GIVEN** a live or failed Root Context observation exists
- **WHEN** Context renders
- **THEN** the first readable summary SHALL identify the Planning root, Launch project, Store/References, and whether root actions are executable
- **AND** raw command payloads, timestamps, data-home paths, and verbose diagnostics SHALL remain in deeper evidence.

#### Scenario: Evidence remains readable on narrow surfaces

- **GIVEN** a Change has long paths, artifact mappings, References, and CLI envelopes
- **WHEN** Paths and CLI evidence is opened on a narrow viewport
- **THEN** readable summaries SHALL use wrapping or bounded code blocks
- **AND** no ancestor shall create a competing page-level horizontal scrollbar.

#### Scenario: Information density follows the content container

- **GIVEN** a Config, Context, Settings, or Change evidence surface is rendered inside a shell
- **WHEN** its nearest inline-size container moves from narrow through intermediate to spacious widths
- **THEN** the surface SHALL begin with one readable mobile column
- **AND** it SHALL add columns only through content-driven container queries
- **AND** an outer viewport breakpoint SHALL NOT force a denser internal layout before the content container can sustain it.

### Requirement: Root topology and configuration hygiene remain independent

OpenSpecUI SHALL derive one objective Root topology independently from configuration diagnostics, then simplify
only redundant presentation while preserving every warning and repair path at its owning surface.

#### Scenario: Classify physical Root topology

- **GIVEN** a current Root Context observation contains a Launch project and a CLI-selected Planning root
- **WHEN** their canonical physical identities are compared
- **THEN** the presentation topology SHALL be `collapsed` when they identify the same directory
- **AND** it SHALL be `distinct` when both identities are available and differ
- **AND** it SHALL be `unresolved` when a current identity is unavailable
- **AND** Root source labels or configuration diagnostics SHALL NOT substitute for that physical comparison.

#### Scenario: Remove the healthy collapsed Dashboard band

- **GIVEN** Root topology is `collapsed`, no References are observed, Code and Planning use one settled Git repository, and no Root, Reference, Git, transport, or refresh state needs attention
- **WHEN** Dashboard renders
- **THEN** the context band SHALL be absent rather than restating the Planning path, `nearest`, zero References, and one Git repository
- **AND** Context navigation SHALL remain available through the project navigation owner
- **AND** distinct topology, References, refresh, Git resolution, or any failure SHALL restore the relevant direct summary.

#### Scenario: Collapse Terminal cwd choice without weakening ownership

- **GIVEN** Root topology is `collapsed`
- **WHEN** a generic Terminal creation surface renders
- **THEN** it SHALL omit the Launch-versus-Planning selector and create against `launch-project`
- **AND** a workflow-locked Planning creation SHALL omit the selector while preserving `planning-root` and its expected Root generation
- **AND** the backend cwd-target protocol and Planning stale-generation guard SHALL remain unchanged
- **AND** `distinct` topology SHALL retain the explicit selector.

#### Scenario: Keep an ignored Store declaration repairable

- **GIVEN** CLI Doctor reports `root_pointer_ignored` because a real local OpenSpec root also declares `store:`
- **WHEN** Project Binding renders
- **THEN** it SHALL present the diagnostic as a non-blocking configuration warning
- **AND** it SHALL state that the current Store declaration is ignored
- **AND** it SHALL provide a clear action through the existing editable declaration draft to remove that `store:` value
- **AND** the warning SHALL NOT block Root-dependent actions or be styled as a destructive Root failure.

#### Scenario: Consolidate same-root Context identity

- **GIVEN** Root topology is `collapsed`
- **WHEN** live Context renders its operational summary
- **THEN** it SHALL present one `Project root` identity rather than separate Active Planning root and Launch project rows
- **AND** Root source, Store provenance, configuration warnings, and raw command evidence SHALL remain retrievable in their appropriate indirect or direct evidence layers
- **AND** `distinct` or `unresolved` topology SHALL preserve separate Launch and Planning facts.

### Requirement: Terminal chrome follows the active Terminal palette

OpenSpecUI SHALL treat Terminal chrome as a palette-local surface whose neutral foreground does not depend on the
application light or dark theme.

#### Scenario: Keep neutral Terminal text legible

- **GIVEN** the active Terminal palette may have a dark, gray, or light background independently from the application theme
- **WHEN** Terminal tabs, cwd identity, controls, or the empty state render neutral text and borders
- **THEN** their default and secondary neutral colors SHALL derive from the active Terminal palette
- **AND** every built-in palette's neutral foreground SHALL maintain at least WCAG AA `4.5:1` contrast against its Terminal background.

#### Scenario: Preserve semantic state colors and application-owned overlays

- **GIVEN** Terminal chrome contains explicit error, success, activity, focus, selection, or notification states
- **WHEN** the palette-local neutral defaults are applied
- **THEN** those explicit semantic states SHALL remain distinguishable rather than being flattened into one descendant color
- **AND** Terminal configuration dialogs, Settings, and other application-owned overlays SHALL continue to use the application theme.

#### Scenario: Keep Terminal-owned popups on one palette

- **GIVEN** a Context Menu, Popover, or equivalent popup is physically mounted inside the Terminal palette boundary
- **WHEN** the popup renders neutral surface and text tokens
- **THEN** its paired surface and foreground colors SHALL both derive from the active Terminal palette
- **AND** its default text SHALL maintain at least WCAG AA `4.5:1` contrast against that popup surface
- **AND** application-owned overlays outside the Terminal boundary SHALL remain application-themed.

### Requirement: Resolved Context is a Config-owned fact surface

OpenSpecUI SHALL present Resolved Context as the objective output of Config declarations after OpenSpec CLI root
selection, rather than as an independent persistent workspace area.

#### Scenario: Enter and leave Resolved Context through Config

- **GIVEN** Config is the owner of project, Planning-root, and environment declarations
- **WHEN** project navigation and the Config page header render
- **THEN** Context SHALL NOT appear as a persistent desktop or mobile workspace tab
- **AND** Config SHALL expose a title-level action to `/config/context`
- **AND** Resolved Context SHALL expose a direct return action to `/config`
- **AND** live routing, static routing, SSG generation, notifications, and internal links SHALL use `/config/context` as the single canonical route.

#### Scenario: Read effective facts before technical evidence

- **GIVEN** a live, refreshing, failed, or static Context observation exists
- **WHEN** Resolved Context renders
- **THEN** effective Root identity and current action authority SHALL occupy the direct plane
- **AND** Launch/Planning relationship, Store provenance, and direct Reference summary SHALL remain structured and readable without opening raw evidence
- **AND** errors, blockers, stale authority, and failed Reference diagnostics SHALL remain directly visible.

#### Scenario: Disclose secondary Context evidence by concern

- **GIVEN** Context contains Reference diagnostics, resolution metadata, Context members, and Doctor/Context command envelopes
- **WHEN** the page first renders
- **THEN** each concern SHALL use a distinct collapsed disclosure rather than one mixed evidence panel
- **AND** Tooltip SHALL contain only concise terminology help, status explanation, or a complete single value
- **AND** long diagnostics, multi-record evidence, stderr, stdout, and raw payloads SHALL NOT exist only in Tooltip content
- **AND** every disclosure SHALL remain keyboard accessible and bounded without page-level horizontal overflow.

### Requirement: Recursive Spec Identity in Views

Owned and referenced Spec views SHALL preserve the complete recursive Spec id across navigation, search, export,
SSG route generation, hydration, and document lookup.

#### Scenario: Navigate to a nested owned Spec

- **GIVEN** the CLI reports Spec id `platform/auth`
- **WHEN** the user opens the owned Spec
- **THEN** the route and lookup SHALL address exactly `platform/auth`
- **AND** SHALL NOT flatten it to `platform` or `auth`

#### Scenario: Navigate to a nested referenced Spec

- **GIVEN** Store `team` exposes Spec id `platform/auth`
- **WHEN** the user opens it from search, catalog, or static export
- **THEN** Store identity and complete Spec identity SHALL round-trip independently
- **AND** traversal protection SHALL remain enforced

### Requirement: Change Detail Evidence Surface

Active Change Detail SHALL keep workflow decisions in a stable default plane and expose persistent source evidence
through a dedicated routed tab without changing source or mutation authority.

#### Scenario: Keep the Header independent from evidence volume

- **GIVEN** a Change has workflow actions, Apply inputs, Root/Reference facts, and arbitrarily long CLI evidence
- **WHEN** Change Detail renders
- **THEN** the Header SHALL contain Change identity, subtitle scan badges, and compact Header actions
- **AND** Actions SHALL occupy the title inline-end while the container has sufficient space
- **AND** the complete Action row SHALL wrap to the title block-end only when the Header container becomes narrow
- **AND** direct status SHALL render in a full-width region below the Header
- **AND** verbose evidence SHALL NOT affect Header height or right-side width allocation

#### Scenario: Keep the default decision plane actionable

- **WHEN** the default Artifact or Content tab is active
- **THEN** Change identity, Schema, artifact progress, Root/Store, References, and workflow actions SHALL remain directly visible
- **AND** Schema, artifact progress, Root/Store, and References SHALL use Tooltip-backed badges in the subtitle
- **AND** each action-specific unavailable reason SHALL be available from the corresponding disabled button Tooltip
- **AND** Change Detail SHALL NOT render a duplicate `Unavailable:` action summary
- **AND** transport errors, Root blockers, Reference failures, stale authority, and progress divergence SHALL remain visible without opening a tab, Tooltip, Dialog, or disclosure
- **AND** non-empty Apply context or operation guidance SHALL expose one `Apply inputs` Action that opens a bounded Dialog
- **AND** empty Apply inputs SHALL expose neither the Action nor the Dialog

#### Scenario: Inspect complete Change evidence

- **WHEN** the user selects the `Evidence` tab
- **THEN** readable Root/Store facts, artifact outputs, References, CLI result, and raw CLI payload SHALL remain retrievable in source-attributed layers
- **AND** the tab SHALL follow `Folder`, participate in the existing routed tab query, and SHALL NOT become the default tab
- **AND** a Dialog SHALL NOT own persistent Change evidence

#### Scenario: Preserve Reference evidence authority

- **GIVEN** Root Context is current, retained during refresh/failure, or unavailable
- **WHEN** Change Detail projects Reference evidence
- **THEN** it SHALL distinguish `current`, `retained`, and `unavailable`
- **AND** unavailable evidence SHALL NOT be presented as zero observed References
- **AND** a static snapshot SHALL explicitly report that live CLI and Reference provenance are unavailable

#### Scenario: Bound Evidence scrolling

- **GIVEN** Evidence contains long paths, diagnostics, and raw JSON
- **WHEN** its content exceeds the available tab space at narrow or wide container widths
- **THEN** the Evidence panel SHALL own the tab's primary vertical scrolling
- **AND** paths SHALL wrap, raw payload SHALL remain bounded, and no ancestor SHALL create page-level horizontal overflow

#### Scenario: Keep Change evidence presentation pure

- **WHEN** compact and complete Change evidence components render
- **THEN** they SHALL consume already-resolved Change Status and Root Context presentation facts
- **AND** SHALL NOT create subscriptions, authorize mutations, reconstruct CLI facts, or change static snapshot contracts
