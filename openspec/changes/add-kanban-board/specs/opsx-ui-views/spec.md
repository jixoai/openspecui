<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Specify an objective Kanban projection over OpenSpec task and archive facts.
2. Separate readonly presentation from live Operator capabilities.
3. Require regional realtime/static parity and accessible interaction paths.

Contributor request (2026-07-18): add a Kanban-style Change view.
Owner decision (2026-07-28): use objective OPSX semantics and replace Dashboard Workflow Progress with ReadonlyKanban.
-->

# opsx-ui-views Specification Delta

## ADDED Requirements

### Requirement: Objective Change Kanban Projection

OpenSpecUI SHALL project Changes into four fact-based lanes and SHALL NOT treat those lanes as a persisted or
prescriptive workflow.

```text
active + no-tasks     -> No tracked tasks
active + in-progress  -> Tasks remaining
active + complete     -> Tasks complete
archive               -> Archived
```

#### Scenario: Preserve upstream task semantics

- **GIVEN** active Changes carry OpenSpec `TrackedTaskProgress`
- **WHEN** a Kanban projection is derived
- **THEN** each active Change SHALL be placed by its exact `phase`
- **AND** `no-tasks` SHALL remain distinct from `complete`
- **AND** the UI SHALL NOT infer TODO, QA, verification, validation, sync, or archive readiness

#### Scenario: Present archived structure objectively

- **GIVEN** a Change exists under the archive stage
- **WHEN** the Kanban projection is derived
- **THEN** the Change SHALL appear in Archived
- **AND** Archived SHALL state structural location only, not quality or task completion

#### Scenario: Filter archived history by objective time

- **GIVEN** archived history may be unbounded
- **WHEN** the full Board opens
- **THEN** it SHALL default to `30d` and offer `7d`, `30d`, `90d`, and `all`
- **AND** the timestamp SHALL use a valid dated archive id before falling back to `updatedAt`

### Requirement: Shared Readonly Kanban

OpenSpecUI SHALL provide one readonly Kanban presentation for Dashboard and static publication.

#### Scenario: Replace only Dashboard Workflow Progress

- **GIVEN** Dashboard Summary has current Change phase counts and bounded archived summaries
- **WHEN** Dashboard renders
- **THEN** `ReadonlyKanban` SHALL replace Workflow Progress
- **AND** Dashboard Active Changes SHALL remain
- **AND** cards SHALL navigate to their Change or Archive detail
- **AND** the readonly component SHALL accept no mutation or drag callbacks

#### Scenario: Render static Board from the same model

- **GIVEN** a static export contains active and archived Change facts
- **WHEN** `/board` renders without a backend
- **THEN** it SHALL use the shared objective lane model and readonly presentation
- **AND** it SHALL expose no Apply, Archive, or drag capability

### Requirement: Interactive Kanban Operator Surface

The live `/board` route SHALL add commands around the objective projection without mutating lane state directly.

#### Scenario: Launch Apply through the production owner

- **GIVEN** an active Change and current Root and Change projections
- **WHEN** the user chooses Apply from its explicit card command
- **THEN** the Board SHALL open the same Compose Operator used by Change Detail
- **AND** the Board SHALL NOT execute Apply or mutate task state directly

#### Scenario: Launch Archive through the production owner

- **GIVEN** any active Change and current Root and Change projections
- **WHEN** the user chooses Archive or drags the card to Archived
- **THEN** the Board SHALL open the same Archive Operator used by Change Detail
- **AND** the drag SHALL NOT archive or mutate the card directly
- **AND** the explicit command SHALL remain available to keyboard and touch users

#### Scenario: Reject stale operation authority

- **GIVEN** Root authority or the corresponding live projection is loading, revalidating, failed, or retained-only
- **WHEN** a card is displayed
- **THEN** it MAY remain visible as display evidence
- **BUT** Apply, Archive, and archive drop SHALL be disabled
- **AND** a drop SHALL resolve its Change id against current rows before opening an Operator

### Requirement: Regional Kanban Realtime Lifecycle

The interactive Board SHALL preserve Changes and Archives as independently settling regions.

#### Scenario: Render one region while its sibling waits

- **GIVEN** one projection has current rows and the other is loading or revalidating
- **WHEN** the Board renders
- **THEN** the current lanes SHALL remain visible
- **AND** only the affected region SHALL show its local lifecycle state

#### Scenario: Preserve progressive and failed evidence

- **GIVEN** Changes emit progressive batches, row errors, or a failed refresh with retained rows
- **WHEN** the Board updates
- **THEN** delivered rows SHALL remain visible in their objective lanes
- **AND** progress, row errors, refresh activity, and terminal region errors SHALL remain attributable
- **AND** list movement SHALL preserve visual continuity instead of flashing or replacing the full Board
