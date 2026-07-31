/**
 * Orthogonal intents (updated 2026-07-31 Asia/Shanghai):
 * 1. Provide the canonical English product-site copy.
 * 2. Keep launch guidance aligned with the local App daemon and explicit Direct Web contract.
 *
 * Original request (2026-07-15): "CLI 1.6 compatibility gate."
 * Original request (2026-07-31): "目前这个版本先给它支持1.7.*，因为基本兼容。"
 */
import type { WebsiteContent } from '$lib/i18n/schema'

export const en = {
  htmlLang: 'en',
  meta: {
    siteTitle: 'OpenSpec UI',
    siteSubtitle: 'Visual frontend for OpenSpec workflows',
    homeTitle: 'OpenSpec UI - Visual frontend for OpenSpec workflows',
    homeDescription:
      'OpenSpecUI gives OpenSpec projects a visual dashboard, workflow views, terminal tabs, and static export capabilities while staying close to the CLI.',
    hooksTitle: 'OpenSpecUI Hooks - Project document and workflow hooks',
    hooksDescription:
      'Learn how OpenSpecUI project hooks customize document reading and workflow execution without polluting .openspecui.json.',
    languageLabel: 'Language',
    themeLabel: 'Theme',
  },
  nav: {
    home: 'Home',
    hooks: 'Hooks',
    app: 'Standalone PWA',
    github: 'GitHub',
  },
  hero: {
    title: 'Operate OpenSpec through a UI that stays close to the CLI.',
    summary:
      'OpenSpecUI gives OpenSpec projects a concrete dashboard, config surface, change workflow views, terminal tabs, and static export capabilities without hiding the underlying workflow.',
    primaryCta: 'Open standalone PWA',
    secondaryCta: 'Read hooks docs',
    sidebarEyebrow: 'Default path',
    sidebarTitle: 'One local App daemon',
    sidebarBody:
      'Serve a project into the bundled same-version App shell. Native OpenTray is the default host; explicit Web mode uses the browser/PWA presenter.',
    badges: {
      live: 'Live mode',
      hosted: 'App daemon',
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
      'Choose the local App daemon for Workspaces, or Direct Web for one explicit browser surface.',
    appToggleEnabled: 'On',
    appToggleDisabled: 'Off',
    runLabel: 'Run OpenSpec UI',
    appOnSummary:
      'Start the project backend, ensure the local App daemon is running, and attach the project as a Workspace.',
    appOffSummary:
      'Start the project backend and explicitly open Direct Project Web. A running daemon also retains the Workspace.',
    exportLabel: 'Static export',
    exportSummary: 'Generate a deployable snapshot for docs hosting or offline review.',
    compatibility:
      'OpenSpecUI 6.1 targets OpenSpec CLI 1.7.x and accepts 1.6.x as legacy-compatible.',
  },
  modes: {
    title: 'Choose the right surface',
    summary: 'The product stays objective: different surfaces for different stages of work.',
    items: [
      {
        title: 'Live mode',
        body: 'Best for editing specs, reviewing changes, working with terminals, and watching project state reactively.',
      },
      {
        title: 'App daemon mode',
        body: 'Best for keeping multiple project Workspaces in one retained OpenTray or Browser/PWA App shell.',
      },
      {
        title: 'Static export',
        body: 'Best for publishing snapshots, design review links, or read-only project inspection.',
      },
    ],
  },
  links: {
    title: 'Go deeper',
    summary:
      'Start locally, then follow the upstream workflow, standalone PWA, and source repository.',
    appTitle: 'app.openspecui.com',
    appBody:
      'Optional standalone browser/PWA deployment. CLI App mode uses its own bundled local shell instead.',
    openspecTitle: 'openspec.dev',
    openspecBody: 'Official OpenSpec project site and workflow reference.',
    githubTitle: 'GitHub',
    githubBody: 'Source, issues, release history, and contribution flow.',
  },
  hooks: {
    heroTitle: 'Project hooks belong beside the project, not inside persisted UI config.',
    heroSummary:
      'OpenSpecUI loads `openspecui.hooks.ts` as executable project policy. The first stable hooks are intentionally narrow: one for reading documents and one for running OpenSpec workflows.',
    designTitle: 'Design law',
    designBody:
      '`on*` hooks are explicit interception points. They receive context plus a default runner function, and they must return the same kind of value the platform would have produced. No broad plugin bus is exposed.',
    contractTitle: 'Compatibility contract',
    contractBody:
      'The hook names describe durable OpenSpec user workflows rather than internal implementation phases. This keeps project hooks useful even as OpenSpecUI internals evolve.',
    lifecycleTitle: 'Where hooks sit',
    lifecycleItems: [
      'OpenSpec files are read from the project workspace.',
      '`onReadDocument` may transform the document payload before UI rendering or translation.',
      'OpenSpec CLI workflows are planned and executed by OpenSpecUI.',
      '`onRunWorkflow` may wrap the workflow run to select tools, inject environment, or audit execution.',
    ],
    onReadDocument: {
      name: 'onReadDocument',
      purpose: 'Customize markdown-like OpenSpec document text before OpenSpecUI displays it.',
      signature: 'onReadDocument(ctx, read): Promise<ReadDocumentResultV1>',
      when: 'Use it for #103-style preprocessing, documentation translation, link rewriting, or frontmatter-derived display changes.',
      stableFor: ['Markdown preprocessing', 'Translation overlays', 'Project-local display policy'],
      example:
        "import type { OnReadDocumentHookV1 } from 'openspecui/hooks'\n\nexport const onReadDocument: OnReadDocumentHookV1 = async (ctx, read) => {\n  const result = await read()\n  if (ctx.document.kind !== 'spec') return result\n\n  return {\n    ...result,\n    markdown: result.markdown.replaceAll('CLI_0003', 'CLI_0003 — CLI Recipe Execution'),\n    watchFiles: ['docs/reqstool/requirements.yml'],\n  }\n}",
    },
    onRunWorkflow: {
      name: 'onRunWorkflow',
      purpose: 'Wrap an OpenSpec workflow run without replacing the OpenSpec CLI contract.',
      signature: 'onRunWorkflow(ctx, run): Promise<RunWorkflowResultV2>',
      when: 'Use it to choose workflow tools, inject safe environment variables, record audit output, or gate execution by project policy.',
      stableFor: ['Workflow orchestration', 'Tool selection', 'Execution audit'],
      example:
        "import type { OnRunWorkflowHookV2 } from 'openspecui/hooks'\n\nexport const onRunWorkflow: OnRunWorkflowHookV2 = async (ctx, run) => {\n  const result = await run()\n  if (result.kind !== 'agent-prompt') return result\n\n  return {\n    ...result,\n    text: `${result.text}\\n\\nPlanning root: ${ctx.target.planningRoot.path}\\nProject policy: include security impact in the final summary.`,\n  }\n}",
    },
  },
  footer: {
    copyright: 'OpenSpecUI',
  },
} satisfies WebsiteContent
