## User Input

- User asked to restart the discussion from first principles, record each question and answer, open a new OpenSpec change, and include the earlier questions.

### Q&A Record

#### Q: "我这边测试还是不行。你遇到的架构问题，和我说你现在的架构。用大白话解释"

- Current implementation: local model asset state is still model-level state (`status`, `files`, `progress`) plus `plan.groups[].status` as derived group status. Runtime refresh mixes top-level state, group status, cache inspection, and active session state.
- Correct target: each profile/chip must have its own isolated lifecycle state. Top-level model state must not be used as the source of truth for chip color/progress.

#### Q: "服务端的代码在哪里？"

- Current implementation: core server paths are `packages/server/src/local-model-asset-service.ts`, `packages/server/src/local-model-asset-store.ts`, `packages/server/src/router.ts`, `packages/server/src/translation-engine-service.ts`, with shared schemas in `packages/core/src/translator.ts`.
- Correct target: the same ownership remains, but `local-model-asset-service.ts` must become profile/chip-lifecycle based rather than model-lifecycle based.

#### Q: "你之所以没有正确拆分，原因是什么？"

- Current implementation: the code preserved the old `LocalModelAssetState` shape and tried to infer chip state from `state.status/files/progress`, `plan.groups[].status`, cache inspection, and active sessions.
- Correct target: stop inferring profile state from the selected model-level projection. Store explicit group state by `groupId`.

#### Q: "点击删除，会发生什么事情，整个大数组全部被删除？"

- Current implementation: yes. The current delete route accepts only `{ modelId }`; `deleteModel(modelId)` removes model-level cache directories and removes the model state record.
- Correct target: delete must accept `{ modelId, groupId }`, abort only that group session if active, delete only the isolated folder for that group, and reset only that group's state.

#### Q: "拆分成多个数组后，一个文件可能会同时出现在多个数组中。你知道你应该怎么做吗？"

- Current implementation: current storage/cache paths are shared at model/cache level; there is no profile-isolated folder law.
- Incorrect initial answer: use file-level ownership/reference accounting.
- User correction and correct target: do not share file ownership. Each profile/chip redundantly downloads its full file set into its own isolated folder. Deleting a chip directly deletes that chip folder. Isolation is more important than storage deduplication.

#### Q: "一开始如何确定有哪些chips?"

- Current implementation: `packages/core/src/local-download-profiles.ts` defines known profiles (`q1`, `q1f16`, `q2`, `q2f16`, `q4`, `q4f16`, `bnb4`, `q8`, `int8`, `uint8`, `fp16`, `fp32`) and groups repository files by recognized ONNX suffixes plus auxiliary files. A group becomes selectable only when all file sizes are concrete.
- Correct target: keep chip discovery based on objective repository metadata/file layout and strict profile rules. Persist raw request metadata as fetch-cache. Local download state must only overlay status, not create chips.

#### Q: "本地的状态文件的数据结构是如何？"

- Current implementation: `models.json` stores `LocalModelAssetState[]` with top-level `status/files/progress/bytesDownloaded/totalBytes` and optional `plan.groups[]`. There is no isolated `groups[groupId]` lifecycle map.
- Correct target: state must be model record plus profile/chip map: global selected group id as selection snapshot, repository metadata, and `groups[groupId]` with status, isolated root directory, files, bytes, progress, and error.

#### Q: "这是你现在就已经有的架构，还是你觉得正确的架构？"

- Current implementation: it is not implemented today. Current code is still old model-level state with partial group projection.
- Correct target: the described `groups[groupId]` isolated state is the architecture this change must introduce.

#### Q: "点击下载的时候，会发生什么事情？"

- Current implementation: download accepts optional `selectedGroupId`, but sessions are keyed by `modelId`; the selected group files are downloaded through shared Hugging Face/Transformers cache paths, and progress is written to top-level state/files.
- Correct target: download must accept `{ modelId, groupId }`, create/use that group's isolated folder, persist group-level `downloading` before network IO, stream every required file into that folder, update group file progress, emit progress, verify files, and mark only that group downloaded.

#### Q: "你选中的LocalModel和groupId存储在哪里？"

- Current implementation: code is mixed. The settings UI writes global settings and project config in some paths. `LocalModelAssetService` reads global settings for selected model/group. Translation engine service also references config/global selection paths.
- User correction and correct target: selected LocalModel and groupId are stored globally in `translationEngines.local.model` and `translationEngines.local.selectedGroupId`. They do not belong to project-local config as the authoritative source, and do not belong to the download cache.

#### Q: "应用突然死亡，你本地的文件写了120mb，但是你json记录到bytesDownloaded不一致，该怎么办？"

- Current implementation: refresh logic performs some cache/file-status inspection for the selected plan and state files, but it is not profile-isolated and does not provide a complete group-folder reconciliation law.
- Correct target: on read/restart, filesystem facts in the group folder override stale JSON progress. Recompute file bytes from disk, clamp/update JSON, mark complete files downloaded, mark partial groups paused/resumable, and persist the reconciled state.

#### Q: "如果正好有页面在执行翻译任务，离开页面，翻译会被中断吗？如果不离开页面，直接修改设置的配置，翻译会被中断吗？"

- Current implementation: `useDocumentTranslation` owns an `AbortController` and aborts on unmount/reset. Settings/markdown changes reset visible state, but there is not a complete task-generation law for every in-flight result.
- User correction and correct target: leaving the page interrupts/destroys the translation task with page lifecycle. Re-entering translates again and relies on `translateCache` for completed segment reuse. Editing settings does not mutate an already-running `batchTranslate` call; it affects the next `batchTranslate` invocation.

#### Q: "batchTranslate那边，你要注意的是pipe是不是可能会被外部销毁？如果是，你应该如何管理？"

- Current implementation: server `batchTranslate` creates a translator for each subscription, aborts on unsubscribe, and calls `translator.destroy?.()` in `finally`. There is no explicit reusable pipeline lease manager.
- Correct target: each `batchTranslate` call acquires an immutable runtime snapshot and a scoped pipeline lease. Settings changes must not destroy an active lease. Page lifecycle abort releases the lease. Deleting a model/group used by an active lease must be blocked or explicitly cancel that task first.

#### Q: "如果页面的内容发生了突变，你该怎么办？因为我们页面是实时更新的。"

- Current implementation: markdown/config changes reset some React state, but there is no explicit generation id or stale-result rejection for translated segment patches.
- Correct target: translate an immutable page-content generation. On content mutation, abort or invalidate the old generation, snapshot the new content, reuse cached segment hashes, translate only new/changed segments, and discard late results whose generation id does not match current page generation.

#### Q: "点击暂停，会发生什么事情？你如何实现暂停？"

- Current implementation: pause route accepts only `{ modelId }`; service sessions are keyed by `modelId`; pause aborts the model session and writes paused status into the current selected plan/top-level state.
- Correct target: pause accepts `{ modelId, groupId }`, aborts only that group's session, preserves partial files in the isolated group folder, reconciles disk bytes, persists `groups[groupId].status = "paused"` with `resumable: true`, and emits a paused progress event. Pause is idempotent.

#### Q: "暂停后回复下载，和应用重启后回复下载，是一样的吗？"

- Current implementation: resume route accepts `{ modelId, selectedGroupId? }` and reuses the model-level `runDownload` path. It can resume from persisted/cache state, but the state is not profile-isolated. After app restart there is no active session, so recovery depends on `models.json` plus cache/file inspection.
- Correct target: after reconciliation, they should use the same resume algorithm. Pause-resume starts with a recently persisted paused state; restart-resume starts with stale JSON and must first scan the isolated group folder. Once actual disk bytes are reconciled, both call the same `resumeGroupDownload({ modelId, groupId })` path and continue missing/partial files for that group only.

#### Q: "那些状态对应的是chip的无色，哪些是蓝色，哪些是绿色"

- Current implementation: frontend maps `downloaded` to green, maps `queued/downloading/paused/error/deleting` to blue, and maps everything else to neutral. The mapping is close to the target, but the server-provided group status is not a stable profile-level source of truth.
- Correct target: chip border style represents selection only (`selected` => solid, unselected => dashed). Chip color represents download state only: `not-downloaded` => neutral/no color; `queued/downloading/paused/error/deleting` => blue because the profile is in-progress, incomplete, resumable, failed, or being removed; `downloaded` => green. After deletion completes, the state becomes `not-downloaded` and returns to neutral.

#### Q: "在页面上点击切换chip，也没会收到什么样的推送？底层会发生什么？"

- Current implementation: clicking a chip updates local React state and writes `selectedGroupId` to global settings and project config. It does not start a download and does not itself create a local-model log event. Current download log subscription only pushes lifecycle logs from download/pause/delete and then the frontend manually refetches `panelState`.
- Correct target: clicking a chip is only a selection operation. It writes global `translationEngines.local.selectedGroupId`, then the UI receives/refetches a fresh local panel snapshot where only `selected` flags change and all group statuses remain server-owned. No download/pause/delete lifecycle log should be emitted by selection itself. If another group is actively downloading, its progress logs still arrive with that `groupId` and update that group's blue/progress state, but selection does not stop or mutate it.

#### Q: "之前为什么点击切换会出现混乱（蓝色变无色）"

- Current implementation: chip color depends on `group.status`, but `group.status` is not durable per profile. When clicking a different chip, frontend changes `selectedGroupId` and refetches `panelState`; server `refreshCachedState` re-runs group status inference using top-level `state.files/status/progress`, runtime plan groups, persisted `plan.groups[].status`, cache inspection, and model-level session matching. If the previous blue state existed only in top-level selected state or was dropped by plan merge/recompute, the unselected group can be inferred as `not-downloaded`, so blue becomes neutral.
- Correct target: switching selection must only change `group.selected`. `groups[groupId].status` must be stored independently and must not be recomputed from the selected group's top-level files. Therefore selecting another chip cannot turn an incomplete/downloading/paused chip from blue to neutral.

#### Q: "是不是一旦profile创建成功，就不需要再依赖网络了？（模型的下载是另外一回事）"

- Current implementation: not fully. If a persisted plan is missing or insufficient, reads can still call runtime/metadata plan resolution paths, and the UI can wait on plan loading. That means profile/chip display and state refresh can still become indirectly network/runtime dependent.
- Correct target: yes. Once a profile/chip manifest is created and persisted with concrete file list, sizes, labels, dtype/profile, root folder, and raw repository metadata snapshot, normal UI rendering, chip switching, pause/resume/delete, crash reconciliation, and translation readiness checks must not require network. Network is used only for remote search/explicit metadata refresh and for downloading model files.

#### Q: "那么我们的页面上，就应该要有一个刷新按钮，放在 Local Model 这个title的inline-end位置，这个位置目前有一个Settings-icon-button，我们还需要一个refresh-icon-button。实现强制的拉取最新的profile，并更新到本地。也就是说，profile的数据结构不应该和本地的状态混在一起。目前你是混在一起的，它们应该完全隔离开。这个才能方便更新。这不会影响应用层使用这些状态不是吗？"

- Current implementation: profile/download plan and local lifecycle state are mixed in `LocalModelAssetState.plan` plus top-level state. Refreshing or recomputing profiles risks overwriting local status because the manifest and lifecycle are not separate stores.
- Correct target: add a refresh icon button at the inline-end of the Local Model title, alongside the existing settings icon. The button forces remote profile metadata refresh for the selected local model, rebuilds and persists profile manifests, and leaves local group lifecycle state separate. Storage should split objective profile manifest data from mutable local download state. The application layer should consume a composed panel DTO, so this separation does not complicate usage; it makes updates safer.
- User correction: an extra composed DTO layer is not required. The separated profile manifest and local lifecycle state can be used directly by the application/API shape if that keeps code simpler. The important law is separation of stored facts, not an artificial compose abstraction.

#### Q: "你还有什么类似的问题需要和我讨论确认的吗？"

- Current implementation: unresolved boundaries include profile refresh status, versioned profile folders, concurrent downloads, deleting in-use profiles, refresh scope, profile parse failure, and stale/needs-refresh semantics.
- User decisions:
  - Frontend needs dedicated profile loading state, profile loading failure state, and failure message. Refresh button provides retry.
  - Do not introduce `stale` or `needs-refresh` lifecycle states.
  - Improve local cache folder naming. Versioned profiles use folder/group labels like `q4-xxxx`; if a local folder exists from an older profile, keep that group and show a label such as `q4 (4-bit) 293 MB · $SHORT_HASH_6`.
  - Versioned folder organization must be strict enough to avoid cross-version interference.
  - Allow concurrent downloads. Do not add a one-active-download-per-model special case.
  - Deleting an in-use group is allowed and aborts all related references/tasks. If deleting an old versioned group such as `q4-xxxx`, remove it from the chip list and clear `selectedGroupId` if it was selected; Download Files must handle the selected group disappearing.
  - Refresh only the currently selected LocalModel.
  - Unknown/incomplete profile detection is a profile parse failure, not a network failure. It should surface through profile loading failure UI.
  - Versioned labels/folders replace stale/needs-refresh semantics.

#### Q: "关于hash，我建议用git-last-commit-hash就好了。这样还方便溯源仓库。但我要知道这个hash能不能拿到？我现在担心的是还有一点，就是文件下载能否支持下载某个commit的？"

- Current implementation: current code does not consistently model profile versions by resolved commit hash. It has fetch-cache/profile metadata, but folder/group identity is not built around Git commit revision.
- Confirmed API capability: Hugging Face JS Hub APIs expose revision-aware metadata and download calls. `modelInfo` supports `revision` and additional fields such as `sha`; `listFiles` supports `revision`, and with `expand: true`, file entries can include `lastCommit.id`. `downloadFileToCacheDir`, `downloadFile`, `fileDownloadInfo`, and `snapshotDownload` all support `revision`.
- Correct target: store the full resolved Git commit hash in the profile manifest and use a short display suffix such as `$SHORT_HASH_6` for labels/folders. Use the full commit hash as `revision` for all file metadata and downloads. Folder/chip labels may use `q4-$SHORT_HASH_6`, but persisted metadata must keep the full commit hash for reproducibility.

#### Q: "或者我这样问：你的下载链接是稳定的吗？还是只能下载最后的？"

- Current implementation: if downloads or metadata resolve through `main`/latest without pinning the resolved commit into the profile manifest, the link is not stable across future repository updates.
- Correct target: profile creation must resolve `main`/branch/tag to a full commit hash and persist that commit. All later file downloads for that profile must use the full commit hash as `revision`, not `main`. The resulting download is stable for that commit as long as the remote repository still retains that commit and the endpoint/mirror can serve it. Latest-only download is only acceptable during initial profile refresh/search, never after a profile version is created.

## Objective Scope

- Define a new Local-Transformers profile/chip lifecycle law.
- Capture Q&A as the objective requirement record before implementation.
- Replace model-level download/delete semantics with profile/chip-level isolated lifecycle semantics.
- Define crash recovery and reconciliation rules where filesystem facts override stale JSON progress.
- Determine chips from repository metadata/file layout and recognized profile grouping rules.
- Add dedicated profile loading/loading-failed state and retry through the Local Model refresh button.
- Store each profile/chip as an isolated installed unit with its own files, progress, status, and folder.
- Use versioned group/folder identity for refreshed or historical profiles so old and new profiles can coexist.
- Profile versions use the resolved Hugging Face Git commit hash. Store full commit hash; display/folder suffix may use the first 6 characters.
- Store objective repository request metadata in the local state/cache so future schema upgrades can re-interpret the raw metadata.
- Ensure the frontend renders chip selection and status from server-provided profile state without local status mixing.

## Non-Goals

- Do not deduplicate shared files across chips in this loop.
- Do not implement file-level reference counting.
- Do not introduce `stale` or `needs-refresh` chip lifecycle states.
- Do not serialize all downloads to one active group per model.
- Do not keep model-level delete semantics for the chip delete button.
- Do not make unknown or incomplete profiles selectable.
- Do not start implementation until the Q&A and research-plan clarify the profile detection and isolated storage rules.

## Acceptance Boundary

- The change records the Q&A needed to drive the redesign.
- The server has one profile/chip-level source of truth for each local model profile.
- Each chip maps to an isolated folder and isolated file-progress list.
- Versioned profile folders allow historical local profiles to remain usable after profile refresh.
- The state file distinguishes model-level selection/repository metadata from profile/chip-level lifecycle state.
- In-flight translation tasks are owned by the page lifecycle and are aborted when the page unmounts.
- In-flight `batchTranslate` calls use immutable runtime snapshots and scoped pipeline leases that are not mutated by later global setting changes.
- Live page content updates are handled through generation ids, segment hashes, cache reuse, and stale-result rejection.
- Deleting a chip deletes only that chip's isolated folder and state.
- Deleting an in-use chip aborts related translation/download references before removing the group.
- Deleting a selected historical group clears `selectedGroupId` and the Download Files panel handles no selected group.
- Downloading a chip downloads all required files for that chip into that chip's folder, even if files duplicate another chip.
- Multiple chips may download concurrently.
- Pausing a chip aborts only that chip's active download session and preserves partial files for resume.
- Pause-resume and restart-resume share one resume path after group-folder reconciliation.
- Chip style semantics remain simple: selection controls border style; download state controls color.
- Chip color mapping is neutral for `not-downloaded`, blue for incomplete/in-flight/removing/error states, and green for `downloaded`.
- Switching chips updates global selection and panel snapshot only; it does not start, pause, delete, or recolor unrelated chip states.
- Switching chips must never recompute non-selected group status from selected group files.
- Once a profile manifest is persisted, normal profile lifecycle reads are local-only; network is reserved for search/refresh and file download.
- Local Model UI exposes an explicit refresh profiles action; forced refresh updates profile manifests without overwriting group lifecycle state.
- Local Model refresh is scoped to the currently selected LocalModel.
- Profile parsing failures are surfaced as profile loading failures with retry, not as generic network/download failures.
- Downloads for a versioned profile must pass the stored full commit hash as the Hugging Face `revision`.
- Download links for created profiles are pinned to full commit hashes; `main`/latest is only used to discover or refresh profiles.
- Profile manifest data and local lifecycle state are separate facts; the application/API may use the separated structure directly without an extra compose abstraction.
- The chip list is derived from concrete repository metadata/file layout and recognized profile rules, with only complete known-size groups selectable.
