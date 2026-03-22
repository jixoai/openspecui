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
    sidebarEyebrow: 'Default path',
    sidebarTitle: 'PWA first, browser fallback',
    sidebarBody:
      'Start the local backend, then launch the maintained hosted app URL. Matching installed PWAs on the same deployment scope may take over.',
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
    runnerLabel: 'Runner',
    appToggleLabel: 'App mode',
    appToggleSummary:
      'Launch the hosted app instead of a local web bundle. Matching installed PWAs on the same deployment scope may be reused by the browser.',
    appToggleEnabled: 'On',
    appToggleDisabled: 'Off',
    runLabel: 'Run OpenSpec UI',
    appOnSummary:
      'Start the local backend and launch the hosted app URL. Browsers may route that same-scope URL into an installed PWA; otherwise it stays in a browser tab.',
    appOffSummary: 'Start the local backend and serve the local web UI from this machine.',
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
      'Best when you want one maintained deployment, multiple local backends, and optional PWA reuse on that same hosted scope.',
    exportTitle: 'Static export',
    exportBody:
      'Best for publishing snapshots, design review links, or read-only project inspection.',
  },
  links: {
    title: 'Go deeper',
    summary: 'Start with the app, then follow the upstream workflow and source repository.',
    appTitle: 'app.openspecui.com',
    appBody:
      'Hosted app shell for the latest compatible OpenSpecUI frontend, with browser-managed PWA capture on the same deployment scope.',
    openspecTitle: 'openspec.dev',
    openspecBody: 'Official OpenSpec project site and workflow reference.',
    githubTitle: 'GitHub',
    githubBody: 'Source, issues, release history, and contribution flow.',
  },
} satisfies WebsiteLocale
