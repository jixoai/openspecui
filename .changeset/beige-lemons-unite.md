---
'openspecui': minor
'@openspecui/core': minor
'@openspecui/server': minor
'@openspecui/web': minor
'@openspecui/browser-translator': minor
'@openspecui/local-translator': minor
'@openspecui/openai-completion-translator': minor
---

Switch translation engines to bundled dynamic imports and batch translation.

Notable translation engine changes:
- rename engine ids to `browser | local | openai`
- rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
- replace single `translate(...)` with `batchTranslate(...)`
- remove engine install/cancel install flows and old `nmt/ai` config keys
- add resumable Local-Transformers model downloads with byte-level progress recovery
