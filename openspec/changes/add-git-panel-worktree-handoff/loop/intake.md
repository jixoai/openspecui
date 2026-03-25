## User Input

- Introduce a new Git panel page that provides a basic changed files viewer.
- The overall design should reference GitHub commits/commit-detail pages so mobile adaptation stays manageable and long lists can be optimized later with virtualization.
- This page should not support static export by default because exported Git history would become too large.
- The existing Dashboard `Git Snapshot` is the starting point; shared abilities should be reused and then expanded for the dedicated Git page.
- The Git page should default to `BottomNavArea`.
- The first version should only show the current worktree in detail.
- Other worktrees should still be visible as summaries and provide a real `Switch worktree` entry.
- Worktree switching should be real in this loop, not a placeholder.

## Objective Scope

- Add a live-only `/git` route and navigation entry that defaults to the bottom area.
- Build a Git page for the current worktree with entry history, changed-file summary, and patch-stream detail.
- Reuse Dashboard Git refresh state, ordering rules, diff presentation, and detached worktree semantics where possible.
- Add backend support for paged Git entry loading, per-entry patch detail loading, and current-worktree switching.
- Implement worktree switching as backend handoff to independently running OpenSpecUI instances for target worktrees.

## Non-Goals

- Support static export or SSG data generation for Git page detail payloads.
- Build a multi-worktree detail viewer inside a single Git page in this loop.
- Implement worktree switching by hot-swapping the current server process in-place.
- Finish advanced virtualization in this loop; the first version only needs a paging strategy that keeps the page fast.

## Acceptance Boundary

- Live mode exposes a `/git` page and bottom-area entry for it.
- The Git page shows current-worktree Git history with `uncommitted` first, then commits ordered newest-to-oldest.
- Selecting an entry shows changed files and GitHub-style patch-stream detail for that entry.
- Dashboard and Git page share the same Git refresh preset/timing behavior.
- Static mode does not expose the `/git` route or its navigation entry.
- Other worktrees are shown as summaries with a working switch action that hands the UI off to the target worktree instance.
