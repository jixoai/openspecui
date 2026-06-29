---
"@openspecui/web": minor
---

Navigation visual improvements.

- **Icon updates**: Changes entry now uses `ListTodo` (was `GitBranch` — a change
  is a proposal/work unit, not a git branch); Git entry now uses `GitBranch`
  (was `FileCode2` — it's version control, not a code file); Stores entry uses
  `Warehouse` (was `Store`), matching the panel title.
- **Beta badge in the sidebar**: beta entries (Stores) now show a "Beta" pill
  next to the label when expanded, and a small "β" corner mark on the icon when
  collapsed (and in the mobile tab bar). Previously the Beta marker only
  appeared inside the panel.
