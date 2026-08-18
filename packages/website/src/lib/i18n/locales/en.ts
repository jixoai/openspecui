/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Provide the canonical English single-page v9 narrative copy.
 * 2. Publish the OpenSpecUI 9 / OpenSpec CLI 1.8–1.9 compatibility boundary without retired surfaces.
 * 3. Omit the translation platform feature per the owner's pending rework decision.
 *
 * Original request (2026-08-19): "只提供现有最新版本的信息"
 * Owner visual decision (2026-08-19): Broadside Log direction — editorial hero + terminal typing card.
 */
import type { WebsiteContent } from '$lib/i18n/schema'

export const en = {
  htmlLang: 'en',
  meta: {
    siteTitle: 'OpenSpec UI',
    siteSubtitle: 'Visual frontend for OpenSpec workflows',
    homeTitle: 'OpenSpec UI - Visual frontend for OpenSpec workflows',
    homeDescription:
      'OpenSpecUI 9 gives OpenSpec projects a reactive dashboard, an objective change workflow, a config workbench, real terminals, and static export — while staying close to the OpenSpec CLI.',
    hooksTitle: 'OpenSpecUI Hooks - Project document and workflow hooks',
    hooksDescription:
      'Learn how OpenSpecUI project hooks customize document reading and workflow execution without polluting .openspecui.json.',
    languageLabel: 'Language',
    themeLabel: 'Theme',
  },
  nav: {
    home: 'Home',
    hooks: 'Hooks',
    app: 'Browser App',
    github: 'GitHub',
  },
  hero: {
    eyebrow: 'OPENSPECUI 9 — VISUAL PROJECTION OF OPENSPEC',
    titleLead: 'Operate OpenSpec through a UI that stays ',
    titleAccent: 'close to the CLI.',
    summary:
      'OpenSpecUI 9 gives OpenSpec projects a reactive dashboard, an objective change workflow, a config workbench, real terminals, and static export — without hiding the OpenSpec CLI underneath.',
    badges: ['NATIVE APP', 'LIVE WEB', 'STATIC EXPORT'],
    copyCta: 'COPY',
    copiedCta: 'COPIED',
    githubCta: 'GITHUB ↗',
  },
  terminal: {
    barTitle: 'www.openspecui.com — zsh',
    command: 'npx openspecui@latest',
    outputs: [
      'OpenSpec UI v9 — visual interface for spec-driven development',
      'supports OpenSpec CLI 1.8.x / 1.9.x · node >= 20.19',
      '→ native app · live web · static export',
      '→ the CLI stays the source of truth, the UI stays a projection',
    ],
  },
  features: {
    title: "WHAT'S INSIDE",
    indexLabel: 'INDEX — 08',
    items: [
      {
        id: 'opsx-workflow',
        title: 'OPSX change workflow',
        body: 'Board lanes project tracked task phases — no-tasks, in-progress, complete, archive — while operators run Continue, Fast-forward, Apply, Verify, and Archive over live CLI evidence.',
      },
      {
        id: 'dashboard',
        title: 'Dashboard',
        body: 'A kanban row, active changes with CLI-owned applying progress, and a curated Code Git snapshot keep current work and recent history on one screen.',
      },
      {
        id: 'config',
        title: 'Config workbench',
        body: 'Route-backed owners for project binding, active root, environment globals, and schemas — plus an adaptive Guide that ends at verified resolved context.',
      },
      {
        id: 'agents',
        title: 'Agent delivery',
        body: 'A CLI-owned registry projects per-version agent delivery: commands, user-global skills, migration, and restart evidence. Init and update stay typed CLI mutations.',
      },
      {
        id: 'terminal',
        title: 'Terminals',
        body: 'Multi-tab PTY sessions with xterm and ghostty-web renderers. Workflow prompts compose in an editor, then send straight into a live agent terminal.',
      },
      {
        id: 'git',
        title: 'Git view',
        body: 'Commits, patches, and worktrees with explicit code-versus-planning scope — the same token-bound provenance the dashboard carries.',
      },
      {
        id: 'search',
        title: 'Search',
        body: 'Reactive search in live mode, and a worker-backed index that keeps working inside the static export.',
      },
      {
        id: 'kernel',
        title: 'Reactive kernel',
        body: 'A signal-based file system watches natively, tracks dependencies, and settles mutations idempotently. Push notifies; every subscribed surface pulls fresh projections.',
      },
    ],
  },
  surfaces: {
    title: 'THREE SURFACES',
    items: [
      {
        title: 'Native App',
        body: 'A retained OpenTray window with tray, Workspaces for many projects, a task manager, and Stores — served by one user-level daemon.',
        command: 'openspecui start',
      },
      {
        title: 'Direct Web',
        body: 'One explicit browser surface for the current project at localhost:3100. A running daemon still keeps the Workspace.',
        command: 'openspecui --web',
      },
      {
        title: 'Static export',
        body: 'A deployable snapshot for docs hosting or offline review — worker search intact, no backend required.',
        command: 'openspecui export -o ./dist',
      },
    ],
  },
  run: {
    title: 'RUN IT',
    summary:
      'Prefer running without a global install so each session picks up the current release line.',
    runnerLabel: 'RUNNER',
    appModeLabel: 'APP MODE',
    appModeSummary:
      'The local App daemon for Workspaces, or Direct Web for one explicit browser surface.',
    appFlagLabel: '--app',
    webFlagLabel: '--web',
    appStateLabel: 'APP',
    webStateLabel: 'WEB',
    serveCaption: 'SERVE',
    serveAppSummary:
      'Start the project backend, ensure the App daemon is running, and attach the project as a Workspace.',
    serveWebSummary: 'Start the project backend and open Direct Project Web in the system browser.',
    exportCaption: 'STATIC EXPORT',
    exportSummary: 'Generate a deployable snapshot for docs hosting or offline review.',
    protectCaption: 'PROTECT IT',
    protectSummary:
      'Generate a 256-bit Bearer credential for the whole access gate — HTTP, tRPC, PTY, files, terminal.',
    compat: 'OpenSpecUI 9 supports OpenSpec CLI 1.8.x and 1.9.x (1.9 recommended) · Node ≥ 20.19',
  },
  links: {
    appTitle: 'app.openspecui.com',
    appBody: 'Optional browser deployment of the App shell.',
    openspecTitle: 'openspec.dev',
    openspecBody: 'The official OpenSpec project and workflow reference.',
    githubTitle: 'GitHub',
    githubBody: 'Source, issues, release history, and contribution flow.',
  },
  footer: {
    ghost: 'OPENSPECUI',
    copyright: 'OpenSpecUI',
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
} satisfies WebsiteContent
