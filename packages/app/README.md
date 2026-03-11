# @openspecui/app

Hosted frontend workspace for `app.openspecui.com` style deployments.

## What It Builds

The `app` workspace emits a persistent hosted shell, not a one-shot redirect page.

Build output includes:

- root shell: `index.html`
- root service worker: `service-worker.js`
- channel manifest: `version.json`
- versioned OpenSpecUI bundles: `versions/<channel>/`

The root shell restores tabs, accepts one launch request from the URL, probes each backend, and then mounts the compatible OpenSpecUI bundle inside an iframe tab.

## Hosted Launch Contract

The hosted shell accepts an initial backend via query parameters:

- `api=<backend-origin>`

Example:

```text
https://app.openspecui.com/?api=http%3A%2F%2Flocalhost%3A3100
```

The shell resolves the backend's `openspecuiVersion` from the health endpoint, selects a compatible hosted channel from `version.json`, and then mounts a versioned entry like:

```text
/versions/v2.0/index.html?api=http%3A%2F%2Flocalhost%3A3100&session=<session-id>
```

Tabs remain in the root shell and can be reopened on later visits.

## Local Development

```bash
pnpm --filter @openspecui/app dev
pnpm openspecui --app
```

Use `pnpm openspecui --app` from the repo root when you want the local backend plus the local hosted shell together.

## Build

```bash
pnpm --filter @openspecui/app build
```

## Deploy

### Cloudflare Pages

1. Build the workspace.
2. Deploy `packages/app/dist`.
3. Attach the custom domain `app.openspecui.com`.
4. Keep `public/_headers` in the published output so cache behavior stays correct.

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

  location = /version.json {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    try_files $uri =404;
  }

  location = /service-worker.js {
    add_header Cache-Control "public, max-age=0, must-revalidate";
    try_files $uri =404;
  }

  location ^~ /versions/ {
    try_files $uri $uri/ @openspecui_version_shell;
  }

  location @openspecui_version_shell {
    rewrite ^/versions/([^/]+)(/.*)?$ /versions/$1/index.html break;
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

  @mutable path / /index.html /version.json /service-worker.js
  header @mutable Cache-Control "public, max-age=0, must-revalidate"

  @versionRoutes path_regexp versionShell ^/versions/([^/]+)(?:/.*)?$
  handle @versionRoutes {
    try_files {path} /versions/{re.versionShell.1}/index.html
    file_server
  }

  try_files {path} /index.html
  file_server
}
```

## Cache Expectations

Mutable entrypoints should revalidate:

- `/`
- `/index.html`
- `/service-worker.js`
- `/version.json`
- `/versions/<channel>/index.html`

Immutable hashed assets can be long-lived:

- `/assets/*`
- `/versions/<channel>/assets/*`

The included `public/_headers` file is tuned for Cloudflare Pages with that split.
