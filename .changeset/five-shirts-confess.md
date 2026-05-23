---
'@openspecui/server': minor
'@openspecui/web': minor
---

Fix published package staging so public workspace dependencies are rewritten to concrete versions and private translator packages are removed from npm manifests. The server package now bundles its private translator runtime modules so `@openspecui/server` can be installed from npm without unresolved private workspace dependencies.
