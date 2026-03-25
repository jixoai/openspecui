## Research Findings

- The app already has Dashboard Git summary data in `packages/core/src/dashboard-types.ts` and `packages/server/src/dashboard-git-snapshot.ts`, but there is no dedicated `/git` route, no Git detail payload, and no changed-files patch API.
- `DashboardOverview.git` is currently a summary-only structure and is reused by static snapshot mapping in `packages/web/src/lib/static-data-provider.ts`; extending it with large patch payloads would leak heavy live-only data into static/export paths.
- Interactive routing is split between main, bottom, and pop routers through `packages/web/src/lib/nav-controller.ts` and `packages/web/src/App.tsx`. Static mode uses a different route tree in `packages/web/src/lib/route-tree-static.ts` and separate static navigation rendering in desktop/mobile layout components.
- Current bottom defaults only include `/terminal`; adding `/git` requires updating `TabId`, navigation items, default bottom tabs, and route registration.
- Existing Git refresh state already exists as a shared live subscription pair: overview subscription plus `subscribeGitTaskStatus`, with persisted refresh preset logic in `packages/web/src/lib/dashboard-git.ts`.
- The current Git snapshot code already enforces the ordering needed for the new page: `uncommitted` first, then commits newest-to-oldest, and current worktree before other worktrees.
- Detached worktree removal already exists as a live-only mutation and can be shared.
- The current server architecture binds one `projectDir` per server/context. More importantly, the reactive watcher pool in `packages/core/src/reactive-fs/watcher-pool.ts` is a global singleton, so one process cannot safely host multiple project roots at the same time.
- Because of that watcher singleton, real worktree switching cannot be implemented as an in-process `projectDir` swap or as multiple in-process project instances. It must hand off to a separate child OpenSpecUI instance per worktree.
- The CLI already contains child-process management patterns in `packages/cli/src/local-hosted-app-dev.ts`, plus port probing helpers in `packages/server/src/port-utils.ts`, which can be reused to manage child OpenSpecUI instances.
- Hosted/app mode already supports switching backend targets by changing the `api` base URL; that gives a clear handoff path for hosted shells without changing the shell origin.

## Decision & Plan (For Approval)

- Add a new live-only `/git` page routed into the interactive app and placed in the bottom navigation by default.
- Keep Dashboard Git Snapshot as the compact overview and build Git page data as a separate live-only API surface instead of inflating `DashboardOverview`.
- Add a new Git router with three responsibilities:
  - current worktree + other worktree summaries
  - paged current-worktree entries (`limit 50`, load more)
  - per-entry changed-files + patch-stream detail
- Build the Git page UI in GitHub commit-detail style:
  - header with current-worktree summary and shared refresh controls
  - entry history list for current worktree
  - changed-files summary + patch-stream detail pane
- Reuse shared Git helper logic for sorting, timestamps, refresh presets, diff badges, and detached worktree actions instead of duplicating Dashboard logic.
- Exclude the Git page from static route trees and static navigation so export mode cannot reach it.
- Implement real worktree switching through CLI-managed child instances:
  - maintain a reusable worktree-instance registry keyed by absolute worktree path
  - health-check and reuse existing child instances
  - spawn a new child instance only when needed
  - hand the UI off to the target instance URL while preserving the `/git` route
- In standalone web mode, switch by navigating the browser to the target instance URL.
- In hosted/app mode, switch by changing the `api` backend target while keeping the same shell origin.

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI gains a dedicated live Git page for current-worktree changed files and patch detail.
- OpenSpecUI gains a real worktree-switch capability built on child instance handoff.

### Modified Behavior

- Bottom area default tabs now include Git alongside Terminal.
- Static navigation becomes more explicitly aware of live-only routes so Git is hidden there.
- Git refresh controls become a shared concern between Dashboard and Git page instead of Dashboard-only UI.

## Risks and Mitigations

- Risk: child-instance lifecycle leaks processes or ports.
  - Mitigation: central registry with reuse, health checks, and parent-process cleanup on exit.
- Risk: large patch payloads make the page sluggish.
  - Mitigation: keep entry history paged, fetch detail per selected entry, and defer virtualization to a later loop.
- Risk: static mode accidentally exposes `/git` through reused nav metadata.
  - Mitigation: update both route trees and both static desktop/mobile nav renderers as part of the same change.
- Risk: worktree switching behaves differently in standalone web vs hosted app.
  - Mitigation: model handoff as a returned target URL/api contract and cover both modes in tests.

## Verification Strategy

- Targeted unit tests for:
  - Git entry pagination and ordering
  - entry detail loading for `uncommitted`, commit, binary/truncated cases
  - worktree child-instance registry reuse and cleanup
  - switch handoff URL/api generation for standalone and hosted modes
- Route/navigation tests for:
  - `/git` present in live route tree and bottom navigation
  - `/git` absent from static route tree and static navigation
- Component tests for:
  - Git page default selection
  - shared refresh behavior with Dashboard
  - load-more entry pagination
- Local CI-equivalent checks before PR:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`
