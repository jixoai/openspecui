<!--
Orthogonal intents (created 2026-09-27 Asia/Shanghai):
1. Clarify scan-level task-count presentation for schemas that track no tasks (CLI 1.13.2 facts).

Original request (2026-09-27): Owner walkthrough of update-openspec-cli-1132 recorded three P3
observations; joint adjudication (ZCode + independent reviewer, Codex channel unavailable) ruled
two as presentation fixes and one as rejected — rulings recorded in loop/intake.md.
-->

## ADDED Requirements

### Requirement: No-Tracking Task Count Scan Presentation

Scan-level task-count presentation SHALL distinguish "the CLI reports no tasks" from incomplete
work without redefining CLI-owned progress evidence. On Change Detail, when the apply projection
carries `taskTrackingConfigured === false` (strictly, never for absent members), the apply progress
badge SHALL keep the literal CLI numbers while lowering its visual weight and appending the
no-tracking qualification to its accessible name and tooltip. On the Changes list, when the CLI
task summary carries `status: "no-tasks"` with `totalTasks === 0`, the row SHALL present a muted
"No tasks" in place of the `Tasks 0/0` count, with a tooltip that keeps the upstream ambiguity
verbatim (the list cannot distinguish an unconfigured `apply.tracks` from an empty tracked list;
the wording SHALL NOT assert either). Absent members and every other status SHALL render exactly
as before. Board/Kanban cards SHALL NOT change (lane placement already carries the phase fact).

#### Scenario: Detail badge degrades, not hides, for untracked schemas

- **GIVEN** a Change Detail whose apply instructions carry `taskTrackingConfigured: false` with
  `progress {0,0,0}`
- **WHEN** the header renders
- **THEN** the badge SHALL still show the literal `0/0` numbers in a muted tone
- **AND** its accessible name and tooltip SHALL append the schema-tracks-no-tasks qualification

#### Scenario: Absent tracking member keeps today's badge

- **GIVEN** apply instructions from a pre-1.13.2 CLI (no `taskTrackingConfigured`)
- **WHEN** the header renders
- **THEN** the badge SHALL render exactly as before, unqualified

#### Scenario: List row reports No tasks for the no-tasks status

- **GIVEN** a Changes row whose CLI task summary carries `status: "no-tasks"` and `totalTasks: 0`
- **WHEN** the row renders
- **THEN** it SHALL show a muted `No tasks` instead of `Tasks 0/0`
- **AND** the tooltip SHALL state the CLI reports no tasks without asserting whether tracking is
  configured
- **AND** rows with any other status or nonzero totals SHALL render exactly as before
