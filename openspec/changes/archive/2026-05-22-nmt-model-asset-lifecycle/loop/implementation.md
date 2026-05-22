## Implementation State

Implementation is in progress across core/server/web for the NMT asset lifecycle split.

Completed or updated slices in this loop:

1. Added core NMT model asset schemas and catalog result types.
2. Added a dedicated server-side NMT asset store and asset service.
3. Split NMT package install semantics from model asset download semantics.
4. Routed `nmtModels.download` and `nmtModels.resume` through `ensureInstalled('nmt')`.
5. Updated NMT asset state refresh so partial local cache without an active session is treated as resumable paused state.
6. Updated Settings so the selected NMT model can show description, size, status, and Download/Pause/Resume/Delete actions without requiring a fresh search selection.
7. Updated the smoke script to follow the new package-install plus model-download lifecycle.

## Decisions Taken

- The platform truth is `engine package` plus `model asset`, not one merged install session.
- Selected model persistence remains in global settings; per-model asset lifecycle remains in the dedicated local asset index.
- Unknown-size models are kept visible for discovery but disabled for selection/download.
- Local cached models are promoted to the top of the selector list because they represent lower user cost and stronger local truth.
- Restart-derived partial cache is surfaced as resumable state instead of silently dropping back to `not-downloaded`.

## Divergence Notes

- The original local-install cancel expectation no longer matches the platform law because local workspace package verification can complete synchronously. The test now validates immediate installed state instead.
- The Settings model detail panel no longer assumes that a live search candidate object always exists for the selected model; it falls back to persisted model id plus download-plan/state facts.
- Installed runtime resolution in the NMT asset service was tightened so it uses the same extension install root law as engine install, instead of relying on a workspace-only path assumption.

## Loopback Triggers

- If installed-extension runtime resolution still diverges from package-install behavior in real packaged runs, return to research and extract a shared runtime package resolver.
- If Hugging Face plan resolution proves too sparse for practical model choice, return to research before broadening the ranking/catalog law.
- If pause/resume requires byte-accurate persistence beyond file-count-derived probing, return to research and expand the persisted asset state contract.
