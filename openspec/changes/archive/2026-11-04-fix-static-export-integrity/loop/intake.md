<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Record the four independent static-export defects reported in issue #319 with
   locally reproduced evidence.
2. Separate "restore an already-specified behavior" from "new behavior" so the change
   does not over-claim.
3. Name the deferred item (deterministic export) explicitly.

Original request (2026-11-04): "同时，处理一下#319" — handle GitHub issue #319.
-->

# Issue #319 static-export intake

## User input

> 同时，处理一下#319

Issue #319 (`Indy79`, `openspecui` 15.1.0, Windows 11 + Node 26.12.1) reports three
independent defects in `export`, plus a fourth found while writing them up, plus one
feature suggestion:

```text
$ npx openspecui@latest export -o ./docs --base-path /pages/my-org/my-repo/
```

## Reproduction status (this worktree, macOS, real SSG CLI)

| #   | Claim                                                        | Reproduced here?      | Evidence                                                                                                                                                                                                              |
| --- | ------------------------------------------------------------ | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `$'` / `` $` `` / `$&` in snapshot content corrupts the page | **yes**               | Snapshot with `projectName: "proj-a$'b"` → `__INITIAL_DATA__` contains a literal `\n  </body>\n</html>\n` inside the JSON string; the inline script stops being valid JS                                              |
| 2   | `--base-path` does not reach assets                          | **yes**               | With `--base-path /docs/`: `src="/assets/index.ssg-….js"` and `href="/logo.svg"` stay root-absolute, while `href="/docs/openspec_pixel_light.svg"` is prefixed — the inconsistency the report describes               |
| 3   | SSG fails on Windows (`import()` on an absolute path)        | **no (Windows-only)** | Source confirms `cli.ts:107` passes `resolveSsgServerEntryPath()` output straight to `import()`; POSIX accepts a bare absolute path, Windows rejects the `c:` protocol                                                |
| 4   | Client-side navigation doubles the base path                 | **no (browser-only)** | Source confirms `view-transitions/navigation.tsx` `toRelativeHref()` keeps the router-rendered `href` pathname, which already carries `basepath`, and hands it to `router.navigate()`, which applies `basepath` again |
| 5   | Deterministic export (stable timestamps)                     | n/a                   | Feature suggestion — **deferred**, out of this change's scope                                                                                                                                                         |

## Scope

**Restores stated behavior** (the specs already promise it, so no new law is needed for
2 and 4):

- `web-rendering` → "Base Path Configuration" → "Respect base path for assets" already
  requires every asset URL to carry `/docs/`. #2 is a violation, not a gap.
- `cli-commands` → "Export with custom base path for deployment" already requires all
  asset and navigation paths relative to `/docs/`. Same.
- `web-rendering` → "Respect base path for routing" already forbids double prefixing. #4
  is a violation.

**New law** (one requirement): the generated document's insertion step must preserve
injected content byte-for-byte, and the SSG loader must be URL-correct on every platform.
That is what #1 and #3 need, and nothing states it today.

## Owner-default decisions (vetoable in review)

1. **#2 is fixed by rewriting the emitted references, not by rebuilding the client with a
   relative base.** `base: './'` was the reporter's first suggestion, but prerendered
   pages live at nested paths (`/docs/specs/index.html`), where `./assets/…` resolves to
   `/docs/specs/assets/…`. Rewriting is the only shape that works for both the root and
   nested documents.
2. **The rewrite is bounded to reference positions.** Template `src`/`href`/`url()`
   attributes, the rendered markup's `src`/`href` attributes, and Vite-emitted `.js`/`.css`
   asset literals. Snapshot JSON inside the inline bootstrap script is never rewritten —
   otherwise a spec body that mentions `/assets/` would be mutated.
3. **#3 uses `pathToFileURL`, which is correct on every platform** — not a win32 branch.
4. **#5 (deterministic export) is deferred** with an explicit note in the issue reply; it
   needs a product decision about which timestamp is authoritative, not a bug fix.
5. **No changeset beyond a patch** for `openspecui` / `@openspecui/web`.
