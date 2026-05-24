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
