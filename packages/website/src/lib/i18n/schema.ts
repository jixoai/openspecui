export type WebsiteLanguage = 'en' | 'zh'
export type RunnerId = 'npm' | 'pnpm' | 'bun'

export interface WebsiteContent {
  htmlLang: string
  meta: {
    siteTitle: string
    siteSubtitle: string
    homeTitle: string
    homeDescription: string
    hooksTitle: string
    hooksDescription: string
    languageLabel: string
    themeLabel: string
  }
  nav: {
    home: string
    hooks: string
    app: string
    github: string
  }
  hero: {
    title: string
    summary: string
    primaryCta: string
    secondaryCta: string
    sidebarEyebrow: string
    sidebarTitle: string
    sidebarBody: string
    badges: {
      live: string
      hosted: string
      static: string
    }
  }
  commands: {
    title: string
    summary: string
    runnerLabel: string
    appToggleLabel: string
    appToggleSummary: string
    appToggleEnabled: string
    appToggleDisabled: string
    runLabel: string
    appOnSummary: string
    appOffSummary: string
    exportLabel: string
    exportSummary: string
    compatibility: string
  }
  modes: {
    title: string
    summary: string
    items: Array<{
      title: string
      body: string
    }>
  }
  links: {
    title: string
    summary: string
    appTitle: string
    appBody: string
    openspecTitle: string
    openspecBody: string
    githubTitle: string
    githubBody: string
  }
  hooks: {
    heroTitle: string
    heroSummary: string
    designTitle: string
    designBody: string
    contractTitle: string
    contractBody: string
    lifecycleTitle: string
    lifecycleItems: string[]
    onReadDocument: HookDoc
    onRunWorkflow: HookDoc
  }
  footer: {
    copyright: string
  }
}

export interface HookDoc {
  name: string
  purpose: string
  signature: string
  when: string
  stableFor: string[]
  example: string
  exampleHtml?: string
}
