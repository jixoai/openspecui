# @openspecui/openai-completion-translator

## 4.0.0

### Major Changes

- 70e8a79: Switch translation engines to bundled dynamic imports and batch translation.

  Breaking changes:
  - rename engine ids to `browser | local | openai`
  - rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
  - replace single `translate(...)` with `batchTranslate(...)`
  - remove engine install/cancel install flows and old `nmt/ai` config keys

### Patch Changes

- Updated dependencies [70e8a79]
  - @openspecui/core@4.0.0
