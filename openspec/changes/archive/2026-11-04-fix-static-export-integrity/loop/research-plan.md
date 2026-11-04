<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. One slice per defect, each with a named red that fails for the intended reason.
2. Keep the base-path rewrite bounded to reference positions.
3. Give every slice an executable focused gate.

Original request (2026-11-04): "同时，处理一下#319"
-->

# Issue #319 research plan

## Findings

- `prerender()` in `packages/web/src/ssg/cli.ts:118-121` passes `appHtml`, `headTags` and
  the title as **string** replacement arguments. `String.prototype.replace` then interprets
  `$'`, `` $` ``, `$&` and `$$` inside them. `headTags` carries the whole snapshot, so a
  spec/design/code block containing such a sequence injects the template tail into the JSON
  string. Reproduced: `"projectName":"proj-a\n  </body>\n</html>\nb"` — invalid JS, and the
  page boots with the template defaults (wrong base path, live API calls on a static host).
- `packages/web/src/ssg/cli.ts:107` hands an absolute filesystem path to `import()`. POSIX
  tolerates it; Windows throws `Only URLs with a scheme in: file, data, and node are
supported by the default ESM loader … Received protocol 'c:'`.
- `packages/web/src/ssg/cli.ts:185` `cpSync`s the prebuilt client, which Vite emitted with
  `base: '/'`. `--base-path` only reaches `createStaticHeadTags` and the router.
- `packages/web/src/lib/view-transitions/navigation.tsx` `toRelativeHref()`/`toPathname()`
  read `event.currentTarget.href`, which the router already rendered with `basepath`, then
  `router.navigate()` applies `basepath` a second time → `/docs/docs/specs`.

## Slices

### Slice 1 — Injected-content integrity (`$` replacement patterns)

- `cli.ts`: pass replacer **functions** for all three replacements.
- Red (named fixed point): a `prerender`-level test that renders a snapshot containing
  `a$'b`, ``a$`b``, `a$&b`, `a$$b` and asserts the emitted document contains the value
  verbatim and parses as one document with exactly one `__INITIAL_DATA__`.
- Gate: `pnpm --filter @openspecui/web exec vitest run src/ssg/static-export-integrity.test.ts`.

### Slice 2 — Windows-safe module load

- `cli.ts`: `await import(pathToFileURL(serverPath).href)`; `resolveSsgServerEntryPath`
  keeps returning a filesystem path (call sites own the URL conversion).
- Red: a test that asserts the loader call receives a `file:` URL for an absolute POSIX path
  (platform-independent proof of the conversion), plus the existing SSG smoke still renders.
- Gate: the Slice 1 file plus `src/ssg/server-entry.test.ts`.

### Slice 3 — Base path applied to emitted references

- New `packages/web/src/ssg/base-path-rewrite.ts`:
  - `rewriteMarkupReferences(html, basePath)` — only `src="/…"` / `href="/…"` attributes.
  - `rewriteAssetModule(basePath)` — `/assets/` → `${base}assets/` inside Vite-emitted
    `.js`/`.css` text (font `url()` and chunk `new URL()` forms).
  - `applyBasePath(options)` — walks the output dir; skips the inline bootstrap JSON by
    construction (it is inside `appHtml`/`headTags`, which are injected **after** the
    template rewrite and are never fed through the asset-module rewriter).
- `cli.ts`: rewrite the template before injection; rewrite `appHtml` attribute positions;
  after prerender, rewrite `.js`/`.css` under the output dir when `basePath !== '/'`.
- Red: a fixture with `--base-path /docs/` asserting every `src`/`href` in the generated
  document starts with `/docs/`, a font `url()` in CSS is prefixed, and a snapshot body
  containing the literal `/assets/` string is **unchanged**.
- Gate: Slice 1 file + `src/ssg/base-path-rewrite.test.ts`.

### Slice 4 — Client navigation keeps one base path

- `navigation.tsx`: strip the router base path from the resolved href before navigating
  (reuse the existing `stripBasePath` from `nav-controller.ts`), so `navigate()` applies it
  once.
- Red: a unit test on the href→navigation-target projection with base path `/docs/`
  asserting `/docs/specs` (not `/docs/docs/specs`).
- Gate: the view-transitions navigation tests.

### Slice 5 — Docs + changeset

- `cli-commands` spec delta (new "Static Export Output Integrity" requirement).
- `.changeset/*.md` patch for `openspecui` + `@openspecui/web`.
- Issue reply draft recording the four fixes and the deferred determinism item.

## Focused gates (exec form)

```bash
pnpm --filter @openspecui/web exec vitest run src/ssg
pnpm --filter @openspecui/web exec vitest run src/lib/view-transitions
pnpm --filter @openspecui/web build:ssg
```

Real-path evidence at the end (repo law — a green build is not export evidence): build the
SSG CLI, run it with a `$'`-bearing snapshot and with `--base-path /docs/`, and assert on
the emitted files.
