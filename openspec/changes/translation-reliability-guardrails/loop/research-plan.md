## Research Findings

- Current repo truth already widened the core translator contract in `packages/core/src/translator.ts`:
  - `TranslatorOptions` now carries `timeoutMs`.
  - `BatchTranslationResult` can now emit either `output` or `error`.
  - managed local global settings now persist `memoryBudgetPercent` for `local`, `local-ct2`, and `local-llama`.
- The implementation is only half-migrated:
  - `packages/server/src/translation-engine-service.ts` forwards `timeoutMs`, but still treats translator failures as whole-stream failures.
  - `packages/web/src/lib/translate-service.ts` and `packages/web/src/lib/browser-translation.ts` still contain success-only assumptions in their batch collection logic.
  - `packages/local-translator`, `packages/local-ct2-translator`, `packages/local-llama-translator`, and `packages/openai-completion-translator` still yield success-only events.
- The current document translation pipeline already has a segment status model:
  - `TranslationSegment.status` supports `pending | translated | error`.
  - `use-document-translation.ts` already treats “all segments failed” differently from “partial failures”.
  - `document-translation-segment-render.tsx` is the correct insertion point for per-segment retry affordances.
- The current Test Translate surface already routes all service-side engines through `runSingleTranslation()` in `packages/web/src/lib/translate-service.ts`, so adding timeout and partial-error truth here upgrades both manual smoke tests and downstream document translation probes.
- The current heavy local engine boundaries are engine-specific:
  - `local` delegates to `@huggingface/transformers`.
  - `local-ct2` delegates to `ctranslate2`.
  - `local-llama` delegates to `node-llama-cpp`.
  - their runtime controls are not equivalent, so detection/install/runtime policy must stay abstract while strategy mapping remains per-engine.
- The repo already contains reusable worker/process patterns:
  - `packages/search/src/node-worker-provider.ts` shows a message-based worker boundary.
  - `packages/cli/src/worktree-instance-manager.ts` shows bounded worker/process shutdown handling.
- Existing UI law remains valid:
  - engine capability and lifecycle truth should stay backend-owned.
  - the front end should stay thin, but must render segment-level failure/retry truth instead of flattening everything into one document-level error.

## Decision & Plan (For Approval)

- Establish a shared translation task-control law across service-side translators:
  - per-input execution can end in `output` or classified `error`,
  - `timeoutMs` applies to each input/subtask, not to the whole batch,
  - abort remains first-class and distinct from runtime failure.
- Introduce a shared runtime-strategy mapper for heavy local engines:
  - input is intent-level `memoryBudgetPercent`,
  - output is per-engine runtime config / worker resource policy,
  - only heavy local engines (`local`, `local-ct2`, `local-llama`) opt into worker isolation in this loop.
- Keep translator-specific logic orthogonal:
  - the shared layer handles timeout/error classification and worker protocol shape,
  - each engine remains responsible for its own runtime config, load path, and execution primitive.
- Upgrade the web translation pipeline in three steps:
  - Settings/Test Translate exposes `timeoutMs` with a 15s default and persists `memoryBudgetPercent`.
  - document translation batch collection accepts partial item failures without aborting the whole render.
  - failed segments gain targeted retry affordances, with direct-mode retry rendered as a top-layer action near the source and bilingual-mode retry rendered inline at the translation slot.
- Drive the work with BDD-style focused tests:
  - contract tests for per-item timeout/error behavior,
  - service/web tests for partial-failure streaming,
  - UI tests for timeout input, memory budget persistence, and segment retry rendering.

## Capability Impact

### New or Expanded Behavior

- Translation batches can now complete with mixed success/error outcomes.
- Test Translate can bound per-input work with an explicit timeout.
- Heavy local engines gain a shared memory-budget intent setting that maps to engine-specific runtime behavior.
- Document translation can expose and recover individual failed segments without discarding successful siblings.

### Modified Behavior

- Automatic lifecycle/smoke checks now run under bounded per-input task control instead of unbounded whole-run execution.
- Service-side translator failures are normalized into item-level error records where possible, instead of always surfacing as fatal stream errors.

## Risks and Mitigations

- Risk: forcing one worker abstraction onto every engine would create glue code and hide runtime-specific constraints.
  - Mitigation: keep worker isolation opt-in and strategy-driven per engine, with a shared protocol rather than a shared implementation body.
- Risk: partial-failure support could leave the web pipeline in a mixed old/new state.
  - Mitigation: migrate the contract end-to-end in one pass, starting from the shared batch event shape and then updating all collectors/renderers.
- Risk: timeout handling could be implemented as whole-batch timeout instead of per-input timeout.
  - Mitigation: centralize timeout enforcement at the per-task wrapper layer and verify with focused translator tests.
- Risk: retry UI can devolve into duplicated overlay logic.
  - Mitigation: inject retry controls at the shared segment-render layer and reuse existing popover/top-layer patterns already present in the web app.
- Risk: project config parsing currently applies defaults, so `translation.engineId` always looks present after parsing.
  - Mitigation: add an explicit project-config presence/read-source signal and use it to decide whether engine selection is project-owned or global-owned.

## Follow-up Plan: Translation Engine Config Ownership

- Add global translation engine selection to the existing `translationEngines` global settings object.
- Add project config presence detection for `translation.engineId` and engine-specific project override fields.
- Resolve effective engine selection as project override first, then global settings, then the product default.
- Route Settings writes through the ownership signal:
  - if project `translation.engineId` exists, write engine selection and managed-local model/profile overrides to project config,
  - otherwise write engine selection and managed-local model/profile settings to global settings.
- Keep provider endpoint and memory-budget settings global in this pass because they describe user/runtime environment rather than project identity.

## Verification Strategy

- Focused unit tests:
  - `packages/local-translator/src/index.test.ts`
  - `packages/local-ct2-translator/src/index.test.ts`
  - `packages/local-llama-translator/src/index.test.ts`
  - `packages/openai-completion-translator/src/index.test.ts`
  - `packages/server/src/translation-engine-service.test.ts`
  - `packages/web/src/lib/browser-translation.test.ts`
  - `packages/web/src/lib/translate-service.test.ts`
  - `packages/web/src/routes/settings.test.tsx`
- Scoped local checks during implementation:
  - `pnpm --filter @openspecui/core test`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/browser-translation.test.ts src/lib/translate-service.test.ts src/routes/settings.test.tsx`
- Broader release gates before completion:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`
