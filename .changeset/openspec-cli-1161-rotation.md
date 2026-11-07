---
'@openspecui/core': patch
'openspecui': patch
---

Rotate the pinned OpenSpec CLI to 1.16.1 inside the unchanged `>=1.16.0 <1.17.0` v16 window (8 upstream commits; command surface and Agent contract byte-identical, so no projection change). The generator staleness baseline moves to 1.16.1, and the pinned fixture matrix now proves two verdict changes the patch introduced: `validate` reports an ERROR — and `archive` refuses — when a requirement sits under a header that reads as a delta operation but is not one (`## Add Requirements`, `## DEPRECATED Requirements`, `## Requirements`), while the same block under prose stays a WARNING and the retained 1.15.0 boundary proves the escalation is new to this line; and ATX closing `#` runs on section/requirement headings are accepted with the name normalized, while an HTML-commented requirement is no longer reported as an orphaned block.
