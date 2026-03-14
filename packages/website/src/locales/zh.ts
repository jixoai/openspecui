import type { WebsiteLocale } from './schema'

export const zh = {
  meta: {
    siteTitle: 'OpenSpec UI',
    siteSubtitle: '面向 OpenSpec 工作流的可视化前端',
    languageLabel: '语言',
  },
  hero: {
    eyebrow: '规格驱动界面',
    title: '用一个贴近 CLI 本质的 UI 来操作 OpenSpec。',
    summary:
      'OpenSpecUI 为 OpenSpec 项目提供可视化的 dashboard、config 界面、change 工作流视图、terminal tabs，以及静态导出能力，同时不遮蔽底层工作流。',
    primaryCta: '打开 Hosted App',
    secondaryCta: '查看 GitHub',
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
    appToggleSummary: '优先打开共享托管前端，而不是本地 Web bundle。',
    appToggleEnabled: '开启',
    appToggleDisabled: '关闭',
    runLabel: '运行 OpenSpec UI',
    appOnSummary: '启动本地后端，并打开共享 App Shell。适合优先复用一套维护中的前端。',
    appOffSummary: '启动本地后端，并由当前机器直接提供本地 Web UI。',
    exportLabel: '静态导出',
    exportSummary: '生成可部署的静态快照，用于文档站点或离线审阅。',
    compatibility: 'OpenSpecUI 2.x 面向 OpenSpec CLI 1.2+。',
  },
  modes: {
    title: '选择合适的界面',
    summary: '产品保持客观：不同工作阶段，使用不同的界面承载。',
    liveTitle: '实时模式',
    liveBody: '适合编辑 specs、审阅 changes、使用 terminal，以及实时观察项目状态。',
    hostedTitle: 'Hosted app 模式',
    hostedBody: '适合复用一套维护中的前端，同时连接多个本地后端或私有部署的服务。',
    exportTitle: '静态导出',
    exportBody: '适合发布快照、做设计评审链接，或只读查看项目。',
  },
  links: {
    title: '继续深入',
    summary: '先进入 app，再查看上游工作流与源码仓库。',
    appTitle: 'app.openspecui.com',
    appBody: '提供最新兼容 OpenSpecUI 前端的 Hosted Shell。',
    openspecTitle: 'openspec.dev',
    openspecBody: 'OpenSpec 官方站点与工作流参考。',
    githubTitle: 'GitHub',
    githubBody: '源码、issues、版本历史与贡献流程。',
  },
} satisfies WebsiteLocale
