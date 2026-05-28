## Implementation State

- The managed `local-llama` engine is implemented across the shared core/server/web stack.
- The host package boundary owns runtime installation truth for `node-llama-cpp`; the translator adapter keeps the heavy runtime external in tsdown output.
- Managed-local empty search now returns recommended llama GGUF candidates, and the settings panel preserves initial panel truth before auto-refreshing artifacts.

## Decisions Taken

- Keep the install and lifecycle truth shared across managed-local engines, while letting each engine define its own detection and install strategy.
- Treat empty managed-local search as a recommendation path instead of an empty result, so the selector always has a default model suggestion.
- Preserve server truth for loading/download states before any auto-refresh, so the UI does not overwrite loaded or downloading state with a premature refresh.

## Divergence Notes

- The local-llama implementation required a wider shared-panel and test-fixture update than the initial scope implied, because the managed-local abstraction now applies to three engines instead of two.

## Verification Facts

- `pnpm format:check`
- `pnpm lint:ci`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm test:browser:ci`
- `pnpm --filter @openspecui/core test -- src/translator.test.ts src/config.test.ts src/global-settings.test.ts`
- `pnpm --filter @openspecui/server test -- src/translation-engine-service.test.ts src/llama-model-catalog.test.ts`
- `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/resolve-document-translation-config.test.ts src/lib/translate-service.test.ts`
- `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/settings.test.tsx`
- `pnpm verify:llama`
  - `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` downloaded successfully but failed during `node-llama-cpp@3.18.1` model load with `Invalid type or block size`; the packaged `llama.cpp` baseline is `b8390`, which does not support the model's STQ-era quantization.
  - `bartowski/Qwen2.5-0.5B-Instruct-GGUF` with `Qwen2.5-0.5B-Instruct-Q4_K_M.gguf` completed the end-to-end verification flow and produced a non-empty Chinese output.
- Final release polish:
  - normalized document-translation segments before projection so sparse patch results no longer crash on `target` access,
  - kept CT2 panel state in loading mode while first artifact resolution is pending, so the card does not fall back to an empty download-plan view.
  - verification rerun: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci`, plus focused `@openspecui/web` vitest coverage for document translation and settings.

## Follow-up Correction

- The original intake named `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` as the desired local verification model, but real runtime validation showed that this repo's current `node-llama-cpp` baseline cannot load that quantization family yet.
- The release-ready platform truth is therefore:
  - keep Tencent Hy-MT2 as a future compatibility target,
  - switch the default/recommended shipped llama model to a publicly readable GGUF that passes the current runtime,
  - prefer stable `Q4_K_M`-style GGUF groups over smaller but less compatible `IQ*` / `1.25bit` groups when auto-selecting a llama download profile.

## Loopback Triggers

- If another managed-local engine is added, it should reuse the same install/search/panel-state contract rather than reintroducing engine-specific UI branches.
- If runtime installation ownership moves, update the host package boundary first and keep the translator adapter externalized.
