## Research Findings

Facts gathered from the codebase that constrain this change.

### Lifecycle state is derived, not stored

- There is **no change status/phase/state field** anywhere in core or server. The only quantified state is `progress { total, completed }` on `Change` / `ChangeMeta` / `ArchiveMeta` (`packages/core/src/schemas.ts`, `packages/core/src/adapter.ts`).
- Task counts come from `computeTaskProgress` over checkbox parsing (`packages/core/src/task-progress.ts`); a change is "all tasks done" when `total > 0 && completed === total`.
- The only two structural buckets the backend knows are `OpsxEntityStage = 'change' | 'archive'` (`packages/core/src/opsx-entity.ts`) — i.e. active vs archived.

### "Synced but not archived" is not detectable (critical)

- There is **no `openspec sync` CLI command** and **no persisted marker** written when a sync runs. Sync is an agent skill that hand-edits `openspec/specs/**` and explicitly leaves the change active. No code compares delta specs against main specs.
- The only trace of a sync is dirty git files under `openspec/specs/`, which cannot be attributed to a specific change and disappears on commit.
- Therefore QA (all tasks complete) and "synced" are indistinguishable from observable state. The board defines **QA = all tasks complete (active)** and **Done = archived**, dropping the synced column. This matches upstream OpenSpec, where archive is the step that merges deltas into main specs.
- Landmine to avoid: `router.ts` exposes `driftStatus: 'in-sync' | 'drift'`, which is **workflow-config** drift, not change-sync state. Do not use it for the board.

### The UI already has a phase taxonomy (a different axis)

- Every change row already shows a workflow-phase badge via `classifyChangeWorkflowPhase(...)` (`packages/web/src/lib/change-workflow-phase.ts`): `Unknown` / `Draft` (an artifact is blocked) / `In Execution` / `Ready to Archive` (`isComplete && tasksComplete`).
- This is driven by **artifact readiness + a tasksComplete boolean**, and has **no 0-vs-some split** — so it cannot serve as the column definition (it collapses TODO and In Progress into "In Execution").
- Conclusion: **column = task-count progress** (this change's model); **card badge = existing classifier**. The two are orthogonal (progress vs blocked/ready), so they coexist without contradiction and reuse the classifier's tone colours.

### Reusable building blocks (frontend)

- Active changes + task counts: `useChangesSubscription()` → `ChangeMeta.progress` (`packages/web/src/lib/use-subscription.ts`).
- Artifact status for the badge: `useOpsxStatusListSubscription()` → `ChangeStatus[]`, joined by `change.id === status.changeName` (pattern already in `routes/change-list.tsx` and `routes/dashboard.tsx`).
- Archived changes: `useArchivesSubscription()` → `ArchiveMeta[]` (carries the date-prefixed `id` and `updatedAt`).
- Card visuals: the change-list row markup (name, id, `formatRelativeTime`, phase `Badge`, `completed/total`, `bg-primary` progress bar) in `routes/change-list.tsx`.
- Archive action + confirmation: the global archive modal, opened via `openArchiveModal({ changeId, changeName })` from `packages/web/src/lib/archive-modal-context.ts` (rendered by `components/global-archive-modal.tsx`). It already handles confirmation, `--skip-specs` / `--no-validate` options, the streamed `validate → archive` run, and "View Archive".
- Time-range preset control: the `Select` component (`packages/web/src/components/select.tsx`), following the dashboard git-auto-refresh preset precedent (`routes/dashboard.tsx`).
- Drag-and-drop: native HTML5 DnD (no library installed); copy the pattern from `components/layout/area-nav.tsx` (`onDragStart`/`onDragOver`/`onDrop`, grab handle, drop indicator).
- Routing + nav registration: add a route in `packages/web/src/lib/route-tree.ts` and a nav item in `packages/web/src/components/layout/nav-items.ts` (mirror `/changes`).

### Design language

Tailwind v4 (config in CSS via `@theme`, no `tailwind.config.js`), Base UI primitives (not shadcn/radix), lucide icons, `cn()` for class merging. Neobrutalist / terminal: hard 4px offset shadows (zero blur), beveled corners, high-contrast borders, JetBrains Mono / Share Tech Mono fonts, crimson `--primary`. "Cards" are ad-hoc `border bg-card rounded-* p-*` divs; status colours are inline utility classes per phase (emerald = ready-to-archive, amber = draft/blocked, primary/red = in-execution, muted = unknown).

## Decision & Plan (For Approval)

Build a frontend-only `/board` view.

1. **Route + nav** — add `/board` to `route-tree.ts`; add a `Board` nav item (lucide `KanbanSquare`/`Columns3`, `defaultArea: 'main'`) to `nav-items.ts` so it appears in the sidebar, mobile tab bar, and IDE-mode area nav.
2. **Board view (`routes/board.tsx`)** — subscribe to `useChangesSubscription()`, `useOpsxStatusListSubscription()`, and `useArchivesSubscription()`. Compute each active change's column with a pure helper `classifyBoardColumn(progress)`: `completed === 0 → 'todo'`; `0 < completed < total → 'in-progress'`; `total > 0 && completed === total → 'qa'`. Archived → `'done'`. Render four columns as bordered `bg-card` lanes.
3. **Cards** — factor the change-list row into a reusable card: name, id, `formatRelativeTime`, task count, progress bar, and the phase `Badge` from `classifyChangeWorkflowPhase` (joined with `ChangeStatus`). Active cards link to `/changes/$id`; Done cards to `/archive/$id`.
4. **Time-range filter (Done only)** — a `Select` with presets `7d / 30d / 90d / all`, defaulting to a bounded range. Parse each archive's date from the `YYYY-MM-DD-` prefix of `archive.id` (fallback `updatedAt`); filter client-side. No backend change.
5. **Drag-to-archive** — make only QA-column cards draggable (native HTML5 DnD, grab handle as in `area-nav.tsx`). The only valid drop target is the Done column; on drop, call `openArchiveModal({ changeId, changeName })`. Cards in other columns are not draggable; invalid drops are rejected. Disable dragging in static/SSG mode (no CLI).
6. **States** — loading, empty-column, and error rendering consistent with existing views; board renders read-only in static mode.
7. **Release hygiene** — add a changeset for `@openspecui/web`; keep loop artifacts and the spec delta in sync.

## Capability Impact

### New or Expanded Behavior

- `opsx-ui-views`: a new **Change Kanban Board** view that groups active and archived changes into TODO / In Progress / QA / Done lanes derived from task progress and archive location, with a time-range filter on Done and drag-to-archive on QA cards using the existing confirmation flow.

### Modified Behavior

- None. Existing views, hooks, the archive modal, and the task/archive flows are unchanged; the board is additive and consumes them.

## Risks and Mitigations

- **Column vs badge look contradictory.** A QA card (all tasks done) may still show an "In Execution" badge if the workflow isn't `isComplete`. Mitigation: treat them as distinct labelled axes (column = task progress, badge = artifact readiness); this is truthful, not contradictory.
- **Archive date accuracy.** `updatedAt` (fs mtime) can drift from the real archive date. Mitigation: parse the date from the `id` prefix, fall back to `updatedAt` only when the prefix is absent.
- **Static/SSG mode.** The CLI is unavailable, so archive-by-drag cannot run. Mitigation: detect static mode and render the board read-only (no drag handles, no archive action); ensure archived data still lists.
- **Drag affordance implies more than it does.** Users may expect to drag between all columns. Mitigation: only QA cards get a visible grab handle; other cards are plainly non-draggable.
- **Scope creep toward "synced".** Mitigation: explicitly out of scope per intake; no marker is introduced.

## Verification Strategy

- **Local checks:** `format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`.
- **SSG guard:** `pnpm --filter @openspecui/web build:ssg` builds and the board renders read-only with no stores/CLI dependency.
- **Acceptance checks:** with fixture changes, verify column placement for `0/0`, `0/N`, partial, and full task states; verify archived items appear in Done and respect each preset; verify a QA card dragged to Done opens the archive modal and archives only after confirmation; verify non-QA cards do not drag and invalid drops are rejected.
- **Spec/loop validation:** `openspec validate add-kanban-board --strict` passes; checkpoints reflect real implementation state.
