## Implementation State

- Loop initialized for the dedicated live Git page and real worktree handoff feature.
- Approved direction is to keep Git detail out of static/export and out of `DashboardOverview`, then add a dedicated live API surface and route.
- Implementation is now in progress.
- Backend live Git panel API now exists via `git.overview`, `git.listEntries`, `git.getEntryDetail`, and `git.switchWorktree`.
- CLI now provides a reusable child-instance manager so worktree switching can hand off to a sibling OpenSpec UI server instead of mutating the current process.
- Web now has a dedicated live-only `/git` route, bottom-area navigation entry, GitHub-style changed-files detail panel, and shared worktree summary rows with real switch actions.
- Dashboard Git Snapshot has been partially deduplicated onto shared Git UI pieces while keeping static/export behavior unchanged.
- Local PR gates are green for this loop: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci`.
- Browser acceptance on `http://localhost:3120/dashboard?_b=%2Fgit` found two follow-up defects and both were corrected in-loop: the sibling-instance spawn command now uses `pnpm --filter openspecui run dev --dir ...` so runtime args reach the CLI, and stale/prunable worktrees now surface as missing-path rows that can be removed but not switched.
- Git entry detail is now split into `getEntryShell` and `getEntryPatch`; a later follow-up replaced the refresh-version query-key pattern with stable Git resource keys plus `invalidateQueries(['git'])` on dashboard git-task completion so the page keeps warm data visible during refresh instead of flashing route-level loading again.
- Git page detail now loads progressively: file metadata arrives first, per-file patches load lazily as cards enter view, and the right-side detail area can switch between a narrow tabs layout and a wide dual-pane `file tree + diff stream` layout.
- Read-only diff rendering now shares a dedicated code-surface token set with markdown/Shiki blocks so light/dark mode stays coherent across non-editor code displays.
- A follow-up browser walk on the live `/git` route corrected three UX defects in-loop: OpenSpec CLI probing now resolves shell-managed `openspec` shims (for example Volta) instead of falsely blocking the page, renamed archive paths no longer leak brace-rename fragments into “linked openspec changes”, and Git history rows no longer nest a second button around the relative-time badge.
- A later self-walk of `/git` exposed a platform-side rendering defect rather than a Git-data defect: shared UI components were injecting `<style>` blocks into the rendered body, which polluted text extraction and browser automation reads. This loop now adds a reusable head-style hook, migrates `Tabs` and `Dialog` to it, and covers the behavior with web tests.
- A subsequent Git UX follow-up corrected file-tree navigation drift inside the detail panel: when `Diff Stream` stayed mounted but hidden behind the tabs shell, file-tree selection could try to scroll a hidden card too early. The panel now queues the target file, waits until the diff pane is actually visible, and scrolls the nearest vertical container with explicit offset math instead of relying on bare `scrollIntoView`.
- A later review of the changed-files UX found that the right-side “File Tree” was still behaving like a two-line list-card view. The panel now renders a true directory tree with compact single-row file items, drops the redundant per-file `1f` badge, and reuses the existing backend `GitEntryFileSummary.diff` payload so each row keeps meaningful `+/-` stats without any server-side schema change. Diff-stream headers were also updated to wrap full paths instead of truncating them.
- A subsequent self-walk showed the first tree pass was still too fragmented because every single-child directory level consumed its own row. The tree now compresses linear directory chains (for example `src/components/git`) into one directory row and switches path wrapping to `overflow-wrap:anywhere` so long paths stay complete without the harsher per-character `break-all` behavior.
- A later data-semantics review found that untracked files were being serialized with synthetic `+0/-0` stats before their patch payload had actually been computed. The Git file model now distinguishes `ready` vs `loading` vs `unavailable` file-level diff stats, so the tree and diff headers render objective loading state instead of fake zero values.
- A subsequent UX correction split the old mixed `/git` screen into a commit list page and dedicated commit-detail routes (`/git/uncommitted` and `/git/commit/$hash`) so the information architecture now follows the same list/detail pattern used by `Changes`, including a top-left back action on detail.
- The File Tree was then rebuilt around a derived tree model instead of patch-query side effects: directory rows now aggregate descendant diff stats, ready rows no longer show completion checkmarks, and unresolved rows show only objective `loading`/`n/a` state.
- The tree visuals were also upgraded from simple left-border indentation to explicit guide rails and elbows so hierarchy reads as a real connected tree instead of a padded list.
- Detail-panel tree-to-diff navigation now measures the tabs strip height and applies the same offset to both `scroll-padding-top` and patch-card `scroll-margin-top`, preventing the target file header from landing under the tabs row after a tree jump.
- Final browser acceptance exposed one more objective defect in the wide two-pane layout: when lazy patch cards above the target expanded during a tree jump, the selected patch could drift back below the viewport even though selection changed. The detail panel now keeps tree-jump scrolling pending until the target card is actually aligned, re-checks alignment after patch layout updates, and adds a regression test covering the second-pass scroll behavior.
- A later maintainer review found a second class of Git-detail defects that earlier passes had not modeled explicitly: the UI was still rendering `ready` zero-line diffs (`1f +0 -0`) as if they were valuable status, even though many of those rows were pure rename/archive moves with no readable line delta. The fix deliberately separates “computable diff” from “worth displaying diff”: zero-line ready stats and zero-file badges are now visually suppressed, single-file patch headers no longer repeat `1f`, pure rename cards use the destination path as the primary line plus a `from ...` secondary line, the commit-detail title/subtitle no longer truncate, and the File Tree is now a true collapsible tree with folder open/closed affordances instead of a permanently expanded pseudo-list.

## Decisions Taken

- The first Git page only expands the current worktree in detail.
- Other worktrees stay at summary level inside this loop and expose a real switch action.
- Git detail uses a GitHub-style patch stream instead of a single-file diff viewer.
- Refresh preset/timing state is shared with Dashboard.
- Worktree switching must use child-instance handoff because the current watcher pool is process-global and single-project.
- Child worktree instances will be reused through a registry rather than spawned every time.
- `/git` remains excluded from the static route tree and static navigation.
- A canonical git-path comparison rule is now required on the server side because `git worktree list` can surface physical paths (for example `/private/var/...`) that differ from the caller's logical path (`/var/...`) while still referring to the same directory.

## Divergence Notes

- No scope divergence from the approved plan so far.
- One unexpected implementation issue appeared during router testing: string-based path equality was not sufficient for worktree matching/current-worktree detection on macOS temp paths. This was resolved by adding a shared canonical git-path comparison helper instead of patching tests around the symptom.
- A second unexpected issue appeared during browser acceptance: `git worktree list --porcelain` can retain prunable entries whose directories are already gone. The UI was incorrectly offering `Switch worktree` for those dead entries. This was resolved by promoting `pathAvailable` into the shared worktree model, guarding the server mutation, and rendering stale rows as remove-only.
- A third follow-up issue appeared during Git panel validation: the original detail path was still eager-loading full patch payloads and the route itself forced a refresh on every mount, which made the page feel cold on each visit. This was resolved by introducing shell-vs-patch API split, version-keyed cache reuse, and removal of the route-mount refresh trigger.
- A fourth follow-up issue appeared during self-walk on a shell-managed local environment: process PATH inspection alone was insufficient to discover the user's `openspec` shim, which left the UI permanently blocked behind the CLI-setup gate even though `openspec` was available from the login shell. This was resolved by resolving bare `openspec` commands through the user's shell once during runner detection and then executing the resolved absolute path directly.

## Loopback Triggers

- If Git patch extraction proves too slow or too large for selected entries, loop back to narrow the detail payload or add stricter per-entry limits.
- If child-instance handoff cannot be implemented safely from the current CLI process, loop back before introducing a partial or placeholder switch flow.
