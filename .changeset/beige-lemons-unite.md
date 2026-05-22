---
'openspecui': major
'@openspecui/core': major
'@openspecui/server': major
'@openspecui/web': major
'@openspecui/browser-translator': major
'@openspecui/local-translator': major
'@openspecui/openai-completion-translator': major
---

Switch translation engines to bundled dynamic imports and batch translation.

Breaking changes:
- rename engine ids to `browser | local | openai`
- rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
- replace single `translate(...)` with `batchTranslate(...)`
- remove engine install/cancel install flows and old `nmt/ai` config keys
