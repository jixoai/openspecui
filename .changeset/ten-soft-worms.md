---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Improve translation reliability by enforcing per-item timeout/error handling across service-side translators, mapping managed-local memory budgets into runtime and worker execution strategy, and surfacing segment-level retry flows with configurable smoke-test timeouts in the settings UI.
