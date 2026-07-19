## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded (derived-state model; synced state undetectable; existing phase taxonomy; reuse points)
- [x] 1.3 Plan reviewed and approved (four columns, two-axes model, drag-to-archive only)
- [x] 1.4 Spec delta authored and validated (`opsx-ui-views` ADD: Change Kanban Board)

## 2. Implementation

- [x] 2.1 Implementation started from approved plan
  - [x] A. Register `/board` route in `packages/web/src/lib/route-tree.ts` (and `route-tree-static.ts` for SSG)
  - [x] B. Add `Board` nav item in `packages/web/src/components/layout/nav-items.ts` + `nav-controller.ts` TabId/ALL_TABS/DEFAULT_MAIN_TABS (lucide `SquareKanban`; `defaultArea: 'main'`)
  - [x] C. Create `packages/web/src/routes/board.tsx`: subscribe to `useChangesSubscription`, `useOpsxStatusListSubscription`, `useArchivesSubscription`
  - [x] D. Add pure `classifyBoardColumn(progress)` helper: `completed===0 → todo`; `0<completed<total → in-progress`; `total>0 && completed===total → qa`; archived → done
  - [x] E. Reusable change card (name, id, `formatRelativeTime`, `completed/total`, progress bar, phase `Badge` via `classifyChangeWorkflowPhase` joined with `ChangeStatus`); active → `/changes/$id`, done → `/archive/$id`
  - [x] F. Render four columns as bordered `bg-card` lanes matching the design language (monospace, `font-nav`, container-friendly horizontal scroll)
  - [x] G. Time-range filter on the Done column: `Select` presets `7d/30d/90d/all`, default `30d`; parse archive date from the `YYYY-MM-DD-` prefix of `id` (fallback `updatedAt`); filter client-side
  - [x] H. Drag-to-archive: QA cards only draggable (native HTML5 DnD per `area-nav.tsx`); only Done is a valid drop target; on drop call `openArchiveModal(id, name)` (existing confirm+CLI modal); reject invalid drops; disable drag in static mode
  - [x] I. Loading / empty-column / static-mode read-only states
  - [x] J. Unit tests for `classifyBoardColumn` + `archiveTimestamp` (edge cases: 0/0→TODO, N/N→QA, date-prefix parse + fallback); prerender routes wired (`ssg/entry-server.tsx` getRoutes/getTitle)
- [x] 2.2 Progress synchronized with implementation artifact
- [x] 2.3 Unexpected issues loop back to intake/research-plan (none required; only a minor local type-narrowing fix)

## 3. PR and Release Gates

- [x] 3.1 Changeset included (`.changeset/add-kanban-board.md`, `@openspecui/web` minor)
- [x] 3.2 CI-equivalent local checks passed (`lint:ci`, `format:check`, `typecheck` all packages, web unit 534 + board 6, `test:root` 43, `test:browser:ci` 12)
- [x] 3.3 SSG guard passed (`build:ssg` + `build:ssg-cli` build; `/board` in static route tree and prerender list; renders read-only without CLI)
- [ ] 3.4 PR checks passed

## 4. Merge Readiness

- [ ] 4.1 OpenSpec archive flow completed
- [ ] 4.2 PR merge approved
