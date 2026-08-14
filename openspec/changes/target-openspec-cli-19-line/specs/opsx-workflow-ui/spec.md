<!--
Orthogonal intents (created 2026-08-15 Asia/Shanghai):
1. Define planning-completion and implementation-progress projection for OpenSpecUI 9.
2. Preserve OpenSpec CLI task totals without UI-side reconstruction.

Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
-->

## ADDED Requirements

### Requirement: Explicit Planning Completion Projection

For supported OpenSpec CLI 1.8.x and 1.9.x, OpenSpecUI SHALL project `isPlanningComplete` as the completion fact
for planning artifacts. It SHALL NOT use planning completion to claim implementation task completion, validation,
sync, archive, or release readiness. The retained `isComplete` field MAY be preserved as raw CLI evidence but SHALL
not become an ambiguous user-facing completion authority.

#### Scenario: Planning is complete while implementation work remains

- **GIVEN** Status reports `isPlanningComplete: true`
- **AND** Apply Instructions report remaining tasks
- **WHEN** the Change is rendered
- **THEN** OpenSpecUI SHALL identify planning as complete
- **AND** SHALL continue to show implementation progress as incomplete

### Requirement: CLI Apply Progress Is Authoritative

OpenSpecUI SHALL preserve `instructions apply --json` `progress.total`, `progress.complete`, and
`progress.remaining` as the primary implementation-progress fact. The actionable `tasks` list and locally parsed
checklists SHALL remain separate projections and SHALL NOT redefine the CLI progress denominator.

#### Scenario: Blank task description remains in CLI progress

- **GIVEN** a supported CLI reports a checkbox task with an empty description that is omitted from `tasks`
- **WHEN** Apply progress is projected
- **THEN** the displayed implementation total SHALL equal CLI `progress.total`
- **AND** SHALL NOT equal `tasks.length` when they differ

#### Scenario: Indented checkbox task is included

- **GIVEN** a supported CLI reports progress for an indented checkbox task
- **WHEN** Apply progress is projected
- **THEN** the progress total and completion SHALL preserve the CLI result
- **AND** local checklist analytics SHALL not overwrite it

### Requirement: v9 Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against pinned OpenSpec 1.8.0 and 1.9.0 executables. A
hand-authored payload alone SHALL NOT establish support for either CLI line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the v9 workflow fixture matrix runs against OpenSpec 1.8.0 and 1.9.0
- **WHEN** it evaluates Status and Apply Instructions
- **THEN** each executable SHALL satisfy the typed planning-completion and progress contracts
