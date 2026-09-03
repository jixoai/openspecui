# opsx-config-center Specification

## Purpose

Define the route-backed Config workbench, its configuration owners, and guided project initialization for supported
OpenSpec projects.

## Requirements

### Requirement: Dedicated Config view for OPSX configuration

OpenSpecUI SHALL provide a route-backed Config workbench that separates configuration owners while keeping Config
as one top-level application destination.

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

#### Scenario: Open Config overview

- **WHEN** the user opens `/config`
- **THEN** the page SHALL summarize Project Binding, Active Root, Environment, Agent Delivery, Schemas, and Resolved
  Context readiness
- **AND** expose Config-owned Init, Guide, and Context actions
- **AND** direct failures SHALL remain visible without hover or expansion

### Requirement: Config view surfaces project configuration

Project configuration SHALL be separated into Project Binding and Active Root owners. Project Binding SHALL own
structured `store` and `references`. Active Root SHALL own structured `schema`, `context`, `rules`, and
`operations`, while also exposing an explicit raw YAML whole-document mode.

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

#### Scenario: Expand Active Root in the Config page

- **WHEN** the Active Root owner renders Structured or Raw configuration content
- **THEN** the content SHALL participate directly in the Config page's natural block flow
- **AND** SHALL NOT calculate or write a viewport-constrained height from JavaScript
- **AND** SHALL NOT add a second card shell or page-level overflow owner around the editor
- **AND** Structured content SHALL expand naturally while Raw YAML MAY use a CSS-only minimum editor height

#### Scenario: Save structured Active Root fields

- **GIVEN** the YAML contains comments, binding fields, and unknown team keys
- **WHEN** the user saves structured official fields
- **THEN** only the owned YAML nodes SHALL change
- **AND** comments, `store`, `references`, ordering where representable, and unknown keys SHALL be preserved

#### Scenario: Save custom raw YAML

- **GIVEN** the user opened raw YAML at revision A
- **WHEN** the user saves valid YAML containing custom keys and the file remains at revision A
- **THEN** OpenSpecUI SHALL atomically write the complete document
- **AND** refresh Project Binding, Active Root, Root Context, Schema, and action-readiness projections
- **AND** SHALL NOT reject unknown keys merely because official OpenSpec does not define them

#### Scenario: Reject a stale raw save

- **GIVEN** the physical YAML changed after revision A was loaded
- **WHEN** the user attempts to save revision A
- **THEN** OpenSpecUI SHALL reject the write as a configuration revision conflict
- **AND** preserve the latest physical source for review

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

### Requirement: Config Revalidation Draft Boundary

The Config view SHALL retain local drafts and editable overlay state across remote projection revalidation. It SHALL distinguish readable display-only configuration from a current configuration that may authorize a write.

#### Scenario: Active Root or Project Binding is revalidating

- **GIVEN** a current Config projection becomes revalidating or refresh-error
- **WHEN** the user views its existing content
- **THEN** the content SHALL remain readable and copyable as display-only
- **AND** a mutation requiring current Root/Config authority SHALL remain locked

#### Scenario: A remote Config update arrives during a dirty edit

- **GIVEN** a user is editing a dirty Project Binding, Active Root, Environment Global, schema, template, or settings draft
- **WHEN** a newer remote projection arrives
- **THEN** the UI SHALL preserve the local draft and open editing interaction
- **AND** SHALL expose local update availability rather than replacing the draft or silently saving stale data

### Requirement: Config view uses route-backed owner navigation

Config SHALL NOT combine fixed owner domains and dynamic Schema entities in one horizontal tab strip. It SHALL use
route-backed secondary pages: `/config/project`, `/config/root`, `/config/environment`, `/config/agents`,
`/config/schemas`, `/config/schemas/:id`, and `/config/context`.

#### Scenario: Navigate Config on a narrow viewport

- **WHEN** the Config workbench is rendered in a narrow container
- **THEN** every owner page SHALL remain discoverable without horizontal page scrolling
- **AND** Schema entities SHALL be reached through the Schema catalog rather than clipped dynamic tabs
- **AND** each route SHALL have one page-level scroll owner

#### Scenario: Adapt the Config NavBar by container width

- **WHEN** the Config workbench container cannot display all owner labels without crowding
- **THEN** the top Config NavBar SHALL preserve every destination as an icon-only action with an accessible name and Tooltip
- **AND** labels SHALL appear when the Config container has sufficient inline space
- **AND** destinations SHALL form one table-like row separated only by thin lines
- **AND** the selected destination SHALL change only foreground and background colors without radius, border emphasis, or shadow
- **AND** only the NavBar bottom rule SHALL use the full `border` color
- **AND** the NavBar SHALL have no top rule and SHALL use a subdued derived color for internal column separators

#### Scenario: Render a Config owner header

- **WHEN** a first-level Config owner route renders its page header
- **THEN** the shared NavBar SHALL provide the return path to Overview
- **AND** the page content SHALL NOT repeat a default `<- Config` action
- **AND** a nested entity page MAY expose an explicit return to its direct catalog owner

#### Scenario: Navigate between Config owner pages

- **WHEN** the user navigates from any `/config/**` owner page to another Config owner or Schema route
- **THEN** both routes SHALL remain in the Config semantic family
- **AND** the stable top NavBar SHALL remain outside the route detail snapshot
- **AND** the owner header and content SHALL participate in one detail View Transition

### Requirement: Environment and Agent Delivery Have One Structured Owner Each

Environment SHALL own machine `defaultStore`, feature flags, data-scope/config-path evidence, and unknown
passthrough evidence. `/config/agents` SHALL solely own structured `profile`, `delivery`, `workflows`, Agent
inventory, and Init/Update/repair execution.

#### Scenario: Configure machine default Store

- **WHEN** the user sets or clears `defaultStore`
- **THEN** Environment SHALL preserve the exact configured value through settlement
- **AND** Root Context SHALL independently report whether the CLI selected it effectively
- **AND** Project Binding SHALL NOT mirror the machine value

#### Scenario: Configure Agent delivery policy

- **WHEN** the user changes `profile`, `delivery`, or `workflows`
- **THEN** `/config/agents` SHALL be the structured mutation owner
- **AND** Environment and Settings SHALL provide no second structured editor

### Requirement: Initialize Project Alert

When the Launch Project lacks a local `openspec/` directory, OpenSpecUI SHALL offer one explicit-confirmation
Initialize Project Alert globally and through Config.

#### Scenario: Open without automatic mutation

- **GIVEN** local OpenSpec initialization is absent
- **WHEN** the Alert opens
- **THEN** it SHALL display the exact proposed command and local/effective Root facts
- **AND** SHALL NOT execute until the user confirms

#### Scenario: Complete initialization

- **WHEN** `openspec init <launch-project> --tools=none` settles successfully
- **THEN** the same Alert SHALL preserve the successful command evidence and transition to its success state
- **AND** SHALL expose `[Ok] [Start Guide]` without opening a second Dialog
- **AND** `Ok` SHALL close without starting the Guide
- **AND** `Start Guide` SHALL begin the adaptive Config Guide

#### Scenario: Dismiss the automatic offer

- **WHEN** the user closes the automatic Alert before initialization
- **THEN** automatic reopening SHALL be suppressed only for the current page runtime
- **AND** Config SHALL continue to expose Init while local setup remains absent

### Requirement: Adaptive Config Guide

Config SHALL provide one typed adaptive Guide for Project Binding, Active Root, Agent Delivery, and Resolved Context
verification. A guide library MAY render focus and popovers but SHALL NOT own readiness, navigation authority,
mutation, or completion.

#### Scenario: Ready stages require explicit continuation

- **GIVEN** a Guide stage is objectively current and ready
- **WHEN** the Guide observes that projection
- **THEN** the stage SHALL remain visible and SHALL enable Continue
- **AND** SHALL NOT advance until the user explicitly activates Continue
- **AND** warning, stale, blocked, failed, or active-edit stages SHALL keep Continue disabled

#### Scenario: Complete the Guide

- **WHEN** Resolved Context is current, reports a usable selected Root, and the user explicitly activates Continue
- **THEN** the Guide MAY complete after every preceding stage was explicitly continued
- **AND** presentation callbacks alone SHALL NOT mark completion

#### Scenario: Preserve target interaction through one bevel mask

- **WHEN** the Guide highlights a mounted semantic target
- **THEN** one SVG even-odd mask SHALL block pointer input only outside the hole
- **AND** the real target SHALL remain interactive without target DOM mutation
- **AND** the hole SHALL derive bevel cuts from computed target corner radii
- **AND** browsers without `corner-shape: bevel` SHALL receive square hole corners
- **AND** the painted veil SHALL use distinct theme-aware colors that remain perceptible on both light and dark surfaces

### Requirement: OpenSpecUI 12 Agent Delivery Inventory

`/config/agents` SHALL select the official Agent inventory and command capabilities from the admitted running
OpenSpec CLI version, not from one fixed 1.12 registry. It SHALL project supported 1.12 physical delivery
metadata: current/legacy project roots, user-global skill roots, detection paths, command paths, delivery
capability, generated version, migration/cleanup evidence, and IDE restart requirements where that CLI declares
them. A tool absent from the admitted CLI line SHALL be unavailable for that line, not falsely stale or
present.

#### Scenario: Project and global roots remain distinct

- **GIVEN** MiniMax Code declares a global skills root and Codex declares a project skills root
- **WHEN** Agent delivery is projected
- **THEN** MiniMax evidence SHALL identify the user-global root
- **AND** Codex evidence SHALL identify the project-local root
- **AND** the UI SHALL NOT present either root as the other scope

#### Scenario: Zed is a 1.10-line skills-only target

- **GIVEN** the admitted OpenSpec CLI is stable 1.12.x
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL appear as a skills-only project target writing `.agents/skills`
- **AND** it SHALL NOT be offered with a command surface
- **GIVEN** the admitted OpenSpec CLI is stable 1.9.x or older
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL be unavailable for that line

#### Scenario: Antigravity migration is objective

- **GIVEN** the admitted OpenSpec CLI is stable 1.12.x and OpenSpec-managed Antigravity artifacts exist at
  `.agent/`
- **WHEN** Agent delivery is projected
- **THEN** OpenSpecUI SHALL report `.agents/skills` and `.agents/workflows` as current roots with `.agent` as
  legacy/migration evidence
- **AND** SHALL NOT delete or move the files without an explicit official CLI operation

#### Scenario: Antigravity remains on its 1.10 root

- **GIVEN** OpenSpec-managed Antigravity artifacts were generated by a 1.10-era CLI at `.agent/` and the
  admitted OpenSpec CLI is stable 1.12.x
- **WHEN** Antigravity delivery is projected
- **THEN** `.agent` SHALL appear only as legacy/migration evidence toward the `.agents` roots
- **AND** the retired 1.10-era current-root interpretation SHALL NOT be projected for that session

#### Scenario: Codex migration is objective

- **GIVEN** OpenSpec-managed Codex skills exist at `.codex/skills` but not `.agents/skills`
- **WHEN** Agent delivery is projected
- **THEN** OpenSpecUI SHALL report legacy/migration evidence
- **AND** SHALL NOT report `.codex` as the current expected root
- **AND** SHALL NOT delete or move the files without an explicit official CLI operation

#### Scenario: Shared skills-root ownership is three-valued

- **GIVEN** the `.agents/skills` tree may be owned by `codex`, `zed`, or the vendor-neutral `agents` target
- **WHEN** Agent delivery is projected
- **THEN** the owner evidence SHALL come from the official marker and arbitration rules
- **AND** Antigravity SHALL be identified as commands-only at that root, never the skills writer
- **AND** co-located targets SHALL be presented as sharing one physical tree

#### Scenario: SourceCraft Code Assistant enters at 1.12

- **GIVEN** the admitted OpenSpec CLI is stable 1.12.x
- **WHEN** the Agent inventory is listed
- **THEN** SourceCraft Code Assistant SHALL appear with skills at `.codeassistant/skills` and commands at
  `.codeassistant/commands/opsx-<id>.md`
- **AND** its skills SHALL be presented as natural-language referenced with no slash-command surface for
  skills
- **AND** it SHALL NOT declare an IDE restart requirement or any migration
- **GIVEN** the admitted OpenSpec CLI is stable 1.11.x or older
- **WHEN** the Agent inventory is listed
- **THEN** SourceCraft Code Assistant SHALL be unavailable for that line

#### Scenario: Select the version-specific official inventory

- **GIVEN** the admitted OpenSpec CLI is stable 1.12.x
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL appear with the shared `.agents/skills` root and Antigravity SHALL declare the
  `.agents` roots with `.agent` as legacy
- **AND** SourceCraft Code Assistant, Command Code, MiniMax Code, Rovo Dev CLI, and Shared `.agents` skills
  SHALL retain their individual capability and path metadata (including MiniMax's user-global root and
  Command Code's `.commandcode/commands/opsx-<id>.md` surface)
- **AND** an IDE restart requirement SHALL remain visible only where that line declares it for a tool it
  actually writes for
- **GIVEN** the admitted OpenSpec CLI is stable 1.11.x or older
- **WHEN** the Agent inventory is listed
- **THEN** no 1.12-line target SHALL appear as stale, missing, or generated for that session

#### Scenario: One missing adapter does not invalidate unrelated command evidence

- **GIVEN** the admitted CLI line has no command adapter for one registry entry
- **WHEN** OpenSpecUI loads generated command evidence
- **THEN** that entry SHALL be unavailable with version-scoped evidence
- **AND** command evidence for every independently supported adapter SHALL remain available

#### Scenario: Retained physical state keeps the selected inventory

- **GIVEN** an admitted 1.12 Agent projection observes a filesystem or Environment replacement
- **WHEN** its retained physical states recompute
- **THEN** the replacement SHALL use the same 1.12-selected registry as the initial projection
- **AND** SHALL NOT reintroduce retired-line targets from a process-global registry

#### Scenario: Direct Init uses the projected registry

- **GIVEN** an admitted 1.12 Agent projection includes a tool
- **WHEN** a caller directly requests Init with a tool outside the projected registry in an explicit `tools`
  array
- **THEN** the Router SHALL reject the tool before a CLI process starts
- **AND** SHALL preserve the CLI-owned literal `tools: 'all'` without rewriting it from the projected
  inventory

### Requirement: Config Retains Sole Agent Mutation Authority

Agent policy and delivery mutations SHALL remain owned by `/config/agents`. Other pages MAY link to this owner or
show read-only summary/evidence but SHALL NOT create a second structured editor or implement filesystem migration.

#### Scenario: Global Agent observation needs repair

- **GIVEN** a global skill-root observation reports missing, stale, or migration-needed artifacts
- **WHEN** the user views the Config Agent page
- **THEN** the page SHALL expose the exact evidence and official CLI repair route
- **AND** SHALL retain Config as the sole mutation owner
