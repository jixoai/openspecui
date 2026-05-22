## Research Findings

- The existing translation-engine flow already distinguishes `browser` from service engines, but it previously treated `installEngine('nmt')` as if package install and model readiness were the same thing.
- User expectations require two orthogonal state machines: `engine package state` and `model asset state`. Trying to keep them fused makes cancellation, restart recovery, and UI explanation incoherent.
- `packages/server/src/translation-model-catalog.ts` already provides the remote facts needed for user choice: Hugging Face trending order, language-match signals, and concrete ONNX file-size plans when the repository exposes them.
- `packages/server/src/nmt-model-asset-service.ts` can own the local cache index and runtime cache probing. That is the correct platform boundary for pause/resume/delete and “local models first” ordering.
- `packages/web/src/routes/settings-translation-panel.tsx` already has an engine row and a second row for engine-specific controls. The user’s requested NMT interaction fits naturally there if the selected model becomes the source of truth instead of the last searched candidate.
- Unknown-size models cannot satisfy the product requirement because user choice is explicitly based on trend plus concrete size cost.
- Resume after restart requires deriving resumable local state from actual cached files, not only from an in-memory session flag.

## Decision & Plan (For Approval)

Adopt the platform-law split explicitly:

1. Keep `TranslationEngineService` responsible only for extension package install and service-engine translation entry.
2. Keep `NmtModelAssetService` responsible for model catalog decoration, asset state persistence, cache probing, download, pause, resume, and delete.
3. Sequence `nmtModels.download` and `nmtModels.resume` through `translationEngineService.ensureInstalled('nmt')` so model download always runs on a prepared runtime.
4. Treat partial local cache detection as resumable paused state when no active download session exists.
5. Make the Settings NMT panel bind its detail and action surface to the persisted selected model plus model-state query, not only to the most recent search candidate.
6. Keep remote candidate enrichment optional: if the current selected model has no live candidate object, the UI still shows the model id, known size when resolvable, status, and actions.
7. Update smoke verification to follow the two-stage lifecycle.

## Capability Impact

### New or Expanded Behavior

- NMT model assets have their own persisted lifecycle independent from engine package install.
- The selected NMT model can surface download/pause/resume/delete immediately on Settings load.
- Local partial cache state can be recognized as resumable even after process restart.
- The smoke path validates the real package-plus-model lifecycle.

### Modified Behavior

- `installEngine('nmt')` no longer implies model preparation.
- NMT selector interaction is no longer required before the Download button can appear for the persisted selected model.
- Local development and installed-extension runtime resolution both need to work for NMT asset operations.

## Risks and Mitigations

- Risk: package install root and model runtime resolution diverge.
  Mitigation: resolve installed runtime modules from the same extension install root law used by `TranslationEngineService`.

- Risk: partial cache probing overestimates progress.
  Mitigation: treat file-count-derived progress as resumable hinting, not as stronger truth than an active download session.

- Risk: UI may still depend on ephemeral candidate state.
  Mitigation: make persisted selected model id plus `nmtModels.state` and download plan the primary render inputs.

- Risk: tests keep old fused-install semantics.
  Mitigation: rewrite the stale install-cancel expectation and update the smoke script to the new two-step lifecycle.

## Verification Strategy

- Run typecheck for `@openspecui/core`, `@openspecui/server`, and `@openspecui/web`.
- Run focused server tests for translation engine install semantics and NMT catalog/plan behavior.
- Run focused Settings tests for:
  - browser engine auto-check
  - NMT search and plan display
  - Download button visibility for the persisted selected model
  - unknown-size candidate disabling
- Run the NMT smoke script after code changes when feasible, or leave it updated and report if the full network/model download path was not executed in this turn.
