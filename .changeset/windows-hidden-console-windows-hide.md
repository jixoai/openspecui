---
'@openspecui/core': patch
'@openspecui/server': patch
'openspecui': patch
---

Hide Windows child-process console windows across daemon execution. `spawnSafe` now defaults to `windowsHide: true` (explicit caller opt-out preserved), Git/runner-probe/export/worktree/translation subprocesses set it explicitly, and the daemon opens external URLs through a hidden detached `explorer.exe` instead of the `open` package's visible PowerShell, so a console-less App daemon no longer flashes a cmd window per executed command.
