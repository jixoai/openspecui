## User Input

- `website 子项目，将部署到 [www.]openspecui.com,website 子项目只要提供简单的展示关于 openspecui 如何使用，还有 链接到 openspec 官网、github 链接`
- `中英双语注意使用可靠的国际化的库，实现多语言切换。官网的风格和 openspecui 的风格保持一致。`

## Objective Scope

- Create a dedicated `packages/website` frontend workspace for the public site.
- Ship a compact landing page for `www.openspecui.com` that explains what OpenSpecUI is and how to use it.
- Provide direct links to the hosted app, the official OpenSpec site, and the GitHub repository.
- Support English and Simplified Chinese switching with a production-grade i18n library.
- Reuse OpenSpecUI visual tokens so the public site feels like the same product family.

## Non-Goals

- Do not build a docs portal, blog, CMS, or multi-page marketing site.
- Do not introduce a separate design language unrelated to the main OpenSpecUI product.
- Do not add server-side rendering or a deployment-specific runtime unless it becomes strictly necessary.
- Do not redesign the hosted app shell as part of this website loop.

## Acceptance Boundary

- `packages/website` builds and tests inside the existing pnpm workspace.
- The site can switch between English and Simplified Chinese without reloading the page.
- The site includes concise usage guidance and links to `app.openspecui.com`, the OpenSpec official site, and GitHub.
- Styling reuses shared product tokens from `packages/web` instead of inventing a parallel theme.
- Deployment notes for `www.openspecui.com` are documented in the website workspace.
