/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Type the single-page v9 narrative surface: hero + terminal card, features, surfaces, run-it, footer.
 * 2. Keep every rendered string locale-owned; commands that depend on the runner stay computed in code.
 * 3. Omit retired surfaces by construction: no PWA fields, no translation-platform fields.
 *
 * Original request (2026-08-19): "提供一个重构方案（不靠向下兼容，只提供现有最新版本的信息）"
 * Owner visual decision (2026-08-19): "我希望 broadside 的整体效果，还喜欢 BootLog 的那个终端打字的效果，把 BootLog 的这个效果卡片合并到 broadside 中"
 */

export type WebsiteLanguage = 'en' | 'zh'
export type RunnerId = 'npm' | 'pnpm' | 'bun'

export interface WebsiteFeatureItem {
  /** Stable semantic id; also the scroll-spy anchor and test key. */
  id: string
  title: string
  body: string
}

export interface WebsiteSurfaceItem {
  title: string
  body: string
  command: string
}

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
    eyebrow: string
    /** Rendered as large lead type; the accent fragment renders in the primary color. */
    titleLead: string
    titleAccent: string
    summary: string
    badges: [string, string, string]
    copyCta: string
    copiedCta: string
    githubCta: string
  }
  terminal: {
    barTitle: string
    command: string
    outputs: [string, string, string, string]
  }
  features: {
    title: string
    indexLabel: string
    items: [
      WebsiteFeatureItem,
      WebsiteFeatureItem,
      WebsiteFeatureItem,
      WebsiteFeatureItem,
      WebsiteFeatureItem,
      WebsiteFeatureItem,
      WebsiteFeatureItem,
      WebsiteFeatureItem,
    ]
  }
  surfaces: {
    title: string
    items: [WebsiteSurfaceItem, WebsiteSurfaceItem, WebsiteSurfaceItem]
  }
  run: {
    title: string
    summary: string
    runnerLabel: string
    appModeLabel: string
    appModeSummary: string
    appFlagLabel: string
    webFlagLabel: string
    appStateLabel: string
    webStateLabel: string
    serveCaption: string
    serveAppSummary: string
    serveWebSummary: string
    exportCaption: string
    exportSummary: string
    protectCaption: string
    protectSummary: string
    compat: string
  }
  links: {
    appTitle: string
    appBody: string
    openspecTitle: string
    openspecBody: string
    githubTitle: string
    githubBody: string
  }
  footer: {
    ghost: string
    copyright: string
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
