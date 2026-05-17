## User Input

用户确认前一轮实验已经证明 Chrome Translator APIs 基本可用，接下来需要讨论一套完善的正式对接方案，并回到 `main` 分支正式撰写这个 change。

用户直接给出核心要求：

1. 在 ToC 的顶部，inline-end 的位置，新增一个 `icon-primary-Button` 作为翻译按钮；这是一个有状态的开关按钮，宽屏和窄屏都必须支持。
2. 如果页面未翻译，按钮显示 `border-primary`；如果页面已经翻译，按钮显示 `bg-primary`；还需要一个“翻译中”的状态，并且翻译中的状态点击后可以取消翻译。
3. 点击后，如果发现翻译功能还没启用，就跳转到设置页面，并跳到翻译设置区域。
4. 设置页需要配置目标语言；原语言不需要配置，因为可以自动检测。
5. 启用翻译后，需要自动开始初始化，也就是下载翻译所需的语言包；这使用翻译 API 自带的能力。

用户随后补充：

6. 需要支持两种模式：
   - 直接翻译：只显示目标语言；默认使用这种模式；最好支持 hover 后通过 popover 浮动显示原句。
   - 双语模式：同时显示原文和目标语言；其中 `h1` / `h2` / `li` 等应把翻译结果追加在同一行，其它块应独立起一行。
7. 翻译应基于 Markdown AST，而不是正则；并且必须放在整个 AST 处理链路的最后一环，保证其它处理链路处理的是原始 Markdown 内容。
8. 用户提出一个架构问题：理论上是否每一行都需要进行 `LanguageDetector`。
9. ToC 这里显示的内容是：如果是双语，那么只显示原文，如果是直接翻译，那么显示译文。这里的关键不是硬编码这个逻辑，而是通过自定义 html 属性来实现，比如 `data-toc-label="xxx"`，ToC 只需认“属性 ?? innerText”，不用耦合任何翻译相关的逻辑。
10. Spec 页面目前也有 Markdown AST 相关的处理，需要构建一套统一的 Markdown AST 处理管线。通过可拔插（动态注册）、可替代（可以通过唯一的名词来进行替换）、可排序（可配置 `order:number`）。
11. Spec 页面目前用 after/before + HTMLAttr 伪类来实现一些定制视觉效果，但这对翻译和文本选择不友好。需要升级成真实节点结构，例如把 `<h3>Requirement: Terminal projection SHALL distinguish raw transport from backend screen projection</h3>` 升级成 `<h3 ...attr><span ...attr>Requirement: </span>Terminal projection SHALL distinguish raw transport from backend screen projection</h3>`，用真实节点替代 pseudo-content，同时保持语义不变。

## Objective Scope

- 为 OpenSpecUI 正式定义一条文档翻译平台契约，而不是只在 SPEC 页面上追加一个局部按钮。
- 为 OpenSpecUI 正式定义一条统一的 Markdown AST 处理平台法则，而不是让 Spec 增强、ToC 元数据、翻译投影分别维护各自的字符串级逻辑。
- 在文档阅读表面统一提供翻译入口，当前至少覆盖带 ToC 的 Markdown 文档视图，并保持宽窄屏一致的入口语义。
- 建立翻译功能的全局设置契约，包括：
  - 启用/关闭翻译能力；
  - 目标语言选择；
  - 初始化与语言包下载状态反馈。
- 建立文档级翻译会话契约，包括：
  - 原文 / 翻译中 / 已翻译 / 初始化中 / 不可用 等状态；
  - 用户可取消正在进行的翻译；
  - 未启用时从文档页跳转到 Settings 的翻译设置锚点。
- 建立翻译展示模式契约，包括：
  - 默认直接翻译模式；
  - 可切换双语模式；
  - 直接翻译模式下保留原文映射，并在 surface 支持时提供原文悬浮查看；
  - 双语模式下的 inline-append 与 block-stack 规则。
- 建立 ToC 标签投影契约，使 ToC 通过 HTML 属性优先、文本回退的方式读取标签，而不感知翻译模式本身。
- 建立 Spec heading 语义增强的真实节点契约，用真实内联节点替代 `::before` / `::after` pseudo-content。
- 明确 Chrome `LanguageDetector` / `Translator` 在正式产品中的职责边界，尤其是自动检测原语言与首次下载模型的初始化路径。
- 明确翻译必须工作在 Markdown AST 之上，并作为渲染前 AST 处理链路的最后一环。
- 明确静态导出、hosted 会话、和运行时全局设置在翻译配置上的边界，避免出现第二套设置真相。
- 形成可实施的 OpenSpec change，包含 loop artifacts 与正式 spec delta。

## Non-Goals

- 不在本 loop 中直接实现所有代码与 UI。
- 不把前一轮 research worktree 中的实验实现直接视为最终产品方案。
- 不在本 loop 中设计一个通用的“全站任意 DOM 文本翻译器”。
- 不要求本轮定义多语言文案系统、服务端翻译缓存、持久化翻译结果存储或离线翻译包管理面板。
- 不在本轮把目标扩展到非文档 surface，例如 dashboard、config、workflow graph、terminal 输出或任意 chrome 文本。
- 不把 `LanguageDetector` 当前实验性不可用状态强行包装成稳定硬依赖。
- 不继续沿用“正则 + 逐行翻译”作为正式产品架构。
- 不默认对每一行都执行 `LanguageDetector`。
- 不把 ToC 做成翻译模式感知组件。
- 不继续依赖 `content: attr(...)` 这类 pseudo-content 作为 Spec heading 的主要可见文本来源。

## Acceptance Boundary

- 正式 change 明确规定翻译入口属于哪个共享 UI surface，而不是散落在页面私有实现中。
- 正式 change 明确规定文档页翻译按钮的状态模型、视觉语义和交互路径，包括“未翻译 / 已翻译 / 翻译中可取消”。
- 正式 change 明确规定 Settings 中的翻译配置项、目标语言配置方式，以及未启用时的跳转行为。
- 正式 change 明确规定直接翻译与双语模式的默认值、切换方式和渲染规则。
- 正式 change 明确规定直接翻译模式下原文映射如何保留，以及 hover popover 作为渐进增强如何接入。
- 正式 change 明确规定 ToC 标签如何通过 `data-toc-label ?? innerText` 的通用法则读取，而不是在 ToC 内硬编码翻译逻辑。
- 正式 change 明确规定 Markdown AST 处理管线的注册、替换、排序模型，而不是只声明“最后一环翻译”。
- 正式 change 明确规定 Spec heading 从 pseudo-content 迁移到真实节点结构的契约。
- 正式 change 明确规定 Chrome Translator 初始化、availability 检查、语言包下载状态与失败回退路径。
- 正式 change 明确规定自动检测原语言的责任边界，并解释 `LanguageDetector` 不可靠时的降级法则。
- 正式 change 明确规定翻译必须基于 Markdown AST，并位于 AST 处理链路的最后一环。
- 正式 change 明确回答 `LanguageDetector` 的粒度法则，而不是把它留给实现阶段临时决定。
- 至少为一个新的翻译能力 spec、一个现有 UI/settings spec、和一个静态/hosted 边界 spec 写出 delta 契约，便于后续实施直接对照。
