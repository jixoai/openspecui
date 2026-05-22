## Implementation State

Implementation has started from the approved plan.

Planned execution slices:

1. Split NMT catalog APIs into local inventory and remote search.
2. Extend NMT asset progress payloads with file-level transfer detail.
3. Rebuild the Settings engine/NMT selector area as one paired control family.
4. Replace duplicate installed text with tooltip-backed icon treatment.
5. Move progress presentation into the stable download-plan card header and file rows.
6. Update focused Settings/server tests.
7. Split NMT model state into selected model, draft query, and debounced remote query.
8. Add subscription-style remote search enrichment so candidates can render before chips and sizes are fully hydrated.
9. Extend the NMT plan contract with selectable profile chips/groups while retaining flat `files[]` compatibility for existing runtime state.
10. Add a local fetch-cache layer for objective provider metadata; derived candidates, chips, and plans must remain recomputable projections.
11. Add an NMT provider advanced setting for the Hugging Face-compatible endpoint and route it through catalog search plus model file downloads.
12. Move NMT profile chips out of the download file card and into the NMT Model control family.
13. Verify backend runtime truth by starting an independent server and fetching tRPC endpoints directly, instead of inferring backend behavior from the Settings page.

## Decisions Taken

- This loop is a refinement of the NMT Settings interaction and interface contract, not a rollback of the engine/model lifecycle split.
- The Settings contract now treats `Engine + NMT Model` as one control family: engine selection owns the first slot, and the NMT model chooser becomes the second slot only when the selected engine is `nmt`.
- NMT catalog data stays split by law: `listLocal` and `searchRemote` are separate server APIs, then the client performs local-first duplicate-suppressed composition so local inventory can remain responsive while remote search is still loading.
- Installed state is now single-sourced by icon + tooltip. The action rail no longer repeats a second visible Installed row once the engine is already available.
- Download progress presentation moved fully into a stable `Download files` card header and file rows. Per-file rows now show explicit downloaded bytes, defaulting to `0 B / total` when the transfer has not started yet.
- The next iteration treats local NMT model discovery data as fetch-cache truth. Raw Hugging Face list/detail metadata is persisted separately from download lifecycle state so future grouping/schema upgrades can recompute derived rows without refetching.
- Profile chips are modeled as dtype/profile download groups. User-facing selection should default to the smallest complete profile that has concrete sizes, while keeping unknown-size groups disabled.
- NMT provider endpoint is a per-engine setting (`translationEngines.nmt.hfEndpoint`), not an ambient environment override. The same value now drives Hugging Face catalog URLs, runtime plan metadata fetches, and official `@huggingface/hub` file downloads.
- The model downloader no longer prepares an entire Transformers.js pipeline to trigger implicit downloads. It iterates the selected runtime-derived group files, calls `downloadFileToCacheDir` for each file, mirrors the cached file into the Transformers.js cache layout, and records file-level progress before the final downloaded snapshot.
- Translation Test now treats the source textarea as an optional override: the control starts empty, the visible placeholder follows the selected source language, and an empty Run Test uses the placeholder sample. NMT Run Test validates the selected profile's local file set before creating the Transformers.js pipeline, so missing local files surface as a local-install state error instead of an opaque Hugging Face `fetch failed`.
- Download plan action state is now projected through the currently selected NMT profile group. A downloaded q8 snapshot no longer makes fp16 or another uninstalled chip render as downloaded; the visible button, percentage, file rows, and resume/delete affordances are derived from the selected chip's file set.
- Local-only NMT translation now passes the Transformers pipeline a concrete local model directory instead of the Hugging Face repo id. This prevents Transformers.js startup metadata probes from attempting remote `resolve/main/...` requests during Run Test.
- Profile chips are no longer part of the `Download files` card. They sit directly under the `NMT Model` combobox so the user first chooses a model, then immediately chooses the dtype/profile variant, and only then sees the file manager for that selected chip.
- The NMT Model area no longer repeats provider/model summary lines such as provider endpoint, previous-local summary, download/like counts, or paused text. That information now belongs either in the model chooser options or in the chip/file lifecycle panel.
- Backend interface verification now starts an explicit server instance and uses direct tRPC fetches. The current verified GET batch shape is `input={0:payload}`; wrapping payloads in `{json:...}` is not accepted by this server path.
- `Download files` is a file manager for the selected profile, not a summary preview. It renders the full selected profile file set, including metadata/tokenizer files and profile-specific ONNX files, and constrains height with an internal scroll container instead of truncating rows.
- Runtime plan resolution now writes the Hugging Face repository tree request and response body into the local NMT fetch cache. A model that has started downloading or has completed downloading therefore keeps the raw provider request metadata needed to recompute file groups after future schema upgrades.
- NMT profile chips project local availability from file truth. A profile chip is solid only when that profile's full file set is locally downloaded; not-downloaded, downloading, paused, or otherwise unavailable profile chips render with a dashed border.
- NMT Settings now treats the local inventory response as the first visible truth. If `listLocal` already contains a matching local asset with objective file/plan data, Settings renders that snapshot immediately and does not call `nmtModels.state` or `translationEngines.getModelDownloadPlan` for that model/profile pass.
- The `Download files` card no longer uses synthetic local-ready prose for completed models. Completed, paused, and in-progress local states render objective file rows from the selected profile plus the circular action/progress control.
- Translation Test moved out of the settings flow into a dialog opened by an icon button beside the Engine selector. The source textarea remains empty by default, placeholders follow the selected source language, and empty Run Test submissions use the placeholder sample as the test input.
- Document translation action availability is now projected through a frontend `TranslateService` status. NMT readiness is determined by the selected profile's local file truth, so a downloaded selected NMT group makes document translation ready through the same service-status path as other engines instead of through a separate button-local check.

## Divergence Notes

- Focused verification was scoped to translation settings/server surfaces in this loop: Settings unit tests, server catalog tests, and web/server typecheck. Full CI-equivalent repo gates remain for the PR workflow stage.
- `pnpm verify:nmt` now passes through a real local package install, selected q4f16 model download, final downloaded state, and a live NMT translation. The verifier logs one transient missing fp16 metadata fetch for the sample model, but resolves a concrete runtime plan and completes.
- Direct backend fetch verification against `http://localhost:3187/trpc` confirmed `translationEngines.getModelDownloadPlan` and `nmtModels.state` return different selected file sets for q8 and fp16 on `Xenova/opus-mt-en-zh`; the file card can therefore trust `selectedGroupId` instead of reusing a stale int8/q8 list.
- 2026-05-22 12:26 CST: focused web unit verification passed for `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/components/document-translation-action.test.tsx --project unit` after the local-inventory-first Settings effect and TranslateService action gating changes.

## Loopback Triggers

- If the runtime cannot expose file-level progress with enough stability, loop back and narrow the UI contract before inventing fake precision.
- If the paired Engine/NMT control causes container-layout regressions that cannot be solved within the existing `@container` law, loop back before introducing viewport-bound behavior.
- If Transformers.js cannot reliably prepare a selected dtype/profile through the existing pipeline options, loop back before exposing per-profile downloads as a completed runtime feature.
- If raw provider cache growth becomes material, add retention/pruning policy in a later change rather than dropping the fetch-cache law from this loop.
