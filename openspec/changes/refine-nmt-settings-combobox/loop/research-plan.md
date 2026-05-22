## Research Findings

- `packages/web/src/routes/settings-translation-panel.tsx` currently renders Engine and NMT Model as separate vertical sections. This preserves functionality but violates the intended perception that NMT Model is part of the NMT engine choice.
- The current engine block shows both a success icon beside the status line and a second explicit `Installed` row/button state. That duplicates the same fact.
- `packages/web/src/components/tooltip.tsx` already provides the tooltip primitive needed for an icon-only installed affordance.
- `packages/server/src/nmt-model-asset-service.ts` currently returns one merged catalog list from `listCatalog()`, combining local and remote results on the server side.
- The user now wants a different law: local inventory and remote search should be two separate sources, with client-side merge and an explicit loading state for the remote part.
- The current NMT download progress uses a horizontal progress bar in the model detail area. That changes the vertical layout and produces visible height jitter.
- The current download plan data contains file paths and total file sizes, but not a structured per-file progress projection. The UI currently only knows total progress plus total bytes.
- The current remote search law is still too coarse for the new requirement: we only have a single result payload, but the user wants a subscription-style search stream that can first render a list and then progressively enrich chips, chip sizes, and detail metadata.
- The current plan still treats a model repository too much like one atomic download unit; the new user requirement wants grouped chips so the user can choose the necessary subset, especially for quantized variants and auxiliary files.
- The current search surface does not yet expose chip-level sizes or a progressive enrichment model, so highly customized repository layouts remain outside the current detection boundary.
- The local NMT discovery cache should store objective fetch metadata, not only normalized/derived catalog rows. This makes the cache larger, but keeps future schema upgrades valuable because derived candidates, chips, and plans can be recomputed from raw provider responses.
- Transformers.js exposes dtype-aware pipeline file resolution through `ModelRegistry.get_pipeline_files(..., { dtype })`, so profile chips can map to a real runtime selection boundary rather than only being presentation labels.

## Decision & Plan (For Approval)

1. Split NMT model discovery into two API surfaces:
   - `nmtModels.listLocal` for persisted/cached local model inventory
   - `nmtModels.searchRemote` for an initial remote candidate list
2. Upgrade remote search to a subscription-style enrich stream:
   - first push a lightweight candidate list so the UI can render quickly
   - then push follow-up updates that add chips, chip sizes, and finer metadata
3. Keep the client responsible for merging local-first plus remote results and for exposing a remote-loading affordance in the popover.
3. Refactor the top Settings engine area so `Engine` and `NMT Model` read as a paired control family when `NMT` is selected, instead of two disconnected sections.
4. Replace the explicit visible `Installed` row with a tooltip-backed status icon when the engine is already installed.
5. Replace the large download progress bar with a stable `Download plan` card header that contains:
   - inline-end circular progress
   - centered percentage text
   - per-file textual progress rows
6. Extend the NMT asset state/log contract with enough file-level progress information for the UI to render per-file lines without reconstructing them heuristically from raw strings.
7. Add a chip-group layer to NMT download planning so a model can be represented as multiple selectable file groups rather than one flat repository download.
8. Treat quantized variants such as int4, int2, and float8 as separate selection targets instead of one forced full-repository download unit.
9. Store raw Hugging Face fetch metadata in a local fetch-cache layer and derive catalog rows, chips, and download plans from that source whenever possible.

## Capability Impact

### New or Expanded Behavior

- Local NMT inventory and remote NMT search are independently queryable.
- The NMT selector can indicate “local truth already available” while remote search is still loading.
- The download-plan card can show compact circular progress and per-file transfer detail.
- Installed state can be communicated by a compact tooltip-backed icon instead of a duplicated text row.
- Remote search can first render candidates and then progressively hydrate them with chips and chip sizes.
- NMT download planning can present explainable file groups, making the minimum necessary download visible before the user commits.
- Local model discovery can survive future data-shape changes because raw provider responses are retained as fetch-cache records.

### Modified Behavior

- Server-side merged catalog response is replaced by separate local and remote list surfaces.
- The Settings translation panel no longer treats the NMT model block as a detached section below the engine block.
- Download progress presentation shifts from a layout-expanding bar to a stable card-header indicator plus textual file rows.
- Model discovery is no longer purely one-shot; it becomes a stream-like enrichment flow for remote search results.
- NMT download choice is no longer a flat full-repo decision when the model can be split into meaningful grouped chips.

## Risks and Mitigations

- Risk: splitting local and remote lists creates duplicate entries or inconsistent sort order.
  Mitigation: merge by model id in the client, keep local entries authoritative, and append only unseen remote ids.

- Risk: file-level progress is not available from the runtime with reliable precision.
  Mitigation: persist a best-effort per-file progress snapshot from monitor events when available, and fall back to size-only rows if a file has no byte progress yet.

- Risk: pairing Engine and NMT Model visually could make the layout brittle on narrow containers.
  Mitigation: keep the paired control inside the existing `@container` layout law and stack within the same family when the container is narrow.

- Risk: tooltip-only installed feedback can become inaccessible.
  Mitigation: keep an accessible name/title on the icon and use the shared tooltip primitive.

- Risk: subscription-style remote search may make the list feel slow or noisy.
  Mitigation: render the candidate shell first, then enrich each item in place and surface loading indicators at chip granularity instead of blocking the whole panel.

- Risk: strict filename-based grouping can miss highly customized repositories.
  Mitigation: keep the current strict naming boundary explicit for now and defer a custom-layout detector to a later change.

- Risk: persisting raw provider metadata increases local cache size.
  Mitigation: treat this cache as a fetch-cache, not primary settings; keep user-facing state derived and allow future pruning without losing installed asset state.

## Verification Strategy

- Update and run focused Settings tests for:
  - no visible duplicate `Installed` text row
  - NMT model control rendered as part of the engine control family
  - remote-loading affordance in the NMT model popover
  - unknown-size option remains disabled after local/remote merge
  - circular progress + file-progress rows in the download-plan card
- Update tests for the search panel to verify debounce behavior, progressive enrichment, and chip-size display.
- Add server coverage for subscription-style search streaming if that interface is introduced in this loop.
- Run focused server tests for split local/remote catalog behavior.
- Run `pnpm --filter @openspecui/server typecheck` and `pnpm --filter @openspecui/web typecheck`.
