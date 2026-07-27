<!--
Orthogonal intents (created 2026-07-23 Asia/Shanghai):
1. Require OPSX routes to compose regional realtime state rather than page-wide loading gates.
2. Preserve independent Dashboard, Change, detail, and search facts through visual migration.
3. Keep page layout, navigation, and the pending Kanban work outside this behavior change.

Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。"
-->

# Delta for OPSX UI Views

## ADDED Requirements

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

