## Implementation State

Current implementation is now aligned to OpenSpec loop tracking. Work starts from the approved platform-upgrade plan and uses `6417ec9 feat(translation): add local ct2 engine` as the code baseline.

Immediate implementation order:

1. Upgrade the core translation engine contract to expose lifecycle truth and descriptor metadata.
2. Migrate server install/probe orchestration to the descriptor-driven lifecycle flow.
3. Rework Settings Translation install gate and managed-local shared UI to consume lifecycle truth instead of single install status.
4. Extend focused tests into BDD acceptance coverage.
5. Run scoped verification and record self-review checkpoints before commit.

## Decisions Taken

- Use OpenSpec `opsx-collab-pr-loop` artifacts as the single source of truth for this implementation, instead of keeping the plan only in chat history.
- Keep `openspecui` as the runtime host truth for optional dependency installation and detection.
- Treat `browser` as an engine with `not-applicable` install/runtime dependency semantics instead of special-casing it outside the lifecycle platform.
- Treat `local` and `local-ct2` as shared `managed-local` engines with per-engine adapters, not two independent platform implementations.
- Keep BDD and self-review artifacts inside this loop so implementation can be corrected without drifting from the original objective.

## Divergence Notes

- The original plan proposed a full shared base-class extraction for both managed-local asset services. During execution, only the shared contract/helper boundary will be extracted unless implementation proves a full merge is low-risk. This keeps the loop focused on lifecycle law first.
- `ctranslate2` companion package publishing may need staged follow-up if the current repo does not already contain the per-platform package scaffolding. In that case, this loop must still close the manifest/loader/runtime truth and add explicit unsupported behavior instead of pretending full coverage.

## Loopback Triggers

- If lifecycle contract migration reveals a missing spec truth for web or server behavior, return to `loop/intake.md` and `loop/research-plan.md` before continuing.
- If `ctranslate2` publish law cannot be closed without adding new publishable packages, record the exact blocker and split the remaining publish automation into a follow-up change rather than shipping a false multi-platform claim.
- If Settings Translation requires file splitting beyond current user tolerance, pause and confirm the split boundary before creating extra files.

## 2026-05-27 16:44 CST Progress

- Completed the focused BDD migration from legacy `installStatus` fixtures to lifecycle semantics across the current verification slice.
- Updated test fixtures and mocks so web/runtime checks now use:
  - `translationEngines.getLifecycle`
  - `TranslationEngineLifecycleStatus`
  - `TranslationEngineLifecycleEvent.lifecycle`
  - managed-local `panelState` instead of legacy local asset `state` assertions where the runtime precheck now owns the entry path
- Kept production code law unchanged in this slice; the work here was to align tests with the already-migrated lifecycle platform and confirm the current behavior truth.

Focused verification completed:

- `pnpm --filter @openspecui/core exec vitest run src/translator.test.ts`
- `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
- `pnpm --filter @openspecui/web exec vitest run src/lib/translate-service-status.test.ts src/components/document-translation-action.test.tsx --project unit`
- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`

Key findings from this self-review loop:

- `getTranslationEngineLifecycleMessage(...)` correctly prioritizes runtime readiness/failure over dependency copy when runtime state is present; the previous core/web assertions were stale.
- Document translation readiness now depends on the lifecycle precheck first, then managed-local `panelState`; tests that still asserted `localModels.state` as the primary call path were invalid.
- `settings.test.tsx` still contained extensive legacy install-only fixtures. A test-only compatibility layer was added to normalize legacy `installStatus` fixtures/events into lifecycle truth so the suite can converge without reintroducing platform regressions into production code.

## 2026-05-27 19:49 CST Progress

- Started the near-production runtime walkthrough by building `openspecui`, packing the published host shape, and installing it into an isolated temp directory with a clean `HOME`.
- The first real npm-host install exposed a packaging law violation: the `// ...` documentation keys had been placed inside `dependencies` / `optionalDependencies`, which made `npm install` fail with `EINVALIDPACKAGENAME`.
- Corrected the packaging law by moving those `// ...` documentation keys to top-level `package.json` fields while keeping the dependency maps machine-parseable for npm/pnpm host installs.
- Repacked the host tarball and resumed verification from the isolated npm host path so the remaining browser walkthrough can continue from a package-manager-valid baseline.

## 2026-05-27 20:24 CST Progress

- The near-production browser walkthrough exposed a real managed-local page-flow gap: selecting a first-time remote model could leave Settings stuck on `No runtime download plan available.` even though the model selection UI expected to move directly into download planning.
- Closed that gap by upgrading the shared managed-local selection path so `markSelected` now returns hydrated `panelState` truth for both `local` and `local-ct2`, while still keeping explicit artifact refresh endpoints available for manual revalidation.
- Updated `settings-translation-panel.tsx` to seed the managed-local query cache from the selection result, including both the requested selector key and the resolved profile key, so the UI no longer loses the first hydrated download plan to a query-key race.
- Added symmetric BDD coverage for this law:
  - `packages/server/src/local-model-asset-service.test.ts`
  - `packages/server/src/ct2-model-asset-service.test.ts`
  - strengthened `packages/web/src/routes/settings.test.tsx` to simulate the real first-selection race instead of assuming `panelState` is already hydrated

Focused verification completed:

- `pnpm --filter @openspecui/server exec vitest run src/local-model-asset-service.test.ts src/ct2-model-asset-service.test.ts src/translation-engine-service.test.ts`
- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`

## 2026-05-27 22:05 CST Progress

- Continued the near-production packaged-host walkthrough from the freshly packed `openspecui` tarball and simulated the real first-launch missing-runtime state by deleting:
  - `node_modules/@huggingface/transformers`
  - `node_modules/onnxruntime-node`
  - `node_modules/onnxruntime-common`
  - `node_modules/onnxruntime-web`
- The real browser walkthrough exposed a second managed-local handoff gap: after runtime installation completed, the active Settings panel could still land on `No runtime download plan available.` because `panelState` only projected existing asset truth and did not create the profile manifest for the already-selected default model.
- Closed that gap by changing the install-success handoff from a read-only `panelState` refresh to the shared managed-local `refreshArtifacts` path, then caching the returned `panelState` truth through the existing lifecycle/UI cache helper.
- Added a BDD regression that starts from a missing-runtime local engine, completes the install stream, and asserts the UI moves directly into `Download model` instead of staying stuck on `No runtime download plan available.`.
- Re-ran the packaged host acceptance after the fix and verified the complete desktop lifecycle:
  - first launch shows the runtime install gate
  - install log streams inside the bounded `pre` card
  - runtime-ready handoff immediately shows the managed-local model card with download groups and file plan
  - model download reaches the completed state without manual refresh
  - server restart preserves the downloaded state
- Captured final walkthrough evidence under:
  - `tmp/translation-lifecycle-walkthrough/desktop/01-desktop-missing-runtime.png`
  - `tmp/translation-lifecycle-walkthrough/desktop/02-desktop-installing-runtime-log.png`
  - `tmp/translation-lifecycle-walkthrough/desktop/03-desktop-runtime-ready-model-panel.png`
  - `tmp/translation-lifecycle-walkthrough/desktop/04-desktop-model-downloading.png`
  - `tmp/translation-lifecycle-walkthrough/desktop/05-desktop-model-downloaded.png`
  - `tmp/translation-lifecycle-walkthrough/desktop/06-desktop-restart-ready.png`
  - `tmp/translation-lifecycle-walkthrough/mobile/01-mobile-translation-top.png`
  - `tmp/translation-lifecycle-walkthrough/mobile/02-mobile-translation-files.png`

Focused verification completed:

- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`
- `pnpm --filter openspecui run build`
- `pnpm pack --pack-destination /tmp/openspecui-walkthrough-pack`

## 2026-05-27 22:42 CST Progress

- User walkthrough exposed two shared managed-local/document-translation regressions after the earlier lifecycle landing:
  - `local-ct2` could render an empty `Download files` card during initial artifact hydration instead of a loading state.
  - document translation could still crash on `segment.target` when progressive patches produced sparse `segments` and later updates materialized explicit `undefined` entries.
- Closed the managed-local loading gap by promoting `asset.profileLoad.status === 'loading'` into the shared local-plan loading law, and by teaching `LocalDownloadFilesCard` to render the profile/artifact loading message when the selected asset has no resolved plan/files yet.
- Closed the translation crash in two layers:
  - `use-document-translation` now preserves sparse patch arrays with `slice()` instead of expanding holes into explicit `undefined`.
  - `document-translation-action` now normalizes translation segments before projecting headings/block annotations, so external result sources cannot crash the renderer with undefined entries.
- Added focused BDD regressions for both failures:
  - `packages/web/src/routes/settings.test.tsx` now asserts the `local-ct2` selected model shows a loading state during artifact hydration instead of `No runtime download plan available.`
  - `packages/web/src/components/document-translation-action.test.tsx` now reproduces out-of-order progressive patches and asserts the viewer keeps rendering until the final translation result lands.

Focused verification completed:

- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`
- `pnpm --filter @openspecui/web exec vitest run src/components/document-translation-action.test.tsx --project unit`
- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/components/document-translation-action.test.tsx --project unit`
- `git diff --check`

## 2026-05-28 01:36 CST Progress

- Release close-out surfaced three stale tests whose expectations still reflected pre-lifecycle dependency law instead of the current runtime-host model:
  - `packages/web/src/lib/translate-service.test.ts` expected only one `checking` update before managed-local readiness, but the lifecycle precheck now emits runtime checking before local asset checking.
  - `packages/server/src/local-model-subscription-transport.test.ts` overfit the integration path to exactly two encoder fetch attempts, while the real transport contract is successful auto-resume with continued client progress events.
  - `packages/cli/src/native-runtime-dependencies.test.ts` still required every native runtime to live in hard `dependencies`, even though `ctranslate2` is now intentionally host-owned via `optionalDependencies`.
- Kept production law unchanged for this slice and narrowed the fixes to test/readiness semantics plus one lint-only cleanup in `packages/server/src/runtime-package-host.ts`.

CI-equivalent local verification completed:

- `pnpm format:check`
- `pnpm lint:ci`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm test:browser:ci`

## 2026-05-28 03:10 CST Progress

- Continued the release-prep loop at the native runtime package boundary instead of starting formal publish.
- Verified locally that `napi.binaryName = ct2` now regenerates the loader and native artifact names onto the `ct2.*` surface:
  - `packages/ct2-engine/index.js` now resolves `ct2.<platform>.node`
  - local build output now includes `ct2.darwin-arm64.node`
- The first pack dry-run exposed a packaging-law leak: legacy `index.*.node` artifacts still matched `"*.node"` and were silently included in the `ctranslate2` tarball alongside the new `ct2.*` output.
- Closed that leak by narrowing the publish file surface to `ct2.*` only, and by adding a focused package-shape regression in `packages/ct2-engine/test/smoke.test.ts` so future name migrations cannot silently reintroduce `index.*` artifacts into the npm tarball.
- This closes the manifest/loader alignment slice truthfully, but the multi-platform publish law remains intentionally open until release automation can build and aggregate every supported addon target.

Focused verification completed:

- `pnpm --filter ctranslate2 build`
- `pnpm --filter ctranslate2 test`
- `cd packages/ct2-engine && npm pack --json --dry-run`

## 2026-05-28 03:38 CST Progress

- Promoted the native package truth from an implicit `package.json.napi` detail into an explicit release law:
  - `packages/ct2-engine/napi.config.json` now declares the supported native target matrix as a dedicated source of truth.
  - `packages/ct2-engine/index.js` is now a stable handwritten entrypoint that:
    - normalizes `NAPI_RS_FORCE_WASI` so falsey string values no longer accidentally force the WASI branch
    - rejects unsupported runtime targets before entering the generated binding loader
  - `packages/ct2-engine/runtime-support.js` now owns support-matrix parsing and runtime target detection, so unsupported platforms fail with an explicit error instead of falling through to opaque loader noise.
- Added reusable publish/release helpers so the workflow and publish step consume the same NAPI artifact truth:
  - `scripts/lib/publish-packages/napi-artifacts.ts` verifies every declared native target artifact exists before publish
  - `scripts/lib/ctranslate2-release.ts` derives the GitHub Actions matrix from `napi.config.json` and verifies the aggregated package surface before publish
- Upgraded `.github/workflows/release.yml` from a single Ubuntu publish job into:
  - a `ctranslate2` matrix-planning job
  - per-target native build jobs
  - a publish job that downloads the aggregated `ct2.*.node` artifacts and refuses to publish if any declared target is missing
- Kept the current support matrix explicit and conservative:
  - `linux-x64-gnu`
  - `win32-x64-msvc`
  - `darwin-x64`
  - `darwin-arm64`
- Confirmed locally that the published tarball surface remains on the intended package law:
  - includes `binding.js`, `runtime-support.js`, `napi.config.json`, `ct2.*.node`
  - excludes stale `index.*.node` native artifacts even if they still exist in the local working tree

Focused verification completed:

- `pnpm --filter ctranslate2 build`
- `pnpm --filter ctranslate2 test`
- `pnpm test:root`
- `pnpm format:check`
- `pnpm lint:ci`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm test:browser:ci`
- `git diff --check`
- `CHANGESET_CHECK_BASE_SHA=$(git merge-base HEAD origin/main) pnpm changeset:check`
- `cd packages/ct2-engine && npm pack --json --dry-run`
- `bun ./scripts/lib/ctranslate2-release.ts matrix`
