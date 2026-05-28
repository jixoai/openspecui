---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Add the managed `local-llama` translation engine across the shared core/server/web stack, with host-owned optional runtime installation for `node-llama-cpp` and GGUF model selection.

Also tighten the managed-local translation UX by returning recommended models for empty search, preserving server/local panel truth before auto-refreshing artifacts, and fixing local translation state handling regressions surfaced by CT2 and segment patch flows.
