/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. 提供中文单页 v9 叙事的规范文案。
 * 2. 发布 OpenSpecUI 9 与 OpenSpec CLI 1.8–1.9 的兼容边界，不出现已退役的表面。
 * 3. 按业主即将重构的决定，不提及翻译平台能力。
 *
 * Original request (2026-08-19): "只提供现有最新版本的信息"
 * Owner visual decision (2026-08-19): Broadside Log 方向 —— 编辑派 Hero + 终端打字卡。
 */
import type { WebsiteContent } from '$lib/i18n/schema'

export const zh = {
  htmlLang: 'zh-CN',
  meta: {
    siteTitle: 'OpenSpec UI',
    siteSubtitle: '面向 OpenSpec 工作流的可视化前端',
    homeTitle: 'OpenSpec UI - 面向 OpenSpec 工作流的可视化前端',
    homeDescription:
      'OpenSpecUI 9 为 OpenSpec 项目提供响应式仪表盘、客观的变更工作流、配置工作台、真实终端与静态导出——同时始终保持贴近 OpenSpec CLI。',
    hooksTitle: 'OpenSpecUI Hooks - 项目文档与工作流 Hooks',
    hooksDescription:
      '了解 OpenSpecUI 如何通过项目级 hooks 自定义文档读取与工作流执行，同时避免污染 .openspecui.json。',
    languageLabel: '语言',
    themeLabel: '主题',
  },
  nav: {
    home: '首页',
    hooks: 'Hooks',
    github: 'GitHub',
  },
  copy: {
    label: '复制',
    done: '已复制',
  },
  hero: {
    eyebrow: 'OPENSPECUI 9 — OPENSPEC 的可视化投影',
    titleLead: '操作 OpenSpec，让 UI 始终',
    titleAccent: '贴近 CLI。',
    summary:
      'OpenSpecUI 9 为 OpenSpec 项目提供响应式仪表盘、客观的变更工作流、配置工作台、真实终端与静态导出——同时不隐藏底层的 OpenSpec CLI。',
    badges: ['原生 App', '实时 Web', '静态导出'],
    githubCta: 'GITHUB ↗',
  },
  terminal: {
    barTitle: 'www.openspecui.com — zsh',
    command: 'npx openspecui@latest',
    outputs: [
      'OpenSpec UI v9 — 规范驱动开发的可视化界面',
      '支持 OpenSpec CLI 1.8.x / 1.9.x · Node ≥ 20.19',
      '→ 原生 App · 实时 Web · 静态导出',
      '→ CLI 始终是事实源，UI 始终是投影',
    ],
  },
  features: {
    title: '能力一览',
    indexLabel: '索引 — 08',
    items: [
      {
        id: 'opsx-workflow',
        title: 'OPSX 变更工作流',
        body: 'Board 泳道投影跟踪任务阶段——no-tasks、in-progress、complete、archive；操作器基于实时 CLI 证据执行 Continue、Fast-forward、Apply、Verify 与 Archive。',
      },
      {
        id: 'dashboard',
        title: '仪表盘',
        body: '看板行、带 CLI 拥有的 Applying 进度的活跃变更，以及精心裁剪的 Code Git 快照，让当前工作与近期历史同屏呈现。',
      },
      {
        id: 'config',
        title: '配置工作台',
        body: '项目绑定、Active Root、环境全局与 Schema 各归其位的路由化 owner——外加一条以验证 Resolved Context 收尾的自适应 Guide。',
      },
      {
        id: 'agents',
        title: 'Agent 交付',
        body: 'CLI 拥有的注册表按版本投影 Agent 交付：命令、用户级 skills、迁移与重启证据；Init 与 Update 始终是带类型的 CLI 变更。',
      },
      {
        id: 'terminal',
        title: '终端',
        body: '基于 xterm 与 ghostty-web 渲染器的多标签 PTY 会话；工作流提示词在编辑器中编排，然后直接送入活跃的 Agent 终端。',
      },
      {
        id: 'git',
        title: 'Git 视图',
        body: '提交、补丁与 worktree，带明确的 code/planning 作用域——与仪表盘同源的 token 绑定凭据。',
      },
      {
        id: 'search',
        title: '搜索',
        body: '实时模式下的响应式搜索；静态导出中由 worker 索引继续工作。',
      },
      {
        id: 'kernel',
        title: '响应式内核',
        body: '基于 Signal 的文件系统原生监听、依赖追踪，并以幂等方式收敛变更；Push 通知，每个订阅面拉取最新投影。',
      },
    ],
  },
  surfaces: {
    title: '三种使用面',
    items: [
      {
        title: '原生 App',
        body: '一个常驻的 OpenTray 窗口：托盘、多项目 Workspaces、任务管理器与 Stores——由一个用户级 daemon 提供。',
        command: 'openspecui start',
      },
      {
        title: 'Direct Web',
        body: '当前项目在 localhost:3100 的一个显式浏览器界面；运行中的 daemon 仍会保留该 Workspace。',
        command: 'openspecui --web',
      },
      {
        title: '静态导出',
        body: '用于文档托管或离线审阅的可部署快照——worker 搜索保持可用，无需后端。',
        command: 'openspecui export -o ./dist',
      },
    ],
  },
  run: {
    title: '开始运行',
    summary: '优先免全局安装运行，让每次会话都拿到当前发布线。',
    runnerLabel: 'RUNNER',
    appModeLabel: 'APP 模式',
    appModeSummary: '本地 App daemon 管理 Workspaces，或 Direct Web 显式打开单个浏览器界面。',
    appFlagLabel: '--app',
    webFlagLabel: '--web',
    appStateLabel: 'APP',
    webStateLabel: 'WEB',
    serveCaption: '启动服务',
    serveAppSummary: '启动项目 backend，确保 App daemon 已运行，并将项目附加为一个 Workspace。',
    serveWebSummary: '启动项目 backend，并在系统浏览器中打开 Direct Project Web。',
    exportCaption: '静态导出',
    exportSummary: '生成用于文档托管或离线审阅的可部署快照。',
    protectCaption: '访问保护',
    protectSummary: '为整个访问门生成 256-bit Bearer 凭据——HTTP、tRPC、PTY、文件、终端。',
    compat: 'OpenSpecUI 9 支持 OpenSpec CLI 1.8.x 与 1.9.x（推荐 1.9）· Node ≥ 20.19',
  },
  links: {
    openspecTitle: 'openspec.dev',
    openspecBody: 'OpenSpec 官方项目与工作流参考。',
    githubTitle: 'GitHub',
    githubBody: '源码、议题、版本历史与贡献流程。',
  },
  footer: {
    ghost: 'OPENSPECUI',
    copyright: 'OpenSpecUI',
  },
  hooks: {
    heroTitle: '项目 hooks 应该放在项目旁边，而不是塞进持久化 UI 配置。',
    heroSummary:
      'OpenSpecUI 会加载 `openspecui.hooks.ts` 作为可执行的项目策略。第一批稳定 hooks 被刻意设计得很窄：一个负责读取文档，一个负责运行 OpenSpec 工作流。',
    designTitle: '设计法则',
    designBody:
      '`on*` hooks 是明确的拦截点。它们接收上下文和默认 runner 函数，并返回平台原本会产出的同类结果。这里不暴露宽泛的 plugin bus。',
    contractTitle: '兼容契约',
    contractBody:
      'hook 名称描述的是长期稳定的 OpenSpec 用户工作流，而不是 OpenSpecUI 内部实现阶段。这样即便内部演进，项目 hooks 仍然有保留价值。',
    lifecycleTitle: 'Hooks 所在的位置',
    lifecycleItems: [
      'OpenSpec 文件从项目工作区读取。',
      '`onReadDocument` 可以在 UI 渲染或翻译之前转换文档载荷。',
      'OpenSpec CLI 工作流由 OpenSpecUI 规划并执行。',
      '`onRunWorkflow` 可以包裹工作流运行，用于选择工具、注入环境或审计执行。',
    ],
    onReadDocument: {
      name: 'onReadDocument',
      purpose: '在 OpenSpecUI 展示 markdown 类 OpenSpec 文档前，自定义文档文本。',
      signature: 'onReadDocument(ctx, read): Promise<ReadDocumentResultV1>',
      when: '适合 #103 这种预处理、文档翻译、链接重写，或者基于 frontmatter 的展示策略。',
      stableFor: ['Markdown 预处理', '翻译覆盖层', '项目本地展示策略'],
      example:
        "import type { OnReadDocumentHookV1 } from 'openspecui/hooks'\n\nexport const onReadDocument: OnReadDocumentHookV1 = async (ctx, read) => {\n  const result = await read()\n  if (ctx.document.kind !== 'spec') return result\n\n  return {\n    ...result,\n    markdown: result.markdown.replaceAll('CLI_0003', 'CLI_0003 — CLI Recipe Execution'),\n    watchFiles: ['docs/reqstool/requirements.yml'],\n  }\n}",
    },
    onRunWorkflow: {
      name: 'onRunWorkflow',
      purpose: '在不替换 OpenSpec CLI 契约的前提下，包裹一次 OpenSpec 工作流运行。',
      signature: 'onRunWorkflow(ctx, run): Promise<RunWorkflowResultV2>',
      when: '适合选择 workflow tools、注入安全环境变量、记录审计输出，或者基于项目策略拦截执行。',
      stableFor: ['工作流编排', '工具选择', '执行审计'],
      example:
        "import type { OnRunWorkflowHookV2 } from 'openspecui/hooks'\n\nexport const onRunWorkflow: OnRunWorkflowHookV2 = async (ctx, run) => {\n  const result = await run()\n  if (result.kind !== 'agent-prompt') return result\n\n  return {\n    ...result,\n    text: `${result.text}\\n\\nPlanning root: ${ctx.target.planningRoot.path}\\nProject policy: include security impact in the final summary.`,\n  }\n}",
    },
  },
} satisfies WebsiteContent
