## Implementation State

Status: **Implemented.** Frontend-only; all planned steps landed. Local CI-equivalent checks, the SSG build, and `openspec validate --strict` pass.

Completed steps:

- [x] Route + nav registration for `/board` (`route-tree.ts`, `route-tree-static.ts`, `nav-items.ts`, `nav-controller.ts` TabId/ALL_TABS/DEFAULT_MAIN_TABS, `ssg/entry-server.tsx` getRoutes/getTitle).
- [x] Board view (`routes/board.tsx`) with four lifecycle columns and the exported `classifyBoardColumn` derivation helper.
- [x] Reusable change card (name, id, relative time, task count, progress bar, workflow-phase badge) + archived card.
- [x] Time-range filter on the Done column (`Select` presets `7d/30d/90d/all`, default `30d`; archive date parsed from the `id` prefix via exported `archiveTimestamp`, fallback `updatedAt`).
- [x] Kind-aware drag: drag-to-archive on QA cards → Done (`openArchiveModal`), and drag-to-apply on apply-ready TODO cards → In Progress (`vtNavController.activatePop(buildOpsxComposeHref({ action: 'apply', changeId }))`). Each column accepts only its matching kind; both disabled in static mode.
- [x] Loading / empty-column / static-mode read-only states.
- [x] Unit tests for `classifyBoardColumn`, `archiveTimestamp`, and `isApplyReady`; changeset for `@openspecui/web`; local checks + SSG build green.

## Decisions Taken

- **Four columns, not five.** "Synced but not archived" is not observable, so QA = all tasks complete (active) and Done = archived. No synced column, no new marker.
- **Two orthogonal axes.** The column is the task-progress bucket; the on-card badge is the existing `classifyChangeWorkflowPhase` artifact-readiness label. They coexist rather than compete.
- **`0 of 0` → TODO.** Column rule keyed on `completed === 0` so a change with no tasks defined lands in TODO, never QA (`total > 0` guard on QA).
- **Every drag maps to a real operation.** The board's columns are derived state, so a drag never ticks checkboxes. The two column boundaries backed by real operations both get a drag: QA → Done = archive (`openArchiveModal`), and apply-ready TODO → In Progress = apply (open the compose overlay). Each column accepts only its matching drag kind.
- **Drag-to-apply reuses the Apply button's hand-off.** Dropping an apply-ready TODO card on In Progress calls the same `activatePop(buildOpsxComposeHref({ action: 'apply', changeId }))` the change page's Apply button uses — no new invocation machinery. Apply-readiness is gated by `isApplyReady(status)` (every `applyRequires` artifact done), mirroring the command bar. Apply is intentionally not immediate: the card flows into In Progress once the agent ticks a task, not on drop.
- **Frontend-only.** No backend/core change: the client already receives the date-prefixed archive `id`, so the time filter parses the date client-side; all other data comes from existing subscriptions.
- **Reuse over rebuild.** Cards reuse change-list row visuals; the time filter reuses `Select`; drag reuses the native DnD pattern from `area-nav.tsx`; archive reuses `global-archive-modal.tsx`.

## Divergence Notes

- The scope already reflected one revision from exploration: the original five-column model with a "synced" column was reduced to four after confirming the synced state is undetectable.
- **Archive modal signature.** The plan phrased the call as `openArchiveModal({ changeId, changeName })`; the actual context API is positional — `openArchiveModal(changeId, changeName)`. Used as-is; no new confirmation UI built.
- **Extra registration points.** Registering `/board` required more than `route-tree.ts` + `nav-items.ts`: also `route-tree-static.ts` (SSG render), `nav-controller.ts` (`TabId` / `ALL_TABS` / `DEFAULT_MAIN_TABS` so it appears by default in IDE mode) with matching updates to `nav-controller.test.ts` fixtures, and `ssg/entry-server.tsx` (`getRoutes` + `getTitle`) so the page is prerendered. All within the frontend-only boundary.
- **Minor type fix.** `column.id` (`'done' | ActiveColumnId`) did not narrow via the `isDone` alias when indexing the grouped record; derived a narrowed `activeItems` list instead. Not a design change, so no loopback to intake/research-plan.

## Loopback Triggers

- If archive-by-drag needs options not covered by the existing modal (e.g. a board-specific confirmation copy), pause and revisit the plan rather than forking the archive flow.
- If a reliable "synced" signal is ever introduced upstream (a CLI command or persisted marker), loop back to reconsider adding the fifth column.
- If static/SSG mode cannot list archived changes as assumed, loop back to research to confirm the archive data path before shipping the Done column.
