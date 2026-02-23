## Context

Dashboard top section needs to stay objective and operationally useful while remaining readable on desktop and mobile.

## Decisions

1. Split top area into two first-class sections:
   - `Workflow Progress`
   - `Git Snapshot`
2. Keep historical trajectories inside `Historical Trends`; avoid adding extra trend widgets into live status.
3. Model workflow status by schema + artifact rows (`Draft/Ready/Blocked`) with stable ordering for `spec-driven`.
4. Introduce git snapshot as a compact two-level tree:
   - worktree summary (branch/path/ahead-behind/diff)
   - commit/uncommitted entries with diff badges.
5. Keep reactive updates through subscription + explicit refresh fallback.

## Tradeoffs

- Git snapshot collection is heavier than plain counters but provides concrete execution context.
- We keep right-edge trend anchoring by latest commit time, while live section remains trend-free to avoid visual noise.
