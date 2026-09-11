---
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
'openspecui': major
---

OpenSpecUI 13: adapt to OpenSpec CLI 1.13.x as a new single-series line (`>=1.13.0 <1.14.0`); the previous 1.12 v12 window, prereleases, `>=1.14.0`, and unparseable versions are blocked by default. Apply Instructions now project the CLI-owned `missingPrerequisites` (build-order closure of unread artifacts, present even in the ready state) and `warnings` (the no-delta-specs advisory that predicts a `validate` failure) end-to-end: typed CLI contract, Core input/projection schemas, Server transport, and a direct-plane Change Detail presentation with readable build-order evidence and graceful degradation. The Agent delivery registry rotates its series to '1.13' with every 1.12 physical fact carried forward (no new tools upstream; SourceCraft's 1.12 introduction stays a provenance fact), the pinned generator baseline moves to 1.13.0 with series-aware staleness (1.12.x-generated artifacts read stale), and the pinned executable fixture matrix rotates to the published `@fission-ai/openspec@1.13.0` with the retained 1.12.0 executable proving below-admitted boundary rejections.
