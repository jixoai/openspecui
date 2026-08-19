<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Preserve the owner's website renewal request and the no-backward-compatibility boundary.
2. Preserve the owner's visual-direction decisions: brutalist text-only, Broadside base, merged Boot Log terminal card.
3. Preserve the translation-feature omission (pending possible major rework) and the no-PWA regression boundary.
4. Preserve the agent-executed browser walkthrough authorization for this website-only scope.

Original request (2026-08-19): "只从 v7+之后，我们已经不再使用 pwa 来为提供 app 模式，而是原生地基于 opentray 来提供原生窗口和托盘。我需要你更新我们的官网项目。"
Original request (2026-08-19): "1. 你先了解项目 2. 独立思考我们应该在官网展示什么内容 3. 思考如何将正确的挪到放置到目前的官网中，提供一个重构方案（不靠向下兼容，只提供现有最新版本的信息） 4. 完成开发后要进行浏览器走查"
Owner visual decision (2026-08-19): "保持纯文字终端风" — no product screenshots; the brutalist-terminal aesthetic stays.
Owner IA decision (2026-08-19): "单页叙事，我觉得可以用是Scroll-Animation 来实现相关的 features 展示，但是注意动效要克制。还有，翻译功能不要提，因为我可能会做大重构。"
Owner merged-direction decision (2026-08-19): "我希望 broadside 的整体效果，还喜欢 BootLog 的那个终端打字的效果，把 BootLog 的这个效果卡片合并到 broadside 中，放在 WHAT'S INSIDE 前面。特别是在桌面模式下，首屏右侧有空间的话，那么我觉得可以吧这个终端打字放在首屏右侧，如果空间不够再放在下面一栏。"
Owner release decision (2026-08-19): "可以了，我们可以正式推进官网的开发了"
Owner correction (2026-08-19): "app.openspecui.com 这个链接需要废除掉，这个我们已经不再使用了" — the retired browser-deployment link is removed from the header nav, footer, schema, and both locales.
Original request (2026-08-19): "THREE SURFACES 这里需要能支持点击复制命令。" — surface command lines are click-to-copy buttons sharing the site-wide copy labels.
Original request (2026-08-19): "RUN IT 这里也需要支持点击复制" — run-it serve/export/auth command rows are click-to-copy buttons over the current dynamic values.
Original request (2026-08-19): "因为顶部栏这里背景始终都是暗色的，所以Theme 和 Language 这里的 toggle 要固定 border 的颜色为亮色。" — the header theme/language toggle borders are pinned to a light color (terminal-foreground/30) instead of the theme-dependent border token fallback.
Original request (2026-08-19): "我发现移动端的窄屏模式下，这些可复制的命令行过长，导致存在溢出问题" — copyable command buttons delegate horizontal scrolling to the command text; the copy chip stays pinned and neither the button nor the page overflows.
Owner follow-up (2026-08-19): "我这边看问题还是存在" — the internal horizontal scroll still read as clipped overflow on a phone; commands now wrap (`wrap-anywhere`) so the full text is always visible at any width.
Owner refinement (2026-08-19): "最好把开头的 `$` 这个作为一个独立的头部，而不是 inline 到 command 里面。然后 command 的换行，不要 break-all，要基于空格去换行" — the `$` prompt is a separate shrink-0 primary-colored column; command text wraps at spaces (`wrap-break-word`).
-->

## User Input

> 只从 v7+之后，我们已经不再使用 pwa 来为提供 app 模式，而是原生地基于 opentray 来提供原生窗口和托盘。
> 我需要你更新我们的官网项目 … 提供一个重构方案（不靠向下兼容，只提供现有最新版本的信息） … 完成开发后要进行浏览器走查

## Agreed Direction

1. The website presents the **current OpenSpecUI 9 line only** — no version-archived guidance, no
   retired PWA surface, no `--app=<url>` language. Compatibility copy states the v9 boundary:
   OpenSpec CLI `>=1.8.0 <1.10.0`, 1.9 recommended, Node `>=20.19`.
2. Information architecture is a **single-page scrolling narrative** (hero → features → surfaces → run it),
   shared by `/en/` and `/zh/`; the Hooks guide page is unchanged.
3. Visual direction is the prototype-picked **Broadside Log**: editorial large-type Broadside base with the
   Boot Log terminal typing card merged into the hero — right column when the first screen has width
   (≥1100px), its own row directly below the hero copy otherwise, always before WHAT'S INSIDE.
4. Motion is restrained: IntersectionObserver reveal (small rise / rule draw), terminal typing with
   reduced-motion and no-JS degradation. Scroll-spy highlights the feature index rail.
5. The translation platform feature is intentionally **not mentioned** (owner expects a major rework).
6. The final browser walkthrough for this website-only scope is executed by the agent per the owner's
   explicit request; product-level acceptance boundaries are untouched.
