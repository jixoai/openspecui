import type { WebsiteContent } from '$lib/i18n/schema'

export const zh = {
  htmlLang: 'zh-CN',
  meta: {
    siteTitle: 'OpenSpec UI',
    siteSubtitle: '面向 OpenSpec 工作流的可视化前端',
    homeTitle: 'OpenSpec UI - 面向 OpenSpec 工作流的可视化前端',
    homeDescription:
      'OpenSpecUI 为 OpenSpec 项目提供 dashboard、工作流视图、terminal tabs 与静态导出能力，同时保持贴近 CLI。',
    hooksTitle: 'OpenSpecUI Hooks - 项目文档与工作流 Hooks',
    hooksDescription:
      '了解 OpenSpecUI 如何通过项目级 hooks 自定义文档读取与工作流执行，同时避免污染 .openspecui.json。',
    languageLabel: '语言',
    themeLabel: '主题',
  },
  nav: {
    home: '首页',
    hooks: 'Hooks',
    app: 'Hosted App',
    github: 'GitHub',
  },
  hero: {
    title: '用一个贴近 CLI 本质的 UI 来操作 OpenSpec。',
    summary:
      'OpenSpecUI 为 OpenSpec 项目提供可视化的 dashboard、config 界面、change 工作流视图、terminal tabs，以及静态导出能力，同时不遮蔽底层工作流。',
    primaryCta: '打开 Hosted App',
    secondaryCta: '阅读 Hooks 文档',
    sidebarEyebrow: '默认路径',
    sidebarTitle: 'PWA 优先，网页回退',
    sidebarBody:
      '启动本地后端，再发起 App Shell 链接。若浏览器发现同一部署范围内已安装的 PWA，则可能直接复用它。',
    badges: {
      live: '实时模式',
      hosted: '托管前端',
      static: '静态导出',
    },
  },
  commands: {
    title: '开始使用',
    summary: '优先建议不全局安装直接运行，这样每次会话都能拿到当前发布线的版本。',
    runnerLabel: '入口',
    appToggleLabel: 'App 模式',
    appToggleSummary:
      '优先启动 App Shell，而不是本地 Web bundle。若浏览器发现同一部署范围内已安装的 PWA，则可能直接复用它。',
    appToggleEnabled: '开启',
    appToggleDisabled: '关闭',
    runLabel: '运行 OpenSpec UI',
    appOnSummary:
      '启动本地后端，并发起 App Shell 链接。浏览器若能捕获同一部署范围内的已安装 PWA，就会优先进入它；否则回退到普通网页标签。',
    appOffSummary: '启动本地后端，并由当前机器直接提供本地 Web UI。',
    exportLabel: '静态导出',
    exportSummary: '生成可部署的静态快照，用于文档站点或离线审阅。',
    compatibility: 'OpenSpecUI 3.x 面向 OpenSpec CLI 1.3.x，并兼容 1.2.x 项目。',
  },
  modes: {
    title: '选择合适的界面',
    summary: '产品保持客观：不同工作阶段，使用不同的界面承载。',
    items: [
      {
        title: '实时模式',
        body: '适合编辑 specs、审阅 changes、使用 terminal，以及实时观察项目状态。',
      },
      {
        title: 'Hosted app 模式',
        body: '适合复用一套维护中的 Shell 部署，同时连接多个本地后端，并在同一部署范围内复用 PWA。',
      },
      {
        title: '静态导出',
        body: '适合发布快照、做设计评审链接，或只读查看项目。',
      },
    ],
  },
  links: {
    title: '继续深入',
    summary: '先进入 app，再查看上游工作流与源码仓库。',
    appTitle: 'app.openspecui.com',
    appBody:
      '提供会打开后端自带 OpenSpecUI 页面的 App Shell，并支持浏览器管理的同部署范围 PWA 捕获。',
    openspecTitle: 'openspec.dev',
    openspecBody: 'OpenSpec 官方站点与工作流参考。',
    githubTitle: 'GitHub',
    githubBody: '源码、issues、版本历史与贡献流程。',
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
      signature: 'onRunWorkflow(ctx, run): Promise<RunWorkflowResultV1>',
      when: '适合选择 workflow tools、注入安全环境变量、记录审计输出，或者基于项目策略拦截执行。',
      stableFor: ['工作流编排', '工具选择', '执行审计'],
      example:
        "import type { OnRunWorkflowHookV1 } from 'openspecui/hooks'\n\nexport const onRunWorkflow: OnRunWorkflowHookV1 = async (ctx, run) => {\n  const result = await run()\n  if (result.kind !== 'agent-prompt') return result\n\n  return {\n    ...result,\n    text: `${result.text}\\n\\nProject policy: include security impact in the final summary.`,\n  }\n}",
    },
  },
  footer: {
    copyright: 'OpenSpecUI',
  },
} satisfies WebsiteContent
