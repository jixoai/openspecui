## Implementation State

Status: **Planned — not started.** Research and planning are complete and approved; the executable checklist lives in `loop/checkpoints.md` and is driven by the apply step.

Planned steps (frontend-only, in order):

- [ ] Route + nav registration for `/board` (`route-tree.ts`, `nav-items.ts`).
- [ ] Board view (`routes/board.tsx`) with the four lifecycle columns and the `classifyBoardColumn` derivation helper.
- [ ] Reusable change card (name, id, relative time, task count, progress bar, workflow-phase badge).
- [ ] Time-range filter on the Done column (presets, archive-date parsed from the `id` prefix).
- [ ] Drag-to-archive on QA cards, opening the existing global archive modal; disabled in static mode.
- [ ] Loading / empty / error / static-mode states.
- [ ] Changeset for `@openspecui/web` and local CI-equivalent + SSG checks.

## Decisions Taken

- **Four columns, not five.** "Synced but not archived" is not observable, so QA = all tasks complete (active) and Done = archived. No synced column, no new marker.
- **Two orthogonal axes.** The column is the task-progress bucket; the on-card badge is the existing `classifyChangeWorkflowPhase` artifact-readiness label. They coexist rather than compete.
- **`0 of 0` → TODO.** Column rule keyed on `completed === 0` so a change with no tasks defined lands in TODO, never QA (`total > 0` guard on QA).
- **Only QA → Done is a real drag.** The board's columns are derived state; the only column boundary backed by a real operation is archive. Drag is scoped to QA cards → Done, reusing the existing confirmation/CLI flow via `openArchiveModal`. No drag-to-complete-tasks.
- **Frontend-only.** No backend/core change: the client already receives the date-prefixed archive `id`, so the time filter parses the date client-side; all other data comes from existing subscriptions.
- **Reuse over rebuild.** Cards reuse change-list row visuals; the time filter reuses `Select`; drag reuses the native DnD pattern from `area-nav.tsx`; archive reuses `global-archive-modal.tsx`.

## Divergence Notes

- None yet. (The scope already reflects one revision from exploration: the original five-column model with a "synced" column was reduced to four after confirming the synced state is undetectable.)

## Loopback Triggers

- If archive-by-drag needs options not covered by the existing modal (e.g. a board-specific confirmation copy), pause and revisit the plan rather than forking the archive flow.
- If a reliable "synced" signal is ever introduced upstream (a CLI command or persisted marker), loop back to reconsider adding the fifth column.
- If static/SSG mode cannot list archived changes as assumed, loop back to research to confirm the archive data path before shipping the Done column.
