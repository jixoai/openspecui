## Implementation State

- Status: planned, not yet implemented in code.
- Intake and research-plan are complete and approved enough to begin implementation work.
- Current code still contains the old model-level local asset state and mixed profile/lifecycle plan storage.
- Implementation must proceed as a platform-law refactor, not a UI-only chip styling patch.

Proposed execution order:

1. Core schema and state model
   - Introduce profile manifest and lifecycle state types.
   - Add versioned group identity based on full resolved Git commit hash plus short display suffix.
   - Preserve raw repository request metadata as fetch-cache truth.
   - Mark old top-level model lifecycle fields as migration/projection-only or replace them where feasible.

2. Server stores and profile refresh
   - Add profile manifest persistence separate from local lifecycle state.
   - Implement refresh for the selected LocalModel only.
   - Resolve and persist full commit hash during profile creation.
   - Surface profile loading and profile parse failure states.

3. Isolated group filesystem layout
   - Add deterministic group root paths, including versioned group id.
   - Store/download all files for a profile inside that profile's folder.
   - Do not deduplicate shared files across groups.

4. Group-scoped lifecycle APIs
   - Change download, pause, resume, and delete to accept `{ modelId, groupId }`.
   - Key sessions by `modelId + groupId`.
   - Allow concurrent group downloads.
   - Implement group-folder reconciliation before read/resume.
   - Delete aborts related download/translation references and removes only the target group folder/state.

5. Settings and panel behavior
   - Make global settings the single source for selected LocalModel/groupId.
   - Remove project-config writes for selected local model/group where they are acting as authority.
   - Chip switching updates selection only and never recomputes unrelated group status.
   - Add refresh icon button to Local Model title inline-end.

6. Translation lifetime hardening
   - Make `batchTranslate` use immutable runtime snapshot and scoped pipeline lease semantics.
   - Ensure deleting an in-use group aborts related translation work before file removal.
   - Add document translation generation ids and stale patch rejection.

7. Verification and migration
   - Add server tests before changing behavior where possible.
   - Add web tests for chip colors, refresh states, delete selection clearing, and document generation invalidation.
   - Run focused typecheck and tests listed in research-plan.

## Decisions Taken

- Profile manifest data and local lifecycle state are separate facts.
- The application/API may use the separated shape directly; no artificial compose DTO layer is required.
- Profile versions are pinned to Hugging Face Git commit hashes.
- Full commit hash is stored; short hash is for display/folder suffix.
- Created profile downloads must use full commit hash as Hugging Face `revision`; `main` is only for search/refresh.
- Local profile folder/group identity is versioned, e.g. `q4-abcdef`.
- Old local profiles remain usable/manageable after refresh.
- No `stale` or `needs-refresh` lifecycle status will be added.
- Multiple group downloads are allowed concurrently.
- Deleting in-use groups is allowed, but it aborts related references/tasks first.
- LocalModel/groupId selection is global settings only.
- Page-owned translation tasks are aborted on page unmount.
- Settings changes affect the next `batchTranslate` call, not an already-running call.

## Divergence Notes

- Earlier discussion considered file-level reference counting for shared files. That is rejected. The approved design intentionally duplicates files per profile folder to maximize lifecycle isolation.
- Earlier discussion considered adding a composed panel DTO. That is not required. Storage facts remain separate, while API/application can use the separated structure directly.
- Earlier implementation patches attempted to fix chip color by changing frontend rendering and server projection. That path is rejected because it preserves competing state sources.

## Loopback Triggers

Return to intake/research-plan if any of these become true:

- Hugging Face metadata cannot reliably provide a full resolved commit hash for selected models.
- `@huggingface/hub` cannot download files at a pinned commit revision for the required endpoint/mirror.
- Transformers runtime cannot load from the isolated profile folder without reintroducing shared mutable cache state.
- A safe migration path from existing `models.json` cannot be implemented without losing significant user progress.
- Deleting an in-use group cannot reliably abort related translation work before file removal.
- Concurrent downloads create unavoidable corruption or race conditions in the chosen store format.
