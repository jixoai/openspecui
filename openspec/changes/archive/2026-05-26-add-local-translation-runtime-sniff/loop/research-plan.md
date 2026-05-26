## Research Findings

- `packages/web/src/routes/settings-translation-panel.tsx` currently merges only two sources inside the combobox: `localOptions` first and then `remoteOptions`, with simple first-wins dedupe by model id.
- `packages/server/src/local-model-asset-service.ts` already knows how to synthesize local-only entries from persisted asset state, so the local source can be treated as objective installed truth even when remote metadata is absent.
- `packages/server/src/translation-model-catalog.ts` already provides remote Hugging Face search results and progressive enrichment, but there is no first-class recommended source yet.
- The workspace already contains search infrastructure (`@openspecui/search`) and an existing fuzzy-search dependency (`fuzzysort` in the lockfile), so this loop does not need a new frontend fuzzy library. The user explicitly wants the backend to own search shaping and fuzzy matching.
- The current candidate contract already carries enough shared shape to merge local, remote, and recommended sources under one list, as long as duplicate ids keep the highest-priority position and can still absorb lower-priority metadata such as tags, plan groups, and size.
- Current repo truth for Local-Transformers is ONNX-only: compatibility is projected from `transformers.js` plus `onnx` tags, download plans are built from `onnx/*` files, and the local runtime executes ONNX assets through Transformers.js plus ONNX Runtime.
- Smaller ONNX translation models suitable for recommendation exist today. In particular, `onnx-community/opus-mt-en-zh` and adjacent `opus-mt` language-pair models are much smaller than `Xenova/nllb-200-distilled-600M`, while NLLB remains the broad-coverage fallback.
- The current missing-asset wording still leans on `Unknown size · Size required`, which is weaker than the actual platform boundary: the issue is not generic size absence, but missing required ONNX assets for the current runtime law.
- The user has now fixed several architectural decisions for this loop:
  - runtime verification records are separate from download state
  - the record key is `engineId=local + modelId + selectedGroupId`, with optional repository commit metadata only when cheaply available
  - download completion is the trigger for automatic verification
  - every completed test updates the current record, regardless of whether the test was automatic or manual
  - recommendation generation is intentionally English-first (`opus-mt en-$TARGET_LANG`) because only target language is configured today
  - mixed-source list rows may show source markers, but the list remains one blended surface
  - non-ONNX results should still be visible, but explicitly marked as incompatible with the current local ONNX runtime

## Decision & Plan (For Approval)

1. Keep this loop scoped to the Local-Transformers ONNX runtime path and make that runtime boundary explicit in UI wording and capability semantics.
2. Change the Local-Transformers engine description so it explicitly says ONNX Runtime executes downloaded ONNX files, while Transformers.js is the adapter layer.
3. Replace the search-panel missing-asset wording so it explicitly refers to missing required ONNX files rather than generic unknown size.
4. Refactor the model selector data law to mix three sources in deterministic priority order:
   - local
   - network
   - recommended
5. Keep duplicate model ids as one rendered entry located at the highest-priority source position, but merge useful lower-priority metadata into that retained entry instead of throwing it away.
6. Define empty-query behavior as:
   - all locally available models
   - recommended models generated from:
     - `opus-mt en-$TARGET_LANG`
     - `nllb-200-distilled-600M`
7. Define keyed-query behavior as:
   - locally available models filtered by fuzzy matching
   - network keyword search results
   - recommended models filtered by fuzzy matching
8. Keep recommendation generation deterministic in this loop:
   - use the current target language to form `opus-mt en-$TARGET_LANG`
   - always include `nllb-200-distilled-600M` as the broad fallback candidate
9. Move all selector shaping and fuzzy matching into the backend:
   - local source fuzzy matching
   - recommended source fuzzy matching
   - final three-source merge
   - duplicate collapse with metadata merge
     This keeps the frontend as a thin objective renderer.
10. Keep the planned local runtime sniff flow in the same change:
    - automatic smoke test after selected model group download completes
    - manual translation test completion can correct the current model-group verdict
    - warning chips and warning engine copy reflect the current model-group availability record
11. Store runtime verification separately from asset download state and key it by:
    - `engineId=local`
    - `modelId`
    - `selectedGroupId`
      Optional repository revision metadata may be captured when cheaply available, but it is not required for the loop because re-download plus re-test is the practical recovery path.
12. Treat automatic and manual verification as orthogonal test producers:
    - no priority system
    - the latest completed test updates the current record
13. Trigger automatic verification as the last step of a completed download flow so the user sees “download complete” and “runtime actually works” as one continuous lifecycle.
14. Keep non-ONNX search results visible in network or recommended flows, but mark them as incompatible with the current Local-Transformers ONNX runtime instead of pretending they are selectable peers.

## Capability Impact

### New or Expanded Behavior

- The local model selector gains a third first-class source: deterministic recommended models.
- The selector follows explicit empty-query and keyed-query laws instead of a generic merged list.
- Duplicate model ids from local, network, and recommended sources collapse into a single higher-priority entry while preserving useful merged metadata.
- Local runtime warning state remains tied to the current model group and can be updated by automatic or manual smoke verification.
- The backend becomes the source of truth for fuzzy search, recommendation shaping, and final mixed-source selector rows.

### Modified Behavior

- Local-Transformers copy no longer reads like a generic local Transformers.js runtime; it explicitly describes the ONNX Runtime execution path.
- Missing-asset wording no longer implies only missing size metadata; it now names missing ONNX assets.
- The selector is no longer just local + remote with first-wins merge; it becomes local + network + recommended with priority-aware merge and fuzzy filtering.
- Automatic verification becomes the final phase of a successful download instead of a separate optional user action.
- Manual and automatic translation tests both write the same current model-group verification record.

## Risks and Mitigations

- Risk: a high-priority local entry may hide better metadata from remote or recommended sources.
  Mitigation: merge retained entries structurally so the local row keeps priority position while absorbing remote tags, summary, size, and plan details when they are stronger than local-only placeholders.

- Risk: deterministic recommendation generation may fail for some target-language codes because `opus-mt en-$TARGET_LANG` does not exist.
  Mitigation: treat recommendations as soft candidates; missing recommendation ids should simply drop out without breaking the selector, while `nllb-200-distilled-600M` remains the broad fallback.

- Risk: fuzzy matching can surface noisy local or recommended rows.
  Mitigation: keep matching fields narrow and deterministic in the backend, preferring model id, label, language-related tags, and summary text; cap low-score matches rather than returning everything.

- Risk: backend-owned fuzzy search may tempt this loop into general search-platform work.
  Mitigation: keep the implementation scoped to the local model selector path and reuse existing search primitives or `fuzzysort` without redesigning the broader app search system.

- Risk: ONNX wording becomes accurate but exposes that some search results are incompatible with the current runtime.
  Mitigation: that is acceptable and desirable in this loop; the search surface should become more explicit about the true runtime law instead of hiding it behind generic language.

- Risk: the sniff flow, warning flow, and three-source selector all touch the same translation settings surface and may expand the loop too far.
  Mitigation: keep this loop anchored on a single platform narrative: current Local-Transformers is an ONNX runtime surface, and all selector, warning, and sniff semantics must speak that truth consistently.

## Verification Strategy

- Add or update focused Settings selector tests for:
  - local/network/recommended priority ordering
  - duplicate id merge into the highest-priority entry
  - empty-query results showing local plus deterministic recommendations
  - keyed-query results showing fuzzy-matched local and recommended entries plus network keyword results
- Add or update wording tests for:
  - Local-Transformers engine copy explicitly referencing ONNX Runtime and ONNX files
  - missing-asset text explicitly referring to missing ONNX files
- Add or update smoke-flow tests for:
  - automatic verification after download completion
  - manual translation test completion correcting the current model-group verdict
  - warning chips and warning engine copy reflecting failed verification
- Add or update backend selector-shaping tests for:
  - local/network/recommended mix order
  - metadata merge on duplicate ids
  - empty-query recommendation generation from `opus-mt en-$TARGET_LANG` plus `nllb-200-distilled-600M`
  - keyed-query fuzzy filtering handled entirely by the backend
  - non-ONNX candidates retained but marked incompatible for the current runtime
- Run focused typecheck and unit/component coverage for `@openspecui/core`, `@openspecui/server`, and `@openspecui/web` paths touched by selector semantics and runtime-verdict projection.

## 2026-05-25 Runtime Identity Findings

- `MarianTokenizer` warning is diagnostic noise for this failure mode; it should not drive the fix.
- The failing ONNX Runtime message points at runtime initialization, not at document segmentation or cache rendering.
- Isolated runtime checks showed at least one downloaded profile can fail at ONNX session creation while other downloaded profiles can initialize and translate, confirming the existing law that "downloaded" is not "runtime verified".
- Settings currently initializes local model/profile state primarily from global local engine defaults once global settings are available.
- Document translation resolves project translation config plus global settings, with project `translation.engines.local` values overriding global local defaults.
- Therefore Settings smoke testing can validate `globalSettings.translationEngines.local.selectedGroupId` while document translation later executes `config.translation.engines.local.selectedGroupId`.

## Runtime Identity Decision

The platform law for this fix is:

- A local translation runtime identity is the tuple `engineId`, `model`, `selectedGroupId`, `sourceLanguage`, and `targetLanguage`.
- Settings controls, smoke tests, document availability checks, and document execution must consume the same resolved identity whenever they are speaking about the current document translation runtime.
- Project document translation config remains the project-specific owner; global settings remain only a default source and a cross-project convenience target.
- When Settings mutates the active local model or selected profile, it must persist the mutation into `translation.engines.local` so the document path executes the same identity that Settings just tested.
- Runtime verification records remain separate from this loop and must eventually key verdicts by the same local runtime identity dimensions that affect execution.

## Added Verification Strategy

- Add a Settings test where global local settings point to one model/profile and project document translation config points to another; the local smoke test must call `batchTranslate` with the project-resolved model/profile.
- Add a Settings test where selecting a local profile writes both global local engine defaults and project `translation.engines.local.selectedGroupId`.
- Add a Settings test where committing a local model writes both global local engine defaults and project `translation.engines.local.model`, while clearing the stale selected profile in the project path.

## 2026-05-25 Page Translation Findings

- Previous verification was insufficient for the user's reported workflow because it did not execute the page markdown translation path.
- The two runtime paths differ:
  - Settings smoke test: `SettingsTranslationPanel -> runSingleTranslation -> TrpcTranslator`.
  - Page translation: `DocumentTranslationAction -> useDocumentTranslation -> translateMarkdownDocumentProgressively -> createSourceLanguageDetectionSession -> translatePendingJobsBySourceLanguage -> TrpcTranslatorFactory`.
- Page translation adds runtime dimensions that the previous tests did not cover:
  - markdown segmentation
  - source language detection
  - per-source grouping
  - one translator per detected source-language group
  - adaptive batch workers
- Local verification on this machine produced the following profile-level facts for `onnx-community/opus-mt-en-zh`:
  - `int8-4dc37a` initializes and translates, while still emitting the Marian tokenizer warning.
  - `q4f16-4dc37a` reproduces the reported ONNX Runtime `InsertedPrecisionFreeCast...SimplifiedLayerNormFusion` initialization failure.
- Local verification also showed `onnx-community/opus-mt-en-zh` ignores a requested `targetLanguage=de` in practice and still emits Chinese text, so successful process execution is not sufficient proof that the configured language pair is coherent.
- The current selected model/destination example `onnx-community/opus-mt-en-zh` plus target `de` is directionally invalid. This must be blocked as a platform fact, not left for ONNX Runtime or model output quality to reveal later.

## Page Translation Decision

The immediate platform law is:

- Directional local models must declare or infer their supported language pair.
- The document translation service state must reject a local directional model when the configured target language is incompatible with the model direction.
- The markdown document translation engine must reject each detected source/target pair before creating a translator when the selected local model direction cannot support it.
- Unsupported pairs must become explicit page translation errors or unavailable states; they must not attempt ONNX session creation.
- Runtime verification records remain the long-term law for profile-specific failures such as `q4f16-4dc37a`, but this page-flow fix must first stop invalid language-pair execution and test the actual page path.

## Added Page-Flow Verification Strategy

- Add core tests for local directional model language-pair inference.
- Add translate-service tests proving `onnx-community/opus-mt-en-zh` plus target `de` is unavailable before local asset readiness can claim ready.
- Add browser-translation tests proving detected source-language groups that do not match the selected directional local model are marked as errors without calling `engine.factory.create`.
- Keep the tests profile-agnostic; no test should hard-code `q4f16` as a special product rule.
