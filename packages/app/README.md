# @openspecui/app

PWA shell workspace for `app.openspecui.com`.

## What It Builds

The `app` workspace emits a persistent multi-tab shell, not a version-hosting site.

Build output includes:

- root shell: `index.html`
- root service worker: `service-worker.js`
- PWA manifest: `manifest.webmanifest`

The shell restores tabs, accepts one launch request from the URL, probes each backend, and then mounts the backend-owned OpenSpecUI page inside an iframe tab.

## Hosted Launch Contract

The shell accepts an initial backend via query parameters:

- `api=<backend-origin>`

Example:

```text
https://app.openspecui.com/?api=http%3A%2F%2Flocalhost%3A3100
```

Each backend must expose `/api/health` with:

- `hostedShellProtocolVersion: 1`
- `embeddedUiUrl: string`

The shell uses `embeddedUiUrl` directly and appends:

- `api=<backend-origin>`
- `session=<session-id>`

Example embedded URL:

```text
http://localhost:3100/dashboard?api=http%3A%2F%2Flocalhost%3A3100&session=<session-id>
```

Tabs remain in the root shell and can be reopened on later visits.

When this deployment is installed as a PWA, browsers that support navigation capture may route the launch URL into that installed app window instead of a regular browser tab. That reuse only applies when the installed PWA comes from the same deployment scope as the URL being opened.

## Local Development

```bash
pnpm --filter @openspecui/app dev
pnpm openspecui --app
pnpm --filter @openspecui/app cf:dev
```

Use `pnpm openspecui --app` from the repo root when you want the local backend plus the local app shell together.

## Build

```bash
pnpm --filter @openspecui/app build
```

## Deploy with Wrangler

One-time setup:

```bash
pnpm --filter @openspecui/app cf:project:create
```

Production deploy:

```bash
pnpm --filter @openspecui/app cf:deploy
```

Required auth:

- `wrangler login`, or
- `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`

Source of truth:

- deploy config: `packages/app/wrangler.jsonc`
- cache headers: `packages/app/public/_headers`
- worker passthrough: `packages/app/public/_worker.js`

Custom domains remain a Cloudflare-side concern. Attach `app.openspecui.com` to the Pages project after the first successful deploy.

## Deploy

### Cloudflare Pages

This workspace is ready for direct upload with Wrangler. The output directory is `packages/app/dist`.

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
  server_name app.openspecui.com;
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
app.openspecui.com {
  root * /srv/openspecui-app

  @mutable path / /index.html /manifest.webmanifest /service-worker.js
  header @mutable Cache-Control "public, max-age=0, must-revalidate"

  try_files {path} /index.html
  file_server
}
```

## Cache Expectations

Mutable entrypoints should revalidate:

- `/`
- `/index.html`
- `/manifest.webmanifest`
- `/service-worker.js`

Immutable hashed assets can be long-lived:

- `/assets/*`

The service worker cache namespace is derived from the app workspace contents. Rebuilding the same source tree keeps the same cache revision; changing the shell source or public assets produces a new revision and lets the new worker evict the old shell cache on activation.

If a newer shell arrives while at least one backend tab is open, the shell exposes the update action and waits for the user to apply it. If no backend tabs are open, the waiting worker is promoted immediately so the shell can upgrade without interrupting an active session.

The included `public/_headers` file is tuned for Cloudflare Pages with that split.
