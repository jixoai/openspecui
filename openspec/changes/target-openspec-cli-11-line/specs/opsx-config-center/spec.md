<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Advance the Agent delivery inventory requirement to the OpenSpecUI 11 line.
2. Encode the zed addition, the antigravity root migration, and three-valued shared-root ownership.

Original request (2026-08-28): "我们直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11"
-->

## RENAMED Requirements

- FROM: `### Requirement: OpenSpecUI 9 Agent Delivery Inventory`
- TO: `### Requirement: OpenSpecUI 11 Agent Delivery Inventory`

## MODIFIED Requirements

### Requirement: OpenSpecUI 11 Agent Delivery Inventory

`/config/agents` SHALL select the official Agent inventory and command capabilities from the admitted running
OpenSpec CLI version, not from one fixed 1.11 registry. It SHALL project supported 1.10/1.11 physical delivery
metadata: current/legacy project roots, user-global skill roots, detection paths, command paths, delivery
capability, generated version, migration/cleanup evidence, and IDE restart requirements where that CLI declares
them. A tool absent from one supported CLI line SHALL be unavailable for that line, not falsely stale or
present.

#### Scenario: Project and global roots remain distinct

- **GIVEN** MiniMax Code declares a global skills root and Codex declares a project skills root
- **WHEN** Agent delivery is projected
- **THEN** MiniMax evidence SHALL identify the user-global root
- **AND** Codex evidence SHALL identify the project-local root
- **AND** the UI SHALL NOT present either root as the other scope

#### Scenario: Zed is a 1.10-line skills-only target

- **GIVEN** the admitted OpenSpec CLI is stable 1.10.x or 1.11.x
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL appear as a skills-only project target writing `.agents/skills`
- **AND** it SHALL NOT be offered with a command surface
- **GIVEN** the admitted OpenSpec CLI is stable 1.9.x or older
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL be unavailable for that line

#### Scenario: Antigravity migration is objective

- **GIVEN** the admitted OpenSpec CLI is stable 1.11.x and OpenSpec-managed Antigravity artifacts exist at
  `.agent/`
- **WHEN** Agent delivery is projected
- **THEN** OpenSpecUI SHALL report `.agents/skills` and `.agents/workflows` as current roots with `.agent` as
  legacy/migration evidence
- **AND** SHALL NOT delete or move the files without an explicit official CLI operation

#### Scenario: Antigravity remains on its 1.10 root

- **GIVEN** the admitted OpenSpec CLI is stable 1.10.x
- **WHEN** Antigravity delivery is projected
- **THEN** `.agent/skills` and `.agent/workflows` SHALL remain the current roots with no migration evidence
- **AND** the 1.11 `.agents` layout SHALL NOT be projected for that session

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

#### Scenario: Select the version-specific official inventory

- **GIVEN** the admitted OpenSpec CLI is stable 1.10.x
- **WHEN** the Agent inventory is listed
- **THEN** it SHALL contain only that CLI line's official targets and adapters
- **AND** Zed Agent SHALL appear while Antigravity SHALL still declare the `.agent` roots
- **GIVEN** the admitted OpenSpec CLI is stable 1.11.x
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL appear with the shared `.agents/skills` root and Antigravity SHALL declare the
  `.agents` roots with `.agent` as legacy
- **AND** Command Code, MiniMax Code, Rovo Dev CLI, and Shared `.agents` skills SHALL retain their individual
  capability and path metadata (including MiniMax's user-global root and Command Code's
  `.commandcode/commands/opsx-<id>.md` surface)
- **AND** an IDE restart requirement SHALL remain visible only where that line declares it for a tool it
  actually writes for
- **GIVEN** the admitted OpenSpec CLI is stable 1.9.x or older
- **WHEN** the Agent inventory is listed
- **THEN** Zed Agent SHALL be unavailable rather than reported as stale, missing, or generated

#### Scenario: One missing adapter does not invalidate unrelated command evidence

- **GIVEN** a supported CLI line has no command adapter for one registry entry
- **WHEN** OpenSpecUI loads generated command evidence
- **THEN** that entry SHALL be unavailable with version-scoped evidence
- **AND** command evidence for every independently supported adapter SHALL remain available

#### Scenario: Retained physical state keeps the selected inventory

- **GIVEN** an admitted 1.10 Agent projection observes a filesystem or Environment replacement
- **WHEN** its retained physical states recompute
- **THEN** the replacement SHALL use the same 1.10-selected registry as the initial projection
- **AND** SHALL NOT reintroduce 1.11-only targets from a process-global registry

#### Scenario: Direct Init uses the projected registry

- **GIVEN** an admitted 1.10 Agent projection excludes a 1.11-only target
- **WHEN** a caller directly requests Init with that target in an explicit `tools` array
- **THEN** the Router SHALL reject the tool before a CLI process starts
- **AND** SHALL preserve the CLI-owned literal `tools: 'all'` without rewriting it from the projected inventory
