## 1. Research and Planning

- [x] 1.1 Intake captured objectively
- [x] 1.2 Research facts recorded
- [x] 1.3 Plan reviewed and approved

## 2. Implementation

- [x] 2.1 Implementation started from approved plan
- [x] 2.2 Progress synchronized with implementation artifact
- [x] 2.3 Unexpected issues loop back to intake/research-plan

## 3. PR and Release Gates

- [x] 3.1 Changeset included for release-impacting package changes
- [ ] 3.2 CI-equivalent local checks passed
- [ ] 3.3 PR checks passed

## 4. Merge Readiness

- [ ] 4.1 OpenSpec archive flow completed
- [ ] 4.2 PR merge approved

## Verification Notes

- 2026-05-29 targeted checks passed:
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/settings.test.tsx`
  - `pnpm --filter @openspecui/core exec vitest run src/runtime-package-manager.test.ts`
  - `pnpm --filter @openspecui/web exec tsc --noEmit`
  - `pnpm --filter openspecui build`
- 2026-05-29 scoped commit checks passed:
  - `git diff --check`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/settings.test.tsx`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec tsc --noEmit`
  - `pnpm --filter @openspecui/core exec vitest run src/translator.test.ts src/runtime-package-manager.test.ts`
  - `pnpm --filter @openspecui/local-translator exec vitest run src/index.test.ts`
  - `pnpm --filter @openspecui/local-ct2-translator exec vitest run src/index.test.ts`
  - `pnpm --filter @openspecui/local-llama-translator exec vitest run src/index.test.ts`
  - `pnpm --filter @openspecui/browser-translator exec vitest run src/index.test.ts`
  - `pnpm --filter @openspecui/openai-completion-translator exec vitest run src/index.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/browser-translation.test.ts src/lib/translate-service.test.ts`
- 2026-05-29 packaged runtime walkthrough passed with `agent-browser --session openspecui-walkthrough-port3111` against `http://localhost:3111/settings#settings-translation`
  - Desktop evidence:
    - `/tmp/openspecui-shots/01-desktop-install-gate-final.png`
    - `/tmp/openspecui-shots/02-desktop-installing-runtime-final.png`
    - `/tmp/openspecui-shots/03-desktop-model-download-final.png`
    - `/tmp/openspecui-shots/04-desktop-post-restart-final.png`
  - Mobile evidence:
    - `/tmp/openspecui-shots/05-mobile-translation-panel-final.png`
    - `/tmp/openspecui-shots/06-mobile-translation-test-final.png`
- Real runtime regression found during walkthrough and fixed in this pass:
  - unresolved engine lifecycle fallback recreated a new probing object every render, which caused a render loop until the backend query resolved
  - install command generation for pnpm needed `--allow-build=onnxruntime-node` instead of the invalid split form
- 2026-05-29 follow-up scoped checks passed:
  - `pnpm --filter @openspecui/core exec vitest run src/config.test.ts src/global-settings.test.ts src/translator.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-runtime-strategy.test.ts src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/resolve-document-translation-config.test.ts src/routes/settings.test.tsx`
  - `pnpm --filter @openspecui/web exec tsc --noEmit`
  - `pnpm --filter @openspecui/server typecheck`
  - `git diff --check`
- 2026-05-29 native process isolation scoped checks passed:
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-runtime-strategy.test.ts src/translation-engine-service.test.ts src/translation-engine-worker.test.ts`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/core exec vitest run src/translator.test.ts`
  - `pnpm --filter @openspecui/server build`
  - `git diff --check`
- 2026-05-29 process lifecycle follow-up scoped checks passed:
  - BDD red state reproduced `disconnect`/`close` parent-generator hangs in `packages/server/src/translation-engine-worker.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-worker.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-runtime-strategy.test.ts src/translation-engine-service.test.ts src/translation-engine-worker.test.ts`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/server build`
  - `git diff --check`
- 2026-05-29 runtime budget follow-up scoped checks passed:
  - BDD red state reproduced Apple Silicon 50% budget collapsing to `0MB` when `availableMemoryMb` was below the OS reserve
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-runtime-strategy.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-runtime-strategy.test.ts src/translation-engine-service.test.ts src/translation-engine-worker.test.ts`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/server build`
  - `git diff --check`
- 2026-05-29 translation settings ownership follow-up scoped checks passed:
  - BDD red state reproduced managed-local lifecycle probing local-llama runtime compatibility during `getLifecycle()`
  - BDD red state reproduced scalar translation preference writes still targeting project config by default
  - BDD red state reproduced OpenAI model writes still double-writing project/global and reading only global model state
  - `pnpm --filter @openspecui/core exec vitest run src/config.test.ts src/global-settings.test.ts src/translator.test.ts`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-runtime-strategy.test.ts src/translation-engine-service.test.ts src/translation-engine-worker.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/resolve-document-translation-config.test.ts src/routes/settings.test.tsx`
  - `pnpm --filter @openspecui/web exec tsc --noEmit`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/server build`
  - `pnpm --filter @openspecui/core typecheck`
  - `git diff --check`
- 2026-05-29 translation engine metadata loading follow-up scoped checks passed:
  - BDD red state reproduced Settings showing `Checking translation engine status.` while `translationEngines.list` was still resolving
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/routes/settings.test.tsx`
  - `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
  - `pnpm --filter @openspecui/web exec tsc --noEmit`
  - `pnpm --filter @openspecui/server typecheck`
  - `git diff --check`
