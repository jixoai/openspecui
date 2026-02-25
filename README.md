# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

OpenSpecUI is a web interface for OpenSpec workflows (live mode + static export).

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

## OpenSpec 1.2 Notes

- OpenSpecUI 2.x requires OpenSpec CLI `>=1.2.0`.
- If your CLI is older, UI shows `OpenSpec CLI Required` and blocks core interactions until upgraded.
- Default workflow guidance is now `/opsx:propose` (quick path).
- OpenSpec profile/workflow sync can be inspected from **Settings → OpenSpec 1.2 Profile & Sync**.

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

## Key Features

- Dashboard for specs/changes/tasks status
- Config/Schema viewers and editors
- OPSX compose panel for change actions
- Multi-tab PTY terminal (xterm + ghostty-web)
- Search in live mode and static mode
- Static snapshot export for docs hosting
