<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Record the delivered implementation surface and its evidence trail for the website v9 renewal.

Original request (2026-08-19): "只提供现有最新版本的信息" through the merged PR series below.
-->

# Implementation Record

All work merged to `main` through the PR series; every PR passed typecheck, unit tests (final count 23/23),
static build, root `format:check` and `lint:ci` locally plus all required CI gates before merge.

| PR | Merge | Scope |
| --- | --- | --- |
| #245 | `f477779f` | Broadside Log single-page narrative: schema/locales rebuild, hero with terminal typing card, eight-entry feature index with scroll-spy, three surfaces, run-it band, footer ghost, reveal action + js bootstrap |
| #246 | `2924da39` | Retired the `app.openspecui.com` link from header nav, footer, schema, and locales with a regression guard |
| #247 | `f385dc46` | THREE SURFACES click-to-copy commands with shared copy labels |
| #248 | `1e6d36e5` | RUN IT click-to-copy (dynamic values), shared `copyTextToClipboard` util, pinned light toggle borders fixing the undefined `border-terminal-border` token fallback |
| #249 | `17d800f1` | Narrow-viewport overflow fix: `$` prompt column, space-based wrapping, and the componentization correction (`command-copy-button`, `section-title`, `press-button`) |
| #250 | `3a7eef48` | COPY/COPIED icon chips with accessible-name state |
| #251 | `a4c2444c` | Display typography (leading 1.2, mono-appropriate tracking) and header icon switchers |

Browser walkthrough evidence: real-Chromium interactive pass (22/22 checks on the initial surface) plus
per-round visual verification screenshots under `.agents/images/2026-08-19-website-live-walkthrough/`.

Owner acceptance: the Owner reviewed the running site across rounds and directed each refinement; the
2026-08-19 bulk-archive directive is the archive disposition. The Herdr Codex independent-review loop stayed
blocked in the authoring session (`HERDR_ENV` unset) and is recorded as blocked in `checkpoints.md`, not as passed.

Deployment boundary: `www.openspecui.com` deployment (`pnpm deploy:website:cf`) intentionally deferred to Owner
acceptance; no deployment was performed by this Change.
