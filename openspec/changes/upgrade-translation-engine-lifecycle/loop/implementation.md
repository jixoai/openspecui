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
