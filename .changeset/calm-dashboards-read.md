---
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
openspecui: patch
---

Classify observation refresh procedures as readonly queries, preserve one absolute Dashboard auto-refresh deadline across visibility changes, keep Dashboard manual refresh independent from background Git work, stabilize Dashboard regional Pending geometry with fixed Historical Trends and independently scrolling compact Kanban lanes, curate the default Git activity window to five meaningful current-worktree rows, compute summary-only data for visible Other Worktrees, skip detached or unavailable hidden Git detail, propagate cancellation into Git subprocesses, and trace Projection Work queue admission separately from leaf execution. Also trace Planning-root lock queue/blocker timing with explicit sources and stacks, single-flight same-generation Root cache misses outside short generation-checked write commits, serialize buffered CLI execution at the real `CliExecutor` boundary, submit aggregate Status/Schema/Spec reads lazily, default buffered OpenSpec execution to Worker with process fallback only when its importable JavaScript module is absent, freeze and report daemon-managed execution policy across restart, and separate CLI admission, response, mode-specific process/Worker, and parent event-loop phase evidence without writing late events to ended spans.
