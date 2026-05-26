## Implementation State

Platform-first implementation is now in place across `core`, `server`, `web`, and `cli`.

Completed execution slices:

1. `packages/core`
   - added shared file preview primitives in `src/file-preview.ts`
   - extended `ChangeFile` metadata with `mime` and `previewKind`
   - changed entity file loading so only text-like files carry inline `content`; binary files now stay metadata-only
2. `packages/server`
   - added guarded entity path resolution for change/archive file writes
   - added `change.writeFile`, `archive.writeFile`, `change.prepareFilePreview`, and `archive.prepareFilePreview`
   - added backend-owned preview sessions under `/api/file-preview/:hash/*`
   - bound preview session hashes to `sha256(dir + mime)` and rewrote preview asset references to the session-local route prefix
3. `packages/web`
   - replaced the folder panel with `Read / Edit / Preview` modes and toolbar actions above CodeMirror
   - kept Markdown preview inline with `MarkdownViewer`
   - moved archive folder editing back onto source files instead of processed artifact content
4. `packages/web` preview entries
   - kept dedicated entries inside the existing multi-entry `packages/web/dist` build contract
   - image preview uses Yet Another React Lightbox inline/zoom mode
   - audio/video preview uses Vidstack custom elements with the community skin
   - PDF preview uses `pdfjs-dist` with a dedicated worker asset
5. Verification
   - scoped type/tests/build checks are passing for the touched packages and preview entries
   - CI-equivalent local gates passed:
     - `pnpm format:check`
     - `pnpm lint:ci`
     - `pnpm typecheck`
     - `pnpm test:ci`
     - `pnpm test:browser:ci`
   - live acceptance on a prepared temp project passed at `http://localhost:3210`
     - change Folder flow verified for `README.md` read/edit/save/reload plus HTML/image/audio/video/PDF preview
     - archive Folder flow verified for `reports/summary.md` read/edit/save/reload plus image/audio preview
     - preview fixtures were restored after automation so the temp project remains clean for manager acceptance
   - live acceptance uncovered one real platform bug:
     - `pdfjs-dist` worker URLs stayed rooted at `/assets/*` inside preview sessions, so PDF preview failed behind `/api/file-preview/:hash/*`
     - fixed by upgrading backend preview asset rewriting so text-like preview assets (`.html`, `.js`, `.mjs`, `.css`) all rewrite `/assets/` to the session-local `/api/file-preview/:hash/assets/` prefix
     - added server startup regression coverage for preview asset JS rewriting
   - second-round preview polish is now in place and live-verified:
     - CodeMirror now auto-loads CodeMirror language support by filename for broad text-like syntax highlighting, while preserving Markdown live preview behavior
     - binary preview-only files (`image/audio/video/pdf`) now default to `Preview` and disable `Read`/`Edit`
     - remote preview iframes are height-clamped inside the Folder panel and support toolbar-driven maximize dialog rendering
     - preview entry roots were refactored to size against the iframe container instead of `100vh`
     - Vidstack preview entries required `media-icons` in addition to the skin CSS; after adding it, audio/video controls render with the expected visible player chrome
   - focused live polish acceptance passed at `http://localhost:3210`
     - report: `/tmp/openspecui-file-preview-TI0hiD/acceptance-artifacts/file-preview-polish-report.json`
     - screenshots:
       - `/tmp/openspecui-file-preview-TI0hiD/acceptance-artifacts/screenshots/polish-video-maximized.png`
       - `/tmp/openspecui-file-preview-TI0hiD/acceptance-artifacts/screenshots/polish-audio-preview.png`
   - final visual-law refinement is now in place and verified by build plus preview action checks:
     - preview surfaces no longer use rounded corners, matching the product's hard-edge shell direction
     - non-interactive preview containers dropped extra borders so content panes no longer visually compete with actual buttons
     - maximize preview dialog now renders as a borderless hard-edge panel while preserving the shared dialog platform
   - media preview interaction surfaces were tightened once more after live dark-theme review:
     - Vidstack menu hover/touch-hover states now blend against the preview card layer instead of collapsing toward the page background
     - explicit menu-item hover overrides prevent playback-rate entries from falling back to inconsistent dark default fills

## Decisions Taken

- This work uses the repository’s `opsx-collab-pr-loop` schema rather than the older proposal/design/tasks flow.
- The feature is treated as a platform law upgrade instead of a page-local patch.
- Preview routing will be backend-owned and mounted under `/api/file-preview/:hash/*`.
- Markdown file preview will stay inside the main app via `MarkdownViewer`; iframe-backed preview is reserved for HTML/image/audio/video/pdf surfaces.
- Preview entries will live inside `packages/web` and participate in the existing `packages/web/dist` watch-build contract used by `pnpm dev`.
- Audio/video preview will use Vidstack web components.
- Image preview will use Yet Another React Lightbox inline/zoom mode.
- PDF preview uses `pdfjs-dist` directly instead of coupling the platform contract to `react-pdf`.

## Divergence Notes

- The user originally suggested a possible new subpackage. Research showed that the existing dev/runtime law is centered on `packages/web/dist`, so the current implementation plan keeps preview entries in `packages/web` instead of creating a new package.
- The archive detail route still renders processed artifact content in the primary artifact/content tabs, but the Folder tab now intentionally reads source files so edit/save works on the real files instead of processed markdown.
- The CLI produced one transient inconsistency immediately after `openspec new change`, where `status --change` briefly failed to find the just-created change. The change exists on disk and `openspec list --json` now sees it, so this is treated as tool noise rather than a product blocker.

## Loopback Triggers

- If multi-entry preview assets cannot be served cleanly from the session route shape, return to research-plan before inventing route-local hacks.
- If entity file write support exposes an architectural conflict between live subscriptions and non-reactive writes, return to research-plan and align the write path with the reactive file system law first.
