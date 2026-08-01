---
'openspecui': patch
'@openspecui/server': patch
---

Extract the `ctranslate2` native package from this monorepo into its own repo (Gaubee/ctranslate2). Remove `packages/ct2-engine`, its NAPI release matrix, and the native build jobs from `release.yml` (expected release time drops from ~14 min to ~8 min). The three consumers (`openspecui`, `@openspecui/server`, `@openspecui/local-ct2-translator`) now resolve `ctranslate2` from the npm registry at `^1.0.0` instead of `workspace:*`. The npm name is unchanged, so adapter imports and runtime admission strings need no edits.
