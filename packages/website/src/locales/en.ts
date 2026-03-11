import type { WebsiteLocale } from './schema'

export const en = {
  meta: {
    siteTitle: 'OpenSpec UI',
    siteSubtitle: 'Visual frontend for OpenSpec workflows',
    languageLabel: 'Language',
  },
  hero: {
    eyebrow: 'Spec-driven interface',
    title: 'Operate OpenSpec through a UI that stays close to the CLI.',
    summary:
      'OpenSpecUI gives OpenSpec projects a concrete dashboard, config surface, change workflow views, terminal tabs, and static export capabilities without hiding the underlying workflow.',
    primaryCta: 'Open hosted app',
    secondaryCta: 'View GitHub',
    badges: {
      live: 'Live mode',
      hosted: 'Hosted app',
      static: 'Static export',
    },
  },
  commands: {
    title: 'Run it',
    summary:
      'Prefer running without a global install so each session picks up the current release line.',
    liveLabel: 'Local live server',
    liveSummary: 'Start the local backend plus the local web UI.',
    hostedLabel: 'Shared hosted frontend',
    hostedSummary:
      'Run the local backend, but open the shared hosted frontend instead of a local web bundle.',
    exportLabel: 'Static export',
    exportSummary: 'Generate a deployable snapshot for docs hosting or offline review.',
    compatibility: 'OpenSpecUI 2.x targets OpenSpec CLI 1.2+.',
  },
  modes: {
    title: 'Choose the right surface',
    summary: 'The product stays objective: different surfaces for different stages of work.',
    liveTitle: 'Live mode',
    liveBody:
      'Best for editing specs, reviewing changes, working with terminals, and watching project state reactively.',
    hostedTitle: 'Hosted app mode',
    hostedBody:
      'Best when you want one maintained frontend and multiple local backends or private hosted deployments.',
    exportTitle: 'Static export',
    exportBody:
      'Best for publishing snapshots, design review links, or read-only project inspection.',
  },
  links: {
    title: 'Go deeper',
    summary: 'Start with the app, then follow the upstream workflow and source repository.',
    appTitle: 'app.openspecui.com',
    appBody: 'Hosted shell for the latest compatible OpenSpecUI frontend.',
    openspecTitle: 'openspec.dev',
    openspecBody: 'Official OpenSpec project site and workflow reference.',
    githubTitle: 'GitHub',
    githubBody: 'Source, issues, release history, and contribution flow.',
  },
  footer: {
    deployment: 'Deployed as a static site on www.openspecui.com.',
    canonical:
      'Canonical apex redirect should be configured in Cloudflare, not in the site bundle.',
    note: 'Language can be forced with ?lang=en or ?lang=zh and then persists locally.',
  },
} satisfies WebsiteLocale
