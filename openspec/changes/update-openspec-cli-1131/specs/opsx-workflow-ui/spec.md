<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Add the change-list hygiene-warning projection and Changes-page surface for CLI 1.13.1.
2. Rotate the pinned executable fixture baseline from 1.13.0 to 1.13.1.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

## ADDED Requirements

### Requirement: Change List Hygiene Warning Projection

The `opsx-change-list` projection SHALL keep its `entries` and compat `value` actionable-only: an entry
the CLI marked with `nested` is excluded at the kernel projection boundary, and the projection SHALL
carry the CLI's top-level change-list `warnings` as display evidence. The namespace-name set SHALL be a
structural derivation — the `name` of every CLI entry carrying `nested` — never parsed from warning
message text. Change-row builders keep their own id sources and SHALL subtract that set where change
inventories are built: the Changes projection, the Dashboard summary inputs (Kanban inherits), search
change documents, and the Store content projection's independent `list --json` decode. The Changes page
SHALL render the warnings as direct-plane evidence: a visible warning region naming the namespace
directory, the nested change names, and the upstream message verbatim, with CLI-owned provenance and a
generic fallback for unknown warning codes. Dashboard SHALL remain actionable-changes-only and SHALL NOT
render hygiene warnings. While the CLI change-list projection is available, a namespaced directory
SHALL NOT appear as a change row, a CLI task summary, a search change document, a Store content change
entry, or a change-detail navigation target on any surface. When the CLI change list is unavailable,
surfaces SHALL degrade to their existing behavior — rows from local listings remain visible with
absent summaries, including a namespace directory row, because the classification fact is CLI-owned —
and row visibility SHALL NOT become CLI-gated.

#### Scenario: Warnings survive the projection chain

- **GIVEN** an admitted CLI session whose `list --json` returns top-level `warnings` with one
  `nested_change_directory` entry
- **WHEN** the `opsx-change-list` projection settles and the Changes page renders
- **THEN** the warning SHALL be visible on the direct plane with the directory name and verbatim message
- **AND** the namespaced directory SHALL NOT appear among the actionable change rows

#### Scenario: One structural namespace-name set, subtracted at every row source

- **GIVEN** a change list where an entry carries `nested: ["area/alpha"]` while the local directory
  listing also contains `area`
- **WHEN** the kernel projection is built and change inventories are assembled
- **THEN** the entry SHALL be excluded from the actionable `entries` and compat `value`
- **AND** the Changes projection, Dashboard summary inputs, search change documents, and Store content
  changes SHALL subtract the structurally-derived namespace-name set (entry `name`s carrying `nested`)
  from their own id sources
- **AND** an entry carrying `nested` SHALL stay excluded even when top-level `warnings` are absent
- **AND** a warning without a structurally-nested matching entry SHALL exclude nothing, and warning
  message text SHALL never be parsed to infer directory identity
- **AND** no surface SHALL implement a second, divergent derivation of which directories are namespaced

#### Scenario: Row visibility degrades, never gates, on CLI loss

- **GIVEN** a namespaced directory exists and the CLI change-list projection is unavailable
- **WHEN** Changes, Dashboard, search, and Store content render
- **THEN** surfaces SHALL keep their existing behavior (local rows visible, CLI summaries absent)
- **AND** no surface SHALL require the CLI projection to show locally listed changes

#### Scenario: Dashboard stays actionable-only

- **GIVEN** the same admitted session
- **WHEN** the Dashboard renders its Active Changes region
- **THEN** no namespaced directory row and no hygiene warning SHALL appear there
- **AND** actionable change rows SHALL be unaffected

#### Scenario: No navigation into a namespaced directory

- **GIVEN** the Changes page renders a `nested_change_directory` warning for directory `area`
- **WHEN** the user inspects the warning region
- **THEN** no change-detail route entry for `area` SHALL exist
- **AND** OpenSpecUI SHALL NOT attempt to read, write, or repair the nested directories

## MODIFIED Requirements

### Requirement: Pinned Workflow Fixtures Are Executable

OpenSpecUI SHALL prove each accepted workflow contract against the pinned OpenSpec 1.13.1 executable, and
SHALL prove capability-boundary rejections with the retained pinned OpenSpec 1.12.0 executable. A
hand-authored payload alone SHALL NOT establish support for the CLI line, and a fixture for a retired line
SHALL NOT be reused as positive evidence for the current line.

#### Scenario: Both supported lines preserve planning/task separation

- **GIVEN** the pinned workflow fixture matrix runs against the retained pair of pinned executables
  (OpenSpec 1.13.1 as the positive line and OpenSpec 1.12.0 as the boundary line)
- **WHEN** it evaluates Status and Apply Instructions on the positive line
- **THEN** the 1.13.1 executable SHALL satisfy the typed planning-completion and progress contracts
- **AND** the boundary executable SHALL NOT be consulted for positive contract evidence

#### Scenario: Capability boundaries are executable facts

- **GIVEN** the retained pinned 1.12.0 executable is evaluated against the OpenSpecUI 13 admission gate
- **WHEN** the fixture matrix asserts the capability boundary
- **THEN** the 1.12.0 line SHALL be recorded as below-admitted for the v13 window
- **AND** the 1.13.1 executable SHALL prove the accepted payloads (including the findings report, the
  Apply Instructions readiness guidance fields, and the change-list nested-directory warnings)

#### Scenario: Positive identity is proven, not assumed

- **GIVEN** the pinned bins map names an installed npm alias for the 1.13.1 executable
- **WHEN** the fixture matrix runs
- **THEN** the executable's `--version` identity SHALL be asserted before contract assertions
- **AND** a bins-map entry pointing at another alias SHALL fail that identity assertion
