## User Input

> 我们新增一个新的翻译引擎，local-llama，底层需要动态安装 node-llama-cpp 这个包。所以开发流程类似，你已经有两个和 huggingface 相关的引擎开发经验了，这一次我们需要支持的模型文件是 gguf。本地测试验证，请使用 tencent/Hy-MT2-1.8B-1.25Bit-GGUF 这个模型来测试。顺便这次好好修复这个 huggingface 的通用搜索面板。你找一下相关的 specs，我觉得应该有记录而没有完整遵循我的需求。总的来说就是没有做任何搜索输入的时候，要有一个默认的搜索来提供推荐列表。
>
> 你直接编写 openspec change，一步到位，完成 llama 模型的支持，直到做好版本发布前的准备，让我做最终验收

## Objective Scope

- Keep the original `local-llama` feature work separate from its remaining verification gap.
- Add a platform-level runtime compatibility truth for managed local engines, starting with `local-llama` GGUF groups.
- Surface a selected-group runtime incompatibility before document translation starts, instead of failing only after `batchTranslate()` creates the runtime model.
- Reconcile the archived `add-local-llama-engine-and-search-recommendations` completion claim with current evidence so release readiness reflects repo truth.

## Non-Goals

- Do not pretend the current `node-llama-cpp` baseline can load `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` if real verification still fails.
- Do not hardcode a `Tencent`-specific special case in the UI or service layer.
- Do not reopen the already archived feature change just to record a new runtime compatibility rule.
- Do not expand this loop into a full upstream `llama.cpp` / `node-llama-cpp` fork or custom STQ runtime patch.

## Acceptance Boundary

- The remaining `local-llama` platform gap is documented as a new OpenSpec loop with current evidence.
- The server can produce a runtime compatibility verdict for the selected managed-local group and expose that verdict through existing lifecycle/readiness surfaces.
- `local-llama` readiness blocks translation when the selected GGUF group cannot be loaded by the current runtime, with an explicit compatibility message instead of a late generic failure.
- Focused tests cover the new compatibility verdict path and the readiness gating behavior.
- Verification evidence clearly distinguishes:
  - platform chain success with a currently supported GGUF model, and
  - current runtime incompatibility for `tencent/Hy-MT2-1.8B-1.25Bit-GGUF`.
