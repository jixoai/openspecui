<!--
Orthogonal intents (created 2026-09-17 Asia/Shanghai):
1. Add the change-list nested-directory/warnings typed contract for CLI 1.13.1.
2. Add local task-line reading parity with the widened CLI 1.13.1 semantics.

Original request (2026-09-17): "Openspec 1.13.1 释放了，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进。让 codex 参与。"
-->

## ADDED Requirements

### Requirement: Change List Nested Directory Contract

OpenSpecUI SHALL decode the OpenSpec 1.13.1 `list --json` change-list additions as typed facts: each entry
MAY carry `nested: string[]` naming change directories wrapped by a namespace folder, and the document MAY
carry a top-level `warnings` array whose entries carry `code`, `name`, `nested`, and `message`. Both
members SHALL be absent when empty (never `null`, never synthesized empty arrays). An entry carrying
`nested` SHALL NOT be treated as an actionable change: its `status` and task counts are meaningless, and
OpenSpecUI SHALL NOT offer change-detail navigation, task summaries, or workflow actions for it. The
`nested_change_directory` warning message SHALL be preserved verbatim as upstream evidence.

#### Scenario: Decode a namespaced directory entry

- **GIVEN** `list --json` returns an entry `{name: "area", completedTasks: 0, totalTasks: 0, lastModified:
  "...", status: "no-tasks", nested: ["area/alpha", "area/beta"]}` and a top-level warning with
  `code: "nested_change_directory"`
- **WHEN** the change list is decoded
- **THEN** the entry and warning SHALL decode as typed facts with the exact `nested` names
- **AND** the warning `message` SHALL be preserved verbatim

#### Scenario: Absent-when-empty members stay absent

- **GIVEN** `list --json` returns a document from a repository without namespace folders
- **WHEN** the change list is decoded
- **THEN** no entry SHALL carry `nested` and the document SHALL carry no `warnings` member
- **AND** OpenSpecUI SHALL NOT synthesize empty arrays or null placeholders for either member

#### Scenario: A namespaced entry is never an actionable change

- **GIVEN** a decoded entry carries `nested`
- **WHEN** any surface or service consumes the change list
- **THEN** the entry SHALL NOT become an actionable change row, CLI task summary, Kanban input, or
  change-detail navigation target
- **AND** the namespaced directories SHALL be left untouched (no read, write, or repair attempt beyond
  presenting the warning)

### Requirement: Task Line Reading Parity

OpenSpecUI's local task-line reading (`trackedTaskProgress`, `documentChecklistSummary`,
`applyInstructionProgress` divergence input, and the task-toggle file write-back) SHALL mirror the admitted
OpenSpec CLI's task-line semantics for the 1.13 line: a task line is a list item under any CommonMark
marker (`-`, `*`, `+`) or an ordered marker (`1.`, `1)` up to nine digits), with optional leading
indentation, whose checkbox holds at most one non-whitespace token — or is whitespace-only — and whose
closing bracket is not followed by `(` or `[` (Markdown link continuation). A line parses as done only when
its marker lowercases to `x`; every other marker (including `~`, digits, or an empty box) reads as
not-done. Reading SHALL tolerate CRLF line endings and empty descriptions. The parity is a reading
alignment only: CLI-owned progress fields remain the authoritative implementation progress, and local
reading SHALL NOT redefine the CLI progress denominator or phase.

#### Scenario: Widened markers count as tasks

- **GIVEN** a tasks document containing `+ [ ] alpha`, `1. [ ] beta`, `1) [x] gamma`, and an indented
  `  - [~] delta`
- **WHEN** local task reading runs
- **THEN** all four lines SHALL count as tasks
- **AND** only `gamma` SHALL count as done
- **AND** the counts SHALL equal what the admitted CLI reports for the same document

#### Scenario: Link bullets and reference links stay out of the counts

- **GIVEN** a tasks document containing `- [Some doc](./doc.md)` and `- [1](./one)`
- **WHEN** local task reading runs
- **THEN** neither line SHALL count as a task
- **AND** a whitespace-only box followed by a link (`- [ ](...)` or `- [ ][...]`) SHALL still count as an
  unfinished task

#### Scenario: CRLF and empty descriptions keep parsing

- **GIVEN** a tasks document with CRLF line endings and a line ending at its checkbox
- **WHEN** local task reading runs
- **THEN** every task line SHALL parse
- **AND** descriptions SHALL be trimmed rather than required

#### Scenario: Toggle write-back covers the widened forms

- **GIVEN** a tasks document line `+ [~] alpha`
- **WHEN** the user toggles that task to done
- **THEN** the write-back SHALL produce `+ [x] alpha` preserving marker, indentation, and description
  bytes
- **AND** toggling a done line back SHALL write the canonical `[ ]` marker

#### Scenario: Parity does not redefine CLI progress authority

- **GIVEN** a change whose CLI list summary and local tracked reading now agree under parity semantics
- **WHEN** Change List, Dashboard, or Kanban renders
- **THEN** CLI-owned progress evidence SHALL remain the authoritative implementation progress
- **AND** the divergence badge SHALL NOT fire when the CLI apply tasks and the local tracked projection
  describe the same widened-syntax document
