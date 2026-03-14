export interface WebsiteLocale {
  meta: {
    siteTitle: string
    siteSubtitle: string
    languageLabel: string
  }
  hero: {
    eyebrow: string
    title: string
    summary: string
    primaryCta: string
    secondaryCta: string
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
    liveTitle: string
    liveBody: string
    hostedTitle: string
    hostedBody: string
    exportTitle: string
    exportBody: string
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
}
