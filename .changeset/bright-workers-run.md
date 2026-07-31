---
'@openspecui/core': patch
'@openspecui/server': patch
openspecui: patch
---

Default buffered OpenSpec commands to Worker execution, fall back to process only when the importable CLI JavaScript module is absent, publish the daemon-owned execution mode, and expose requested, effective, module, fallback, and lifecycle evidence through OpenTelemetry.
