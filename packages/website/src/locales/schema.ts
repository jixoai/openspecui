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
    liveLabel: string
    liveSummary: string
    hostedLabel: string
    hostedSummary: string
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
  footer: {
    canonical: string
    note: string
  }
}
