---
'@openspecui/core': patch
'openspecui': patch
---

Stabilize the Windows CI gate: serialize Win32 process-table reads behind a single in-flight guard, isolate process-topology tests in a dedicated vitest project with `fileParallelism:false` + single worker, add bounded EBUSY backoff to the installed-CLI smoke cleanup, stop swallowing teardown errors in the Server suite, and close the worktree child runtime lifecycle registry (close-during-launch ownership, late-ready rejection, watcher propagation, endpoint truth for worker transport).
