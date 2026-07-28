<!--
Orthogonal intents (created 2026-07-28 Asia/Shanghai):
1. Define the OPSX-first information hierarchy across Web projections.
2. Preserve accessible retrieval of secondary 6.x facts.
3. Forbid progressive disclosure from hiding errors, blockers, or stale authority.

Original request (2026-07-28): simplify most added 6.x information into Badge + Tooltip or Accordion while keeping OPSX primary.
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
