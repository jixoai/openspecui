<!--
Orthogonal intents (created 2026-08-18 Asia/Shanghai):
1. Clarify that CLI list task summaries are valid implementation evidence at list surfaces.
2. Preserve planning completion as a planning-only fact.
3. Prohibit local tracked-task arithmetic from replacing CLI evidence.

Original request (2026-08-18): restore `Applying`, CLI task counts, and approximate progress in Change List.
-->

## MODIFIED Requirements

### Requirement: CLI Apply Progress Is Authoritative

OpenSpecUI SHALL preserve CLI-owned implementation progress from both the Change-list task summary and
`instructions apply --json` `progress.total`, `progress.complete`, and `progress.remaining` when those projections
are available. Change List, Dashboard, and ReadonlyKanban MAY show the CLI list summary as `completed/total` and a
proportional visual signal. Detail SHALL show the source-attributed Apply progress when Apply Instructions are loaded.
The actionable `tasks` list and locally parsed checklists SHALL remain separate projections and SHALL NOT redefine the
CLI progress denominator or phase.

#### Scenario: Planning completion does not hide applied CLI work

- **GIVEN** Status reports `isPlanningComplete: true`
- **AND** CLI task evidence reports `completedTasks: 31` and `totalTasks: 33`
- **WHEN** a Change is rendered in Change List or Dashboard
- **THEN** the phase SHALL be `Applying`
- **AND** the row SHALL show `Tasks 31/33`
- **AND** the row MAY show a proportional progress signal
- **AND** it SHALL NOT show `Planning Complete` as the only phase signal

#### Scenario: CLI list summary remains valid before Detail Apply Instructions load

- **GIVEN** Change List has a CLI-owned task summary but Detail Apply Instructions have not been loaded
- **WHEN** the Change row renders
- **THEN** the row MAY show the CLI `completed/total` summary and proportional signal
- **AND** the summary SHALL be labeled or attributable to the CLI

#### Scenario: Aggregate Status loading does not mask CLI Apply evidence

- **GIVEN** a Change List or Dashboard primary row carries CLI `completedTasks: 31` and `totalTasks: 33`
- **AND** the separately admitted aggregate Status projection has not returned for that Change
- **WHEN** the row first renders
- **THEN** its phase SHALL be `Applying`, not `Unknown`
- **AND** it SHALL expose CLI `Tasks 31/33`
- **AND** artifact status MAY remain visibly loading or unavailable without relabeling the CLI Apply fact

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

#### Scenario: Tracked analytics never replace CLI evidence

- **GIVEN** a Change has CLI `31/33` evidence and divergent local tracked values `1/100`
- **WHEN** Change List, Dashboard, or ReadonlyKanban renders
- **THEN** the implementation evidence SHALL remain `31/33`
- **AND** the phase and proportional signal SHALL derive from the CLI values
- **AND** `1/100` SHALL NOT be shown as implementation progress

#### Scenario: Missing CLI evidence stays absent

- **GIVEN** a Change has local tracked task data but no CLI task summary
- **WHEN** a list surface renders
- **THEN** it SHALL omit implementation task counts and progress signals
- **AND** it MAY still show planning/artifact status

#### Scenario: List does not relabel tracked analytics as implementation progress

- **GIVEN** Change List has Status and locally tracked task data but has not loaded any CLI task summary
- **WHEN** it renders a Change row
- **THEN** it MAY show planning/artifact workflow phase
- **AND** it SHALL NOT label tracked totals, a tracked percentage, or a tracked completion state as implementation
  task progress

#### Scenario: Detail always shows available Apply progress

- **GIVEN** Change Detail has Apply Instructions with a progress payload
- **WHEN** tracked analytics agree with the CLI Apply count
- **THEN** it SHALL display the source-attributed CLI Apply progress
- **AND** tracked analytics SHALL remain absent or clearly secondary unless divergence requires comparison
