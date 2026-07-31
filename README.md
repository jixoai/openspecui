<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Document the current OpenSpec compatibility and project workflow.
2. Document serve, App-daemon, Direct Web, and static-export commands.
3. Document project hooks without hiding OpenSpec CLI authority.

Original request (2026-07-29): "补充 openspecui --web == openspecui serve --web；README 文档需要补充这些命令的介绍。"
-->

# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI is a web interface for OpenSpec workflows (live mode + static export).

## Version Compatibility

| OpenSpecUI        | OpenSpec CLI line                                       |
| ----------------- | ------------------------------------------------------- |
| `@latest` / `@^6` | current: `>=1.6.0 <1.7.0`; compatible: `>=1.7.0 <1.8.0` |
| `@^5`             | current: `>=1.5.0 <1.6.0`; accepted: `>=1.4.0 <1.6.0`   |
| `@^4`             | current: `>=1.4.0 <1.5.0`; accepted: `>=1.3.0 <1.5.0`   |
| `@^3`             | `>=1.3.0 <1.4.0`                                        |
| `@^2`             | `>=1.2.0 <1.3.0`                                        |
| `@^1`             | `>=1.0.0 <1.2.0`                                        |

OpenSpecUI major versions ordinarily track OpenSpec CLI minor lines. OpenSpecUI 6.1 remains adapted to
OpenSpec CLI 1.6.x and accepts 1.7.x as a compatibility bridge. This bridge does not claim 1.7-specific
feature completeness or define the later OpenSpecUI 7.x line.

Legacy docs:

- 1.3: [`README-1.3.0.md`](./README-1.3.0.md)
- 1.2: [`README-1.2.0.md`](./README-1.2.0.md)
- 1.x UI / pre-1.2 CLI line: [`README-1.x.md`](./README-1.x.md)
- 0.16: [`README-0.16.0.md`](./README-0.16.0.md)

## Quick Start

```bash
# Recommended: run without global install
npx openspecui@latest
bunx openspecui@latest

# Optional: install globally
npm install -g openspecui
openspecui
```

Direct Project Web defaults to `http://localhost:3100` when that presentation is selected.

## OpenSpec CLI Compatibility

- OpenSpecUI 6.1 targets OpenSpec CLI `>=1.6.0 <1.7.0`; CLI `>=1.7.0 <1.8.0` remains compatible.
- Older CLI lines and CLI `>=1.8.0` are unsupported by OpenSpecUI 6.1.
- If your CLI is outside `>=1.6.0 <1.8.0`, the UI shows `OpenSpec CLI Required` and blocks core interactions until upgraded.
- OpenSpec profile/workflow sync can be inspected from **Settings → OpenSpec Profile & Sync**.
- OpenSpec CLI 1.6's default `core` profile includes `/opsx:sync` and `/opsx:update`, with Oh My Pi and Trae command delivery.

Upgrade CLI:

```bash
npm install -g @fission-ai/openspec@latest
```

## Common Flows

### Serve a project

```bash
openspecui
openspecui ./my-project
openspecui serve ./my-project
openspecui --port 3200
```

The bare command is an alias for `serve`. Each `serve` process owns its project Server. If an App
daemon is already running, the project is added to its **Workspaces**. Otherwise an interactive
terminal asks `Start OpenSpecUI App? [Y/n]`; non-interactive execution opens Direct Project Web.

### App daemon and explicit presentation

```bash
# Serve this project through the local App daemon (native OpenTray by default)
openspecui --app
openspecui serve --app

# Open Direct Project Web; also attach to an already-running daemon
openspecui --web
openspecui serve --web
openspecui serve --no-open

# Manage only the user-level App daemon, never project Servers
openspecui start
openspecui start --web
openspecui stop
openspecui restart
openspecui restart --web
```

Daemon host mode is fixed at startup: native uses a retained OpenTray window; `--web` uses the
Browser host. If a repeated `start` explicitly requests another mode, use the exact `restart`
command reported by the CLI. `serve --no-open` performs no prompt, daemon start, Workspace
registration, or Browser opening. URL-valued App mode and project-level shell-location settings are
no longer supported; the daemon serves the App shell bundled with the same CLI release. Every
Workspace tab can ask the daemon to open its current backend in the system browser without exposing
the backend URL as page-controlled input.

### Static export

```bash
openspecui export -o ./dist
openspecui export -o ./dist --base-path /docs --clean
```

### Nix

```bash
nix run github:jixoai/openspecui -- --help
nix develop
```

## Project Hooks

OpenSpecUI can load project-local hooks from `openspec/openspecui.hooks.ts`.
Hooks are intentionally kept outside `openspec/.openspecui.json` so executable project behavior
does not pollute persisted UI configuration.

Install-time types are available from the CLI package:

```ts
import type { OnReadDocumentHookV1, OnRunWorkflowHookV2 } from 'openspecui/hooks'
```

### `onReadDocument`

Use `onReadDocument` when a project needs to project OpenSpec markdown differently for UI
consumers without rewriting source files. Typical use cases include resolving requirement IDs from
another file, translating markdown for readers, or adding derived context for search/export.

```ts
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { OnReadDocumentHookV1 } from 'openspecui/hooks'

export const onReadDocument: OnReadDocumentHookV1 = async (ctx, read) => {
  const result = await read()
  if (ctx.document.kind !== 'spec') return result

  const glossaryPath = join(ctx.projectDir, 'openspec', 'glossary.md')
  const glossary = await readFile(glossaryPath, 'utf-8')

  return {
    ...result,
    markdown: `${result.markdown}\n\n---\n\n${glossary}`,
    watchFiles: [glossaryPath],
  }
}
```

`onReadDocument` runs server-side in OpenSpecUI V1. It applies to processed document reads for
live views, search, and static export. Source reads stay raw and audit-safe, so editing,
validation, and source inspection still use the original OpenSpec files.

### `onRunWorkflow`

Use `onRunWorkflow` to adjust the final OPSX invocation payload before OpenSpecUI hands it to an
agent or command runner. OpenSpec CLI remains the source of truth for workflow status,
instructions, schemas, validation, and archive behavior.

```ts
import type { OnRunWorkflowHookV2 } from 'openspecui/hooks'

export const onRunWorkflow: OnRunWorkflowHookV2 = async (ctx, run) => {
  const result = await run()
  if (result.kind !== 'agent-prompt') return result

  return {
    ...result,
    text: `${result.text}\n\nPlanning root: ${ctx.target.planningRoot.path}\nProject policy: include security impact in the final summary.`,
  }
}
```

If a hook throws, OpenSpecUI falls back to the default result and attaches diagnostics instead of
blocking the UI.

## Key Features

- Dashboard for specs/changes/tasks status
- Config/Schema viewers and editors
- OPSX compose panel for change actions
- Multi-tab PTY terminal (xterm + ghostty-web)
- Search in live mode and static mode
- Static snapshot export for docs hosting
- Project-local hooks for document projection and OPSX invocation customization
