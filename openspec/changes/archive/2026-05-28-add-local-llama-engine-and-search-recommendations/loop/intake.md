## User Input

- 新增一个新的翻译引擎 `local-llama`。
- 底层需要动态安装 `node-llama-cpp` 这个包。
- 开发流程类似之前的 HuggingFace 引擎经验。
- 这一次需要支持的模型文件是 `gguf`。
- 本地测试验证请使用 `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` 这个模型。
- 这次要修复 HuggingFace 的通用搜索面板。
- 需要先找相关 specs，确认有没有记录但没有完整遵循需求。
- 没有做任何搜索输入的时候，要有一个默认搜索来提供推荐列表。
- 直接编写 OpenSpec change，一步到位，完成 llama 模型支持，直到做好版本发布前的准备，让我做最终验收。

## Objective Scope

- 新增 `local-llama` 翻译引擎，并纳入现有翻译引擎平台法则。
- 将 `node-llama-cpp` 作为按需动态安装的运行时依赖，而不是主包刚性强依赖。
- 让 `local-llama` 支持 GGUF 模型文件，并用 `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` 作为本地验证模型。
- 复用现有 installer strategy / runtime host detection / lifecycle gate 的平台能力，而不是写针对某个包管理器的硬编码分支。
- 修复 HuggingFace 通用搜索面板的空查询行为，使其在没有搜索输入时提供默认推荐列表。
- 用 BDD 驱动测试和多轮 self-review 把实现收敛到可发布前验收状态。

## Non-Goals

- 不在本轮引入与 `local-llama` 无关的新翻译引擎。
- 不把 `node-llama-cpp` 改造成主包刚性依赖。
- 不把搜索推荐逻辑做成无约束的全局搜索平台重写。
- 不在本轮执行正式发布动作。
- 不为了兼容旧行为而保留一套重复的搜索/推荐实现。

## Acceptance Boundary

- `local-llama` 通过统一翻译引擎平台暴露 lifecycle / install / runtime truth。
- `node-llama-cpp` 通过宿主 runtime package manager 策略动态安装，而不是强行固定为 npm。
- GGUF 模型可被 `local-llama` 识别、加载并用于本地验证。
- `tencent/Hy-MT2-1.8B-1.25Bit-GGUF` 可以作为本地测试验证模型走通完整流程。
- 搜索面板在空输入时必须提供默认推荐列表，不得空白或只剩下无意义的空状态。
- 推荐列表的生成与展示必须可测试、可重复、并符合现有搜索/lifecycle 平台法则。
- 相关 BDD 测试必须覆盖安装、模型加载、空查询推荐和最终 UI 流程。
