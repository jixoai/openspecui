---
'openspecui': patch
'@openspecui/core': patch
'@openspecui/server': patch
'@openspecui/web': patch
---

Fix the published runtime package layout so `@huggingface/transformers` stays
external to the CLI/server bundle and can resolve its native runtime
dependencies from installed package dependencies.

Unify Local-Transformers model profile state behind the server `panelState`
source of truth so Settings chips render selection, download status, and file
progress from the same model lifecycle snapshot.
