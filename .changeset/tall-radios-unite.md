---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Improve dashboard with a new objective overview data model and reactive subscription:

- add backend `dashboard` get/subscribe API
- include spec/requirement counts and active/completed/in-progress change metrics
- show per-spec requirement breakdown and per-change task progress in UI
- support static export mode via dashboard overview mapping
