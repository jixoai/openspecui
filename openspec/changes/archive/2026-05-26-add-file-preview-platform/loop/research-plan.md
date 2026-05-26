## Research Findings

- `packages/core/src/schemas.ts` currently models `ChangeFile` as `{ path, type, content?, size? }` and has no MIME or preview metadata, so binary-safe preview cannot be expressed cleanly yet.
- `packages/core/src/adapter.ts` and `packages/core/src/reactive-fs/reactive-fs.ts` currently read files as UTF-8 text when building change/archive file listings. This is correct for text inspection but wrong as the platform law for general file preview.
- `packages/web/src/components/folder-editor-viewer.tsx` is currently a read-only text viewer driven by `useChangeFilesSubscription` / `useArchiveFilesSubscription`.
- `packages/web/src/routes/config.tsx` already provides the exact toolbar language we want for mode switching: a `ButtonGroup`-based read/preview/edit control with actions on the opposite side.
- The existing change/archive detail shells stay thin; the correct ownership point for this feature is the shared Folder tab panel, not the outer detail layout.
- The backend currently has several safe write patterns for schema/config files in `packages/server/src/router.ts`, but it does not yet expose a generic entity file write interface for `change` and `archive` stages.
- `pnpm dev` uses `scripts/lib/dev-task-definitions.ts` to watch-build `packages/web/dist`; the CLI/runtime then serves that built output. This means preview entries should be added to `packages/web` build inputs rather than introduced as a separate runtime package.
- `packages/cli/src/index.ts` and `packages/cli/src/web-assets.ts` show that the server resolves web assets from `packages/web/dist` in the monorepo and from copied CLI assets in packaged runtime mode.
- Static mode in `packages/web/src/lib/use-subscription.ts` and `packages/web/src/lib/static-data-provider.ts` is snapshot-driven and does not have backend-backed preview/session support. The requirement to disable preview/edit in static mode aligns with the current architecture.
- Local `/tmp` feasibility testing confirmed these library and build facts:
  - `vidstack@0.6.15` web components compile successfully with Vite 8 and React 19 and are suitable for framework-decoupled audio/video preview entries.
  - `yet-another-react-lightbox@3.32.0` with `Inline` and `Zoom` plugins compiles successfully as a dedicated image preview entry and provides touch/zoom support suitable for mobile.
  - `react-pdf@10.4.1` compiles, but its worker integration under Vite 8/Rolldown produces a runtime-resolution warning with the recommended `new URL(...)` pattern, and `?url` import resolution failed in the spike. This increases bundler coupling risk for the preview entry.
  - Because the requirement explicitly asks for `pdf.js`, using `pdfjs-dist` directly for the dedicated PDF preview entry is the cleaner long-term platform law.
- Existing build tests and route proxying already support `/api` traffic through the backend in dev mode, so placing preview HTTP serving under `/api/file-preview/:hash/*` fits the current runtime shape without extra frontend proxy complexity.

## Decision & Plan (For Approval)

Implement the file preview platform as a core/server/web law upgrade, not as a Folder-page patch.

1. Add a shared file preview primitive in `packages/core`:
   - infer MIME from file path;
   - classify preview kind (`markdown`, `html`, `image`, `audio`, `video`, `pdf`, `text`, `unknown`);
   - distinguish text-readable files from binary/preview-only files.
2. Extend `ChangeFile` metadata so change/archive listings can represent MIME and preview capability without forcing `content` for every file.
3. Update the adapter/entity read path so `content` is only populated for text-like files.
4. Add a server-side entity file path helper:
   - resolve `change` and `archive` roots safely;
   - validate relative paths;
   - support a shared `writeEntityFile(stage, id, path, content)` mutation for editable text files.
5. Add a preview session service in `packages/server`:
   - validate previewable file path and MIME;
   - bind preview sessions to a directory and preview kind;
   - compute stable session keys from `sha256(dir + previewKindOrMime)`;
   - serve preview assets plus guarded directory resources from `/api/file-preview/:hash/*`.
6. Add dedicated preview entries in `packages/web` build inputs:
   - HTML entry or passthrough session support for HTML files;
   - image entry using `yet-another-react-lightbox`;
   - audio/video entries using Vidstack web components;
   - PDF entry using `pdfjs-dist` directly.
7. Upgrade `FolderEditorViewer` into a mode shell:
   - `Read`: current text reading behavior;
   - `Edit`: local draft + save/revert for text-like files;
   - `Preview`: Markdown inline viewer or iframe-backed prepared preview URL.
8. Disable preview and edit in static mode and present a clear disabled state rather than pretending the feature exists.
9. Validate with focused core/server/web tests plus web build verification for the added preview entries.

## Capability Impact

### New or Expanded Behavior

- Change and archive folder files gain first-class preview metadata and MIME-aware handling.
- The backend can prepare and serve dedicated preview sessions through the primary API server.
- Folder panels in change/archive detail pages support read, edit, and preview workflows from one shared surface.
- Audio, video, image, HTML, and PDF preview behavior become independently extensible through dedicated web preview entries.

### Modified Behavior

- Change/archive file listing is no longer “all files are UTF-8 text until proven otherwise.”
- `FolderEditorViewer` stops being read-only.
- Preview is no longer equivalent to CodeMirror’s Markdown live preview.
- Static mode explicitly refuses preview/edit instead of sharing the live-mode assumptions.

## Risks and Mitigations

- Risk: MIME detection may be incomplete or extension-based heuristics may misclassify edge cases.
  Mitigation: keep MIME inference centralized in `packages/core`, restrict previewability to an explicit allowlist, and default unknown files to read-only/no-preview.

- Risk: binary-safe file listing could break existing consumers that assume every file has `content`.
  Mitigation: extend metadata compatibly and update Folder consumers together with targeted type coverage.

- Risk: preview route path collisions between preview assets and served directory resources.
  Mitigation: reserve a dedicated resource namespace such as `/resource/*` inside each preview session.

- Risk: PDF preview entry could become unstable if worker/runtime asset handling is implicit.
  Mitigation: use direct `pdfjs-dist` integration and explicitly control the worker/resource story in the dedicated preview entry.

- Risk: preview entry assets may not be reachable when served from session-relative routes.
  Mitigation: align `packages/web` multi-entry output with backend asset resolution and test the actual built output shape through `build:dist`.

- Risk: edit mode could expose binary files or unsupported files to the text editor.
  Mitigation: only enable edit for text-like files as classified by the shared core primitive.

## Verification Strategy

- Core:
  - add tests for MIME inference, preview kind classification, and text/binary gating;
  - add adapter/entity tests proving binary files do not force `content`.
- Server:
  - add route/service tests for safe entity path resolution, preview preparation, and guarded preview resource serving;
  - add tests for entity file write mutation behavior.
- Web:
  - add Folder viewer tests for mode switching, disabled static behavior, save behavior, and Markdown preview;
  - add targeted tests or smoke coverage for preview URL preparation logic.
- Build/runtime:
  - run `pnpm --filter @openspecui/core typecheck`
  - run `pnpm --filter @openspecui/server typecheck`
  - run `pnpm --filter @openspecui/web typecheck`
  - run targeted `vitest` suites for new core/server/web units
  - run `pnpm --filter @openspecui/web build:dist` to verify preview multi-entry output
- Manual acceptance:
  - verify change detail and archive detail Folder tabs in live mode;
  - verify preview disabled in static mode;
  - verify at least one HTML/image/video/PDF flow against the backend preview route.
