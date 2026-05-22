## User Input

同意这份参考图，请你开始优化界面和接口

1. 第一行的图标是打勾，和第二行相同，所以完全没必要出现第二行“Installed”，只需要实现hover icon显示 Installed 这个tip即可。这个技术在我们项目中很常用
2. NMT Model应该深度融合到顶部 Engine 的选择中。让用户觉得这是Engine的一部分。当选中NMT后，NMTModel的入口Button和Engine的Select将会组成一对Combox
3. 混合列表的返回数据的时候，分成连个接口来返回，优先返回本地的，再返回搜索的，然后在前端混合，但是列表要展示出一种“加载中”的状态，你可以用一个loading的图标即可
4. 这里的下载进度条会导致页面高度抖动，直接升级成“Download plan”这里卡片的title的inline-end位置提供一个圆形的下载进度，圆心中是数字百分比。还有ul-li列表提供具体的下载进度，比如：`[onnx/encoder_model_quantized.onnx      12.4 MB / 50.4 MB]`
5. 在开始工作之前，请基于目前参考图 [Image #5]，设计出一份新版的设计图

## Follow-up User Input

在当前 change 的基础上继续改进：

1. 页面加载时，Translation Settings 左侧始终显示 browser，说明初始选中引擎没有和已保存设置同步。
2. NMT 模型搜索面板需要自动 debounce 后触发搜索，不应要求用户按 Enter 才提交。
3. NMT 下载不应该把整个仓库当成一个文件包。需要把文件智能分组，并用 chips 让用户选择实际要下载的必要文件。
4. 同一个模型的不同量化版本，例如 int4、int2、float8，应该作为独立的下载选择，而不是被强制捆成一个整体。

## Second Follow-up User Input

继续扩展搜索面板和模型发现方式：

1. 搜索面板需要展示它能提供的 chips，以及每一个 chip 对应的大小。
2. 现在这种做法依赖仓库严格按规范命名文件，才能被识别；更高度定制的仓库后续再做兼容。
3. remote search 需要改成订阅式接口，服务端可以多次推送，把细节逐步补全。
4. 前端应尽快先把列表渲染出来，再随着订阅推送逐步补全 chip、size 和其他详情。

## Third Follow-up User Input

继续在现有 change 上收敛 NMT 发现与下载体验：

1. 页面加载时，Translation Settings 左侧不应该先闪成 browser；初始引擎必须和已保存设置同步。
2. NMT 模型搜索面板应自动 debounce 触发，不要要求按 Enter 提交。
3. NMT 的下载不应被理解成“整仓库下载”；需要把可识别文件智能分组，并用 chips 让用户选择必要部分。
4. 不同量化版本（如 int4 / int2 / float8）应作为独立下载选择，而不是强制合并成一个整体。
5. 搜索结果要暴露 chip 以及 chip 对应大小；本次仍限定在严格命名可识别的仓库边界内。
6. 远端搜索要改成订阅式增量补全：先渲染列表，再逐步补齐 chips、size、metadata。
7. 本次仍不扩展到任意自定义仓库布局识别。

## Objective Scope

This loop refines the NMT Settings experience and related interfaces:

- Present NMT model selection as a paired control with the Engine selector so it reads as one combined combobox-like surface.
- Remove redundant installed-state text from the main engine block and replace it with an icon tooltip treatment.
- Split local NMT model inventory and remote search into separate data sources, then merge them in the client with an explicit loading state.
- Replace the shifting download progress bar with a stable download-plan card that shows circular progress in the title row and line-level file progress.
- Update the interface so the user can understand selection cost through trend plus concrete size, and so unknown-size models remain non-selectable.
- Keep the initial selected engine synchronized with persisted settings on load, without flashing the browser default when another engine was previously saved.
- Make NMT model search fire automatically after debounce, rather than requiring explicit Enter submission.
- Group NMT runtime download files into explainable chips so the user can select only the necessary parts.
- Treat quantized variants such as int4, int2, and float8 as separate download choices instead of one forced full-repository download unit.
- Show discovered search results first, then progressively hydrate chip groups, chip sizes, and detail metadata through a subscription-based remote search stream.
- Expose chip-level size information in the search surface so the user can judge cost before committing to a download.
- Keep the current strict filename-based detection boundary for NMT model grouping; do not add a generic custom-repo detector in this loop.

## Non-Goals

- Do not change the broader translation-engine platform law again in this loop unless it is required to support the new UI contract.
- Do not remove the existing NMT asset lifecycle state machine from the server.
- Do not redesign unrelated Settings sections.
- Do not introduce a new generic model marketplace abstraction.
- Do not collapse grouped NMT downloads back into a flat "download the whole repo" model.
- Do not expand the model detector to arbitrary custom repository layouts in this loop; keep the current strict naming convention boundary for discoverability.

## Acceptance Boundary

- The engine block no longer shows a separate visible `Installed` row when the state is already represented by the success icon; tooltip-only affordance is acceptable.
- NMT Model is visually coupled to the Engine selector as one control family.
- Local models are returned separately from remote search results and are merged in the UI with a visible loading state while remote results are pending.
- The download-plan card title shows a circular progress indicator with the percentage centered inside it.
- The file list shows concrete per-file progress text rather than relying on a page-height-shifting progress bar.
- The model selector keeps unknown-size models disabled.
- The final UI preserves text wrapping and stable widths across the engine/model area.
- A previously saved translation engine is restored as the selected engine on initial render, without a browser-default flash.
- NMT search updates automatically after typing debounce and does not require Enter to be useful.
- The download plan is split into selectable chips/groups, and the default selection is the smallest necessary set of files for the chosen model.
- Quantized variants are presented as distinct chip choices, and the user can exclude unnecessary variants or auxiliary files before download.
- Remote search first renders a lightweight candidate list, then progressively enriches each item with chip groups, sizes, and additional metadata.
- Search results expose chip-level sizes wherever the repository layout can be recognized by the current strict naming rules.
