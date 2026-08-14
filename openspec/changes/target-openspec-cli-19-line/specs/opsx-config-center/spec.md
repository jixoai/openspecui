<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define official OpenSpec 1.8/1.9 Agent delivery projection requirements.
2. Preserve Config as the sole structured Agent mutation owner.
3. Define safe physical observation for project and global Agent skill roots.

Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
-->

## ADDED Requirements

### Requirement: OpenSpecUI 9 Agent Delivery Inventory

`/config/agents` SHALL project the official supported OpenSpec 1.8/1.9 Agent inventory with physical delivery
metadata. It SHALL model current/legacy project roots, user-global skill roots, detection paths, command paths,
delivery capability, generated version, migration/cleanup evidence, and IDE restart requirements where the CLI
declares them.

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

#### Scenario: New official targets are complete

- **WHEN** the Agent inventory is listed
- **THEN** Command Code, MiniMax Code, Rovo Dev CLI, Shared `.agents` skills, and existing official targets SHALL
  retain their individual capability and path metadata
- **AND** an IDE restart requirement SHALL remain visible where declared upstream

### Requirement: Config Retains Sole Agent Mutation Authority

Agent policy and delivery mutations SHALL remain owned by `/config/agents`. Other pages MAY link to this owner or
show read-only summary/evidence but SHALL NOT create a second structured editor or implement filesystem migration.

#### Scenario: Global Agent observation needs repair

- **GIVEN** a global skill-root observation reports missing, stale, or migration-needed artifacts
- **WHEN** the user views the Config Agent page
- **THEN** the page SHALL expose the exact evidence and official CLI repair route
- **AND** SHALL retain Config as the sole mutation owner
