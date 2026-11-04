<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Record each #319 fix with the reproduction and the gate that proves it.
2. Keep the real-export evidence (repo law: a green build is not export evidence).
3. Record the deferred item.

Original request (2026-11-04): "同时，处理一下#319"
-->

# Issue #319 implementation log

Worktree `openspecui-worktrees/fix-static-export-319`, branch `fix/static-export-319` off
`origin/main` (`e99a05c9`).

## Reproduction (before the fix, macOS, real SSG CLI)

Built `build:ssg` + `build:ssg-cli`, then ran `node packages/web/dist-ssg/ssg-cli.mjs` against
a fabricated snapshot.

- **#1** snapshot `projectName: "proj-a$'b"` → the emitted `__INITIAL_DATA__` contained
  `"projectName":"proj-a\n  </body>\n</html>\nb"`. `$'` expanded to "the rest of the template
  after the match", splitting the JSON string; the inline script stopped being valid JS. A clean
  control snapshot produced the same byte size ±16, which is exactly why the defect is invisible
  in file-size terms when the template tail is short — the corruption is structural, not bulk.
- **#2** `--base-path /docs/` → `src="/assets/index.ssg-….js"` and `href="/logo.svg"` stayed
  root-absolute while `href="/docs/openspec_pixel_light.svg"` was prefixed.
- **#3** source-level: `cli.ts` passed a filesystem path to `import()`. POSIX tolerates it (so
  the macOS run succeeds); Windows rejects the `c:` protocol.
- **#4** source-level: `toRelativeHref()` kept the router-rendered pathname, which already
  carries `basepath`, and `navigate()` re-applied it.

## Fixes

- `ssg/template-insertion.ts` (new): `insertDocumentValues()` is the single insertion owner. It
  passes **replacer functions** for all three replacements and validates that the template still
  carries both placeholders before rendering.
- `ssg/cli.ts`: uses that owner; imports the server entry via `pathToFileURL(...).href`; rewrites
  the template and the rendered markup with the base path before injection; applies the
  base-path module rewrite to the emitted tree after prerender.
- `ssg/base-path-rewrite.ts` (new): `rewriteMarkupReferences()` (attribute positions only),
  `rewriteAssetModule()` (`/assets/` inside Vite-emitted `.js`/`.css`), `applyBasePathToOutputTree()`.
  Base `/` is a strict no-op in all three.
- `lib/base-path-href.ts` (new): the one base-path algebra (`normalizeBasePath`,
  `stripBasePath`, `applyBasePath`, `toBaseRelativeHref`) plus a local `currentBrowserBasePath()`.
  It deliberately imports nothing, so unit tests that partially mock `nav-controller` or
  `static-mode` cannot break it.
- `lib/nav-controller.ts`: consumes the shared algebra instead of its own private copies;
  `normalizeNavigationHref` stays exported.
- `lib/view-transitions/navigation.tsx`: `toRelativeHref`/`toPathname` normalize through
  `toBaseRelativeHref`, so `navigate()` applies the base path exactly once.

### Self-inflicted regression caught by the full suite (kept as the reason for the layout above)

The first attempt imported `normalizeNavigationHref` from `@/lib/nav-controller` into
`navigation.tsx`. Ten-plus route tests mock that module as `{ navController: … }`, so the new
named import resolved to `undefined` and six "real Router" navigation tests failed with
`expected '/specs' to be '/specs/owned/auth'`. A control run of the same file on the untouched
branch passed 4/4, which is what proved the cause was mine rather than pre-existing. `static-mode`
is partially mocked in thirty-two files (only `isStaticMode`), so routing the base path through
`getBasePath()` would have broken the same set. The fix is the dependency-free module above, and
the lesson is recorded here: **navigation code reachable from partially-mocked modules must own
its helpers, not borrow them through a boundary those tests replace.**

## Verification

Unit gates:

- `template-insertion.test.ts` — 21 assertions over the four `$` sequences, both insertion
  sites, single-doctype/single-bootstrap invariants, and the missing-placeholder failure.
- `base-path-rewrite.test.ts` — normalization table, attribute-only rewriting, protocol-relative
  immunity, the bounded property (text-node `/assets/` untouched), and the root no-op.
- `nav-controller.test.ts` + `navigation.test.tsx` — 44 tests including the new
  base-relative href projection (`/docs/specs` → `/specs`).
- Combined run: `2 files / 21 tests` and `2 files / 44 tests`, both exit 0.

Real-export evidence (after rebuilding the SSG artifacts):

- `$'` snapshot → `"projectName":"proj-a$'b"` preserved verbatim, exactly one `<!doctype html>`
  and one bootstrap script.
- `--base-path /docs/` → **31 of 31** `src`/`href` attributes carry `/docs/`, zero unprefixed;
  CSS fonts rewritten to `url(/docs/assets/…)`; no residual `"/assets/` in the emitted JS.
- Bounded check: a snapshot whose text reads `note /assets/foo.js stays` is emitted unchanged,
  so the rewrite cannot mutate spec content.

## Deferred

- The issue's fifth item (deterministic export — `meta.timestamp` / `observedAt` and git commits
  making two exports of unchanged specs differ) is a product decision about which timestamp is
  authoritative, not a defect fix. Recorded for the issue reply.
