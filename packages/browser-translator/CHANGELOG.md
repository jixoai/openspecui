# @openspecui/browser-translator

## 11.1.0

### Minor Changes

- 97aca09: Expose spec-scope validation on the Specifications surfaces: a shared
  read-only evidence component at the all-specs header and the owned-spec
  detail header, with typed transport and report schemas, contract-drift
  and static degradation, making spec-level findings such as the 1.11
  Purpose-placeholder warning reachable in the UI.

### Patch Changes

- Updated dependencies [97aca09]
  - @openspecui/core@11.1.0

## 11.0.0

### Major Changes

- 56e20c8: OpenSpecUI 11 adapts OpenSpec CLI 1.10 and 1.11 in one release line: stable `>=1.10.0 <1.12.0` is admitted with the 1.11 line current and recommended and the 1.10 line supported non-current, while CLI `<1.10.0` (including 1.9.x and older), every prerelease, `>=1.12.0`, and unparseable versions stay blocked by default behind the session-scoped version-bypass dialog. 1.11 sessions load the full change status list through one `openspec status --all --json` spawn behind a capability gate — 1.10 keeps the serial per-change path — with partial-failure batches preserved as per-change diagnostics instead of failing the whole status projection. Change Detail MODIFIED deltas render the CLI's own `openspec show --diff` unified diff body and exact upstream warnings as separate evidence without recomputing or backfilling the local delta projection, `openspec init --language` passes through on both admitted lines, and validate surfaces the Purpose-placeholder warning class. The Agent delivery registry is rebuilt from the pinned 1.11 inventory: Zed joins from 1.10 (skills-only at `.agents/skills`, shared-root owner candidate), Antigravity declares `.agents` current with `.agent` legacy/migration evidence from 1.11 only while 1.10 keeps `.agent` current, opencode command templates carry the `**Provided arguments**` passthrough, and per-tool IDE-restart guidance follows actually written artifacts. Pinned 1.10.0/1.11.0 executable fixtures prove every accepted contract plus both capability-boundary rejections, and the references/openspec pin advances to verified v1.11.

  The 10.0.0 base version is consumed without a release so this major changeset publishes as OpenSpecUI 11.0.0: the v11 line deliberately skips a separate 1.10-only OpenSpecUI 10 release while still taking on every 1.10 protocol obligation.

### Minor Changes

- de39f9c: Present the Change Detail Evidence tab as a container-responsive list-detail workspace:
  evidence rows in the decision-plane layer order with fact-derived status chips, a detail
  pane that owns the tab's reading surface, and a crowded drill with a back affordance that
  keeps settled evidence mounted — replacing the stacked full-width accordions. Evidence
  semantics, CLI provenance, and typed degradation are unchanged.

### Patch Changes

- 4cc5289: Consume the 10.0.0 base version without a release so the pending major
  changeset publishes OpenSpecUI as 11.0.0 (the v11 line skips a separate
  10.x release, the same base-consumption the v9 release performed).
- Updated dependencies [56e20c8]
- Updated dependencies [de39f9c]
- Updated dependencies [4cc5289]
  - @openspecui/core@11.0.0

## 9.0.3

### Patch Changes

- Updated dependencies [12b6a0e]
- Updated dependencies [fa7b304]
  - @openspecui/core@9.0.3

## 9.0.2

### Patch Changes

- Updated dependencies [a9db235]
  - @openspecui/core@9.0.2

## 9.0.1

### Patch Changes

- Updated dependencies [dc854a8]
  - @openspecui/core@9.0.1

## 9.0.0

### Major Changes

- dfd04b8: OpenSpecUI 9 adapts OpenSpec CLI 1.8 and 1.9 in one release line: stable `>=1.8.0 <1.10.0` is admitted with the 1.9 line current and recommended and the 1.8 line supported non-current, while CLI `<1.8.0`, every prerelease, `>=1.10.0`, and unparseable versions stay blocked. Workflow Status projects the explicit `isPlanningComplete` planning fact and keeps `instructions apply` progress authoritative even when the actionable task list omits blank-description or indented checkboxes; `schemas --json` decodes as a success-array or selected-Root failure sum type so root-resolution failures keep their diagnostics instead of becoming an empty catalog; `validate --archived --json` is available as typed CLI evidence without repair or automatic archive. The Agent delivery registry is rebuilt from the official 1.9 inventory — Command Code, MiniMax Code user-global skills, Rovo Dev CLI, the available Shared `.agents` skills target, Codex at `.agents` with `.codex` as legacy migration evidence, and declared IDE restart requirements — with user-global roots observed but never cleaned or migrated locally. Pinned 1.8.0/1.9.0 executable fixtures prove every accepted contract, and the references/openspec pin moves to verified v1.9.0.

  The 8.0.0 base version is consumed without a release so this major changeset publishes as OpenSpecUI 9.0.0: the v9 line deliberately skips a separate 1.8-only OpenSpecUI 8 release while still taking on every 1.8 protocol obligation.

### Patch Changes

- Updated dependencies [dfd04b8]
  - @openspecui/core@9.0.0

## 7.0.2

### Patch Changes

- Updated dependencies [0c79923]
- Updated dependencies [48b6983]
- Updated dependencies [f09e062]
  - @openspecui/core@7.0.2

## 7.0.1

### Patch Changes

- @openspecui/core@7.0.1

## 7.0.0

### Patch Changes

- Updated dependencies [da5d080]
- Updated dependencies [da5d080]
  - @openspecui/core@7.0.0

## 6.2.1

### Patch Changes

- @openspecui/core@6.2.1

## 6.2.0

### Patch Changes

- Updated dependencies [cbf7153]
  - @openspecui/core@6.2.0

## 6.1.0

### Patch Changes

- Updated dependencies [701bfe8]
- Updated dependencies [ff2218a]
- Updated dependencies [b1bd34f]
- Updated dependencies [4755386]
- Updated dependencies [752addc]
  - @openspecui/core@6.1.0

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
