## User Input

使用openspec推进。

我没看明白你的交互。模型选中后，不是应该要出现一个下载按钮吗？

选中NMT后，应该联动出现NMT Model 的交互（二者应该紧密放在一起），并且如果搜索的列表中，没有出现已知尺寸，就不该可选。

选中模型后，如果确定本地没有安装，那么下载按钮会出现。

如果下载过，那么应该记录下载的进度。

如果下载过，那么打开NMTModel选择器的时候，本地模型应该出现在列表的最前面，并显示已经下载的进度。

如果已经下载，可以取消下载，可以恢复下载。也可以从本地删除。

1. 用户也能参与这个选择的过程，是吧？
2. 用户基本只会选择 target language，这是一个搜索的基础，能用于改进我们的排序。
3. 最终我们基于趋势进行混合排序。
4. 用户最终要决策的，基本都是基于趋势+模型体积 来决定最终的下载文件。

Implement the plan.

## Objective Scope

This loop upgrades NMT from a single extension-install step into a two-layer lifecycle:

- NMT engine package install remains a translation-engine platform concern.
- NMT model asset discovery, download, pause, resume, delete, and local cache state become a dedicated model-asset platform concern.
- Settings must present engine selection and NMT model management as one coherent control surface.
- The NMT model selector must merge remote Hugging Face search results with local cached models, pin local models to the top, and disable models with unknown concrete size.
- The selected NMT model must expose a direct action surface: download when absent, live progress during transfer, pause/resume controls, and delete for local cleanup.

## Non-Goals

- Do not persist per-model asset lifecycle state into global translation settings; only the selected model belongs there.
- Do not collapse browser, AI, and NMT into one special-cased code path.
- Do not introduce page-local hacks that bypass the server-side engine/model lifecycle boundary.
- Do not build a generic model marketplace abstraction beyond the current NMT lifecycle needs in this loop.

## Acceptance Boundary

- NMT package install and NMT model download are separate states with separate logs and controls.
- Selecting `NMT` in Settings reveals the model selector and model action surface in the same section.
- If the selected model has a known concrete download size and is not downloaded locally, a `Download` action is visible on initial render.
- If a model has no known concrete ONNX size, it is disabled in the selector and cannot be downloaded.
- Local models appear before remote-only models in the selector and show their local status/progress.
- Downloaded or partially downloaded models can be paused, resumed after restart-derived partial cache detection, and deleted from local cache.
- The server-side smoke path verifies `ensure engine package -> download model asset -> translate`.
