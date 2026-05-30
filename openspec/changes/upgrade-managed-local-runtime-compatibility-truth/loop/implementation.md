## Implementation State

- Change scaffolded to close the remaining `local-llama` verification gap after the archived feature release.
- Runtime compatibility verdict plumbing is now implemented across the translator factory, server lifecycle surface, and web readiness projection.
- Current evidence proves:
  - `local-llama` search/download/install flow exists,
  - supported GGUF verification passes with Qwen,
  - `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` still fails under `node-llama-cpp@3.18.1`,
  - the failure now surfaces before translation starts as an explicit lifecycle incompatibility message instead of a late opaque crash.
- Focused verification completed:
  - `pnpm typecheck`
  - `pnpm --filter @openspecui/local-llama-translator test`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/translate-service.test.ts`
  - `pnpm verify:llama`
  - `OPENSPECUI_VERIFY_LLAMA_MODEL='tencent/Hy-MT2-1.8B-1.25Bit-GGUF' OPENSPECUI_VERIFY_LLAMA_EXPECT_RECOMMENDED_MODEL='bartowski/Qwen2.5-0.5B-Instruct-GGUF' pnpm verify:llama`
- Release gate verification completed:
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`
  - `openspec validate --all --strict`

## Decisions Taken

- Keep the archived feature change closed; record the remaining runtime-compatibility law as a new loop.
- Treat runtime compatibility as a selected-group verdict, not a model-name special case.
- Reuse the existing lifecycle/assets/readiness surfaces instead of inventing a parallel UI-only error path.
- Keep `prepare()` and the standalone runtime probe aligned on default llama context settings so lifecycle probing and translator creation run under the same baseline assumptions.

## Divergence Notes

- The original feature loop claimed release readiness based on a supported substitute model plus the broader platform chain.
- This new loop exists because the original intake explicitly named Tencent Hy-MT2 as the verification target, and current repo truth still cannot prove that requirement on the shipped runtime baseline.
- Release truth is now narrower and more honest: supported GGUF models remain usable, while unsupported GGUF groups are explicitly blocked until upstream runtime support exists.

## Loopback Triggers

- If the upstream `node-llama-cpp` or `llama.cpp` baseline gains STQ support during this work, re-evaluate whether the compatibility verdict should stay as a blocker or be replaced by a runtime package upgrade.
- If probing model load is too expensive to run synchronously in lifecycle checks, loop back and move the verdict into a dedicated cached background probe path before widening the surface.
