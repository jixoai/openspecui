# OpenSpec UI

[English](./README.md) | [中文](./README-zh.md)

A visual web interface for spec-driven development with OpenSpec.

### Features

- **Dashboard** - Overview of specs, changes, and task progress
- **Spec Management** - View and edit specification documents
- **Change Proposals** - Track change proposals with tasks and deltas
- **Task Tracking** - Click to toggle task completion status
- **Realtime Updates** - WebSocket-based live updates when files change
- **Web Terminal** - Built-in PTY terminal with desktop/mobile support
- **OPSX Compose** - Generate/edit prompts from change actions and send to active terminal
- **Search Panel** - Reactive search in live mode and in static-export mode
- **CLI Execute Path** - Detect/fallback runners and configurable `execute-path`
- **Static Site Export** - Export the current state as static website to be used in CI
- **AI Integration** - Review, translate, and suggest improvements (API & ACP)

### Quick Start

```bash
# Recommended: run without global install (always use latest)
npx openspecui@latest
bunx openspecui@latest

# Run in your project directory
openspecui

# Or specify a directory
openspecui ./my-project

# Optional: install globally
npm install -g openspecui

# Run via Nix Flake
nix run github:jixoai/openspecui -- --help
```

The UI will open at `http://localhost:3100`.

### Nix Usage

```bash
# Run OpenSpecUI directly
nix run github:jixoai/openspecui -- --help

# Install into your profile
nix profile install github:jixoai/openspecui

# Enter development shell
nix develop
```

### How To Use

#### 1) Web Terminal (desktop + mobile)

- Open the `Terminal` tab from navigation.
- Terminal sessions are long-lived and only close when you explicitly close the tab/session.
- If a process exits, you can close the finished terminal via close action (including key-close behavior in terminal UI).
- On mobile, an input panel/FAB is available; on desktop, the same panel can be opened when needed.

#### 2) OPSX Compose from Change Actions

- Open a change page (`/changes/:changeId`).
- Click one of: `Continue`, `Fast-forward`, `Apply`, `Verify`, `Archive`.
- A compose dialog opens in PopArea (`/opsx-compose`) with a generated draft prompt.
- Edit in `CodeEditor`, then:
  - `Send`: select a live terminal target and write prompt to that PTY.
  - `Copy`: copy prompt to clipboard.
  - `Save`: save prompt into terminal input history.

#### 3) Reactive Search (Live + Static)

- Desktop: click `Search` below the logo in sidebar.
- Mobile: click the search icon in top header.
- Search opens in PopArea (`/search?query=...`), supports keyword highlighting, and subscribes to data updates in live mode.
- In static export mode, search still works with a frontend worker-based index.

#### 4) OpenSpec CLI Execute Path

- If OpenSpec CLI is unavailable/incompatible, `OpenSpec CLI Required` modal lets you set `Execute Path` directly and re-check immediately.
- You can also view/update execute-path in `Settings`.
- Useful for custom command entries (including command + args with spaces).

### CLI Options

```
Usage: openspecui [command] [options]

Commands:
  openspecui [project-dir]     Start the development server (default)
  openspecui start [project-dir]  Start the development server
  openspecui export            Export as a static website

Start Options:
  -p, --port <port>       Port to run the server on (default: 3100)
  -d, --dir <path>        Project directory containing openspec/
  --no-open               Don't automatically open the browser
  -h, --help              Show help message
  -v, --version           Show version number

Export Options:
  -o, --output <path>     Output directory (required)
  -d, --dir <path>        Project directory containing openspec/
  --base-path <path>      Base path for deployment (default: /)
  --clean                 Clean output directory before export
  --open                  Open exported site in browser after export
```

### Static Export

Export your OpenSpec project as a static website for deployment to GitHub Pages, Netlify, or any static hosting service.

```bash
# Export to a directory (output directory is required)
openspecui export -o ./dist

# Export with long form
openspecui export --output ./my-docs

# Export for subdirectory deployment (automatically normalized)
openspecui export -o ./dist --base-path /docs
# Note: /docs, /docs/, and docs all normalize to /docs/

# Clean output directory before export
openspecui export -o ./dist --clean

# Export from a different project directory
openspecui export -o ./dist --dir ../my-project

# Combine options
openspecui export -o ./dist --base-path /specs --clean
```

The exported site includes:

- Complete data snapshot (data.json)
- All HTML, CSS, JS assets
- Fallback routing for SPA navigation
- Routes manifest for all pages

**Note:** Static exports have limited functionality compared to the live server:

- No real-time file watching
- No task checkbox toggling
- No AI integration features
- No PTY terminal runtime features
- Read-only view of the snapshot at export time

#### Test the Static Export Locally

```bash
# Export the site
openspecui export -o ./test-output --clean

# Serve it locally with any static server
cd test-output
python3 -m http.server 8080
# Or: npx http-server -p 8080

# Open in browser
# http://localhost:8080
```

Look for the static snapshot indicator in the bottom status bar (merged footer status) to confirm static mode is active.

#### Deploy to GitHub Pages

```yaml
# .github/workflows/deploy-specs.yml
name: Deploy Specs

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install -g openspecui
      - run: openspecui export -o ./dist
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

Nix-based CI export example:

```yaml
- uses: DeterminateSystems/nix-installer-action@v21
- uses: DeterminateSystems/magic-nix-cache-action@v13
- run: nix run github:jixoai/openspecui -- export -o ./dist --base-path /my-repo/
```

#### Deploy to Subdirectory (e.g., /docs/)

If you're deploying to a subdirectory, use the `--base-path` option:

```bash
# Export with base path
openspecui export -o ./dist --base-path /docs

# The base path is automatically normalized:
# /docs   -> /docs/
# /docs/  -> /docs/
# docs    -> /docs/
```

**GitHub Pages example:**

```yaml
- run: openspecui export -o ./dist --base-path /my-repo
```

**Important:** When using a custom base path:

- All assets and navigation will be prefixed with the base path
- The exported site must be served from that path (e.g., `https://example.com/docs/`)
- Direct URL access will work correctly (e.g., `https://example.com/docs/specs/my-spec`)

### Project Structure

OpenSpec UI expects the following directory structure:

```
your-project/
└── openspec/
    ├── project.md          # Project overview
    ├── AGENTS.md           # AI agent instructions
    ├── specs/              # Specification documents
    │   └── {spec-id}/
    │       └── spec.md
    └── changes/            # Change proposals
        ├── {change-id}/
        │   ├── proposal.md
        │   └── tasks.md
        └── archive/        # Archived changes
```

### Development

```bash
# Clone the repository
git clone https://github.com/jixoai-labs/openspecui.git
cd openspecui

# Install dependencies
pnpm install

# Build all packages
pnpm build:packages

# Start Bun + OpenTUI dev dashboard
pnpm dev

# Legacy multi-process dev script
pnpm dev:legacy

# Optional: use Nix development shell
nix develop
```

### Packages

| Package                   | Description                                  |
| ------------------------- | -------------------------------------------- |
| `openspecui`              | CLI tool and bundled web UI                  |
| `@openspecui/core`        | File adapter, parser, validator, and watcher |
| `@openspecui/search`      | Shared search providers and indexing         |
| `@openspecui/server`      | tRPC HTTP/WebSocket server                   |
| `@openspecui/ai-provider` | AI provider abstraction (API & ACP)          |
| `@openspecui/web`         | React web application                        |
| `xterm-input-panel`       | Terminal input panel addon (mobile/desktop)  |

### Tech Stack

- **Frontend**: React 19, TanStack Router, TanStack Query, Tailwind CSS v4
- **Backend**: Hono, tRPC v11, WebSocket
- **Build**: pnpm workspaces, Vite, tsdown
- **Type Safety**: TypeScript, Zod

### Community

- [Contributing Guide](./CONTRIBUTING.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)
- [Security Policy](./SECURITY.md)
- [Support](./SUPPORT.md)

### License

[MIT](./LICENSE)
