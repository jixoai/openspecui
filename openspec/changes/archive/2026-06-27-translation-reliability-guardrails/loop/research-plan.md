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

## Follow-up Finding: Native Runtime Crash Boundary

- The current managed-local executor uses `worker_threads.Worker`.
- `worker_threads` can bound V8 heap and isolate JS exceptions, but it cannot contain a native addon `std::terminate`/abort because all workers share the same Node process.
- The observed `llama-addon.node` stack indicates `node-llama-cpp` threw or terminated in the native/N-API async worker completion path, so JS `try/catch` and `worker.on('error')` are insufficient.
- The `control-looking token ... '</s>'` line is a model/tokenizer warning; the fatal condition is the uncaught native exception and process abort.

## Follow-up Plan: Process-Isolated Managed Local Executors

- Split the managed-local executor host from the translation task protocol:
  - keep the existing message protocol and factory creation law,
  - allow a thread host for lower-risk managed-local engines,
  - add a process host for native-crash-risk engines such as `local-llama`.
- Pass the same runtime strategy output to both hosts:
  - runtime config remains engine-specific,
  - V8 heap limit is applied through worker `resourceLimits` for thread hosts,
  - V8 heap limit is applied through `--max-old-space-size` for process hosts,
  - RSS watchdog is enforced by the process host parent and kills the child before it can swap the system.
- Treat abnormal child process exit as `runtime` batch failure instead of a server crash.
- Keep the first rollout focused on `local-llama`; do not force `local`/`local-ct2` to child processes unless evidence shows their native layers can abort the host.

## Follow-up Finding: Process Lifecycle Observation Gap

- The process host is currently per batch: each `batchTranslate()` invocation creates a child process, sends one request after `ready`, drains events, then shuts the child down.
- Because the host is per batch, "auto restart" in this design means the next invocation creates a fresh process host. A persistent engine daemon with restart backoff is a larger platform law and is not implemented in this loop.
- The first process-host implementation observes `message`, `error`, and `exit`, but it does not model IPC `disconnect` or process `close`.
- A native/runtime crash can therefore detach IPC or close stdio without producing the exact path currently expected by the parent, leaving the async generator without a classified failure.
- The process-host interface also does not expose `disconnect`/`close`, so tests cannot prove those lifecycle paths are handled.

## Follow-up Plan: Process Lifecycle Failure Reducer

- Extend the child-process adapter interface to include `disconnect` and `close` lifecycle events.
- Route `error`, `exit`, `disconnect`, and `close` through one idempotent failure reducer that:
  - stops the RSS watchdog,
  - records that the process is no longer usable,
  - emits one classified runtime failure for every unsettled input,
  - ignores duplicate lifecycle events after completion.
- Add BDD coverage for:
  - IPC disconnect before completion,
  - process close before completion,
  - spawn/process error before ready,
  - second invocation after a failed batch creating a fresh child process.
- Keep the process host per-batch in this follow-up; do not silently introduce a persistent daemon or restart loop without a separate design.

## Follow-up Finding: Unified-Memory Budget Collapse

- The current local-llama preflight computes `budgetMemoryMb` as the minimum of:
  - the user-intent quota from `totalMemoryMb * memoryBudgetPercent`,
  - and `availableMemoryMb - osReservedMb`.
- `availableMemoryMb` currently comes from `os.freemem()`.
- On Apple Silicon/unified memory, `os.freemem()` is transient and can be very low because memory is cached, compressed, or under pressure; it is not a reliable hard capacity signal for deciding whether a user-selected 50% budget is effectively 0%.
- This causes false rejections such as a 50% budget yielding `0.01GB`.
- The runtime already has a process RSS watchdog based on the intent-derived budget, so preflight should reject against the intent budget while runtime enforces the actual process ceiling.

## Follow-up Plan: Stable Local-Llama Budget Derivation

- Keep `memoryBudgetPercent` anchored to total/constrained memory.
- For Apple Silicon/unified memory:
  - compute the safe budget from total memory and OS reserve,
  - do not use transient `os.freemem()` as a hard cap in preflight.
- For non-unified memory, continue using available-memory telemetry conservatively because VRAM/RAM pressure behaves differently and process fallback can still be dangerous.
- Add a BDD regression test proving a 50% unified-memory budget does not collapse to zero when `availableMemoryMb` is below the reserve.
- Update the existing rejection test to assert rejection still happens when model requirements exceed the stable intent-derived budget.

## Follow-up Finding: Automatic Engine Probe and Translation Ownership Gaps

- Switching the Settings engine calls `translationEngines.select`, then refetches `translationEngines.list`.
- `listEngines()` calls `getLifecycle()` for every engine.
- Managed-local `getLifecycle()` calls `detectManagedLocalLifecycle()`, and when dependencies are installed it calls `probeManagedLocalRuntime()`.
- That runtime probe imports the native/runtime package on selection/list refresh, so switching engines can still perform an implicit runtime test before the user opens Test Translate.
- Current project/global ownership is only complete for `translation.engineId`.
- `translation.enabled`, `translation.targetLanguage`, `translation.displayMode`, and `translation.cacheEnabled` are read from project config and written through `config.update` by default.
- Settings UI also writes OpenAI model to both global and project, and managed-local model selection uses `translation.engineId` ownership rather than the related `translation.engines.*` ownership.

## Follow-up Plan: Manual Test Translate and Global Translation Defaults

- Stop managed-local lifecycle detection after dependency detection; runtime validation becomes `not-applicable` until the user runs Test Translate.
- Add front-end copy near the engine selector/test button that tells users to run Test Translate for errors, latency, and runtime validation.
- Add global translation settings for `enabled`, `targetLanguage`, `displayMode`, and `cacheEnabled`.
- Extend config presence to track scalar `translation.*` fields, not only `engineId`.
- Resolve effective document translation config as project override first, then global settings, then defaults for every scalar translation field.
- Route Settings writes field-by-field:
  - write project config only when that exact project field is present,
  - otherwise write global settings.
- Route `translation.engines.*` model/selected-group writes by the related engine settings presence, not by `translation.engineId`.

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
