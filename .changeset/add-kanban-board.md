---
'@openspecui/web': minor
---

Add a Kanban board view (`/board`) that visualises changes across their lifecycle — TODO, In Progress, QA, and Done (archived). Columns are derived from task-completion counts and archive location; each card keeps the existing workflow-phase badge. QA cards can be dragged onto Done to archive them (with the existing confirmation flow), and the Done column has a time-range filter (7d/30d/90d/all). Read-only in static mode.
