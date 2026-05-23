## Research Findings

- 当前翻译实现集中在 `packages/web/src/lib/browser-translation.ts`，局部定义 `BrowserTranslator` 并直接调用浏览器 `window.Translator` / `window.LanguageDetector`。
- 当前 `useDocumentTranslation` 在 web 侧直接 probe browser translator 并调用 `translateMarkdownDocumentProgressively`；server 只参与 translation cache read/write。
- 当前 Settings 的 Translation section 内联在 `packages/web/src/routes/settings.tsx`，直接调用 `prepareBrowserTranslation` / `probeBrowserTranslation`，没有 engine registry 或扩展安装模型。
- 当前 `@openspecui/core/document-translation` 只包含 enable、target language、display mode、cacheEnabled 和 cache entry schema。
- 当前 `GlobalSettingsManager` 已经管理用户级 `~/.openspecui/settings.json`，适合扩展 AI 凭据、安装状态、per-engine 模型配置。
- 当前 server 已有 tRPC router、subscription 和 service 注入边界；新增 `TranslationEngineService` 可作为平台服务注入 `Context`。
- 当前 CLI/config 中已有 runner/user-agent 检测逻辑，但缺少 `vp` 和 user-cache extension install law；需要抽取新的 package-runner 工具，不复用 SSG export 的局部函数。
- 当前包构建已广泛使用 `tsdown`；新 translator 包应保持相同 package shape。
- `vp` 本机可用，并提供 `vp dlx`、`vp add`、`vp install`、`vp pm`。
- MDN Translator API 支持 `availability()`、`create({ monitor, signal })`、`downloadprogress` 和 `translate(..., { signal })`。
- Transformers.js 支持 translation pipeline，适合作为服务端 NMT 底座。
- TanStack AI OpenAI adapter 支持 OpenAI-compatible base URL/token 模式，可承载 AI translator。

## Decision & Plan (For Approval)

- 将翻译能力定义为平台法则：`Translator` contract + engine registry + install session + runtime resolver。
- `@openspecui/browser-translator` 是内置默认原子；首版封装 Web Translator API，未来可加入浏览器 JS polyfill provider。
- `@openspecui/nmt-translator` 是服务端 NMT 原子；基于 Transformers.js；模型配置 per engine。
- `@openspecui/ai-translator` 是服务端 AI 原子；基于 TanStack AI OpenAI provider；配置 baseURL/token/model。
- 可选扩展安装到用户级 cache，并使用 npm alias：
  - `@openspecui-runtime/nmt-translator` -> `npm:@openspecui/nmt-translator@<range>`
  - `@openspecui-runtime/ai-translator` -> `npm:@openspecui/ai-translator@<range>`
- local/dev resolver 优先解析 workspace/source package，安装操作为 no-op。
- Settings 拆分 Translation panel，避免继续膨胀 settings route。

## Capability Impact

### New or Expanded Behavior

- 用户可在 Settings 选择 browser/NMT/AI 翻译引擎。
- NMT/AI 可按需安装、取消安装，并显示单行日志。
- AI 可配置 base URL、token、model。
- NMT 可配置 model。
- 文档翻译通过统一 engine 执行，缓存按 engine/model 隔离。

### Modified Behavior

- Browser translation 从 web 内部函数升级为 `@openspecui/browser-translator` 原子包。
- Settings Translation section 从 browser capability 控制升级为 engine platform 控制。
- translation config 增加 engineId 和 per-engine model 维度。

## Risks and Mitigations

- 风险：真实 package-manager 进度难以标准化。缓解：v1 统一为单行日志和 stdout/stderr 摘要，模型下载可提供百分比时再映射进 progress。
- 风险：optional package 动态 import 在 bundled CLI 中解析复杂。缓解：server resolver 从用户级 cache package root 或 workspace package root 创建 import URL，不依赖 platform direct import。
- 风险：AI/NMT 依赖较重影响主包体积。缓解：只作为可选扩展安装；主包只包含协议与 registry metadata。
- 风险：local/dev 与 published runtime 路径分裂。缓解：只分 resolver 策略，不分业务 API；local install no-op，alias metadata 仍一致。

## Verification Strategy

- Core unit tests 覆盖 schema defaults、engine metadata、cache key 维度。
- Server unit tests 覆盖 install command generation、local resolver、session cancel/log。
- Translator package tests 覆盖 browser adapter signal/progress、NMT/AI config validation 和 translate contract。
- Web tests 覆盖 Settings engine selector、install/cancel log、masked token、static/local unavailable。
- 构建检查包括新增包 `tsdown` build、web SSG build 和 CI-equivalent checks。
