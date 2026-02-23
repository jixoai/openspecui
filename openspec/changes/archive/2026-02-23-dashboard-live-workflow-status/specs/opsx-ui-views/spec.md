## MODIFIED Requirements

### Requirement: Dashboard Live Status Information Architecture

The Dashboard SHALL render live status as two top-level objective sections: Workflow Progress and Git Snapshot.

#### Scenario: Render objective top-level status groups

- **WHEN** the Dashboard loads
- **THEN** it SHALL show `Workflow Progress` and `Git Snapshot` as separate first-level sections
- **AND** it SHALL avoid subjective stage labels in the top-level live status container.

### Requirement: Workflow Progress Schema Coverage

The Workflow Progress panel SHALL show schema-level workflow state, including schemas without active change execution.

#### Scenario: Render schema cards without active changes

- **WHEN** a schema exists in configuration but has no active change status
- **THEN** Workflow Progress SHALL still render that schema card
- **AND** artifact rows SHALL render zero-state values as objective counts.

### Requirement: Git Snapshot Operational Context

The Dashboard SHALL provide a compact git snapshot with worktree-level and entry-level diff context.

#### Scenario: Display worktree and entry diff badges

- **WHEN** git snapshot data is available
- **THEN** the panel SHALL render worktree summary and nested commit/uncommitted entries
- **AND** file-count plus diff (`+`/`-`) badges SHALL use compact, consistent badge styling.
