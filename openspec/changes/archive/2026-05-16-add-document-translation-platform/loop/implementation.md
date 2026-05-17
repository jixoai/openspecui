## Implementation State

- 当前阶段：正式 change 已实现并完成本地验证；待执行 OpenSpec archive 和 research worktree 清理。
- 已批准路径已落地：主线没有直接搬运 research worktree 的试验实现，而是抽象成“统一 Markdown reading/render pipeline + 文档翻译平台 + 通用 ToC 标签契约 + Spec heading 真实节点结构”。

## Decisions Taken

- 将本次需求定性为新的平台能力 `document-translation`，但它必须依附于统一 Markdown AST 处理管线，而不是 SPEC 页面局部功能。
- 翻译入口归属共享文档阅读 surface，优先挂在 ToC 顶部 header inline-end，而不是正文私有工具栏。
- Settings 负责翻译启用、目标语言配置和初始化状态；文档页只负责当前文档的翻译会话状态。
- 正式翻译实现不继续沿用正则/逐行路线，而是改为统一 Markdown AST 管线中的最终投影阶段。
- 翻译展示模式被提升为正式契约：默认 direct，可切换 bilingual。
- ToC 必须保持通用，只认 `data-toc-label ?? innerText` 的标签读取法则，不内嵌任何翻译模式判断。
- Spec requirement / scenario heading 必须从 pseudo-content 迁移到真实节点结构，避免文本选择和翻译失真。
- 自动检测原语言不以 `LanguageDetector` 为硬依赖，且默认不按每一行调用，必须具备文档级或块级降级路径。
- 正式状态机必须覆盖 `downloadable` / `downloading` / `translating` / `translated` / `cancelled` / `unavailable` 等用户可见状态。
- translation settings 属于有意共享的运行时全局设置；文档翻译中间态属于文档会话状态，不应跨 hosted session 共享。
- direct 模式必须保留 source-target 映射；hover / focus 原文预览是渐进增强，不应阻塞基础翻译上线。
- change archive 完成后必须移除前一轮 research 用的 `.worktree/translator-api` git worktree。

## Implementation Completed

- `@openspecui/core/document-translation` 定义了翻译配置 schema：启用状态、目标语言、direct/bilingual 展示模式，并接入 `OpenSpecUIConfigSchema`、持久化剪枝逻辑、默认静态配置和 server `config.update`。
- `MarkdownReadingPluginRegistry` 建立了 core 侧 Markdown reading 插件法则：插件通过唯一 `id` 注册，同名替换，按 `order` 再按 `id` 确定性排序；annotation/projection rules 共享同一 facts lookup。
- Web Markdown render 层新增命名 render processors：`MarkdownViewer` 按 `name/order` 合并处理器，heading processor 可投影 `tocDataLabel`、children、suffix、className 和 `data-*` attributes。
- `TranslatableMarkdownViewer` 将翻译作为文档阅读 surface 的最后投影层接入：它不修改源 Markdown，只在有 translation result 时追加最高优先级 processor 和 block annotations。
- `browser-translation` adapter 基于 Markdown facts 提取 heading/paragraph/listItem/blockquote segment，默认文档级 LanguageDetector，LanguageDetector 不可用时降级到 `en`，并保护 code、URL、文件路径和 HTML tag 等技术 span。
- Chrome Translator capability 状态覆盖 `available/downloadable/downloading/unavailable/missing/error`；Settings 启用翻译后会触发 probe/prepare，文档 session 使用 abortable controller。
- ToC 新增通用 `headerAction` slot，宽屏/窄屏都渲染同一 action；翻译按钮只通过 `TranslatableMarkdownViewer` 注入，ToC 本身不感知翻译状态或模式。
- ToC label 法则由文档 render projection 负责：direct 模式投影译文 label，bilingual 模式投影原文 label；ToC 消费 collector 中的 label，heading DOM 同步写入 `data-toc-label` 作为通用可观测属性。
- Spec requirement/scenario heading 从 pseudo-content 迁移到真实 `<span data-openspec-heading-label>` 与 `<span data-openspec-heading-title>`，可见文本、选择文本、语义属性和翻译源重新对齐。
- Settings 增加 Translation section，支持 enable、target language、display mode、capability/init 状态和手动 check；未启用时文档翻译按钮跳转到 `/settings#settings-translation`。
- Spec 页面和 artifact markdown output 均接入 `TranslatableMarkdownViewer`，翻译配置来自共享 `useConfigSubscription()`。
- 已修复 Chrome 验收发现的取消路径缺陷：`downloadprogress` listener 不再抛出 `AbortError`，abort 只由 `raceAbort` 负责 reject，避免浏览器全局 `pageerror`。

## Review Findings

- 架构 review 通过：翻译逻辑没有进入 ToC 原子；ToC 只接收通用 header action 与 collector label，模式选择由文档投影层完成。
- 当前 `data-toc-label ?? innerText` 的实现形态不是运行后 DOM sweep；React 渲染阶段用同一 projection result 同步写入 heading 的 `data-toc-label` 与 ToC collector label。这满足“不硬编码翻译逻辑到 ToC”的核心法则，同时避免 ToC 扫 DOM。
- 当前实现是 Markdown facts + React render projection 的 AST-native 产品化路线，而不是全站 HTML DOM 文本翻译器；这保持了本 change 的非目标边界。
- 静态模式当前安全默认 translation disabled，并通过 browser capability fail-closed；`SettingsStatic` 仍只暴露 Appearance，没有提供静态 translation 设置 UI。该点是后续体验 Radar，不阻塞本 change 的 dynamic document reading acceptance。

## Verification Evidence

- `pnpm lint:ci`
- `pnpm typecheck`
- `pnpm test:ci`
- `pnpm test:browser:ci`
- `pnpm --filter @openspecui/web build:ssg`
- `pnpm exec openspec validate --all --strict`
- `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/browser-translation.test.ts src/components/document-translation-action.test.tsx`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm exec prettier --check <task-owned files>`
- `git diff --check -- . ':(exclude)CHAT.md' ':(exclude).gitignore'`
- Chrome acceptance evidence: `.chat/translator-apis/evidence/implementation-acceptance-main.json`
  - direct/bilingual translation produced translated nodes.
  - disabled button navigated to `/settings?_b=%2F#settings-translation`.
  - narrow and wide ToC exposed translation action.
  - cancel path reported `beforePageErrors: 0` and `afterPageErrors: 0`.
  - Chrome exposed `Translator`; `LanguageDetector.availability()` remained `unavailable`, validating the fallback law.

## Verification Caveats

- `pnpm format:check` still fails because unrelated `CHAT.md` has existing formatting/trailing-whitespace changes. Task-owned files passed scoped Prettier check.
- SSG build emits pre-existing warnings for CSS `scroll-button` and `src/lib/trpc.ts` dynamic import chunking; build exits successfully.
- `pnpm exec openspec validate add-document-translation-platform --strict` is not the right CLI form in this installed OpenSpec CLI because the positional item is interpreted as a spec id unless type is supplied; `validate --all --strict`, `status --change`, and archive flow were used for change validation instead.

## Divergence Notes

- 前一轮 research 分支已经存在可运行实现，但本 loop 不把那份实现直接视为最终方案；需要先将其抽象成主线平台法则。
- 当前主仓存在与本任务无关的 `.gitignore` 与 `CHAT.md` 本地修改，因此本 loop 只新增 OpenSpec 变更文件，不触碰无关脏文件。
- 当前草案曾错误假设统一 Markdown AST 管线已经存在；实际代码只有 `react-markdown` 渲染入口和独立的 core facts/projection 资产，需要在实现前补齐正式共享契约。
- 实现阶段发现 Chrome cancel path 会把 `AbortError` 泄漏成 pageerror；该问题不需要重开架构讨论，已在既有 abortable session 法则内修复。

## Loopback Triggers

- 如果共享 ToC surface 无法在不破坏现有宽窄屏行为的前提下承载 header action slot，需要回到 research-plan 重新定义入口 surface。
- 如果 `Translator` 的真实初始化/下载语义无法被当前浏览器 API 稳定表达，需要回到 research-plan 重新定义 capability state contract。
- 如果自动原语言检测在没有 `LanguageDetector` 的条件下无法形成可靠降级，需要回到 research-plan 缩窄首版范围并改为显式 source pair。
- 如果现有 `react-markdown` 渲染入口无法干净承载“统一管线 + 最后一环翻译”，需要回到 research-plan 重新定义 Markdown rendering pipeline。
- 如果 ToC 无法在属性优先、文本回退法则下稳定消费标签，需要回到 research-plan 重新定义 heading/ToC 元数据接口。
- 如果 Spec heading 真实节点迁移会破坏当前语义或选择行为，需要先单独完成 heading law 升级，再挂入翻译插件。
- 如果 archive 阶段发现 `.worktree/translator-api` 含有未迁移的有效证据或报告，需要先确认报告已进入本 change 或 `.chat` 归档，再移除 worktree。
