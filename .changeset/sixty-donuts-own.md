---
'openspecui': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Fix the published runtime dependency graph so `openspecui` and `@openspecui/server`
do not require `tsx` as an installed runtime dependency.

Fix the shared file detail layout so the editor pane and file tree share one bounded
height, keep their own internal scrolling, and restore HTML files to preview mode so
their preview actions remain available by default.
