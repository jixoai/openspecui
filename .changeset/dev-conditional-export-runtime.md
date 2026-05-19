---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/search': patch
---

Add development conditional exports so source-mode worktree runtimes resolve workspace TypeScript sources while published/default runtimes keep using dist artifacts.
