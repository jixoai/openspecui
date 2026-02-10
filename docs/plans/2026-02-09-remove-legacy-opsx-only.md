# Remove Legacy, OPSX-Only Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove all legacy dual-mode routing and make OPSX the sole implementation for Dashboard, ChangeList, and ChangeView. Remove the Project route entirely. Clean up dead code.

**Architecture:** The current codebase has a dual-mode pattern where `isStaticMode()` gates between Legacy and OPSX components. We eliminate this by: (1) promoting OPSX components to be the direct exports from the route files, (2) deleting all `*-legacy.tsx` files and `project.tsx`, (3) removing the `isStaticMode()` branching from routes, (4) cleaning up unused server procedures and subscription hooks.

**Tech Stack:** React, TanStack Router, tRPC, Zod, Vite

---

### Task 1: Promote OpsxDashboard to Dashboard

**Files:**
- Modify: `packages/web/src/routes/dashboard.tsx`
- Delete: `packages/web/src/routes/dashboard-legacy.tsx`

**Step 1: Replace dashboard.tsx with direct OPSX content**

Replace the entire content of `packages/web/src/routes/dashboard.tsx` with the content from `opsx-dashboard.tsx`, renaming the export to `Dashboard`:

```tsx
// packages/web/src/routes/dashboard.tsx
// Move the full content of opsx-dashboard.tsx here, changing:
//   export function OpsxDashboard() → export function Dashboard()
// Remove the isStaticMode import and DashboardLegacy import
```

The file should export `function Dashboard()` directly with the OPSX implementation (status list subscription, stat cards, terminal panel, new change button).

**Step 2: Delete legacy and old OPSX files**

```bash
rm packages/web/src/routes/dashboard-legacy.tsx
rm packages/web/src/routes/opsx-dashboard.tsx
```

**Step 3: Run typecheck**

Run: `pnpm --filter @openspecui/web exec tsc --noEmit`
Expected: No errors related to dashboard imports

**Step 4: Commit**

```bash
git add packages/web/src/routes/dashboard.tsx
git rm packages/web/src/routes/dashboard-legacy.tsx packages/web/src/routes/opsx-dashboard.tsx
git commit -m "refactor(web): promote OpsxDashboard to Dashboard, remove legacy"
```

---

### Task 2: Promote OpsxChangeList to ChangeList

**Files:**
- Modify: `packages/web/src/routes/change-list.tsx`
- Delete: `packages/web/src/routes/change-list-legacy.tsx`

**Step 1: Replace change-list.tsx**

The current `change-list.tsx` already contains `OpsxChangeList` inline. Remove the `isStaticMode()` gate and the legacy import. The file becomes:

```tsx
// Remove: import { ChangeListLegacy } from './change-list-legacy'
// Remove: import { isStaticMode } from '@/lib/static-mode'
// Remove: the if (isStaticMode()) branch
// Keep: the OpsxChangeList function, rename to ChangeList
// The existing useOpsxStatusListSubscription import stays
```

Export `function ChangeList()` directly with the OPSX implementation that's already inline in the file.

**Step 2: Delete legacy file**

```bash
rm packages/web/src/routes/change-list-legacy.tsx
```

**Step 3: Run typecheck**

Run: `pnpm --filter @openspecui/web exec tsc --noEmit`
Expected: No errors related to change-list imports

**Step 4: Commit**

```bash
git add packages/web/src/routes/change-list.tsx
git rm packages/web/src/routes/change-list-legacy.tsx
git commit -m "refactor(web): promote OpsxChangeList to ChangeList, remove legacy"
```

---

### Task 3: Promote OpsxChangeView to ChangeView

**Files:**
- Modify: `packages/web/src/routes/change-view.tsx`
- Delete: `packages/web/src/routes/change-view-legacy.tsx`

**Step 1: Replace change-view.tsx with OPSX content**

Replace the entire content of `packages/web/src/routes/change-view.tsx` with the content from `opsx-change-view.tsx`, renaming the export to `ChangeView`:

```tsx
// packages/web/src/routes/change-view.tsx
// Move the full content of opsx-change-view.tsx here, changing:
//   export function OpsxChangeView() → export function ChangeView()
// Remove the isStaticMode import and ChangeViewLegacy import
```

**Step 2: Delete legacy and old OPSX files**

```bash
rm packages/web/src/routes/change-view-legacy.tsx
rm packages/web/src/routes/opsx-change-view.tsx
```

**Step 3: Update any imports of OpsxChangeView**

Search for `from './opsx-change-view'` or `from '../routes/opsx-change-view'` — these should no longer exist since we moved the content into `change-view.tsx`.

**Step 4: Run typecheck**

Run: `pnpm --filter @openspecui/web exec tsc --noEmit`
Expected: No errors related to change-view imports

**Step 5: Commit**

```bash
git add packages/web/src/routes/change-view.tsx
git rm packages/web/src/routes/change-view-legacy.tsx packages/web/src/routes/opsx-change-view.tsx
git commit -m "refactor(web): promote OpsxChangeView to ChangeView, remove legacy"
```

---

### Task 4: Remove Project route

**Files:**
- Delete: `packages/web/src/routes/project.tsx`
- Modify: `packages/web/src/App.tsx` (if Project route still referenced)
- Modify: `packages/web/src/ssg/entry-server.tsx` (if Project route still referenced)
- Modify: `packages/web/src/components/layout/nav-items.ts` (if Project nav item exists)

**Step 1: Verify Project is not in current routing**

Check `App.tsx` — based on our read, it does NOT import `project.tsx` (it was already replaced by Config). Confirm no route references `/project`.

Check `nav-items.ts` — confirm no "Project" nav item.

Check `entry-server.tsx` — confirm no Project route.

**Step 2: Delete project.tsx**

```bash
rm packages/web/src/routes/project.tsx
```

**Step 3: Search for any remaining references**

```bash
grep -r "project.tsx\|from.*routes/project\|/project" packages/web/src/ --include="*.tsx" --include="*.ts"
```

Fix any remaining imports.

**Step 4: Run typecheck**

Run: `pnpm --filter @openspecui/web exec tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git rm packages/web/src/routes/project.tsx
git commit -m "refactor(web): remove Project route (replaced by Config)"
```

---

### Task 5: Clean up SSG entry-server.tsx

**Files:**
- Modify: `packages/web/src/ssg/entry-server.tsx`

**Step 1: Remove Schemas route if not in SSG**

The current `entry-server.tsx` does not import `Schemas`. Verify this is intentional (Schemas requires CLI, not available in static mode). No changes needed if already correct.

**Step 2: Verify route list matches App.tsx**

Ensure `entry-server.tsx` route tree matches `App.tsx` routes. Currently both have: Dashboard, SpecList, SpecView, ChangeList, ChangeView, ArchiveList, ArchiveView, Config, Settings.

**Step 3: Commit (only if changes were made)**

```bash
git add packages/web/src/ssg/entry-server.tsx
git commit -m "refactor(web): sync SSG routes with App.tsx"
```

---

### Task 6: Clean up unused legacy subscription hooks

**Files:**
- Modify: `packages/web/src/lib/use-subscription.ts`

**Step 1: Identify hooks only used by deleted legacy files**

After Tasks 1-4, these hooks lose all consumers:
- `useDashboardSubscription` — only used by `dashboard-legacy.tsx`
- `useInitializedSubscription` — only used by `dashboard-legacy.tsx`
- `useChangesSubscription` — only used by `change-list-legacy.tsx`
- `useChangeSubscription` — only used by `change-view-legacy.tsx`
- `useAgentsMdSubscription` — only used by `project.tsx`
- `useProjectMdSubscription` — only used by `project.tsx`

These hooks are STILL needed (used by kept routes):
- `useSpecsSubscription` — `spec-list.tsx`
- `useSpecSubscription` — `spec-view.tsx`
- `useArchivesSubscription` — `archive-list.tsx`
- `useArchiveSubscription` — `archive-view.tsx`
- `useArchiveFilesSubscription` — `folder-editor-viewer.tsx`
- `useChangeFilesSubscription` — `folder-editor-viewer.tsx`
- `useConfigSubscription` — `settings.tsx`
- `useConfiguredToolsSubscription` — `settings.tsx`

**Step 2: Remove the 6 unused hooks from use-subscription.ts**

Delete the function definitions for: `useDashboardSubscription`, `useInitializedSubscription`, `useChangesSubscription`, `useChangeSubscription`, `useAgentsMdSubscription`, `useProjectMdSubscription`.

**Step 3: Run typecheck**

Run: `pnpm --filter @openspecui/web exec tsc --noEmit`
Expected: No errors

**Step 4: Commit**

```bash
git add packages/web/src/lib/use-subscription.ts
git commit -m "refactor(web): remove unused legacy subscription hooks"
```

---

### Task 7: Clean up unused server router procedures

**Files:**
- Modify: `packages/server/src/router.ts`

**Step 1: Identify server procedures only used by deleted legacy code**

Check which tRPC procedures were consumed by the deleted hooks:
- `dashboard.getData` / `dashboard.subscribe` — used by `useDashboardSubscription`
- `dashboard.isInitialized` / `dashboard.subscribeInitialized` — used by `useInitializedSubscription`
- `change.getAll` / `change.subscribeAll` — used by `useChangesSubscription`
- `change.getById` / `change.subscribeById` — used by `useChangeSubscription`
- `project.getProjectMd` / `project.subscribeProjectMd` — used by `useProjectMdSubscription`
- `project.getAgentsMd` / `project.subscribeAgentsMd` — used by `useAgentsMdSubscription`

Before removing, verify these are not used elsewhere (e.g., by the export/snapshot logic in `packages/cli/src/export.ts`). The export logic uses its own direct file reads, not tRPC, so these should be safe to remove.

**Step 2: Remove unused procedures**

Remove the dead procedures from `router.ts`. Be careful to keep:
- `change.toggleTask` — may still be used
- `change.getFiles` / `change.subscribeFiles` — used by `folder-editor-viewer.tsx`
- All `opsx.*` procedures — these are the new standard
- All `spec.*`, `archive.*`, `config.*`, `cli.*` procedures — still in use

**Step 3: Remove the `projectRouter` entirely if all its procedures are dead**

The `projectRouter` had `getProjectMd`, `subscribeProjectMd`, `getAgentsMd`, `subscribeAgentsMd`, `saveProjectMd`, `saveAgentsMd`. With Project route deleted, check if any of these are still referenced. If not, remove the entire router.

**Step 4: Run typecheck and tests**

Run: `pnpm --filter @openspecui/server exec tsc --noEmit`
Run: `pnpm --filter @openspecui/server test`
Expected: Pass

**Step 5: Commit**

```bash
git add packages/server/src/router.ts
git commit -m "refactor(server): remove unused legacy router procedures"
```

---

### Task 8: Clean up isStaticMode usage in remaining files

**Files:**
- Review: `packages/web/src/components/cli-health-gate.tsx`
- Review: `packages/web/src/routes/config.tsx`
- Review: `packages/web/src/routes/settings.tsx`
- Review: `packages/web/src/lib/trpc.ts`
- Review: `packages/web/src/lib/use-subscription.ts`
- Review: `packages/web/src/lib/use-server-status.ts`
- Review: `packages/web/src/lib/use-cli-runner.tsx`
- Review: `packages/web/src/components/StaticModeBanner.tsx`

**Step 1: Audit remaining isStaticMode usage**

`isStaticMode()` is still legitimately needed for:
- `trpc.ts` — disabling WebSocket in static mode
- `use-subscription.ts` — returning static data instead of subscribing
- `use-server-status.ts` — skipping server health checks
- `use-cli-runner.tsx` — disabling CLI execution
- `StaticModeBanner.tsx` — showing banner
- `cli-health-gate.tsx` — skipping CLI check
- `config.tsx` — disabling mutations
- `settings.tsx` — disabling mutations

These are all legitimate uses for SSG/static export support. **No changes needed** — `isStaticMode` is infrastructure, not legacy routing.

**Step 2: Commit (no-op, just verification)**

No commit needed. This task is verification only.

---

### Task 9: Build and test verification

**Step 1: Run full typecheck**

```bash
pnpm typecheck
```

Expected: All packages pass

**Step 2: Run all tests**

```bash
pnpm test
```

Expected: All tests pass

**Step 3: Run dev server and verify**

```bash
pnpm dev
```

Verify in browser:
- Dashboard loads with OPSX status cards and change list
- `/changes` shows OPSX change list with artifact counts
- `/changes/<id>` shows OPSX change view with artifact editor
- `/config` loads Config Center
- `/schemas` loads schema browser
- `/specs` and `/specs/<id>` still work
- `/archive` and `/archive/<id>` still work
- `/settings` still works
- No console errors about missing imports

**Step 4: Run build**

```bash
pnpm build
```

Expected: Build succeeds without errors

**Step 5: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "fix: resolve build/test issues from legacy removal"
```

---

## Summary of deletions

| File | Reason |
|------|--------|
| `routes/dashboard-legacy.tsx` | Replaced by OPSX Dashboard |
| `routes/opsx-dashboard.tsx` | Merged into `dashboard.tsx` |
| `routes/change-list-legacy.tsx` | Replaced by OPSX ChangeList |
| `routes/change-view-legacy.tsx` | Replaced by OPSX ChangeView |
| `routes/opsx-change-view.tsx` | Merged into `change-view.tsx` |
| `routes/project.tsx` | Replaced by Config route |

## Summary of modifications

| File | Change |
|------|--------|
| `routes/dashboard.tsx` | OPSX content directly, no branching |
| `routes/change-list.tsx` | OPSX content directly, no branching |
| `routes/change-view.tsx` | OPSX content directly, no branching |
| `lib/use-subscription.ts` | Remove 6 unused hooks |
| `server/src/router.ts` | Remove unused procedures (dashboard, project) |
