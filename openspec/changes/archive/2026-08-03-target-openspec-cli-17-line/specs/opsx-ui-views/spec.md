<!--
Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
1. Preserve recursive Spec identity across live and static view routes.
2. Move Settings Agent mutations into the Config workbench.

Original request (2026-08-01): redesign Config and complete the OpenSpec 1.7 projection in OpenSpecUI 7.
-->

# Delta for opsx-ui-views

## MODIFIED Requirements

### Requirement: Settings View Content

Settings SHALL contain OpenSpecUI application preferences and a concise read-only Agent Integrations summary. It
SHALL NOT own OpenSpec initialization, Agent selection, profile/delivery/workflow mutation, update, repair, cleanup,
or execution Terminal state.

#### Scenario: Open Agent summary in Settings

- **WHEN** the user views Agent Integrations in Settings
- **THEN** configured, partial, drifted, failed, and unavailable counts SHALL be readable
- **AND** direct failures SHALL remain visible
- **AND** a Manage action SHALL navigate to `/config/agents`

### Requirement: Config View

The Config view SHALL be the workbench described by `opsx-config-center`, with overview actions and route-backed
owner pages rather than a mixed fixed/dynamic tab strip.

#### Scenario: Open Config actions

- **WHEN** the user opens Config overview
- **THEN** Init SHALL be available only when local setup is absent
- **AND** Guide and Resolved Context actions SHALL be available according to current projection state
- **AND** static mode SHALL not fabricate mutation authority

## ADDED Requirements

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
