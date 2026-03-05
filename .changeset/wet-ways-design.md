---
'@openspecui/server': patch
'openspecui': patch
---

Move dashboard git refresh stamp into Git metadata (`.git`/worktree `gitdir`) so OpenSpecUI no longer creates `openspec/.openspecui-dashboard-git-refresh.stamp` in user projects.

When Git metadata is unavailable, dashboard refresh becomes a no-op instead of writing a fallback project file.
