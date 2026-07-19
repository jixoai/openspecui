## User Input

> I want to add a Kanban-style board to the web UI to visualise changes. It should show changes in TODO (change active, but no tasks started), in progress (some tasks completed), in QA (all tasks completed but change not synced), and done (change synced), and archived (self explanatory). It should allow us to set a time range (time back) so we don't show _every_ archived change.
>
> We should keep with the same design language and visual and UX style of the existing web UI.

Refinements agreed during exploration:

- The original QA/Done/Archived split assumed a detectable "synced but not archived" state. Investigation confirmed that state is **not detectable** (there is no `openspec sync` CLI command, no persisted marker, and no delta-vs-main comparison in the codebase). The board therefore collapses to four columns: **QA = all tasks complete (still active)**, **Done = archived**. This also matches upstream OpenSpec semantics, where archiving is the step that merges deltas into the main specs.
- A change with **no tasks defined** (`0 of 0`) belongs in **TODO**, not QA.
- Cards may be **dragged**, but dragging a QA card to Done triggers the existing archive flow **with the current confirmation dialog** before any transition happens. This is the only drag that maps to a real operation.
- The time-range filter applies to the **Done (archived) column only**, using presets.

## Objective Scope

- Add a new `/board` view to the web UI (nav entry mirroring `/changes`).
- Render active and archived changes as cards laid out in lifecycle columns: **TODO → In Progress → QA → Done (archived)**.
- Derive a card's column purely from observable state:
  - **TODO** — active change with `completed === 0` (covers "no tasks defined" and "tasks defined, none done").
  - **In Progress** — active change with `0 < completed < total`.
  - **QA** — active change with `total > 0 && completed === total`.
  - **Done** — change present under `changes/archive/`.
- Keep the existing per-change workflow-phase badge on each card (a separate axis from the column: column = task progress, badge = artifact readiness / blocked).
- Support drag-to-archive: a QA card dragged to Done opens the existing global archive modal (confirmation + `validate → archive` CLI run).
- Add a time-range filter (presets: `7d / 30d / 90d / all`) to the Done column; default to a bounded range so the archive is not shown in full.
- Match the existing design language (Tailwind v4, Base UI primitives, monospace / neobrutalist styling, existing badge and progress-bar patterns).

## Non-Goals

- **No "synced but not archived" column.** That state is not observable from the filesystem; the board will not invent or persist it.
- **No drag-to-complete-tasks.** Dragging between TODO/In Progress/QA is not offered — those boundaries are derived from `tasks.md` checkboxes and must not be set by a gesture (it would falsify the task record).
- **No un-archive** (Done → any) and no backward drags.
- **No new persisted change status field** and no new backend "phase" concept.
- **No changes** to task toggling, change creation, or the archive CLI flow itself — the board consumes existing procedures only.
- **No backend/core changes** are expected; the board is a frontend addition over existing subscriptions and the client-visible date-prefixed archive `id`.

## Acceptance Boundary

- A `/board` route exists, is registered in navigation (desktop sidebar + mobile tab bar), and renders in both live and static/SSG modes.
- Active changes appear in exactly one of TODO / In Progress / QA per the derivation rules above; a `0 of 0` change appears in TODO.
- Archived changes appear in Done, filtered by the selected time range (parsed from the `YYYY-MM-DD-` prefix of the archive `id`, falling back to `updatedAt`).
- Each card shows: change name, id, relative time, task count `completed/total`, a progress bar, and the existing workflow-phase badge — reusing the current change-list row visuals.
- Dragging a QA card onto Done opens the existing global archive modal (confirmation before any change is archived); no other drag performs a transition, and invalid drops are rejected/snap back.
- In static/SSG mode the board renders read-only (no archive action, since the CLI is unavailable).
- The board matches the existing design language and passes local CI-equivalent checks, the SSG build guard, and `openspec validate --strict`.
- A changeset is included for the release-impacting package(s) changed (`@openspecui/web`).
- Loop artifacts and the `opsx-ui-views` spec delta stay synchronized with the implementation and validate.
