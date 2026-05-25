## 1. Research and Planning

- [x] 1.1 Intake captured objectively with each Q&A preserving current implementation and target architecture.
- [x] 1.2 Research facts recorded from current server, web, core, cache, and translation task code paths.
- [x] 1.3 Plan reviewed enough to proceed with implementation artifact.
- [x] 1.4 Rejected approaches recorded: frontend-only chip styling patch, file-level reference counting, artificial compose DTO, stale/needs-refresh states.

## 2. Core State and Profile Manifest

- [x] 2.1 Profile manifest schema added with model id, endpoint, full commit hash, raw request metadata, base profile id, versioned group id, display label, files, sizes, and revision metadata.
- [x] 2.2 Lifecycle schema added with group-scoped status, rootDir, file progress, bytes, progress, error, installedAt, and updatedAt.
- [x] 2.3 Existing `models.json` migration/reconciliation implemented without treating top-level `status/files/progress` as durable chip truth.
- [x] 2.4 Raw Hugging Face request metadata remains persisted as fetch-cache truth.
- [x] 2.5 Versioned group/folder identity uses the full resolved commit hash as source and short hash only for display/folder suffix.

## 3. Profile Discovery and Refresh

- [x] 3.1 Current profile discovery rules are preserved for recognizable ONNX profiles with concrete sizes.
- [x] 3.2 Profile refresh resolves and persists full commit hash before creating profile manifests.
- [x] 3.3 Refresh is scoped to the currently selected LocalModel.
- [x] 3.4 Refresh updates profile manifests without overwriting lifecycle state.
- [x] 3.5 Profile loading state, failure state, and failure message are exposed to the frontend.
- [x] 3.6 Unknown/incomplete profile detection surfaces as profile parse failure with retry.
- [x] 3.7 Created profile reads are local-only after manifest persistence; `main`/latest is not used outside search/refresh.

## 4. Isolated Filesystem and Download Lifecycle

- [x] 4.1 Deterministic isolated group root paths implemented for versioned groups.
- [x] 4.2 Downloads write all required files into the selected group folder, including duplicate common files.
- [x] 4.3 Download API accepts `{ modelId, groupId }` and persists group-level `downloading` before network IO.
- [x] 4.4 Download calls pass full commit hash as Hugging Face `revision`.
- [x] 4.5 Sessions are keyed by `modelId + groupId`, allowing multiple concurrent group downloads.
- [x] 4.6 Progress events are group-scoped and update only the target group.
- [x] 4.7 Pause aborts only the target group session and preserves partial files.
- [x] 4.8 Resume always reconciles the group folder first, then continues missing/partial files.
- [x] 4.9 Restart recovery uses filesystem facts over stale JSON bytes.
- [x] 4.10 Delete aborts related references/tasks, removes only the target group folder/state, and handles selected-group clearing.

## 5. Settings and UI Behavior

- [x] 5.1 Selected LocalModel and selected group id use global settings only.
- [x] 5.2 Project config writes are removed where they act as selected LocalModel/group authority.
- [x] 5.3 Local Model title renders settings and refresh icon buttons at inline-end.
- [x] 5.4 Chip switch updates global selection and panel state only.
- [x] 5.5 Chip switch never starts, pauses, deletes, or recolors unrelated chip states.
- [x] 5.6 Chip border reflects selection only: solid for selected, dashed for unselected.
- [x] 5.7 Chip color reflects status only: neutral for `not-downloaded`, blue for incomplete/in-flight/removing/error states, green for `downloaded`.
- [x] 5.8 Historical groups display short commit suffix labels such as `q4 (4-bit) 293 MB · abc123`.
- [x] 5.9 Download Files handles no selected group after selected historical group deletion.

## 6. Translation Task Lifecycle

- [ ] 6.1 Page-owned translation tasks abort on page unmount.
- [ ] 6.2 Settings changes affect only the next `batchTranslate` invocation.
- [ ] 6.3 `batchTranslate` uses immutable runtime snapshots and scoped pipeline leases.
- [x] 6.4 Deleting an in-use group aborts related translation work before removing files.
- [ ] 6.5 Document translation uses generation ids and rejects stale late patches after content mutation.
- [ ] 6.6 Translation cache reuse remains effective when re-entering a page after abort.

## 7. Verification

- [x] 7.1 Server unit tests cover profile manifest creation, commit hash persistence, refresh, parse failure, and pinned-revision download.
- [x] 7.2 Server unit tests cover concurrent downloads, pause/resume, restart reconciliation, delete, selected group clearing, and chip status stability.
- [x] 7.3 Web unit tests cover refresh button, profile loading/failure states, chip style semantics, chip switching, historical deletion, and Download Files empty selection.
- [ ] 7.4 Web unit tests cover document translation unmount abort and stale generation patch rejection.
- [x] 7.5 Focused integration checks cover two concurrent group downloads, pause one while another continues, restart with partial bytes, profile refresh with old/new chips, and pinned commit download.
- [x] 7.6 `pnpm --filter @openspecui/server typecheck` passes.
- [x] 7.7 `pnpm --filter @openspecui/web typecheck` passes.
- [x] 7.8 `pnpm --filter @openspecui/server test -- src/local-model-asset-service.test.ts src/local-model-subscription-transport.test.ts src/translation-engine-service.test.ts src/translation-model-catalog.test.ts` passes.
- [x] 7.9 `pnpm --filter @openspecui/web exec vitest run src/routes/settings.test.tsx src/components/document-translation-action.test.tsx --project unit` passes.

## 8. PR and Release Gates

- [x] 8.1 Changeset included if package behavior or published contracts change.
- [x] 8.2 Implementation artifact updated with any divergence from this checklist.
- [x] 8.3 CI-equivalent local checks passed or scoped failures documented.
- [ ] 8.4 PR checks passed.
- [ ] 8.5 OpenSpec archive flow completed after implementation is accepted.
- [ ] 8.6 PR merge approved.
