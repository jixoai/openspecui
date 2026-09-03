<!--
Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
1. Document the current OpenSpec compatibility and project workflow.
2. Document serve, App-daemon, Direct Web, and static-export commands.
3. Document project hooks without hiding OpenSpec CLI authority.

Original request (2026-07-29): "补充 openspecui --web == openspecui serve --web；README 文档需要补充这些命令的介绍。"
Original request (2026-08-01): "v7不兼容1.6.x，明确要求必须使用 v1.7.x。"
Original request (2026-08-15): "v9的适配需要同时适配 1.8和1.9。"
Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
-->

# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI is a web interface for OpenSpec workflows (live mode + static export).

## Version Compatibility

| OpenSpecUI         | OpenSpec CLI line                                          |
| ------------------ | ---------------------------------------------------------- |
| `@latest` / `@^11` | current: `>=1.11.0 <1.12.0`; supported: `>=1.10.0 <1.12.0` |
| `@^9` (legacy)     | current: `>=1.9.0 <1.10.0`; supported: `>=1.8.0 <1.10.0`   |
| `@^7`              | `>=1.7.0 <1.8.0`                                           |
| `@^6`              | current: `>=1.6.0 <1.7.0`; compatible: `>=1.7.0 <1.8.0`    |
| `@^5`              | current: `>=1.5.0 <1.6.0`; accepted: `>=1.4.0 <1.6.0`      |
| `@^4`              | current: `>=1.4.0 <1.5.0`; accepted: `>=1.3.0 <1.5.0`      |
| `@^3`              | `>=1.3.0 <1.4.0`                                           |
| `@^2`              | `>=1.2.0 <1.3.0`                                           |
| `@^1`              | `>=1.0.0 <1.2.0`                                           |

OpenSpecUI major versions ordinarily track OpenSpec CLI minor lines. OpenSpecUI 11 adapts OpenSpec
CLI 1.10.x and 1.11.x in one release line: stable 1.11.x is the current, recommended line, stable
1.10.x is supported non-current, and OpenSpecUI deliberately skips a separate 10 release while
taking on every 1.10 protocol obligation. OpenSpecUI 9 remains the historical 1.8.x/1.9.x product
line.

Legacy docs:

- 1.9: [`README-1.9.0.md`](./README-1.9.0.md)
- 1.7: [`README-1.7.0.md`](./README-1.7.0.md)
- 1.6: [`README-1.6.0.md`](./README-1.6.0.md)
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

- OpenSpecUI 11 accepts stable OpenSpec CLI `>=1.10.0 <1.12.0` and recommends the 1.11 line.
- Stable 1.11.x is identified as the current line; stable 1.10.x is supported non-current.
- OpenSpec CLI 1.9.x and older lines, CLI `>=1.12.0`, and every prerelease are unsupported by
  OpenSpecUI 11 and blocked by default.
- If an incompatible CLI executable is available, the mismatch Dialog offers **Skip version check**.
  This bypass is held only by the current page runtime, clears on refresh/reopen, and does not
  create a compatibility promise.

OpenSpecUI 11 adds: one-spawn batch status loading through `openspec status --all` for 1.11
sessions (1.10 keeps the per-change path), Change Detail requirement diff/warning evidence through
`openspec show --diff` for MODIFIED deltas, `openspec init --language` on both admitted lines, and
an expanded Agent delivery registry — Zed joins from CLI 1.10 (skills-only, `.agents/skills`), and
Antigravity migrates its skills root from `.agent` to `.agents` starting with CLI 1.11 while 1.10
keeps `.agent` current.

Upgrade CLI:

```bash
npm install -g @fission-ai/openspec@1.11
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
