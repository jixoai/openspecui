# opsx-ui-views Specification Delta

## ADDED Requirements

### Requirement: Change Kanban Board

OpenSpecUI SHALL provide a Kanban board view that visualises changes across their lifecycle in four columns — **TODO**, **In Progress**, **QA**, and **Done** — driven entirely by observable state (task-completion counts and archive location). A change's column SHALL be derived, not stored:

- **TODO** — an active change with `completed === 0` tasks (including a change with no tasks defined).
- **In Progress** — an active change with `0 < completed < total` tasks.
- **QA** — an active change with `total > 0 && completed === total` tasks.
- **Done** — a change located under `changes/archive/`.

The board SHALL keep the existing per-change workflow-phase badge on each card as a distinct axis from the column (column = task progress; badge = artifact readiness). The board SHALL NOT introduce a "synced but not archived" column or any new persisted change-status field. The board SHALL match the existing design language and SHALL reuse existing data subscriptions, the workflow-phase classifier, the global archive flow, and the existing apply compose hand-off. Every drag on the board SHALL map to a real operation (archive or apply); a drag SHALL NEVER silently change a change's task state.

#### Scenario: Group active changes into lifecycle columns

- **GIVEN** active changes exist with varying task progress
- **WHEN** the user opens the board view
- **THEN** each active change SHALL appear in exactly one of TODO, In Progress, or QA
- **AND** placement SHALL follow the derivation rules (TODO `completed===0`, In Progress `0<completed<total`, QA `total>0 && completed===total`)

#### Scenario: Change with no tasks defined lands in TODO

- **GIVEN** an active change whose task total is `0`
- **WHEN** the board renders
- **THEN** the change SHALL appear in the TODO column
- **AND** SHALL NOT appear in the QA column

#### Scenario: Archived changes appear in Done

- **GIVEN** archived changes exist under `changes/archive/`
- **WHEN** the board renders
- **THEN** those changes SHALL appear in the Done column

#### Scenario: Card shows change summary and workflow-phase badge

- **GIVEN** a change is rendered as a card
- **WHEN** the user views it
- **THEN** the card SHALL show the change name, id, relative time, task count (`completed/total`), and a progress bar
- **AND** SHALL show the existing workflow-phase badge from the change status classifier
- **AND** SHALL link to the change detail (`/changes/$id` for active, `/archive/$id` for archived)

#### Scenario: Filter the Done column by time range

- **GIVEN** the Done column may contain many archived changes
- **WHEN** the user selects a time-range preset (for example `7d`, `30d`, `90d`, or `all`)
- **THEN** the Done column SHALL show only archived changes within the selected range
- **AND** the archive date SHALL be taken from the `YYYY-MM-DD-` prefix of the archive id, falling back to the change's updated time
- **AND** the board SHALL default to a bounded range rather than showing every archived change

#### Scenario: Drag a QA card to Done to archive with confirmation

- **GIVEN** a change is in the QA column
- **WHEN** the user drags its card onto the Done column
- **THEN** the UI SHALL open the existing global archive modal for that change
- **AND** the change SHALL be archived only after the user confirms in that modal
- **AND** no archive SHALL occur from the drag gesture alone

#### Scenario: Drag an apply-ready TODO card to In Progress to apply

- **GIVEN** a change is in the TODO column and is apply-ready (every artifact its schema requires for apply is done)
- **WHEN** the user drags its card onto the In Progress column
- **THEN** the UI SHALL open the existing apply compose overlay for that change (the same hand-off as the change page's Apply button)
- **AND** the apply SHALL run only after the user dispatches it from that overlay
- **AND** no task state SHALL be changed by the drag gesture itself

#### Scenario: Apply drag is offered only on apply-ready TODO cards

- **GIVEN** a TODO change that is not apply-ready (a required apply artifact is missing)
- **WHEN** the board renders that card
- **THEN** the UI SHALL NOT offer an apply drag for it
- **AND** In Progress SHALL accept only apply drags and Done SHALL accept only archive drags
- **AND** a drop whose kind does not match the target column SHALL be rejected without changing state

#### Scenario: Read-only in static mode

- **GIVEN** OpenSpecUI runs in static/SSG mode (no CLI available)
- **WHEN** the board renders
- **THEN** the board SHALL still list active and archived changes in their columns
- **AND** SHALL NOT offer drag-to-archive, drag-to-apply, or any archive/apply action
