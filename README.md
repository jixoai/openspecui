# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI is a web interface for OpenSpec workflows (live mode + hosted app + static export).

## Version Compatibility

| OpenSpecUI        | Required OpenSpec CLI |
| ----------------- | --------------------- |
| `@latest` / `@^2` | `>=1.2.0 <2`          |
| `@^1`             | `>=1.0.0 <1.2.0`      |

Legacy docs:

- 1.x: [`README-1.x.md`](./README-1.x.md)
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

## Common Flows

### Start local live mode

```bash
openspecui
openspecui ./my-project
openspecui --port 3200
```

### Start with the hosted app

```bash
openspecui --app
openspecui --app=https://app.example.com
```

`--app` still runs the local backend, but launches the hosted app instead of a local web bundle.
When no explicit URL is passed, OpenSpecUI uses the configured `appBaseUrl` or the official
`https://app.openspecui.com`.

Launch contract:

- PWA-first when the browser can capture the hosted app URL into an installed PWA from the same
  deployment scope
- browser-page fallback when no matching hosted-app PWA is installed, link capture is disabled, or
  the browser does not support it
- `--app=https://app.example.com` only works with the PWA installed from that same deployment; an
  installed `app.openspecui.com` PWA will not capture a different origin

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

## Public Entry Points

- Hosted app: `https://app.openspecui.com`
- Website: `https://www.openspecui.com`
- OpenSpec official site: `https://openspec.dev`
- GitHub: `https://github.com/jixoai/openspecui`

## OpenSpec 1.2 Notes

- OpenSpecUI 2.x requires OpenSpec CLI `>=1.2.0`.
- If your CLI is older, UI shows `OpenSpec CLI Required` and blocks core interactions until upgraded.
- Default workflow guidance is now `/opsx:propose` (quick path).
- OpenSpec profile/workflow sync can be inspected from **Settings → OpenSpec 1.2 Profile & Sync**.

Upgrade CLI:

```bash
npm install -g @fission-ai/openspec@latest
```

## Key Features

- Dashboard for specs/changes/tasks status
- Config/Schema viewers and editors
- OPSX compose panel for change actions
- Multi-tab PTY terminal (xterm + ghostty-web)
- Hosted app shell for shared frontend deployments
- Search in live mode and static mode
- Static snapshot export for docs hosting
