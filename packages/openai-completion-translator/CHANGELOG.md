# @openspecui/openai-completion-translator

## 6.0.1

### Patch Changes

- Updated dependencies [ec5fab4]
  - @openspecui/core@6.0.1

## 6.0.0

### Patch Changes

- Updated dependencies [95bc2b9]
- Updated dependencies [5def094]
- Updated dependencies [e49ff53]
- Updated dependencies [ccd72af]
- Updated dependencies [8b81f7d]
- Updated dependencies [39ac6ce]
- Updated dependencies [cdb2cb5]
  - @openspecui/core@6.0.0

## 6.0.0-beta.1

### Patch Changes

- Updated dependencies [5def094]
  - @openspecui/core@6.0.0-beta.1

## 6.0.0-beta.0

### Patch Changes

- Updated dependencies [95bc2b9]
- Updated dependencies [ccd72af]
- Updated dependencies [8b81f7d]
- Updated dependencies [39ac6ce]
- Updated dependencies [cdb2cb5]
  - @openspecui/core@6.0.0-beta.0

## 5.0.0

### Patch Changes

- Updated dependencies [3019d08]
  - @openspecui/core@5.0.0

## 4.1.0

### Patch Changes

- Updated dependencies [29e9571]
  - @openspecui/core@4.1.0

## 4.0.2

### Patch Changes

- @openspecui/core@4.0.2

## 4.0.1

### Patch Changes

- Updated dependencies [962795a]
  - @openspecui/core@4.0.1

## 4.0.0

### Patch Changes

- Updated dependencies [b8d85f9]
  - @openspecui/core@4.0.0

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
