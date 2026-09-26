---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Rotate the pinned OpenSpec CLI fixture to 1.13.2 inside the unchanged v13 window (`>=1.13.0 <1.14.0`), and project the two 1.13.2 contract facts end-to-end: `instructions apply --json` tracking evidence (`taskTrackingConfigured` plus `unavailableTrackingFiles`, absent-when-empty, never gating apply state) now renders as non-gating evidence on the Change Detail status region with glob-tracked aggregation proven against the executed executable, the Kilo Code Agent delivery path rotates to `.kilo/command/opsx-<id>.md` with two-generation legacy cleanup of the old `.kilocode/workflows/` folder, and artifact-glob recognition widens to brace/expglob patterns for dependency-watching parity (wildcard-class task matching stays a documented boundary).
