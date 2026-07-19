## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded (derived-state model; synced state undetectable; existing phase taxonomy; reuse points)
- [x] 1.3 Plan reviewed and approved (four columns, two-axes model, drag-to-archive only)
- [x] 1.4 Spec delta authored and validated (`opsx-ui-views` ADD: Change Kanban Board)

## 2. Implementation

- [ ] 2.1 Implementation started from approved plan
  - [ ] A. Register `/board` route in `packages/web/src/lib/route-tree.ts`
  - [ ] B. Add `Board` nav item in `packages/web/src/components/layout/nav-items.ts` (AppRoute union + allNavItems; lucide icon; `defaultArea: 'main'`)
  - [ ] C. Create `packages/web/src/routes/board.tsx`: subscribe to `useChangesSubscription`, `useOpsxStatusListSubscription`, `useArchivesSubscription`
  - [ ] D. Add pure `classifyBoardColumn(progress)` helper: `completed===0 → todo`; `0<completed<total → in-progress`; `total>0 && completed===total → qa`; archived → done
  - [ ] E. Reusable change card (name, id, `formatRelativeTime`, `completed/total`, progress bar, phase `Badge` via `classifyChangeWorkflowPhase` joined with `ChangeStatus`); active → `/changes/$id`, done → `/archive/$id`
  - [ ] F. Render four columns as bordered `bg-card` lanes matching the design language (monospace, beveled corners, 4px offset shadows, container-query responsive)
  - [ ] G. Time-range filter on the Done column: `Select` presets `7d/30d/90d/all`, default bounded; parse archive date from the `YYYY-MM-DD-` prefix of `id` (fallback `updatedAt`); filter client-side
  - [ ] H. Drag-to-archive: QA cards only draggable (native HTML5 DnD per `area-nav.tsx`); only Done is a valid drop target; on drop call `openArchiveModal({ changeId, changeName })`; reject invalid drops; disable drag in static mode
  - [ ] I. Loading / empty-column / error / static-mode read-only states
- [ ] 2.2 Progress synchronized with implementation artifact
- [ ] 2.3 Unexpected issues loop back to intake/research-plan

## 3. PR and Release Gates

- [ ] 3.1 Changeset included (`@openspecui/web`, minor)
- [ ] 3.2 CI-equivalent local checks passed (`format:check`, `lint:ci`, `typecheck`, `test:ci`, `test:browser:ci`)
- [ ] 3.3 SSG guard passed (`pnpm --filter @openspecui/web build:ssg`; board renders read-only without CLI)
- [ ] 3.4 PR checks passed

## 4. Merge Readiness

- [ ] 4.1 OpenSpec archive flow completed
- [ ] 4.2 PR merge approved
