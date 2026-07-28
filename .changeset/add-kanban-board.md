---
'@openspecui/web': minor
'@openspecui/core': minor
'@openspecui/server': minor
---

Add an objective Kanban projection over exact tracked-task phases and structural archives.

Core and Server now expose exact phase counts plus bounded recent archive summaries through the shared Dashboard Summary contract. Web adds an interactive `/board`, replaces Dashboard Workflow Progress with the callback-free `ReadonlyKanban`, and publishes the same readonly Board in static exports. The readonly projection uses its own container to select four, two, or one columns without horizontal scrolling. The live Board contains page overflow, uses one horizontal lane-grid scrollbar, and lets each lane body scroll vertically on its own. Apply and Archive remain explicit existing Operator flows; drag-to-archive only opens Archive, and stale Root or projection data cannot authorize commands.
