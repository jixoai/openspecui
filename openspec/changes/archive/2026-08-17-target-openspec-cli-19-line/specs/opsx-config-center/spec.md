<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define official OpenSpec 1.8/1.9 Agent delivery projection requirements.
2. Preserve Config as the sole structured Agent mutation owner.
3. Define safe physical observation for project and global Agent skill roots.

Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
-->

## ADDED Requirements

### Requirement: OpenSpecUI 9 Agent Delivery Inventory

`/config/agents` SHALL select the official Agent inventory and command capabilities from the admitted running
OpenSpec CLI version, not from one fixed 1.9 registry. It SHALL project supported 1.8/1.9 physical delivery
metadata: current/legacy project roots, user-global skill roots, detection paths, command paths, delivery
capability, generated version, migration/cleanup evidence, and IDE restart requirements where that CLI declares
them. A tool absent from one supported CLI line SHALL be unavailable for that line, not falsely stale or present.

#### Scenario: Project and global roots remain distinct

- **GIVEN** MiniMax Code declares a global skills root and Codex declares a project skills root
- **WHEN** Agent delivery is projected
- **THEN** MiniMax evidence SHALL identify the user-global root
- **AND** Codex evidence SHALL identify the project-local root
- **AND** the UI SHALL NOT present either root as the other scope

#### Scenario: Codex migration is objective

- **GIVEN** OpenSpec-managed Codex skills exist at `.codex/skills` but not `.agents/skills`
- **WHEN** Agent delivery is projected
- **THEN** OpenSpecUI SHALL report legacy/migration evidence
- **AND** SHALL NOT report `.codex` as the current expected root
- **AND** SHALL NOT delete or move the files without an explicit official CLI operation

#### Scenario: Select the version-specific official inventory

- **GIVEN** the admitted OpenSpec CLI is stable 1.8.x
- **WHEN** the Agent inventory is listed
- **THEN** it SHALL contain only that CLI line's official targets and adapters
- **AND** Command Code SHALL be unavailable rather than reported as stale, missing, or generated
- **GIVEN** the admitted OpenSpec CLI is stable 1.9.x
- **WHEN** the Agent inventory is listed
- **THEN** Command Code, MiniMax Code, Rovo Dev CLI, Shared `.agents` skills, and existing official targets SHALL
  retain their individual 1.9 capability and path metadata
- **AND** an IDE restart requirement SHALL remain visible where declared upstream

#### Scenario: One missing adapter does not invalidate unrelated command evidence

- **GIVEN** a supported CLI line has no command adapter for one registry entry
- **WHEN** OpenSpecUI loads generated command evidence
- **THEN** that entry SHALL be unavailable with version-scoped evidence
- **AND** command evidence for every independently supported adapter SHALL remain available

#### Scenario: Retained physical state keeps the selected inventory

- **GIVEN** an admitted 1.8 Agent projection observes a filesystem or Environment replacement
- **WHEN** its retained physical states recompute
- **THEN** the replacement SHALL use the same 1.8-selected registry as the initial projection
- **AND** SHALL NOT reintroduce Command Code or 1.9-only restart metadata from a process-global registry

#### Scenario: Direct Init uses the projected registry

- **GIVEN** an admitted 1.8 Agent projection excludes Command Code
- **WHEN** a caller directly requests Init with Command Code in an explicit `tools` array
- **THEN** the Router SHALL reject the tool before a CLI process starts
- **AND** SHALL preserve the CLI-owned literal `tools: 'all'` without rewriting it from the projected inventory

### Requirement: Config Retains Sole Agent Mutation Authority

Agent policy and delivery mutations SHALL remain owned by `/config/agents`. Other pages MAY link to this owner or
show read-only summary/evidence but SHALL NOT create a second structured editor or implement filesystem migration.

#### Scenario: Global Agent observation needs repair

- **GIVEN** a global skill-root observation reports missing, stale, or migration-needed artifacts
- **WHEN** the user views the Config Agent page
- **THEN** the page SHALL expose the exact evidence and official CLI repair route
- **AND** SHALL retain Config as the sole mutation owner
