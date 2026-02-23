## 1. Dashboard IA Refactor

- [x] 1.1 Replace top-level live status stack with `Workflow Progress` + `Git Snapshot`.
- [x] 1.2 Move historical trends into a dedicated section and keep live status trend-free.
- [x] 1.3 Improve mobile layout and remove horizontal overflow in top sections.

## 2. Workflow Progress

- [x] 2.1 Group status by workflow schema and display artifact states (`Draft/Ready/Blocked`).
- [x] 2.2 Keep explicit order for `spec-driven` (`Proposal`, `Design`, `Specs`, `Tasks`).
- [x] 2.3 Ensure schemas without active changes are still visible in status panel.

## 3. Git Snapshot

- [x] 3.1 Add worktree summary + commit/uncommitted entry hierarchy.
- [x] 3.2 Add refresh control and running-state feedback.
- [x] 3.3 Unify git diff badges and reduce redundant text.

## 4. Static/Tests

- [x] 4.1 Add/adjust dashboard router tests for new overview fields.
- [x] 4.2 Add/adjust static provider tests for dashboard overview and static config behavior.
- [x] 4.3 Keep static mode behavior deterministic for git task status fallback.
