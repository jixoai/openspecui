## User Input

我们需要在 codemirror 中实现更多 filePreview 的能力。

和目前 Markdown 支持 livePreview 不一样，livePreview 的好处是改善预览的可读性；这里说的 filePreview，是指转化成特定的 MIME=`text/html` 内容来进行渲染。

1. 比如说 Markdown 内容的 filePreview，直接使用我们的 `MarkdownViewer` 组件。
2. 比如说 html 文件，直接使用 http static html server。这里为了最好的效果，需要后端配合，直接路由到一个静态服务，将目标文件的目录通过静态服务暴露出来，专门用来做预览效果。这样的设计是因为我们支持自定义后端，所以如果使用临时端口暴露出来的服务，可能跟这个自定义后端绝缘，因此我们不得不做一些取舍，统一使用这个自定义后端来提供服务。最终的链接路径类似于 `$BACKEND_API_ENDPOINT/$PATH_HASH/index.html`。这里的 `PATH_HASH` 是一个安全值，这个值和特定的目录和预览类型绑定，使用的时候需要先请求 `prepareStaticServer`，传入要预览的文件路径，基于文件路径解析出绝对路径和 mime，确保目标路径最终 resolve 出来是在进程的子目录下；确保 mime 是可预览的，然后就计算出 `PATH_HASH`。最终返回的是一个可访问的相对路径，比如 `$PATH_HASH/index.html`。
3. 还有其它不同 MIME 的文件，类似 video/audio/pdf/image 等，都可以在 html 预览技术类的基础上，实现其它类型的预览服务。虽然 video/audio/image 都可以直接预览，但是最好渲染成 html 再用 iframe 来嵌入。这样可以最大程度保持核心的干净，我们预览的效果也可以做得更丰富，因为是其它入口，不用担心和核心打架。所以 video/audio 请引入专业的播放器来提供播放，还有 pdf，请使用 `pdf.js` 来提供预览能力。图片的预览，也引入专业的 PhotoViewer 的库，最好别自己做，用别人专业的库，注意这些技术选型，都要对移动端友好。每一种 mime 的预览，编译的时候都应该有独立的 entry 的配置。

> 比如说我要预览 `openspec/yyy/xxx.mp4` 这个文件，所以我传入 `file=openspec/yyy/xxx.mp4`，后端确认出目录路径安全，同时确认出 `mime=video/mp4`，是合法可预览文件。于是后端最终返回是 `$PATH_HASH/mp4.html?xxx.mp4`，这里的工作原理是 `$PATH_HASH/resource/*` 会返回 `./openspec/yyy/*` 的文件内容，当然也是做了路径安全的检测，然后 `$PATH_HASH/**` 的其它路径，返回的是我们 `mp4.html` 这个入口编译出来的其它文件。`PATH_HASH` 是基于 `sha256(dir+mime)` 计算的，所以是稳定的值。

4. 预览能力不在静态导出的模式下提供，避免安全问题，而且这需要服务端的支持。
5. `changeDetail` 这个页面之前是支持编辑的，参考 config 页面的自定义 schema 工具栏。如果有这个工具栏，就可以放预览按钮和编辑按钮了。先检查一下，后端应该还有通用文件编辑接口。

实现以上需求，可以在 `changeDetail/archiveDetail` 页面的 Folder 的 `tabPanel` 中，实现 只读（目前的）、编辑（提供保存按钮）、预览 的功能。我建议将这组 `ButtonGroup` 放在 codemirror 上方。参考 Config 页面的自定义 Schema。这样就可以实现左侧是 `ModeButtonGroup`，右侧是 `Actions`。

在 worktree 中开始新的任务：

1. 了解项目架构如何实现这个功能，大概率是要开子包，记得 `pnpm dev` 是我们开发模式的入口，如果开了子包就要考虑到各种构建问题。
2. 寻找合适的库来更快更好地实现需求。但必须进行确切的技术调研，可以到 `/tmp` 目录下进行可行性测试，找到最合适的库。

## Objective Scope

This loop adds a backend-backed file preview platform for change/archive folder files and wires it into the shared Folder panel used by change detail and archive detail pages.

- File preview must be a MIME-aware platform capability, not a CodeMirror-only enhancement.
- Markdown file preview uses `MarkdownViewer` directly in the main web app.
- HTML, image, audio, video, and PDF previews use backend-prepared preview sessions and dedicated preview entries rendered through iframe-based HTML surfaces.
- The backend must own preview routing, path safety checks, preview session creation, and stable preview URL generation.
- Change detail and archive detail Folder tabs must expose read, edit, and preview modes from the same panel, with save-oriented actions for editable text files.
- The work must follow the actual development entry path used by `pnpm dev`, including the `packages/web/dist` watch-build contract used by the CLI/runtime.

## Non-Goals

- Do not conflate Markdown live preview in CodeMirror with file preview.
- Do not add preview support to static export mode.
- Do not introduce page-local special-case branching that bypasses shared core/server laws.
- Do not create a temporary-port preview service that is disconnected from custom backends.
- Do not build custom media, image, or PDF viewers when established libraries can provide the UX.
- Do not redesign the outer change/archive detail shells beyond what is required to host the Folder toolbar and modes.

## Acceptance Boundary

- Change/archive folder files expose enough metadata to distinguish text-readable files from binary preview-only files.
- The backend can prepare a safe preview session for a supported file path and return a stable preview-relative URL derived from directory plus preview MIME/kind.
- The backend can serve preview entry assets plus guarded directory resources through a unified preview route.
- Change detail and archive detail Folder panels support `Read`, `Edit`, and `Preview` modes with a toolbar above the editor area.
- Text-like files can be edited and saved through a shared entity file write interface.
- Markdown preview renders with `MarkdownViewer` without using iframe.
- HTML, image, audio, video, and PDF previews render through dedicated preview entries and iframe-backed URLs.
- Static export mode disables preview and edit behavior for this surface.
- The implementation includes verified library selection and targeted validation for build/type/test coverage.
