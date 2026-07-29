<!--
Orthogonal intents (updated 2026-07-30 Asia/Shanghai):
1. Document the bundled daemon-owned App shell and CLI command contract.
2. Document Workspaces, runtime-only authority, and local development.
3. Preserve standalone Browser/PWA deployment as an optional manual capability.

Original request (2026-07-29): "App 使用 Workspaces；不再考虑 App 外壳部署位置；README 补充 daemon、serve、--app 和 --web。"
-->

# @openspecui/app

The persistent Workspaces shell bundled with the `openspecui` CLI and served by its user-level App daemon.

## Primary Runtime

The normal product path is local and version-locked:

```text
foreground `openspecui serve`
  -> project backend + reconnecting Workspace lease
  -> user-level App daemon
  -> bundled @openspecui/app assets
  -> native OpenTray window or Browser/PWA host
```

The daemon owns the App endpoint, tray, retained window, and transient Workspace ledger. Each foreground `serve` process remains the sole owner of its project backend.

Use the CLI from a project root:

```bash
# Bare command is an alias for serve; it discovers a running daemon or asks [Y/n] in a TTY.
openspecui
openspecui serve

# Require the local App daemon and attach this project.
openspecui --app
openspecui serve --app

# Open Direct Project Web. A running daemon also receives the Workspace.
openspecui --web
openspecui serve --web

# Manage only the App daemon.
openspecui start
openspecui start --web
openspecui stop
openspecui restart
openspecui restart --web
```

Native mode uses a retained OpenTray window. Daemon `--web` mode uses the Browser/PWA presenter and never loads the native WebView extension. The selected host mode is immutable until `restart`.

The CLI does not select a remote App URL. The local daemon always serves the shell packed with the same CLI release.

## What It Builds

The workspace emits:

- `index.html`
- `service-worker.js`
- `manifest.webmanifest`
- hashed App assets

The shell restores Workspaces, probes backend health, and mounts backend-owned OpenSpecUI pages in persistent iframe tabs. In daemon delivery it receives Workspace snapshots through same-origin typed control endpoints. Runtime credentials stay in memory and are not persisted with tabs.

## Local Development

```bash
pnpm --filter @openspecui/app dev
pnpm --filter @openspecui/app build
pnpm openspecui --app
```

Repository tooling may resolve the local App build while developing the workspace. This is an internal development path, not a user-facing shell-location option.

## Optional Standalone Browser/PWA Deployment

The same static output can be deployed manually as a standalone browser or PWA shell. This remains useful for a fixed web deployment, but it is not the destination of CLI App mode.

A standalone deployment may accept an initial backend through:

```text
https://app.openspecui.com/?api=http%3A%2F%2Flocalhost%3A3100
```

The backend must expose `/api/health` with a compatible `hostedShellProtocolVersion`, `embeddedUiUrl`, and runtime capabilities. The App loads the backend-owned page and appends tab-local `api` and `session` parameters.

### Cloudflare Pages

```bash
pnpm --filter @openspecui/app cf:project:create
pnpm --filter @openspecui/app cf:deploy
```

The output directory is `packages/app/dist`. Deployment authentication uses `wrangler login` or `CLOUDFLARE_API_TOKEN` with `CLOUDFLARE_ACCOUNT_ID`.

### Docker

```dockerfile
FROM caddy:2-alpine
COPY ./packages/app/dist /srv
CMD ["caddy", "file-server", "--root", "/srv", "--listen", ":80"]
```

### nginx

```nginx
server {
  listen 80;
  root /srv/openspecui-app;

  location = /service-worker.js {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    try_files $uri =404;
  }

  location = /manifest.webmanifest {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    try_files $uri =404;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

### Caddy

```caddy
app.example.com {
  root * /srv/openspecui-app

  @mutable path / /index.html /manifest.webmanifest /service-worker.js
  header @mutable Cache-Control "public, max-age=0, must-revalidate"

  try_files {path} /index.html
  file_server
}
```

Mutable shell entrypoints should revalidate. Hashed `/assets/*` files may use long-lived immutable caching. The included `public/_headers` file applies this split for Cloudflare Pages.

If a newer service worker waits while a Workspace is open, the shell exposes an update action instead of interrupting the active document. With no open Workspace, it may promote the update immediately.
