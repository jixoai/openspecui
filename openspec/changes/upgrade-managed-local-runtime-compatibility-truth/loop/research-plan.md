## Research Findings

- The archived change `2026-05-28-add-local-llama-engine-and-search-recommendations` already implemented:
  - the managed `local-llama` engine,
  - dynamic `node-llama-cpp` installation through the runtime package manager abstraction,
  - empty-query recommended Hugging Face results.
- Current repo truth still fails the original verification target:
  - `pnpm verify:llama` succeeds only with `bartowski/Qwen2.5-0.5B-Instruct-GGUF`.
  - Running `OPENSPECUI_VERIFY_LLAMA_MODEL='tencent/Hy-MT2-1.8B-1.25Bit-GGUF' pnpm verify:llama` downloads the model successfully, then fails during `node-llama-cpp` model load with `Invalid type or block size`.
- Fresh upstream evidence shows no simple package upgrade escape hatch in the current ecosystem:
  - `node-llama-cpp` latest npm tag is still `3.18.1`.
  - `withcatai/node-llama-cpp` latest GitHub release is still `v3.18.1`.
  - `ggml-org/llama.cpp` PR `#22836` for STQ1_0 support is still open.
- The Tencent repository currently resolves to a single GGUF artifact group in our download-plan logic:
  - selected group id: `Hy-MT2-1.8B-1.25Bit.gguf-2cd886`
  - file path: `Hy-MT2-1.8B-1.25Bit.gguf`
- Current readiness law is incomplete:
  - `TranslationEngineService.readManagedLocalAssetLifecycle()` only verifies dependency/runtime package load plus local file presence.
  - `resolveTranslateServiceState()` treats `local-llama` as ready once the selected files are downloaded.
  - The first real model-load probe happens too late inside `batchTranslate()`.
- The runtime host boundary is already aligned correctly:
  - `openspecui` and `@openspecui/server` both own the relevant optional runtime dependencies.
  - `@openspecui/local-llama-translator` keeps `node-llama-cpp` as a source-level dependency and documents that tsdown externalization prevents bundling the heavy native runtime into shipped output.

## Decision & Plan (For Approval)

- Add a shared managed-local runtime compatibility verdict path in the server translation platform, without adding engine-specific UI branches.
- Start with `local-llama` by introducing a lightweight runtime probe helper in `@openspecui/local-llama-translator` that attempts model load and returns/throws compatibility truth before translation.
- Extend `TranslationEngineService` to:
  - probe the selected `local-llama` GGUF group during lifecycle asset checks,
  - cache verdicts per installed group revision to avoid repeated heavy loads during one server lifetime,
  - reuse the same verdict before `batchTranslate()` so late failures become early explicit errors.
- Update frontend readiness projection so a lifecycle asset error makes the engine unavailable before translation starts.
- Add package.json comment keys on runtime host packages to explain why the heavyweight runtime remains optional even though the bundled translator packages still import it in source.

## Capability Impact

### New or Expanded Behavior

- Managed-local lifecycle truth can now represent “files exist but current runtime still cannot load this selected group”.
- `local-llama` document translation readiness becomes a true end-to-end readiness verdict instead of a pure file-presence check.

### Modified Behavior

- `local-llama` selected GGUF groups that fail runtime probe now surface an explicit compatibility error before translation starts.
- Release/readiness evidence for the archived `local-llama` feature is clarified: supported GGUF success remains proven, Tencent Hy-MT2 remains a verified incompatibility target under the current runtime baseline.

## Risks and Mitigations

- Risk: probing a llama model load is slower than a pure file-exists check.
  - Mitigation: cache verdicts per selected group installation identity for the current server lifetime.
- Risk: lifecycle probing could accidentally block other managed-local engines.
  - Mitigation: keep the probe helper generic in shape but enable active probing only for `local-llama` in this loop.
- Risk: wording could still look like a repo bug instead of an upstream compatibility boundary.
  - Mitigation: normalize the surfaced message to mention the current runtime baseline and preserve the underlying load error text.

## Verification Strategy

- Focused unit tests:
  - `packages/local-llama-translator/src/index.test.ts`
  - `packages/server/src/translation-engine-service.test.ts`
  - `packages/web/src/lib/translate-service.test.ts`
- Scoped local checks after implementation:
  - `pnpm --filter @openspecui/local-llama-translator test`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/translate-service.test.ts`
- Runtime evidence:
  - `pnpm verify:llama` for the supported Qwen baseline.
  - `OPENSPECUI_VERIFY_LLAMA_MODEL='tencent/Hy-MT2-1.8B-1.25Bit-GGUF' pnpm verify:llama` to preserve the explicit incompatibility evidence.
