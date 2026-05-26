## User Input

- Local-Transformers mode should describe itself as an ONNX Runtime-based local adapter with ONNX model files, not as a generic Transformers.js local runtime.
- The model search UI should replace `Unknown size · Size required` with wording that more accurately means the model cannot find the required ONNX files.
- The change should still support the planned local runtime sniff flow after download completion and manual translation test completion.
- Refactor the search panel to mix three data sources in this priority order: local, network, recommended.
- If the same model appears in multiple sources, merge it into the highest-priority source entry automatically.
- When the search keyword is empty, show all locally available models plus the recommended list generated from `opus-mt en-$TARGET_LANG` and `nllb-200-distilled-600M`.
- When the search keyword is present, show fuzzy-matched local models, network keyword search results, and fuzzy-matched recommended models.

## Objective Scope

- Refine the visible language for the Local-Transformers engine to emphasize ONNX Runtime and ONNX assets.
- Refine local model availability wording so missing ONNX files are described explicitly.
- Keep the scope aligned with the existing local model sniffing and verification flow for selected model groups.
- Add deterministic three-source search mixing and duplicate merge rules for the local model selector.
- Add the empty-query and keyed-query result laws for local, network, and recommended model sources.

## Non-Goals

- Do not introduce support for non-ONNX local model formats in this loop.
- Do not change the model selection or download mechanics beyond the wording and capability semantics needed for the sniff flow.
- Do not add historical compatibility records beyond the current selected model group verdict.
- Do not add a generalized recommendation service beyond the deterministic `opus-mt en-$TARGET_LANG` plus `nllb-200-distilled-600M` rule.

## Acceptance Boundary

- The Local-Transformers description clearly states that ONNX Runtime executes ONNX files.
- The model search UI no longer uses `Size required` wording for missing local assets.
- The missing-asset state explicitly refers to absent ONNX files.
- The wording changes remain compatible with the existing local runtime sniff and availability record flow.
- The search panel mixes local, network, and recommended sources in the required priority order.
- Duplicate models are represented once, at the highest-priority position, without losing useful metadata from lower-priority sources.
- Empty-query results show locally available models plus the deterministic recommended set.
- Keyed-query results show fuzzy-matched local entries, network keyword results, and fuzzy-matched recommended entries.

## 2026-05-25 Runtime Identity Loopback

### User Input

- Local model translation smoke testing can pass, but document translation fails when the document translation path starts.
- The visible warning was `WARNING: MarianTokenizer is not yet supported by Hugging Face's "fast" tokenizers library. Therefore, you may experience slightly inaccurate results.`
- The runtime failure was an ONNX Runtime session initialization exception referencing `InsertedPrecisionFreeCast_/layers.5/self_attn_layer_norm/Constant_output_0` and `/layers.0/self_attn_layer_norm/Mul/SimplifiedLayerNormFusion/`.
- The user asked to investigate first without writing code, then asked to use OpenSpec to advance the fix.

### Objective Facts

- The Marian tokenizer warning is not the root cause; it is emitted on Marian models even when other local profiles can initialize and translate.
- The ONNX Runtime error is a real runtime incompatibility for at least one local profile, so file download state and runtime usability remain separate platform facts.
- Settings smoke testing and document translation can currently use different resolved local runtime identities when project translation config and global local engine defaults disagree.
- The observed local state included a project config local `selectedGroupId` that differed from the global local `selectedGroupId`, so a smoke test could validate one profile while document translation executes another.
- The document translation target language can also disagree with the selected local model direction, which is a separate identity coherence risk.

### Acceptance Addendum

- Settings local model controls, local profile controls, and the translation smoke test must use the same resolved local runtime identity that document translation will use.
- Local model/profile changes made in Settings must update the project document translation config path as well as any global local engine defaults that remain useful for cross-project defaults.
- The fix must not special-case a failing profile such as `q4f16`; profile failures belong to the runtime verification record law, not UI fallback glue.

## 2026-05-25 Page Translation Loopback

### User Input

- The user restarted and still observed the same problem.
- The user reported that `Test Translate` works, but page translation fails as soon as document translation starts.
- The user asked whether the previous testing was sufficient, whether the test page workflow was fully verified, and whether `Test Translate` and page translation truly share the same code.

### Objective Facts

- `Test Translate` and page translation are not the same execution path.
- `Test Translate` calls `runSingleTranslation` with one user-selected source language and one sample string.
- Page translation calls `translateMarkdownDocumentProgressively`, extracts markdown segments, runs document and segment language detection, groups pending jobs by detected `sourceLanguage`, and creates translators per detected source language.
- The local runtime identity therefore includes `sourceLanguage` and `targetLanguage`, not only `engineId`, `model`, and `selectedGroupId`.
- Local machine verification reproduced the reported ONNX Runtime initialization error for `onnx-community/opus-mt-en-zh` with profile `q4f16-4dc37a`.
- The same local machine verification initialized and translated with profile `int8-4dc37a`, while emitting the Marian tokenizer warning. The tokenizer warning is therefore not the failing cause.
- The current project config can combine target language `de` with directional model `onnx-community/opus-mt-en-zh`, which is an incompatible model direction even when the model profile can initialize.

### Acceptance Addendum

- Page translation must not execute a local directional model for an unsupported source/target pair.
- Translation availability must surface local model direction mismatch before starting page translation when the target language is incompatible with the selected directional model.
- Page-flow tests must cover the markdown translation path, including segment language detection and per-source translator creation.
- Settings smoke testing must be treated as a single-pair smoke test unless it exercises the same markdown document translation path.
