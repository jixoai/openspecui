## Implementation State

- Hosted shell state now syncs across same-origin instances through `localStorage` persistence, `storage` listeners, and a dedicated shell-state `BroadcastChannel`.
- `forwarded` launch handling now performs a short bounded rehydrate wait so newly created tabs can appear without a manual refresh.
- A second root cause was confirmed in the hosted app `service-worker`: versioned document navigations were served with stale-first behavior, so existing installs could keep using an outdated shell HTML even when direct/private navigation worked.
- Versioned hosted shell navigations now use network-first behavior, cache the canonical channel shell at `rootPath`, and fall back to that cached shell only when the network path fails.
- Hosted `version.json` lookups now use cache-first behavior in the service worker, while SW activation forcibly refreshes the manifest once so a new deploy can invalidate channel caches without re-downloading the manifest on every probe.
- Hosted reachability now memoizes the manifest per app base URL and stops forcing `cache: 'no-store'`, so repeated tab probes reuse the same manifest fetch instead of bypassing SW/browser caches.
- Hosted shell refresh now provides explicit transient feedback: the refresh button switches into the active surface, the icon animates, and the feedback window outlives very short probes so users can actually see the refresh intent.
- Hosted shell tabs now keep the header order and the content-pane order decoupled, so drag-reordering headers no longer remounts iframe content or triggers unnecessary reloads.
- Terminal tabs now put the 0.5rem top breathing room on the tabs strip itself instead of the shell root, and terminal hover styling is weaker than the selected style to avoid the “two active tabs” visual confusion after drag.
- Hosted app theme-color metadata is forced to the terminal color, and overlay mode now keeps the shell root background fused with the terminal header.
- PWA icon assets were adjusted from the project SVG source.
- Dashboard overview loading now uses a dedicated server-side `DashboardOverviewService` warm cache. The service warms once, reuses the cached overview for `dashboard.get`, pushes cached/current data to `dashboard.subscribe`, and refreshes in the background from watcher/manual git-refresh triggers instead of recomputing the full overview on every request.
- `dashboard.refreshGitSnapshot` now triggers an actual overview refresh after writing the git refresh stamp, so front-end refresh actions update the warm cache instead of waiting for an unrelated subsequent request.
- `openspec/.openspecui.json` was removed after being generated accidentally by `bunx openspecui` in the repo root.

## Decisions Taken

- Keep `/versions/*` semantics unchanged; fix the stale shell problem in the app service worker instead of changing product routing.
- Keep explicit `--app=<preview-url>` origin allow-list flow for Pages previews.
- Keep the shared `Tabs` component and fix DOM identity there instead of adding a hosted-app-specific tab implementation.
- Move expensive dashboard recomputation behind a dedicated service cache instead of trying to micro-optimize the React subscription layer.
- Added a patch `.changeset` for `openspecui`, `@openspecui/core`, `@openspecui/server`, and `@openspecui/web` because the shipped dashboard/server/web bundle behavior changed.

## Verification

- `pnpm --filter @openspecui/web test -- src/components/tabs.test.tsx`
- `pnpm --filter @openspecui/app test -- src/components/hosted-shell.test.tsx src/lib/reachability.test.ts`
- `pnpm --filter @openspecui/server test -- src/router.test.ts src/dashboard-overview-service.test.ts src/system-router.test.ts src/search-router.test.ts`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm --filter @openspecui/app typecheck`
- `pnpm --filter @openspecui/server typecheck`
- `pnpm --filter @openspecui/app build`
- `pnpm format:check`
- `pnpm lint:ci`
- `pnpm test:ci`
- `pnpm test:browser:ci`
- `pnpm build`

## Divergence Notes

- Vitest still prints jsdom CSS parse warnings from the existing shared `Tabs` stylesheet that uses nested CSS and anchor-position syntax; tests pass, and this loop does not change that pre-existing limitation.
- Full workspace gates were run before archive: `pnpm test:ci`, `pnpm test:browser:ci`, and `pnpm build`.

## Loopback Triggers

- If Pages preview behavior still shows blank iframes after the SW update, capture the failing request/response chain before widening the scope again.
- If hosted tabs need cross-window drag/drop or persisted tab order, return to research-plan before expanding behavior further.
- If dashboard freshness on non-OpenSpec worktree file edits still feels too stale, extend the warm-cache invalidation sources beyond the current watcher/manual git-refresh signals rather than reintroducing request-time recomputation.
