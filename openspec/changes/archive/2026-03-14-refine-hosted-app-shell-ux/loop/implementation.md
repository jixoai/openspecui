## Implementation State

- Hosted app shell now supports double-click to open the existing Add Backend API dialog from both the tabs bar empty area and the empty-state header strip.
- Refresh is now scoped to the active tab and performs a real iframe reload attempt before probing only that tab's backend metadata.
- Each hosted tab now tracks its own frame loading state so initial load and manual refresh both surface a loading overlay until `load` resolves.
- App-shell theme storage is isolated behind `openspecui-app:theme`; iframe theme changes no longer reuse the shared web `theme` key.
- Launch relay leadership now prefers already-open PWA windows over normal browser tabs and can report `forwarded-to-pwa` so the browser source page can best-effort `window.close()`.
- Service-worker versioned navigation now validates returned HTML against the expected versioned base-path marker before caching or accepting it as a channel shell.
- Deployed Pages verification exposed an additional root cause: the hosted app service worker bundle is emitted as an ES module, so registration must use `{ type: 'module' }`. Without that, the worker fails evaluation and versioned iframe refreshes fall back to the root shell. The bootstrap registration path and tests were updated accordingly.

## Decisions Taken

- Reuse the existing Add Backend API dialog instead of inventing a second tab-creation surface.
- Keep refresh scoped to the active tab only.
- Preserve best-effort semantics for browser-page auto-close after a PWA window accepts the launch.
- Validate versioned shell responses by HTML marker, not only by `response.url`, because some servers can serve the wrong shell body while preserving the requested URL.

## Divergence Notes

- Browser automation could not exercise a fully online hosted session because the local backend health endpoint currently does not emit `Access-Control-Allow-Origin`, so cross-origin browser fetches from the hosted app fail with `TypeError: Failed to fetch`. This is pre-existing environment behavior, not introduced by this loop.
- Browser automation confirmed that `versions/latest` and `versions/v2.1` preserve versioned URLs after reload. `versions/v2.0` still rewrites back to root because the historical `2.0.2` published bundle itself lacks the later base-path fix; that behavior is outside this loop's local source changes.
- A deployed `pages.dev` run showed `ServiceWorker script evaluation failed` before the module-registration fix. That failure mode is now addressed in-source and covered by the bootstrap test, but it could not have been detected by logic-only unit tests alone because it depended on the production worker output format.

## Loopback Triggers

- If hosted backend CORS is widened for browser app usage, rerun browser automation with a real online session to verify iframe loading overlay visibility during successful frame load.
- If old archived channels such as `v2.0` must also preserve versioned canonical URLs, that needs a separate loop aimed at patching or re-materializing historical published bundles.
