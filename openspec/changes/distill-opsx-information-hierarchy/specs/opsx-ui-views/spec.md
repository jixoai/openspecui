<!--
Orthogonal intents (updated 2026-07-29 Asia/Shanghai):
1. Define the OPSX-first information hierarchy across Web projections.
2. Preserve accessible retrieval of secondary 6.x facts.
3. Forbid progressive disclosure from hiding errors, blockers, or stale authority.

Original request (2026-07-28): simplify most added 6.x information into Badge + Tooltip or Accordion while keeping OPSX primary.
Owner correction (2026-07-29): assign shell, Project Binding, Context, Settings, and Change evidence facts to their product-task owners.
-->

# Delta for opsx-ui-views

## ADDED Requirements

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
