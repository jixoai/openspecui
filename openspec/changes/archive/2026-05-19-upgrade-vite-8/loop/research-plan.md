## Research Findings

- 官方 npm registry 当前版本显示 `vite@8.0.0` 已正式发布；官方文档也已切到 `v8.0.0`，存在正式的 “Migration from v7” 指南与 “Announcing Vite 8” 文章。
- 官方 Vite 8 迁移核心变化是底层从 Rollup/esbuild 迁到 Rolldown/Oxc，并引入更激进的默认兼容层；官方同时说明大多数项目可先依赖兼容层直接升级，但复杂项目需要重点检查 Rolldown 相关行为差异。
- 官方公告说明 Vite 8 的 Node.js 要求仍为 `20.19+` 或 `22.12+`；本仓库根 `package.json` 已声明 `node >=20.19.0`，当前本机为 `v24.11.0`，不构成升级阻塞。
- 官方迁移文档列出的高风险点包括：`build.rollupOptions`/`worker.rollupOptions` 向 `rolldownOptions` 迁移、`manualChunks` 能力变化、部分 Rollup hook/输出格式不再受支持、插件作者在 `load`/`transform` 中可能需要显式 `moduleType: 'js'`。
- 官方公告说明 `@vitejs/plugin-react` 随 Vite 8 对应发布 `v6`，并切到 Oxc React Refresh；同时明确 `@vitejs/plugin-react` v5 仍可运行在 Vite 8 上，但 peer 版本线已经切到 `vite ^8`。
- 本仓库当前直接依赖 `vite@^7.3.1` 的包有四个：`packages/app`、`packages/web`、`packages/website`、`packages/xterm-input-panel`。
- 本仓库当前三个 React/Vite 项目 `packages/app`、`packages/web`、`packages/website` 统一使用 `@vitejs/plugin-react@^5.1.3`；该版本 npm peerDependencies 只声明兼容 `vite ^4 || ^5 || ^6 || ^7`，因此本仓库若升级到 Vite 8，`plugin-react` 需要同步升到 `v6`。
- 本仓库存在多套 Vite 构建入口，而不只是单一 `vite.config.ts`：`packages/web` 同时有 dev build、SSG client build、SSG server build、SSG CLI build、watch dist build；`packages/app` 还有自定义 hosted app plugin；因此升级验证不能只跑单个前端包的 `vite build`。
- 本仓库确实使用了 `build.rollupOptions`：`packages/app/vite.config.ts`、`packages/web/vite.ssg-cli.config.ts`、`packages/xterm-input-panel/vite.config.ts`。按官方说法，Vite 8 有兼容层，但这些位置需要作为重点回归点。
- 本仓库自定义 Vite 插件主要在 `packages/app/src/vite-plugin-hosted-app.ts` 和 `packages/web/vite.sync-cli-web.ts`。从当前代码看，这些插件主要使用 `configResolved`、`closeBundle`、`configureServer` 等 hook，没有明显依赖已知被移除的 Rollup 插件能力，但仍需在真实构建下验证。
- 当前测试栈没有发现与 Vite 8 同级别的硬阻塞：`vitest@4.0.18` 不声明对 Vite 的 peer 限制；`@storybook/addon-vitest@10.2.8` 与 `@storybook/web-components-vite@10.2.8` 也没有直接卡死在 Vite 7。
- 官方公告建议复杂项目采用渐进路线：先用 `rolldown-vite` 在 Vite 7 上隔离 Rolldown 兼容问题，再升到 Vite 8；这对本仓库是一个备选 fallback，而不是首选默认路径。

## Decision & Plan (For Approval)

- 采用“直接升级到 Vite 8 + 同步升级 `@vitejs/plugin-react` v6 + 全量 CI 验证”的主路线，不先引入 `rolldown-vite` 过渡层。
- 第一步只做依赖与配置兼容升级：将四个直接依赖 Vite 的包统一升级到 `vite@^8`，并将三个 React 项目的 `@vitejs/plugin-react` 升到 `^6`。
- 第二步做构建配置与插件回归：逐项验证 `packages/app`、`packages/web`、`packages/website`、`packages/xterm-input-panel` 的 `vite build`、SSG、Storybook browser tests、dev dist/watch 链路；如果 Vite 8 的 Rolldown 兼容层对现有 `rollupOptions` 或插件行为有警告/回归，再做定点配置迁移，而不是先批量改写成 `rolldownOptions`。
- 第三步做脚本与工具链回归：验证 `pnpm dev`、`pnpm openspecui`、`pnpm changeversion`、`pnpm deploy:app:cf` 等依赖 web/app 产物的脚本是否仍按预期工作。
- 如果直接升级路线遇到 Rolldown 兼容阻塞，再回退到官方建议的两步迁移方案：先在 Vite 7 上验证 `rolldown-vite`，确认问题是否来自底层 bundler，再决定是否拆成两个 loop。

## Capability Impact

### New or Expanded Behavior

- 构建工具链从 Vite 7 升级到 Vite 8。
- React 项目切换到 `@vitejs/plugin-react` v6，对应 Oxc 驱动的 React Refresh。
- 仓库将获得 Vite 8 的官方能力与后续生态兼容基础。

### Modified Behavior

- 生产构建底层行为会从 Rollup/esbuild 语义过渡到 Rolldown/Oxc 兼容层语义。
- 现有 `rollupOptions`、手工 chunk、插件 hook、SSG build 行为需要按 Vite 8 语义重新验证。
- 如果出现兼容层差异，相关配置可能需要从 `rollupOptions` 向 `rolldownOptions` 迁移。

## Risks and Mitigations

- 风险：`packages/web` 的 SSG/CLI 双构建链路比普通前端包复杂，可能在 Vite 8 下出现只在 SSR/SSG 路径触发的问题。
  缓解：将 `build:ssg`、`build:ssg-cli`、静态相关测试纳入升级必跑项，而不是只跑 `vite build`。
- 风险：`@vitejs/plugin-react` v6 引入 Oxc 后，React 开发时的 transform 行为与当前 v5 存在细微差异。
  缓解：同步跑 `packages/web`、`packages/app`、`packages/website` 的单测与浏览器测试，并做一次本地 dev 手工冒烟。
- 风险：Rolldown 对 `rollupOptions`、`manualChunks`、部分 hook 的兼容边界与当前不同。
  缓解：优先依赖官方兼容层；仅在真实失败点上做最小配置迁移，不提前重写所有配置。
- 风险：升级后 `pnpm dev` 或 CLI 对 `packages/web/dist` 的同步机制出现非测试路径回归。
  缓解：把 `pnpm dev` / `pnpm openspecui` / `pnpm deploy:app:cf` 纳入验收，而不只看包级测试。

## Verification Strategy

- 依赖与类型检查：`pnpm install`, `pnpm typecheck`
- 单元与浏览器测试：`pnpm test:ci`, `pnpm test:browser:ci`
- 构建验证：`pnpm build`, `pnpm --filter @openspecui/web build:ssg`, `pnpm --filter @openspecui/app build`, `pnpm --filter @openspecui/website build`
- 开发链路冒烟：`pnpm dev`, `pnpm openspecui`, `pnpm openspecui --app`
- 发布/部署链路回归：`pnpm changeversion`, `pnpm deploy:app:cf`
