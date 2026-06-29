---
"@openspecui/web": patch
---

Stores panel now consumes a reactive subscription (the server polls the
registry and pushes updates) instead of a one-shot query, and no longer
leaks polling cadence / registry-location details into the UI copy.
