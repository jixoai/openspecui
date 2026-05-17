## Implementation State

Implemented the approved Option A platform-law repair for active change artifact previews.

Current implementation:

- `DocumentService` now owns processed active change artifact reads for single-file artifact previews and glob artifact previews.
- `opsx.readArtifactOutput` / `opsx.subscribeArtifactOutput` call `DocumentService.readChangeArtifactOutput()` after warming the kernel dependency stream.
- `opsx.readGlobArtifactFiles` / `opsx.subscribeGlobArtifactFiles` call `DocumentService.readChangeGlobArtifactFiles()` after warming the kernel dependency stream.
- Existing folder/code-editor views remain source-mode through `change.subscribeFiles` / `archive.subscribeFiles`.
- Existing archive rendered reads remain routed through `DocumentService`; regression tests now lock processed archive tasks and delta specs.

## Decisions Taken

- Treat #140 reopening as a platform document-reading consistency issue.
- Preserve `onReadDocument` as the hook law; do not introduce a new hook surface for this bug.
- Separate reading surfaces from source/audit surfaces:
  - reading surfaces should consume processed Markdown from `DocumentService`;
  - source/audit editors should consume adapter/source content.
- Keep this OpenSpec change isolated from the active translation work.
- Keep the translation rendering pipeline untouched. The bug was in the backend document-read path feeding artifact previews, not in `TranslatableMarkdownViewer`.
- Keep `OpsxKernel` as the reactive warmup/dependency owner for artifact files, but stop using its raw artifact cache as the rendered Markdown payload.

## Divergence Notes

- The reporter's initial wording says "changes/spec" does not apply the hook, but current source shows `DocumentService.readChangeRaw()` already processes delta specs. The likely divergence is that one or more UI/router paths still bypass that service and read adapter/source content.
- `changes/tasks` flakiness is explained by mixed read paths: artifact preview used raw kernel artifact output, while other document reads could use `DocumentService`.
- `change.subscribeFiles` and `archive.subscribeFiles` intentionally remain raw because they feed folder/code-editor source inspection.
- No translation implementation files were changed for this bugfix, although existing translation work already had local edits in nearby files.

## Verification

- `pnpm --filter @openspecui/server test -- src/document-service.test.ts src/router.test.ts`
  - 17 test files passed
  - 102 tests passed
- `pnpm --filter @openspecui/server typecheck`
- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/opsx/artifact-output-viewer.test.tsx`
  - 1 test file passed
  - 2 tests passed
- `pnpm --filter @openspecui/web typecheck`
- `pnpm exec openspec validate fix-change-document-hook-rendering --type change --strict --no-interactive`

## Walkthrough Fixture

Added an ignored local fixture at `tmp/issue-140-hook-preview/` for manual verification and future walk-throughs.

The fixture contains:

- a real `openspec/openspecui.hooks.ts` that appends `HOOKED:<stage>:<kind>:<relativePath>` to processed document reads;
- an active change `hook-preview` with `tasks.md`;
- an active change delta spec at `specs/auth/spec.md`;
- a `walkthrough.ts` script that constructs `OpenSpecAdapter`, `ProjectHookRuntime`, and `DocumentService` against that fixture.

Walkthrough command:

```bash
pnpm exec tsx tmp/issue-140-hook-preview/walkthrough.ts
```

Observed result:

```text
PASS processed tasks preview includes hook marker
PASS processed delta spec preview includes hook marker
PASS raw source tasks stay unhooked
PASS raw source delta spec stays unhooked
```

This verifies the intended split directly:

- rendered active change `tasks.md` and `specs/**/*.md` previews are processed by `DocumentService` and see `onReadDocument`;
- raw source reads from `OpenSpecAdapter.readChangeFiles()` stay unprocessed for source/editor style views.

## Loopback Triggers

- If live reproduction proves `DocumentService` does not process active delta specs/tasks despite the current code shape, loop back and revise the diagnosis.
- If `opsx.subscribeArtifactOutput` already processes hooks and the bug comes from stale subscription/cache state, loop back and reframe the change around reactive invalidation.
- If fixing active change previews requires modifying translation components touched by `refine-document-translation-heading-projection`, pause and coordinate with that change before editing.
- If reporter screenshots reveal a source/editor view rather than a rendered reading view, loop back and discuss whether source-mode should remain intentionally raw.
