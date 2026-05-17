## Implementation State

- 当前阶段：实现完成，focused tests、web typecheck、web SSG build 均已通过；待整体 review、archive/PR 决策。
- 已批准计划：将 OpenSpec heading 视觉徽标、可访问语义文本、翻译 segment 投影拆成独立职责；将长文档翻译从一次性等待改为 translation session 逐 segment patch 的 progressive snapshot。
- 已完成：
  1. 更新 OpenSpec Markdown heading projection，恢复 `REQ-xx` / `Scenario` 视觉 badge，并保留 `Requirement:` / `Scenario:` 真实语义文本。
  2. 更新 CSS，使视觉 badge 从 `.openspec-heading-label[data-openspec-visual-label]::before` 投影，主要标题文本仍为真实 DOM。
  3. 扩展 Markdown heading processor input，使最终翻译 processor 可以读取前序 OpenSpec projection snapshot，而不需要耦合到 ToC 或 Spec 页面私有逻辑。
  4. 新增 `translateMarkdownDocumentProgressively()`，按 segment 翻译并 emit patch；保留 `translateMarkdownDocument()` wrapper 兼容完整结果调用。
  5. 更新 `useDocumentTranslation`，在 translation session 中逐 patch 更新 snapshot，取消时清空 partial output 并阻止 stale patch。
  6. 统一 direct/bilingual 的 translation segment wrapper；direct 保留 source mapping 属性和 target 节点，bilingual 渲染 source/target siblings。
  7. 更新 focused tests 覆盖 heading badge、semantic label、unified segment projection 和 progressive patch render。
  8. 根据真实翻译验收反馈修正 translation projection：
     - bilingual source/target 分隔从文本 `/` 改为 CSS `border-inline-start` 绘制的视觉分隔。
     - Translator 技术 token 不再使用 HTML `<span translate="no">`，改为纯文本 token，避免 Chrome 返回转义 HTML 后泄漏到正文。
     - target 内容在最终投影时重新走 inline Markdown renderer，避免 `**bold**` / `` `code` `` 以 raw markdown 文本显示。
     - nested list item 分段改为只翻译本行直接文本，子列表 item 独立分段，避免父级 list item 把整棵子列表压成一段译文。
  9. 根据第二轮真实翻译反馈继续修正 translation projection：
     - Translator 技术 token 从旧的 `__OSUI_TRANSLATION_TOKEN_n__` 收敛为 Markdown-safe 的 `OSUI<n>TOKEN`，并用大小写不敏感恢复，避免 Translator 将 token 改写成小写后泄漏到正文。
     - bilingual inline 分隔线继续保持 CSS-only `border-inline-start`，但加粗并增大 source/target 间距，避免视觉上像紧贴文本的 `/`。
     - LanguageDetector 策略升级为 document baseline + translatable AST segment 高置信检测；同目标语言等价的 segment 直接复用 source，不再送入 Translator；Translator 实例按 `sourceLanguage -> targetLanguage` 缓存。
  10. 根据 change detail/spec detail 渲染一致性反馈继续修正阅读视图：
      - `changeDetail` 中匹配 `specs/<id>/spec.md` 的 active change artifact preview 改为走与 main `specDetail` 页面相同的 OpenSpec Markdown projection、ToC label 和 translation entry。
      - 全 spec glob artifact 保持一个根 `MarkdownViewer`、一个根 ToC、一个滚动容器；嵌套 spec viewer 通过 root ToC header action registry 暴露 translation action。
      - 非 spec artifact 继续走普通 artifact Markdown reader，不把 proposal/tasks/其它 markdown 误判为 spec 文档。
  11. 根据最终架构反馈废除临时 Markdown wrapper：
      - `MarkdownViewer` 成为唯一 Markdown 渲染入口，同时支持 `markdown` 和 `path`。
      - OpenSpec spec 渲染被改装成 `MarkdownViewer` 的 path-aware render plugin，由 `specs/<id>/spec.md` 激活。
      - Document translation 被改装成 `MarkdownViewer` 的 render plugin，不再需要 translation-only Markdown wrapper。
      - 删除 `SpecMarkdownDocument` 组件和测试文件，不保留兼容薄包装。
      - 将旧组件语义样式类从 `.spec-markdown-document` 收敛为 `.openspec-markdown-document`，由 OpenSpec render plugin 注入。

## Decisions Taken

- 不把 Markdown render processor 链升级成 async emitter。processor 继续只消费当前 snapshot 并同步投影 DOM。
- progressive emit 只属于 document translation session 和 browser translation adapter，不扩散到所有 Markdown 插件。
- 视觉 badge 优先用 CSS pseudo-content 从 `data-openspec-label` 读取；因为它只是视觉标识，不是主要文档文本。
- `Requirement:` / `Scenario:` 保留为真实 DOM text，并使用 screen-reader-visible 的隐藏方式承载 accessibility / translation semantics。
- Direct 模式不把 source 作为可读正文节点渲染，避免屏幕阅读器同时读原文和译文；source mapping 通过 `data-translation-source` 和 hover/focus preview 保留。
- Bilingual 模式渲染 source 与 target 两个子节点，但使用与 direct 相同的 segment wrapper attributes。
- `Requirement:` / `Scenario:` 不再从 heading translator input 中剥离，允许 browser Translator 处理语义 kind；OpenSpec heading projection 再把翻译后的 kind 与 title 分配到真实语义文本和 title segment。
- Progressive 更新没有改造整个 Markdown pipeline；Markdown render processor 仍然只读取当前 snapshot，同步投影 DOM。
- 普通 heading 可以整段替换，OpenSpec requirement/scenario heading 通过前序 processor 的 `data-openspec-kind` / label metadata 保留 badge 和 title 结构。
- 混合语言文档不应只依赖全文 LanguageDetector。新的法则不是“每一行都检测”，而是“每个可翻译 Markdown AST segment 可以检测”：物理行不稳定，AST segment 才是翻译投影的原子。检测结果低置信或 API 不可用时降级到 document baseline。
- `specs/<id>/spec.md` 在 active change 中只是位置不同，不是文档类型不同；前端阅读层应以文件语义激活 OpenSpec render plugin，而不是以页面归属选择普通 artifact renderer。
- ToC translation action 仍然属于 document render plugin 的 header action，不进入 ToC 内部逻辑；glob spec artifact 通过 nested header action registry 贡献到单一 root ToC。
- `MarkdownViewer` 是唯一 Markdown 渲染入口；未来新增文档效果应作为独立 render plugin 进入管线，而不是新增页面专用 Markdown wrapper。

## Divergence Notes

- `data-openspec-visual-label` 同时写在 heading element 和 `.openspec-heading-label` 上，因为 CSS pseudo-content 需要读取 label 节点自身属性。
- Progressive patch snapshot 在最终 result 到来前可能没有 document-level `sourceLanguage`，但每个 translated segment 会携带自己的 `sourceLanguage` / `targetLanguage`，满足 DOM lang projection。
- Focused tests 中补了 `cleanup()`；之前多个 render 留下多个 ToC translation buttons，属于测试隔离问题，不是产品行为变更。
- 单文件 `specDetail` 的 ToC translation action 已经存在；用户观察到“specs 内容没有翻译按钮”的明确缺口主要来自 change detail 的 `specs/**/*.md` glob artifact 之前被包进 builder/nested viewer，内层 document 有 source 但没有自己的 ToC header。
- 旧的“每个 spec glob 文件独立渲染完整 document”的方案会破坏单一 ToC/滚动容器；最终方案保留嵌套 viewer，同时让 nested action 注册到 root ToC header。
- `SpecMarkdownDocument` 在最终方案中完全废除；保留它作为薄包装会形成第二个 Markdown 入口，违背 path-aware plugin 架构。
- 用户截图暴露的 raw HTML token 泄漏不是 Translator API 保留 HTML 的稳定能力问题，而是我们把保护 token 设计成 HTML span，实际浏览器可能转义并返回。修正后 adapter 不再依赖 Translator 对 HTML 的结构保留。
- 用户截图暴露的 `Reported surfaces` 翻译错位根因是 Markdown AST segment 选择过粗：父级 `listItem.rawMarkdown` 包含子列表。修正后 list item 的 translation source 来自直接非 list 子节点。
- 译文 raw markdown 显示根因是 render layer 把 `segment.target` 当 React text 写入。修正后 target 经过 `MarkdownInlineContent` 解析，但仍保持外层 block/heading/list 的 Markdown AST 投影边界。
- 中文译文常见 `**重要：**保留` 没有空格时 CommonMark 不解析 strong；`MarkdownInlineContent` 在 inline 渲染前做最小归一化，避免 Translator 输出压缩空格导致 Markdown 标记失效。
- 用户第二轮截图暴露的 `osui_translation_token_0` 类泄漏说明纯文本 token 也必须具备 Translator 扰动容错。当前 token 不再使用 `_` 或 Markdown emphasis 敏感字符，并允许大小写扰动后恢复。
- Segment 级 LanguageDetector 会增加检测调用次数，但不会增加到每个 DOM 文本节点或物理行；它和 translation segment 同边界，并通过 detector/session 与 translator pool 控制成本。

## Verification Evidence

- `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/document-translation-action.test.tsx src/lib/browser-translation.test.ts`
- `pnpm --filter @openspecui/web typecheck`
- `pnpm --filter @openspecui/web build:ssg`
- SSG build passed with existing non-blocking warnings: CSS `scroll-button`, dynamic import chunking, and chunk size warnings.
- After feedback fix:
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/browser-translation.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/document-translation-action.test.tsx`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/document-translation-action.test.tsx src/lib/browser-translation.test.ts`
  - `pnpm --filter @openspecui/web typecheck`
- After second feedback fix:
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/lib/browser-translation.test.ts`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/document-translation-action.test.tsx src/lib/browser-translation.test.ts`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm --filter @openspecui/web build:ssg`
  - `pnpm exec openspec validate --all --strict`
- After change detail/spec detail renderer alignment:
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/opsx/artifact-output-viewer.test.tsx`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer-open-spec-plugin.test.tsx`
  - `pnpm --filter @openspecui/web typecheck`
  - `pnpm exec prettier --check packages/web/src/components/opsx/artifact-output-viewer.tsx packages/web/src/components/opsx/artifact-output-viewer.test.tsx packages/web/src/components/markdown-viewer-open-spec-plugin.test.tsx`
  - `pnpm --filter @openspecui/web exec vitest run --project unit src/components/markdown-viewer.test.tsx src/components/markdown-viewer-open-spec-plugin.test.tsx src/components/document-translation-action.test.tsx src/components/opsx/artifact-output-viewer.test.tsx src/lib/browser-translation.test.ts`
  - `pnpm exec openspec validate refine-document-translation-heading-projection --type change --strict --no-interactive`
- Browser plugin namespace was not available in this runtime, so rendered validation used Playwright from `@openspecui/web`.
- Rendered validation fixture:
  - project: `tmp/change-spec-rendering-preview/`
  - backend: `pnpm --filter @openspecui/server dev -- --dir tmp/change-spec-rendering-preview --port 3118`
  - web: `OPENSPEC_SERVER_PORT=3118 pnpm --filter @openspecui/web exec vite --host 127.0.0.1 --port 13118 --strictPort`
  - route: `http://127.0.0.1:13118/changes/spec-preview?artifact=specs`
  - observed DOM evidence:
    - `hasSpecPath: true`
    - `requirementHeadingCount: 1`
    - `firstRequirementTitle: "Change Delta Spec Rendering"`
    - `translationButtons: 1`
  - screenshot: `/tmp/openspecui-change-spec-rendering.png`

## Loopback Triggers

- 如果 heading accessible name 无法同时满足视觉 badge 和可访问语义，需要回到 research-plan 重新定义 a11y projection。
- 如果 progressive snapshot patch 导致 ToC label 需要 translation-specific 逻辑进入 ToC，需要回到 research-plan 重新定义 heading label projection contract。
- 如果 browser Translator API 在 abort 或 per-segment failure 时无法稳定继续后续 segment，需要回到 research-plan 缩小首版为 progressive-success-only，并记录失败策略。
- 如果统一 source/target DOM shape 与现有 Markdown block annotation API 冲突，需要先扩展 Markdown render projection law，再继续翻译 DOM 合并。
