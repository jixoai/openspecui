## User Input

用户要求开两个新的子包：`@openspecui/nmt-translator`、`@openspecui/ai-translator`，目的是提供更多的引擎来实现翻译功能。

用户要求对翻译接口进行抽象与统一，其中大部分接口和官方 Web Translator API 一样，唯一差别是在官方 `translate` 接口上扩展出一种更适于 LLM 模型翻译的能力：

```ts
interface Translator {
  translate(input: string, options?: { signal: AbortSignal }): Promise<string>
  translate(
    input: { instructions: string; context: string; source: string },
    options?: { signal: AbortSignal }
  ): Promise<string>
}
```

用户说明 `instructions` 通常指翻译指令，比如保留 html 节点和属性、翻译属性内容、不要翻译 `xN` 和 `aN` 但翻译内容；`context` 通常指全文或相关 proposal/design 等内容；`source` 是具体要翻译的内容。

用户要求这是扩展包，按需加载安装，运行时需要识别目前通过什么方式运行（`pnpm dlx` / `npx` / `bunx` / `yarn dlx` / `vp dlx` / `local`），然后用对应依赖管理器安装扩展包。

用户要求 Settings 界面显示引擎选择器。

用户要求 Settings 界面显示安装日志，包括引擎下载中、下载进度、模型下载中、下载进度等；模型下载基于 `Translator.create`；这里是“单行日志”显示；可点击安装，也可点击取消。

用户要求 AI 引擎基于 tanstack-ai，需要配置 api base url 和 token。

用户补充未来也许会引入浏览器侧垫片，用纯粹的浏览器 JS 能力实现翻译是可能的，所以独立的 `browser-translator` 包有价值。

用户确认：

- NMT 引擎是 Server NMT。
- 扩展安装位置是 User cache。
- AI 凭据存 User settings。
- NMT 底座是 Transformers.js。
- 浏览器包是 Separate package，并说明这个包体积小，可以不通过下载直接内置，作为默认引擎。
- `local` 安装是 no-op builtin。
- 模型配置是 per engine。
- Token 存储是 User settings plaintext。
- 前期直接 `tsdown` 一起打包。
- 其它包通过 `npm:name` 关联，需要考虑本地开发模式兼容。

## Objective Scope

- 将当前 browser-only document translation 升级为统一 Translator Engine 平台。
- 新增三个正交 translator 原子包：
  - `@openspecui/browser-translator`
  - `@openspecui/nmt-translator`
  - `@openspecui/ai-translator`
- 在平台层定义统一 Translator contract、engine registry metadata、per-engine settings、安装状态、单行日志和取消机制。
- 通过用户级 cache 安装可选扩展包，并使用 npm alias 绑定稳定 runtime alias 到真实发布包。
- 在 local/dev 模式下，不触发网络安装；优先解析 workspace/source package 或 built dist。
- Settings 提供引擎选择、安装/取消、单行日志、NMT model 配置、AI base URL/token/model 配置。
- 文档翻译会话通过统一 engine 执行，避免不同 engine 的缓存结果互相污染。

## Non-Goals

- 不把 `@openspecui/ai-provider` 私有包直接作为发布扩展核心。
- 不把 NMT/AI 直接打包进主 CLI runtime 作为默认强依赖。
- 不在 web Settings 或 document translation hook 中硬编码多引擎分支网。
- 不在本轮实现完整浏览器 JS polyfill；只为 `browser-translator` 保留 provider 扩展点。
- 不要求 v1 支持所有 package manager 的深度进度百分比；必须有统一单行日志与可取消会话。
- 不把 AI token 加密存储；用户已确认明文 user settings，UI 掩码。

## Acceptance Boundary

- `@openspecui/core` 暴露统一 Translator/engine/settings 类型与 schema。
- 三个 translator package 存在并可通过 `tsdown` 构建。
- Server 提供 engine registry、安装会话、安装日志订阅、选择 engine 和服务端翻译入口。
- 可选 engine 安装使用 npm alias，例如 stable alias 指向 `npm:@openspecui/ai-translator@<range>`。
- local/dev 模式不安装远端包，能解析 workspace/source package。
- Settings 显示 engine selector、install/cancel、single-line log、AI 配置和 NMT model 配置。
- Browser engine 保持默认内置，当前浏览器翻译能力不回退。
- NMT/AI engine 未安装或缺配置时，UI 显示明确状态，不破坏 browser 默认路径。
- 翻译缓存 key 包含 engine/model/contract 维度。
- 发布影响包含 changeset。
