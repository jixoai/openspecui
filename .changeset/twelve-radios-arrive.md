---
'@openspecui/core': patch
---

Fix CLI runner probing and execution when `spawn()` throws synchronously for invalid commands.
This prevents delayed `ReferenceError` failures and keeps CLI availability checks stable for the web and server integrations.
