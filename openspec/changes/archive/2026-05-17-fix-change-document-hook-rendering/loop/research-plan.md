## Research Findings

- GitHub issue #140 is open. The original report was fixed in `openspecui@3.6.0` for main spec detail pages, but the reporter now says active change delta specs do not apply the hook, and asks to check active change tasks because they appear flaky.
- Current hook law in `packages/core/src/hooks.ts` already models the needed surface: `DocumentRefV1.stage` supports `project | main | change | archive`, and `DocumentRefV1.kind` supports `spec | proposal | design | tasks | delta-spec`.
- `packages/server/src/document-service.ts` already processes active change `proposal`, `tasks`, `design`, and `delta-spec` documents through `processDocument()` in `readChangeRaw()`.
- The same service also processes archived change `proposal`, `tasks`, `design`, and `delta-spec` documents through `readArchivedChangeRaw()`.
- `packages/server/src/router.ts` still has legacy raw routes/subscriptions that bypass the document service:
  - `change.getRaw` returns `ctx.adapter.readChangeRaw(input.id)`.
  - `change.subscribeFiles` returns `ctx.adapter.readChangeFiles(id)`.
  - `archive.getRaw` returns `ctx.adapter.readArchivedChangeRaw(input.id)`.
  - `archive.subscribeFiles` returns `ctx.adapter.readArchivedChangeFiles(id)`.
- `packages/web/src/components/opsx/artifact-output-viewer.tsx` renders artifact outputs through `useOpsxArtifactOutputSubscription()` or `useOpsxGlobArtifactFilesSubscription()`, then through `TranslatableMarkdownViewer`.
- `packages/web/src/components/folder-editor-viewer.tsx` intentionally displays file content through a code editor. That should remain a source/audit view, not a processed document reading view.
- The previous #139/#140 implementation established the main-spec law: render processed Markdown as the visual source and attach OpenSpec semantic markers on top, rather than reconstructing the visual document from parsed facts.
- The active translation change is untracked in the working directory and targets document translation heading projection. This bugfix can stay isolated by touching only a new OpenSpec change now, and later limiting implementation to document service/router/view contracts rather than translation code.

## Decision & Plan (For Approval)

### Diagnosis

This is not a new translation or parser problem by default. It is a platform consistency problem:

```
onReadDocument
      │
      ▼
DocumentService processed Markdown
      │
      ├── main spec detail: already consumes processed raw Markdown
      ├── active change preview: mixed paths, some may consume source/raw artifact reads
      ├── active change folder/editor: source view by design
      └── archive views: mixed paths, current reported behavior looks better but lacks a hard law
```

### Option A: Platform-Law Repair (Recommended)

Make processed document reading the only document-reading path for rendered Markdown views, across main specs, active changes, and archives.

- Server law:
  - Route rendered document endpoints/subscriptions through `DocumentService`.
  - Keep explicit source/audit endpoints on adapter/raw reads.
  - Name or type frontend consumers so a component chooses `processed document view` vs `source file view` deliberately.
- Web law:
  - Artifact preview / reading surfaces consume processed Markdown.
  - Folder editor / code editor surfaces consume source Markdown.
  - Do not branch on `delta-spec` in UI; the document ref kind and stage are already the platform contract.
- Test law:
  - Add a hook fixture that marks each document kind/stage.
  - Assert active change delta spec and tasks preview receive processed output.
  - Assert source editor stays unprocessed.
  - Assert archive delta spec/tasks behavior remains processed in reading views.

Why this is the long-term fix: it preserves the hook API as the stable law and removes duplicate truths. Future document processors, including translation-adjacent processors, automatically apply to every document-reading surface that opts into processed mode.

### Option B: Page-Local Patch (Technical Debt)

Patch `ArtifactOutputViewer` or one active change route to special-case `specs/**/*.md` and manually call a processed endpoint.

Why this is weaker:

- It treats delta specs as a UI exception instead of a document kind.
- It risks leaving tasks/proposal/design/archive on different paths.
- It creates a second local truth for whether a file is hook-processed.
- It makes future hooks harder to reason about because behavior depends on page wiring instead of `DocumentRefV1`.

### Recommendation

Use Option A. The existing platform already has the right document identity model; the implementation should complete that law instead of adding another hook or page-specific conditional.

## Capability Impact

### New or Expanded Behavior

- Active change artifact preview renders hook-processed delta specs and tasks consistently.
- Archive reading views retain hook-processed behavior under explicit regression coverage.
- The product has a clear processed-vs-source boundary for OpenSpec Markdown documents.

### Modified Behavior

- Any rendered Markdown view currently backed by adapter raw reads should migrate to the document service when it is a reading surface.
- Source/file editor views remain intentionally raw and should be labeled in tests as source-mode surfaces.

## Risks and Mitigations

- Risk: Some callers intentionally depended on raw Markdown in a reading view.
  - Mitigation: audit each route before changing it and keep an explicit source endpoint for editor/file views.
- Risk: Processing artifact output through hooks could double-process content if the output subscription is already processed.
  - Mitigation: identify the `opsx.subscribeArtifactOutput` and glob implementation before coding, then centralize processing at one server boundary.
- Risk: Translation work touches nearby Markdown viewer components.
  - Mitigation: keep this bugfix implementation in server/document routing and focused view tests unless evidence shows the renderer itself is involved.
- Risk: The reporter's "tasks flaky" could be a cache/subscription stale-data bug rather than hook processing.
  - Mitigation: include subscription cache invalidation/reactive update checks in the investigation before patching.

## Verification Strategy

- Add focused server tests for active and archived change document reads:
  - `readChangeRaw()` processes `tasks` and `delta-spec` with `stage: "change"`.
  - `readArchivedChangeRaw()` processes `tasks` and `delta-spec` with `stage: "archive"`.
- Add router tests that rendered/read endpoints do not bypass `DocumentService` for active change reading surfaces.
- Add web tests for active change artifact preview:
  - a hook-processed marker appears in active `specs/<id>/spec.md` preview;
  - a hook-processed marker appears in active `tasks.md` preview;
  - folder/code editor still shows source Markdown.
- Add archive regression tests where current code has coverage hooks.
- Run focused checks first:
  - `pnpm --filter @openspecui/server test -- src/document-service.test.ts src/router.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/opsx/artifact-output-viewer.test.tsx src/components/folder-editor-viewer.test.tsx`
- Before PR/archive, run the repo-required gates or a scoped subset with explicit justification if the parallel translation work keeps the global workspace dirty.
