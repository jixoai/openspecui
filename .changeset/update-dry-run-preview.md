---
'@openspecui/core': minor
'@openspecui/server': minor
'@openspecui/web': minor
'openspecui': minor
---

Land the deferred OpenSpec 1.15 dry-run preview (B1 of the 15.0.0 line): `update --dry-run --json` becomes the `updateDryRun` capability with the typed `UpdatePlan` contract (three keys always arrays, closed action/note enums, no rename action, per-tool failures as plan data beside exit 0, failed-command envelope `status[]`/`update_error` at exit 1), projected through a gated executor method, an `agentIntegrations.updatePlanPreview` read transport, and a Config Agents Update/Repair plan preview that renders raw rows with wrapped paths, notes by code, and inline would-fail rows — never gating the real mutation. The stale v9-era `check-openspec-reference` gate is repaired to the v1.15 assertion in the same delivery.
