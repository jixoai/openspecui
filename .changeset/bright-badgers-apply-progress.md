---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/search': patch
'@openspecui/web': patch
---

Restore CLI-owned Apply progress on Dashboard, Change List, and ReadonlyKanban, including first-frame `Applying` state and `completed/total` evidence without falling back to tracked task arithmetic. Keep the Windows installed-CLI smoke aligned with the workspace package version so future patch releases do not retain a stale `9.0.0` assertion.
