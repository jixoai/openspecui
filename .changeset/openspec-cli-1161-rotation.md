---
'@openspecui/core': patch
'openspecui': patch
---

Rotate the pinned OpenSpec CLI to 1.16.1 inside the unchanged `>=1.16.0 <1.17.0` v16 window (8 upstream
commits; command surface and Agent contract byte-identical, so no projection change). The generator
staleness baseline moves to 1.16.1, and the pinned fixture matrix now proves what the patch changed:
`validate` reports an ERROR — so plain validation already fails, not only `--strict` — and `archive`
refuses with the typed `archive_validation_failed` status when a requirement sits under a header that
reads as a delta operation but is not one (`## Add Requirements`, `## DEPRECATED Requirements`,
`## Requirements`), while the same block under prose stays a WARNING and the retained 1.15.0 boundary
reports it as a WARNING without failing. ATX closing `#` runs are now accepted on **section** headings
(`## Requirements ##`, `## ADDED Requirements ##`), so such a delta applies on archive, and the orphan
scan masks HTML comments so a commented-out declaration is no longer reported; requirement-name
normalization was already present and stays carried-forward evidence.
