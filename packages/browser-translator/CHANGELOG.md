# @openspecui/browser-translator

## 3.12.0

### Patch Changes

- Updated dependencies [dc997ea]
  - @openspecui/core@3.12.0

## 3.11.6

### Patch Changes

- @openspecui/core@3.11.6

## 3.11.5

### Patch Changes

- Updated dependencies [a055d57]
  - @openspecui/core@3.11.5

## 3.11.4

### Patch Changes

- Updated dependencies [b02c131]
  - @openspecui/core@3.11.4

## 3.11.3

### Patch Changes

- Updated dependencies [bc8e0a8]
  - @openspecui/core@3.11.3

## 3.11.2

### Patch Changes

- @openspecui/core@3.11.2

## 3.11.1

### Patch Changes

- Updated dependencies [ec56e7f]
- Updated dependencies [da4b8ee]
  - @openspecui/core@3.11.1

## 3.11.0

### Patch Changes

- Updated dependencies [eba707d]
  - @openspecui/core@3.11.0

## 3.10.0

### Patch Changes

- @openspecui/core@3.10.0

## 3.9.0

### Patch Changes

- @openspecui/core@3.9.0

## 3.8.0

### Minor Changes

- 4f43845: Switch translation engines to bundled dynamic imports and batch translation.

  Notable translation engine changes:
  - rename engine ids to `browser | local | openai`
  - rename translator packages to `@openspecui/local-translator` and `@openspecui/openai-completion-translator`
  - replace single `translate(...)` with `batchTranslate(...)`
  - remove engine install/cancel install flows and old `nmt/ai` config keys
  - add resumable Local-Transformers model downloads with byte-level progress recovery

### Patch Changes

- Updated dependencies [4f43845]
  - @openspecui/core@3.8.0
