<!--
Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
1. Document the npm-facing surface of the current openspecui release line (v11) only.
2. Keep commands, compatibility, and hooks aligned with the repository README facts.
3. Leave full version history and legacy archives to the repository README.

Original request (2026-08-19): "现在我们需要为 openspecui 这个 npm 包撰写一下 README.md 文件。但是不用发版本，下次发版本的时候带上去就行。和仓库的 README.md 不同的是，它更侧重于当前这个版本 v9."
Owner release law (2026-08-19): every release that updates the repository README must also update this package README.
Original request (2026-08-28): "直接将 0.10.0 和 0.11.0 一起适配，然后发布 v11。"
-->

# OpenSpecUI

A visual interface for [OpenSpec](https://openspec.dev) — the visual projection and operator for spec-driven development with AI agents.

OpenSpecUI 11 gives OpenSpec projects a reactive dashboard, an objective change workflow, a config workbench, real terminals, and static export — while the OpenSpec CLI stays the source of truth for every workflow fact.

## Requirements

- **OpenSpec CLI**: `>=1.10.0 <1.12.0` — the stable 1.11 line is current and recommended; stable 1.10.x is supported non-current. Older lines (including 1.9.x and below), prereleases, and `>=1.12.0` are blocked by default.
- **Node.js**: `>= 20.19.0`

```bash
npm install -g @fission-ai/openspec@1.11
```

## Quick start

```bash
# Recommended: run without a global install
npx openspecui@latest
bunx openspecui@latest

# Optional: install globally
npm install -g openspecui
openspecui
```

The bare command is an alias for `serve`. It starts the project backend; if a local App daemon is already running, the project is attached to its **Workspaces**. Otherwise an interactive terminal asks `Start OpenSpecUI App? [Y/n]`, and non-interactive execution opens **Direct Project Web** at `http://localhost:3100`.

## Three surfaces

**Native App** — a user-level App daemon hosts the bundled same-version App shell in a retained OpenTray window with a tray icon. Workspaces keep multiple projects in one place (favorites, recents, a task manager for running backends) alongside environment-scoped Stores.

```bash
openspecui start        # start/activate the App daemon (native OpenTray host)
openspecui start --web  # same daemon, Browser host instead
openspecui stop
openspecui restart
```

**Direct Web** — one explicit browser surface for the current project, no daemon required.

```bash
openspecui --web
```

**Static export** — a deployable snapshot for docs hosting or offline review; search keeps working from a worker index, no backend needed.

```bash
openspecui export -o ./dist
openspecui export -o ./dist --base-path /docs --clean
```

## Command reference

| Command                                     | Description                                                                                      |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `openspecui [project-dir]`                  | Serve a project (alias of `serve [project-dir]`)                                                 |
| `openspecui serve [project-dir]`            | Start the project backend and own its Server                                                     |
| `openspecui --app`                          | Ensure the App daemon is running and attach the project as a Workspace                           |
| `openspecui --web`                          | Open Direct Project Web; also attach when a daemon is already running                            |
| `openspecui --no-open`                      | No prompt, no daemon start, no Workspace registration, no browser                                |
| `openspecui --auth`                         | Generate a 256-bit Bearer credential for the whole access gate                                   |
| `openspecui --password <secret>`            | Use an operator secret instead of a generated credential                                         |
| `openspecui --port <port>`                  | Project web port (default 3100)                                                                  |
| `openspecui start / stop / restart [--web]` | Manage only the user-level App daemon, never project Servers                                     |
| `openspecui export -o <dir>`                | Static export; `-f html\|json`, `--base-path`, `--clean`, `--open`, `--references include\|omit` |
| `openspecui --otel --otel-endpoint <url>`   | Backend OpenTelemetry tracing                                                                    |

URL-valued App mode is not supported: the daemon always serves the App shell bundled with the same CLI release.

## What's inside

- **OPSX change workflow** — kanban lanes over tracked task phases with Continue / Fast-forward / Apply / Verify / Archive operators driven by live CLI evidence; 1.11 sessions load the whole change status list in one `status --all` spawn
- **Change evidence** — MODIFIED deltas can present the CLI's own requirement diff and warning evidence (`show --diff`, 1.11) beside the local delta projection
- **Dashboard** — active changes with CLI-owned applying progress and a curated Code Git snapshot
- **Config workbench** — route-backed owners for project binding, active root, environment globals, and schemas, plus an adaptive setup guide and `init --language` on both admitted CLI lines
- **Agent delivery** — the CLI-owned registry projects per-version agent commands and skills, including Zed (from 1.10) and the Antigravity `.agent` → `.agents` migration (from 1.11)
- **Terminals** — multi-tab PTY sessions (xterm and ghostty-web) with direct agent send
- **Git view** — commits, patches, and worktrees with explicit code/planning scope
- **Search** — reactive in live mode, worker-backed in static exports
- **Reactive kernel** — native file watching with push-notify / pull-refresh projections

## Project hooks

Project-local hooks live in `openspec/openspecui.hooks.ts`, outside persisted UI config. Types ship with this package:

```ts
import type { OnReadDocumentHookV1, OnRunWorkflowHookV2 } from 'openspecui/hooks'

export const onReadDocument: OnReadDocumentHookV1 = async (ctx, read) => {
  const result = await read()
  if (ctx.document.kind !== 'spec') return result
  return { ...result, watchFiles: ['openspec/glossary.md'] }
}

export const onRunWorkflow: OnRunWorkflowHookV2 = async (ctx, run) => {
  const result = await run()
  if (result.kind !== 'agent-prompt') return result
  return { ...result, text: `${result.text}\n\nPlanning root: ${ctx.target.planningRoot.path}` }
}
```

See the repository README for the full hook contract.

## Links

- Website: <https://www.openspecui.com>
- OpenSpec: <https://openspec.dev>
- Source and full documentation: <https://github.com/jixoai/openspecui>

MIT License — see the repository for details.
