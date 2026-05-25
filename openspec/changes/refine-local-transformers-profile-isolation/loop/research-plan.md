## Research Findings

- Current local model state is model-level. `LocalModelAssetState` stores top-level `status`, `files`, `progress`, `bytesDownloaded`, `totalBytes`, and an optional `plan.groups[]`. This makes chip status a derived projection instead of a durable profile fact.
- Current chip discovery already has a profile recognizer in `packages/core/src/local-download-profiles.ts`. It maps known ONNX suffixes such as `q4`, `q4f16`, `bnb4`, and `q8` into groups and only marks groups selectable when every required file has a concrete size.
- Current download is only partially group-aware. `localModels.download` accepts `selectedGroupId`, but server sessions are keyed by `modelId`, downloads write into shared Hugging Face/Transformers cache paths, and progress is persisted to top-level model state.
- Current pause/delete are model-level. Pause accepts only `{ modelId }`; delete accepts only `{ modelId }` and removes model-level cache directories plus the entire model state record.
- Current chip switch writes selected group to settings and does not start download, but it refetches panel state. Because server refresh recomputes group status from selected top-level files/state, non-selected chip colors can regress from blue to neutral.
- Current selected LocalModel/groupId ownership is mixed. UI paths write global settings and project config; server local asset reads global settings. The target law is global settings only for selected LocalModel/groupId.
- Current profile metadata and lifecycle state are mixed in `LocalModelAssetState.plan` and top-level lifecycle fields. Forced profile refresh would risk overwriting local progress/status unless these facts are separated.
- Current fetch-cache infrastructure exists and already stores raw Hugging Face request data through `LocalModelFetchCacheStore`. This should remain the objective request metadata cache.
- `@huggingface/hub` is already a dependency of `@openspecui/server` and `@openspecui/local-translator`. Its APIs support revision-aware file operations. Profile versions can store the full resolved Git commit hash and pass it as `revision` for downloads.
- Current document translation is page-owned through `useDocumentTranslation` and an `AbortController`. It aborts on unmount/reset, but markdown/config changes do not have a complete generation-id stale-result law.
- Current server `batchTranslate` creates a translator per subscription, aborts on unsubscribe, and calls `destroy` in `finally`. This gives a basic scoped lifetime, but no explicit pipeline lease abstraction exists.

## Decision & Plan (For Approval)

1. Split local profile facts from local lifecycle facts.
   - Add a profile manifest store that persists objective model/profile metadata: model id, endpoint, full commit hash, raw request metadata, base profile id, versioned group id, display label, files, sizes, etags/revision where available.
   - Add or replace lifecycle state with profile/chip-level records keyed by versioned group id: status, rootDir, file progress, bytes, progress, error, installedAt/updatedAt.
   - Do not use top-level model `status/files/progress` as chip truth. Any top-level fields retained during migration are compatibility projections only.

2. Use commit-pinned versioned group identity.
   - Resolve profile refresh/search through `main`/branch/latest only during discovery.
   - Persist the full resolved commit hash in the profile manifest.
   - Use `q4-$SHORT_HASH_6` style versioned group ids/folders for historical or commit-specific groups.
   - Use full commit hash as Hugging Face `revision` for all downloads for that profile.
   - Do not add `stale` or `needs-refresh` states. Old profiles remain visible/manageable through versioned labels such as `q4 (4-bit) 293 MB · abc123`.

3. Make profile refresh explicit and local lifecycle safe.
   - Add a refresh icon button at the Local Model title inline-end beside the settings icon.
   - Add profile loading state, profile failed state, and failure message to the frontend.
   - Refresh only the currently selected LocalModel.
   - Forced refresh updates profile manifests and raw metadata, but does not overwrite lifecycle state.
   - Unknown/incomplete profile detection is a profile parse failure with retry, not a network/download failure.

4. Make download lifecycle profile-isolated.
   - Change download/pause/resume/delete APIs to accept `{ modelId, groupId }`.
   - Use session keys that include `modelId + groupId`; allow multiple concurrent group downloads.
   - Download every group file into that group's isolated folder, even if another group has identical files.
   - Persist `downloading` before network IO; emit group-scoped progress events.
   - Pause aborts only that group session and preserves partial files.
   - Resume always begins with group-folder reconciliation, then continues missing/partial files.
   - Delete aborts all related download/translation references, deletes only the group folder/state, removes historical group chips when appropriate, and clears global `selectedGroupId` if the deleted group was selected.

5. Make settings and panel state deterministic.
   - Store selected LocalModel/groupId only in global settings: `translationEngines.local.model` and `translationEngines.local.selectedGroupId`.
   - Chip switching writes only global selection and triggers a panel snapshot refresh.
   - Selection changes may alter `selected` flags but must never recompute non-selected group status from selected group files.
   - Chip visual mapping remains: neutral for `not-downloaded`, blue for incomplete/in-flight/removing/error states, green for `downloaded`; border style only means selected/unselected.

6. Harden translation task lifetime.
   - Page unmount aborts the page's translation task. Re-entering re-runs translation and relies on `translateCache`.
   - Settings changes affect the next `batchTranslate` invocation, not an already-running invocation.
   - `batchTranslate` should operate on an immutable runtime snapshot and scoped pipeline lease. Deleting a group used by an active task aborts that task before deleting files.
   - Add generation ids to document translation patches. Markdown/content mutation aborts or invalidates the current generation, reuses cached unchanged segment hashes, and rejects stale late results.

## Capability Impact

### New or Expanded Behavior

- Local Model panel can force-refresh profiles and retry profile load/parse failures.
- Local profile chips are versioned by resolved Git commit hash and can coexist across old/new profile manifests.
- Multiple chips can download concurrently.
- Historical chips can be resumed, used, or deleted independently.
- Deleting a selected historical chip clears global selection and leaves Download Files in a no-selection-safe state.
- Document translation rejects stale results from older page generations.

### Modified Behavior

- Local model download lifecycle moves from model-level to profile/chip-level.
- Delete/pause/resume semantics become group-scoped.
- Profile/chip state reads become local-only after manifest creation; network is used only for refresh/search and file download.
- Selected LocalModel/groupId become global-only settings.
- Frontend chip colors become a direct render of server-owned group state and are not affected by selection changes.

## Risks and Mitigations

- Risk: migration from existing `models.json` may lose old progress.
  - Mitigation: read existing top-level state as a one-time selected-group compatibility projection, then write the new group lifecycle format. Prefer filesystem reconciliation over stale JSON bytes.
- Risk: folder/group hash changes if metadata normalization is unstable.
  - Mitigation: use full resolved commit hash as the version anchor, not a locally computed file-list hash. Use short hash only for display/folder suffix.
- Risk: mirrors may not serve a pinned commit.
  - Mitigation: surface download/profile failure with endpoint and revision in the error; do not silently fall back to `main`.
- Risk: concurrent downloads may produce noisy logs or race state writes.
  - Mitigation: key sessions and writes by `modelId + groupId`; persist group records independently; make progress updates idempotent.
- Risk: deleting in-use profiles can leave active translators with missing files.
  - Mitigation: centralize leases/references and require delete to abort related tasks before removing group folders.
- Risk: profile refresh can remove a selected group from available manifests.
  - Mitigation: versioned local groups remain until explicitly deleted. If user deletes the selected group, clear selection and handle empty Download Files.

## Verification Strategy

- Server unit tests:
  - Profile manifest creation persists full commit hash and versioned group ids.
  - Refresh updates manifests without overwriting lifecycle state.
  - Refresh parse failure surfaces profile failure state and retry is possible.
  - Download writes into isolated group folders and passes full commit hash as `revision`.
  - Multiple groups can download concurrently without shared session collisions.
  - Pause aborts only the target group and preserves partial files.
  - Pause-resume and restart-resume share reconciliation behavior.
  - Delete removes only the target group folder/state and clears selectedGroupId when needed.
  - Switching selected group changes only selected flags, not group statuses.

- Web unit tests:
  - Local Model title renders settings and refresh icon buttons.
  - Profile loading, profile failed, and retry states render correctly.
  - Chip color mapping follows status only; border follows selection only.
  - Switching chips does not remove blue/green status from other chips.
  - Deleting selected historical chip clears selected state and Download Files handles no selected group.
  - Document translation aborts on unmount and rejects stale generation patches after markdown mutation.

- Focused integration checks:
  - Start two group downloads concurrently and verify independent progress.
  - Pause one group while another continues.
  - Restart after partial file write; verify disk bytes override stale JSON.
  - Refresh profiles after downloading an old commit; verify old and new chips coexist.
  - Download a profile from a pinned commit hash and verify no `main` URL is used for that profile.

- Commands:
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter @openspecui/server test -- src/local-model-asset-service.test.ts src/local-model-subscription-transport.test.ts src/translation-engine-service.test.ts src/translation-model-catalog.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/components/document-translation-action.test.tsx --project unit`
