## Research Findings

- 主仓当前仍在 `main` 分支，且前一轮 `translator-api` worktree 中的实现尚未并入主线，因此本次工作首先需要把翻译从 research 结论提升为正式平台契约。
- 现有文档阅读 surface 已经有明确共享原子：
  - `packages/web/src/components/toc.tsx` 提供宽窄屏自适应的 ToC shell；
  - `packages/web/src/components/markdown-viewer.tsx` 提供带 ToC 的顶层 Markdown 阅读布局；
  - `SpecMarkdownDocument` 已经被确认为 SPEC 文档的共享增强入口。
- `packages/web/src/components/markdown-content.tsx` 当前通过 `react-markdown + remark-gfm` 直接从 Markdown 字符串渲染 React 节点，并在组件层投影 block/inline annotations；它还没有一个正式的、可注册可替代可排序的 Markdown AST 处理管线。
- `packages/core/src/markdown-facts.ts` 已经证明仓库具备 AST 基础设施，但当前 facts / projection / rendering 仍未被统一成一条正式的平台处理链路。
- `packages/web/src/routes/settings.tsx` 已经承载越来越多运行时全局设置，并且通过 ToC sections 管理大页面导航，因此翻译配置应该进入现有 Settings 平台，而不是新建独立页面。
- 当前仓库已有稳定的“共享设置 + 页面跳转 + 锚点 section”法则：例如 Notifications、Hosted App、Terminal 等都在 Settings 内拥有独立 section。
- `packages/web/src/routes/settings-static.tsx` 当前只暴露少量静态设置能力，这说明翻译设置必须补充静态模式降级法则，不能默认假设所有 Settings 能力都在 static 中可用。
- 前一轮 research 已经证明：
  - Chrome `Translator` 在真实 localhost 页面可用，但必须处理 `availability()` 的状态语义；
  - `availability` 可能返回 `downloadable` 或 `downloading`，因此“初始化中/下载中”是正式产品必须纳入的状态；
  - `LanguageDetector` 在同一环境下仍可能 `unavailable` 并在 `create()` 时报 `NotSupportedError`；
  - Markdown-first、protected-token-first、structure-preserving 的翻译法则是当前唯一可靠基线。
- 前一轮 experiment code 已经给出一条重要产品事实：`useMarkdownTranslation` 只覆盖了 `source / translated` 切换和运行时翻译，没有正式解决 Settings 授权、目标语言持久化、ToC 顶部入口、初始化下载状态、以及用户级取消模型。
- 前一轮 experiment code 采用的是“protected token + line-by-line”路线。这条路线对 research 有价值，但对正式产品存在三个结构性缺陷：
  - 它不是 AST-native，难以稳定表达双语模式的 block/inline 布局法则；
  - 它不是现有 Markdown 渲染链路的最后一环，容易和已有 projection/annotation 逻辑形成双轨；
  - 它无法天然为“hover 看原句”提供稳定的 source-target span 映射。
- 现有共享 `Button` 原子已经支持与 `variant` 正交的 `activity` 状态；这为“翻译中但可取消”“当前已翻译”提供了可借用的状态建模基础，但翻译按钮不是普通 fulfilled action，仍需要独立状态机，而不是简单套用 `activity`。
- `Toc` 当前宽窄屏结构是：
  - 窄屏：顶部可折叠条；
  - 宽屏：侧边栏常驻导航。
    用户要求“在 ToC 顶部 inline-end 位置”放按钮，说明翻译入口应属于 ToC header surface，而不是文档正文控制栏。
- `Toc` 当前只消费 `TocItem.label` 这个纯文本字段，并没有一个“属性优先、文本回退”的标签来源法则；如果直接把翻译逻辑塞进 ToC，会污染共享导航原子。
- `MarkdownViewer` 已经支持 `headingTransform` 返回 `tocLabel`，这说明更合理的法则是由文档渲染层投影 ToC 标签，ToC 只负责消费结果。
- `SpecMarkdownDocument` 当前把 requirement / scenario 的可见标题文本放在 `data-openspec-label` / `data-openspec-title` 上，再通过 `index.css` 中的 `::before` / `::after` 渲染；这会让文本选择、翻译、以及 source-target span 对齐都失真。
- 仓库当前没有现成的 `icon-button.tsx` 共享原子，但已有多个“primary icon button”样式约定可复用，例如 notifications panel 与 sound preview 等场景中的 `border-primary` / `bg-primary` icon button。
- 仓库已有可复用的 hover surface：
  - 简单说明类可以复用 `Tooltip`；
  - 需要承载原句全文时可以复用现有 native `popover` 模式。
    这意味着“直接翻译模式 hover 看原句”可以作为渐进增强接入。
- 对 `LanguageDetector` 的合理粒度判断是：
  - 不应默认按“每一行一次”调用；
  - 当前 API 本身不稳定，逐行调用会放大延迟、抖动和误判；
  - 文档类 Markdown 通常在语言上呈块级一致，检测更适合按文档或较大语义块进行，并做缓存与回退。

## Decision & Plan (For Approval)

将本次需求定义为一个平台法则升级：`document-translation` 建立在统一 Markdown AST 处理管线之上，而不是一个独立页面功能。

实施上采用六层法则，而不是页面补丁：

1. 统一 Markdown AST 管线层
   - 新增一条共享 Markdown AST 处理管线法则，服务于 Spec 增强、ToC 标签投影、以及翻译投影。
   - 每个处理环节必须具备：
     - 唯一名称：用于替换和排障；
     - 动态注册：运行时可插拔；
     - 可替代：同名插件可显式替换；
     - 可排序：通过 `order:number` 决定执行顺序。
   - 管线应区分“结构事实 / 语义增强 / 渲染投影”三个层次，避免把翻译和 Spec 语义直接揉成一个阶段。
   - 当前 `react-markdown` 渲染入口与 core `markdown-facts` 不构成现成统一管线，因此这次 change 必须先建立契约，再开始实现。

2. 文档翻译平台层
   - 新增 `document-translation` 正式能力 spec。
   - 定义“浏览器侧翻译投影”是唯一正式翻译路径。
   - 翻译只作用于共享 Markdown 文档 surface，不修改源文档，不生成第二份持久化文档真相。
   - 翻译实现保持 AST-native、Markdown-first、protected-token-first、structure-preserving。
   - 翻译必须位于统一 Markdown AST 处理管线的最后一环：现有 facts、OpenSpec 语义增强、ToC 标签投影都继续基于原始 Markdown；最终仅在渲染前对 AST 应用翻译投影。

3. 翻译展示模式层
   - 支持两种正式模式：
     - direct：默认；只显示目标语言；
     - bilingual：同时显示原文和目标语言。
   - direct 模式要求为翻译 span 保留 source-target 映射；hover / focus 原文预览作为渐进增强接入，不作为首版可用性的硬阻塞。
   - bilingual 模式要求区分布局法则：
     - `h1` / `h2` / `li` 等短结构采用 inline append；
     - 段落、blockquote、table-like prose 等采用 block stack，译文与原文分行。
   - ToC 标签投影法则：
     - direct 模式下，文档投影层应把译文写入 `data-toc-label`；
     - bilingual 模式下，文档投影层应把原文写入 `data-toc-label`；
     - ToC 本身只执行“`data-toc-label ?? innerText`”读取法则，不感知翻译模式。

4. 文档页入口层
   - 将翻译入口并入共享 ToC 顶部 surface，在 header 的 inline-end 放置 icon-primary button。
   - 按钮状态至少包括：
     - idle / source：未翻译，显示 `border-primary`
     - translating：正在翻译，显示 active/pending 视觉，并允许点击取消
     - translated：已翻译，显示 `bg-primary`
     - blocked-by-settings：未启用时点击跳转到 Settings 指定 section
   - 当前正式接入范围优先限定在共享 Markdown 文档视图，如 spec detail 与 artifact markdown viewer。

5. 全局设置、静态/hosted 边界与初始化层
   - 在 Settings 中新增 Translation section，并纳入 ToC。
   - 配置项至少包括：
     - Enable Translation
     - Target Language
     - Translation Display Mode
     - Chrome AI / Translator capability status
     - 初始化/下载状态说明
   - 启用翻译后立即触发 capability probing 与语言包初始化。
   - 若 `Translator.availability()` 为 `downloadable` 或 `downloading`，设置页必须把状态表达为初始化中，而不是把功能误判为不可用。
   - Translation settings 属于运行时全局设置，应跨页面共享；但“当前文档是否已翻译 / 是否正在翻译”属于文档会话状态，不能持久化成新的全局文档真相。
   - hosted 模式下，translation settings 仍属于有意共享的全局设置，不应被 session-scoped tab state 覆盖；但文档级翻译会话和中间态不应跨 hosted session 共享。
   - static 模式下，若浏览器不具备 Translator 能力，UI 必须把 translation settings 表达为不可用或受限，而不是假装具备 live runtime 行为。
   - 原语言默认走“文档级或语义块级自动检测”法则，但不能把 `LanguageDetector` 作为硬依赖：
     - 不默认按每一行调用 `LanguageDetector`；
     - 优先按文档或较大 block 复用检测结果；
     - 当 `LanguageDetector` 可用时再作为增强能力；
     - 当其不可用时必须安全降级，而不是阻止整个翻译功能。

6. Spec heading 结构迁移层
   - Spec requirement / scenario heading 必须从 pseudo-content 迁移到真实节点结构。
   - 目标结构应允许类似：
     - heading 本体持有语义属性；
     - 内部前缀 label 通过真实 `<span>` 渲染；
     - 标题正文保留为真实可选中文本节点。
   - 这条法则既服务于翻译，也修正当前文本不可选择、ToC/语义/可见文本分离过度的问题。

Spec 归属建议：

- 新增 `document-translation` capability spec：
  - 定义统一 Markdown AST 管线内的翻译插件、浏览器侧翻译投影、模式切换、原句悬浮查看、目标语言配置、初始化/download 状态、取消翻译、自动源语言检测降级法则。
- 修改 `opsx-ui-views` spec：
  - 为 Settings 增加翻译设置 section；
  - 为文档阅读页面增加 ToC 顶部翻译入口、ToC 标签读取法则、与未启用跳转法则。
- 修改 `web-rendering` spec：
  - 为静态/hosted/全局设置边界补充 translation settings 契约。

实现阶段建议拆成以下任务组：

1. 统一 Markdown AST 管线
   - 抽象共享处理器注册表；
   - 定义命名、替换、排序模型；
   - 把当前 Spec heading 增强和 ToC 标签投影迁入这条共享管线。

2. 设置与状态法则
   - 定义 translation settings storage schema；
   - 在 Settings 中落 Translation section 与 ToC；
   - 建 capability probing / init status hook。
   - 增加 translation display mode 配置。

3. AST 翻译投影法则
   - 将 translation projection 从正则/逐行方案升级为 AST-native 方案；
   - 明确它是统一管线的最后一环；
   - 生成 source-target 对照元数据，供 direct mode 原文映射、可选预览 surface、与 bilingual mode 布局使用。

4. ToC 与 heading 契约升级
   - 定义 `data-toc-label ?? innerText` 读取法则；
   - 把 heading projection 暴露为属性优先、文本回退的统一标签来源；
   - 将 Spec heading 的 pseudo-content 改为真实节点结构。

5. 文档入口与按钮状态机
   - 抽象 ToC header action slot；
   - 落翻译 icon button；
   - 建文档级 translation session state，包括 cancel 机制。

6. Chrome Translator 正式接线
   - 将 research 中的 capability adapter 与 markdown projection 整理进主线；
   - 补充 `downloadable / downloading / unavailable / missing / error` 的正式产品语义；
   - 定义 document-level / block-level source language detection 的降级策略。

7. 首批接入与验证
   - `SpecMarkdownDocument`
   - artifact markdown viewer
   - 宽窄屏 ToC 行为
   - Settings 跳转与初始化状态
   - direct / bilingual 模式渲染
   - source-target 映射与可选原句预览 surface

## Capability Impact

### New or Expanded Behavior

- OpenSpecUI 将新增正式的统一 Markdown AST 处理平台法则，而不是让 Spec、ToC、翻译各自做局部字符串处理。
- OpenSpecUI 将新增正式的文档翻译平台能力，而不是试验性页面局部控件。
- Markdown 文档阅读 surface 将拥有统一的翻译入口与共享状态模型。
- 文档翻译将拥有正式的显示模式契约：direct 与 bilingual。
- Settings 将新增翻译功能配置、目标语言配置与 Chrome Translator 初始化状态展示。
- 浏览器侧翻译将具备正式的 capability-aware 初始化、下载与取消机制。
- 翻译结果将保留 source-target 映射，以支撑原句浮层与双语布局。
- Spec heading 可见文本将由真实 DOM 节点承载，而不再主要依赖 pseudo-content。

### Modified Behavior

- 共享 ToC surface 需要支持一个 header 级 action slot，而不再只显示标题/折叠控件。
- 共享 ToC 的标签来源需要从单一 `label` 文本扩展为“属性优先、文本回退”的通用读取法则。
- 文档页的翻译交互不再依赖正文上方独立控制栏作为唯一入口。
- 翻译实现从 research 阶段的正则/逐行路线调整为统一 AST 管线中的最后一环路线。
- 自动源语言检测从“理想依赖 `LanguageDetector`”调整为“可增强、不可硬依赖、且默认不按行调用”的降级法则。
- Spec requirement / scenario heading 的样式实现从 `::before` / `::after` 伪内容迁移到真实节点结构。

## Risks and Mitigations

- 风险：误以为当前已经存在统一 Markdown AST 管线，会让实现阶段继续在 web renderer 和 core parser 间各自打补丁。
  缓解：在本次 change 中先正式定义注册、替换、排序契约，再迁移现有 Spec/ToC/translation 逻辑上轨。

- 风险：把翻译按钮直接做成页面局部实现，会导致 spec 页面、artifact 页面和未来文档页各自维护状态机。
  缓解：先把入口收敛到共享 ToC/Markdown document surface，再做首批页面接入。

- 风险：继续沿用正则/逐行翻译，会使双语布局、原句映射、以及 Markdown 语义保护都越来越脆弱。
  缓解：在正式方案中改为 AST-native translation projection，并把它放在处理链路末端。

- 风险：如果 ToC 内部硬编码“direct 显示译文 / bilingual 显示原文”，会把翻译策略污染进共享导航原子。
  缓解：ToC 只认 `data-toc-label ?? innerText`，模式选择由文档投影层负责。

- 风险：继续依赖 pseudo-content，会让 heading 的可见文本、可选中文本、ToC 标签、翻译源文本各自分叉。
  缓解：把 Spec heading 改为真实节点结构，让可见文本和语义节点重新对齐。

- 风险：把 `LanguageDetector` 当成硬依赖，会让功能在当前真实 Chrome 环境下大量不可用。
  缓解：把自动检测定义为增强能力；基础能力只依赖 `Translator` 与目标语言配置。

- 风险：按每一行调用 `LanguageDetector` 会引入额外延迟、检测抖动，并使同一段语义上下文被切碎。
  缓解：默认按文档或较大语义块检测，并对检测结果做缓存；只有在 mixed-language 证据明显时才提高粒度。

- 风险：`downloadable` / `downloading` 若未纳入正式状态机，会让用户误以为功能坏掉。
  缓解：把初始化与下载纳入 Settings 和按钮态，明确“正在准备翻译能力”不是“不可用”。

- 风险：取消翻译若只是 UI 状态切换，而不终止当前请求，会造成状态漂移。
  缓解：正式要求文档级翻译 session 使用 abortable request，并在 UI 中把取消作为一等事件。

- 风险：将翻译入口绑定到 ToC header，可能影响窄屏折叠布局。
  缓解：在 spec 中明确宽窄屏都支持，实施阶段需要为 narrow/wide ToC 分别验证布局与交互。

- 风险：translation settings 与 hosted session-scoped state 边界不清，会把文档中间态错误共享到其它 tab/session。
  缓解：把“全局设置共享、文档翻译会话不共享”写入 `web-rendering` 契约。

- 风险：如果把目标扩展到“全站任意文本”，会立即掉入 DOM sweep 和稳定词汇破坏问题。
  缓解：本次 change 明确只针对共享文档 Markdown surface，后续 HTML adapter 另立 change。

## Verification Strategy

- OpenSpec artifact verification
  - `pnpm exec openspec status --change add-document-translation-platform --json`
  - 保证 loop artifacts 与 specs delta 完整。

- 设计验证
  - 检查 `Toc`、`MarkdownViewer`、`SpecMarkdownDocument`、`settings.tsx` 的共享入口与扩展点是否匹配方案。
  - 检查 `MarkdownContent` / `MarkdownViewer` / `markdown-facts` 是否能承载统一处理管线，而不是继续保持双轨。
  - 检查 `index.css` 与 `SpecMarkdownDocument` 当前 pseudo-content 位置，确认结构迁移被正式记录。
  - 对照 research evidence，确认 capability state 与 `LanguageDetector` 降级法则被正式记录。

- 后续实施阶段的 scoped checks 预案
  - `pnpm --filter @openspecui/web test -- src/components/toc*.test.tsx src/routes/settings.test.tsx src/components/spec-markdown-document.test.tsx`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter @openspecui/web build:ssg`
  - change archived 后移除前一轮实验 worktree：`.worktree/translator-api`
  - 浏览器验收：
    - 窄屏/宽屏 ToC 顶部翻译按钮
    - 未启用跳转到 `/settings#settings-translation`
    - 启用后初始化/下载状态
    - 翻译中取消
    - direct / bilingual 模式切换
    - direct 模式保留 source-target 映射，并在实现 hover/focus 预览时验证原句 popover
    - ToC 在 direct / bilingual 下分别读取正确标签
    - Spec heading 在真实节点结构下仍保持选择、样式、和语义
    - spec/artifact 文档切换为目标语言
