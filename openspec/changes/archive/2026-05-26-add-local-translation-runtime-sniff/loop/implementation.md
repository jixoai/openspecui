## Implementation State

Implementation is now in progress for the local translation runtime and Settings
Translation surface.

Completed code work in this implementation pass:

- Local model profile state now has a server-owned single truth:
  - `TranslationDownloadGroupPlan.status` is part of the shared contract.
  - `LocalModelAssetService.readSelectedModelState(modelId, selectedGroupId)`
    resolves the selected profile, profile file list, top-level asset status,
    per-file progress, and every profile chip status from the same runtime/persisted file set.
  - `localModels.panelState` returns the selected asset plus the resolved
    download plan so the frontend does not merge separate state/plan truths.
- Local model profile chip rendering is now a pure projection:
  - `group.selected` controls solid vs dashed border.
  - `group.status` controls green/blue/default tone.
  - The frontend no longer derives profile status from file byte progress,
    active selected group, catalog options, or client-side file sharing rules.
- Local profile switching now keeps the last server `panelState` snapshot visible
  while the next selected profile snapshot is resolving. This preserves the
  server-owned single truth without letting the Settings UI collapse into an
  empty loading state between two valid server snapshots.
- Download Files now reads the same selected server profile truth as the chips.
- Local download log subscription invalidates/refetches `panelState` instead of
  synthesizing local model state in the browser.
- The `not-downloaded` state after deleting local files now still carries the
  runtime download plan, selected group, total bytes, and zeroed file list. This
  keeps the Local panel renderable after deletion without falling back to a
  second catalog-derived truth.
- Download session teardown is explicitly guarded by session identity. Pausing
  or deleting an active download aborts the stream, and a later-settling old task
  cannot overwrite the paused/deleted server state.
- Local profile status is now independent from the currently selected profile.
  Changing `selectedGroupId` only changes which chip is solid and which file list
  is displayed; it does not erase another profile's `downloading`, `paused`, or
  `downloaded` status.
- Document translation availability now resolves project + global translation
  config before rendering document translation controls.
- Local translator batch translation now calls the underlying pipeline with the
  full input array and maps generator outputs back by index.
- Browser/document translation batching now groups pending segments by source
  language, accepts out-of-order batch outputs, and records adaptive concurrency
  metrics in a bounded global log.

Focused tests added or updated:

- Server local model asset tests cover:
  - downloaded profiles remaining independently green
  - an active profile download not leaking status to another selected profile
  - shared auxiliary files not causing another profile to look partially downloaded
  - paused state surviving a later-settling aborted download stream
  - deleted state surviving a later-settling cancelled download task
  - runtime download plan/file list remaining available after local deletion
  - a downloading profile remaining `downloading` after another profile is
    selected before file-level ONNX progress exists
- Server tRPC transport tests cover:
  - byte-level download progress delivered through a real WebSocket client
  - retryable stream auto-resume progress delivered through a real WebSocket client
  - pause then resume lifecycle events delivered through a real WebSocket client
  - delete during an active download delivering `deleting -> not-downloaded`
    without a later bogus `downloaded` event
- Web Settings tests cover:
  - server `panelState` as the Local panel source
  - profile chips using border style for selection and color for status
  - Download Files switching only after server profile truth changes
  - downloaded profile chips staying green even when a different profile is selected
  - Local profile chips and Download Files remaining visible while a new
    `panelState` request is still pending after chip selection
  - subscription logs not being allowed to synthesize a completed UI unless the
    refreshed server `panelState` says the model is downloaded
  - download, pause, resume, complete, delete, and deleting UI states driven from
    server panel snapshots
- Web document translation tests cover local readiness after switching away from
  an unavailable Browser engine.
- Browser translation tests cover batch output reordering and adaptive concurrency log recording.

## Decisions Taken

- Keep the profile lifecycle law server-owned. The frontend may render and request
  a profile selection, but it must not compute profile status from local files or
  catalog entries.
- Treat `localModels.panelState` as the Settings Translation panel source of truth.
- Preserve existing `localModels.state` for compatibility with older call sites,
  but migrate new panel behavior to `panelState`.
- Keep download state and runtime verification as separate concepts. This pass
  strengthens download/profile truth; runtime sniff warnings remain part of the
  broader change scope and are not overclaimed here.
- Keep the current OpenSpec change active. PR checks, archive, and merge are not
  complete in this checkpoint.

## Verification Performed

- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`
  - Passed: 38 tests after lifecycle hardening.
  - Re-run after the Local profile switch regression fix: passed 36 tests.
- `pnpm --filter @openspecui/server exec vitest run src/local-model-asset-service.test.ts src/local-model-subscription-transport.test.ts`
  - Passed: 21 tests after lifecycle, subscription, and cross-profile status
    BDD coverage.
- `pnpm --filter @openspecui/server exec vitest run src/local-model-asset-service.test.ts src/translation-engine-service.test.ts`
  - Passed: 18 tests.
- `pnpm --filter @openspecui/core typecheck`
  - Passed.
- `pnpm --filter @openspecui/server typecheck`
  - Passed.
- `pnpm --filter @openspecui/web typecheck`
  - Passed.
- `pnpm --filter @openspecui/local-translator typecheck`
  - Passed.
- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/components/document-translation-action.test.tsx src/lib/browser-translation.test.ts src/lib/resolve-document-translation-config.test.ts src/lib/translation-adaptive-concurrency-log.test.ts --project unit`
  - Passed: 73 tests.
- `pnpm --filter @openspecui/local-translator test -- src/index.test.ts`
  - Passed: 7 tests.
- `git diff --check`
  - Passed.
- Rendered page walkthrough for `http://127.0.0.1:3231/settings?_b=%2F#settings-translation`
  against backend `http://127.0.0.1:3230`:
  - In-app Browser plugin was unavailable with `Browser is not available: iab`, so
    validation used package Playwright fallback.
  - Page heading, `Local-Transformers`, `Local Model`, and `Download files` rendered.
  - `Open translation test` button rendered with `bg-primary`.
  - Local profile chips rendered directly from server `panelState` data:
    selected profile used `border-solid`, unselected profiles used `border-dashed`,
    downloaded profiles used emerald text, and not-downloaded profiles stayed neutral.
  - The local cache inspected during the walkthrough only contained the
    `bnb4` and `q8` ONNX profile files for `onnx-community/opus-mt-en-zh`; `q4`
    and `q4f16` were correctly neutral because their ONNX files were absent from
    the server-owned cache truth.

## Pending Verification

- PR checks, archive flow, and merge approval.

## Loopback Notes

- The original research plan also covers backend-owned recommended-source model
  selector shaping and runtime sniff warning records. Those broader items should
  remain in the change scope, but this implementation pass intentionally focuses
  on the profile lifecycle truth conflict that was blocking Settings Translation.
- If later work adds recommendation/fuzzy selector shaping, keep it backend-owned
  and do not reintroduce client-side state mixing for profile status.

## 2026-05-25 Runtime Identity Follow-Up

Implementation is reopening because investigation found a second truth split:
Settings smoke tests and document translation can resolve different local runtime
identities when project translation config and global engine defaults disagree.

Planned code work:

- [x] Reuse the existing document translation resolver in Settings so the Settings
      panel initializes local model/profile state from the document-effective config.
- [x] Keep global local settings as defaults, but treat project
      `translation.engines.local` as the active document runtime owner when present.
- [x] Persist local profile selections into both global local engine defaults and
      project document translation config.
- [x] Persist local model commits into both global local engine defaults and project
      document translation config, clearing stale project selected profiles for the
      new model.
- [x] Keep the fix profile-agnostic; no profile-specific failure fallback belongs in
      this layer.

Focused tests to add before implementation:

- [x] Project local model/profile overrides global local defaults for Settings smoke
      tests.
- [x] Local profile selection writes the document translation local profile.
- [x] Local model commit writes the document translation local model and clears the
      document translation local selected profile.

Completed code work in this follow-up:

- Settings now resolves the document translation config through the existing
  `resolveDocumentTranslationConfig` helper before initializing local model and
  profile state.
- The Settings local panel, smoke test, and profile query now prefer the
  document-effective local model/profile over global defaults.
- Local model commits write both global local defaults and project
  `translation.engines.local.model`.
- Local profile selections write both global local defaults and project
  `translation.engines.local.selectedGroupId`.
- Config and global settings patch types now allow `selectedGroupId: null` as an
  explicit deletion sentinel, while persisted/read config remains optional and
  null-free.

Focused verification performed for this follow-up:

- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx --project unit`
  - Passed: 42 tests.
- `pnpm --filter @openspecui/core test -- src/config.test.ts src/global-settings.test.ts -t "clear"`
  - Passed: 295 tests across the filtered run.
- `pnpm --filter @openspecui/server exec vitest run src/router.test.ts -t "globalSettings|config.update|translation"`
  - Passed: 3 selected router tests.
- `pnpm --filter @openspecui/web exec vitest run src/lib/resolve-document-translation-config.test.ts src/lib/translate-service.test.ts --project unit`
  - Passed: 2 tests.
- `pnpm --filter @openspecui/core typecheck`
  - Passed.
- `pnpm --filter @openspecui/server typecheck`
  - Passed.
- `pnpm --filter @openspecui/web typecheck`
  - Passed.

## 2026-05-25 Page Translation Reopen

Implementation is reopening again because the user's restarted app still fails on
the real page translation path. The previous follow-up only proved Settings and
document translation share model/profile resolution; it did not prove they share
the same source/target execution plan.

Reproduced runtime facts:

- `onnx-community/opus-mt-en-zh` with `int8-4dc37a` initializes and translates
  locally, while emitting the known Marian tokenizer warning.
- `onnx-community/opus-mt-en-zh` with `q4f16-4dc37a` reproduces the reported
  ONNX Runtime `InsertedPrecisionFreeCast...SimplifiedLayerNormFusion`
  initialization error.
- `onnx-community/opus-mt-en-zh` with requested target `de` still produces
  Chinese output, proving a successful smoke run does not validate model
  direction coherence.

Planned code work:

- [x] Add a core helper that infers supported language pairs for directional
      local model ids such as `opus-mt-en-zh`.
- [x] Make local document translation availability reject target languages that
      conflict with an inferred directional local model.
- [x] Make markdown document translation reject detected source/target groups
      that conflict with the selected local model direction before creating a
      translator.
- [x] Add page-flow tests for detected source-language grouping and unsupported
      local model directions.
- [x] Re-run focused web/core checks for the page translation path.

Completed code work in this follow-up:

- Added `@openspecui/core/translation-language-pair` as a core platform helper
  for inferring directional local model pairs such as `opus-mt-en-zh`.
- Local document translation availability now rejects incompatible directional
  model targets before claiming local files are ready.
- Settings smoke tests now use the directional local model source language when
  the selected local model and target language form a coherent pair. For example,
  `Xenova/opus-mt-no-de` now tests `no -> de`, not `en -> de`.
- `runSingleTranslation` now rejects unsupported local source/target pairs before
  opening a server translator.
- Page markdown translation now rejects unsupported detected source/target groups
  before creating a translator. The affected segments become explicit translation
  errors instead of attempting ONNX session creation.
- Server-side `translationEngines.batchTranslate` enforces the same local
  directional model law so callers cannot bypass the frontend check.

Focused verification performed for this follow-up:

- `pnpm --filter @openspecui/core test -- src/translation-language-pair.test.ts`
  - Passed: 30 files, 299 tests in the filtered core run.
- `pnpm --filter @openspecui/server exec vitest run src/translation-engine-service.test.ts`
  - Passed: 9 tests.
- `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/lib/translate-service.test.ts src/lib/browser-translation.test.ts src/components/document-translation-action.test.tsx --project unit`
  - Passed: 86 tests.
- `pnpm --filter @openspecui/core typecheck`
  - Passed.
- `pnpm --filter @openspecui/server typecheck`
  - Passed.
- `pnpm --filter @openspecui/web typecheck`
  - Passed.
- `git diff --check`
  - Passed.
