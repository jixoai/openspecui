# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI is a web interface for OpenSpec workflows (live mode + static export).

## Version Compatibility

| OpenSpecUI        | OpenSpec CLI line                                     |
| ----------------- | ----------------------------------------------------- |
| `@latest` / `@^6` | current: `>=1.6.0 <1.7.0`; accepted: `>=1.5.0 <1.7.0` |
| `@^5`             | current: `>=1.5.0 <1.6.0`; accepted: `>=1.4.0 <1.6.0` |
| `@^4`             | current: `>=1.4.0 <1.5.0`; accepted: `>=1.3.0 <1.5.0` |
| `@^3`             | `>=1.3.0 <1.4.0`                                      |
| `@^2`             | `>=1.2.0 <1.3.0`                                      |
| `@^1`             | `>=1.0.0 <1.2.0`                                      |

OpenSpecUI major versions track OpenSpec CLI minor lines. OpenSpecUI 6.x targets OpenSpec CLI
1.6.x and accepts only the immediately previous 1.5.x line as legacy-compatible. It does not
forward-support OpenSpec CLI 1.7.x.

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

Default URL: `http://localhost:3100`.

## OpenSpec CLI Compatibility

- OpenSpecUI 6.x targets OpenSpec CLI `>=1.6.0 <1.7.0`; CLI 1.5.x remains legacy-compatible.
- Older CLI lines and CLI `>=1.7.0` are unsupported by OpenSpecUI 6.x.
- If your CLI is outside `>=1.5.0 <1.7.0`, the UI shows `OpenSpec CLI Required` and blocks core interactions until upgraded.
- OpenSpec profile/workflow sync can be inspected from **Settings → OpenSpec Profile & Sync**.
- OpenSpec CLI 1.6's default `core` profile includes `/opsx:sync` and `/opsx:update`, with Oh My Pi and Trae command delivery.

Upgrade CLI:

```bash
npm install -g @fission-ai/openspec@latest
```

## Common Flows

### Start server

```bash
openspecui
openspecui ./my-project
openspecui --port 3200
```

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
