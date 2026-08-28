## Implementation State

- [x] Core hardened shim extraction + validation (`packages/core/src/command-invocation.ts`)
- [x] Core fallback runner pinning + `sniffGlobalCli` probe rewrite (`packages/core/src/config.ts`)
- [x] Server install spec pinning (`packages/server/src/router.ts`)
- [x] Web install display/label honesty (`packages/web/src/lib/use-cli-runner.tsx`, `packages/web/src/routes/settings.tsx`)
- [x] Scripts mirror fix (`scripts/lib/package-manager-shim.mjs`)
- [x] Tests: cross-platform red-then-green extraction/containment, fallback specs, sniff outcomes, Windows-gated modern fixtures (Core + scripts)

Red evidence (captured before the fix): the 10 new cross-platform Core tests failed at the
extraction boundary, and the legacy-only regex was directly shown to match the legacy shim
source (1 match) while matching the modern cmd-shim final call (0 matches). Mutation-resistance:
disabling only the containment rejection fails exactly the escape and symlink tests.

## Decisions Taken

- Entry containment root = the real shim directory, plus its real parent only when the shim
  directory is named `.bin`; this covers the npm global-prefix layout and the local
  `node_modules/.bin` layout exactly, and was tightened from the initially planned unconditional
  parent after the symlink fixture proved a bare parent root over-admits.
- The extraction regex accepts both `%~dp0<rel>` (legacy cmd-shim) and `%dp0%\<rel>` (cmd-shim
  v4+); token validation additionally rejects NUL, drive letters, UNC prefixes, and unexpanded
  `%` references before any filesystem call, and backslashes normalize to `/` so containment
  stays host-testable.
- Fallback and install specs derive from `OPENSPEC_CLI_TARGET_SERIES` (no literal `1.9` outside
  `openspec-compat.ts`); server/web import the browser-safe subpath because the Core barrel
  does not re-export the constant.
- `sniffGlobalCli` keeps its public result contract; only the local probe transport changed
  (`runBufferedCommand`), and PATH-resolution failures ("Unable to resolve ... from PATH.")
  classify as not-found like ENOENT.
- Settings update-target label uses `classifyOpenSpecCliVersion(latestVersion).supported` to
  decide between the literal latest version and the `1.9.x` series label.

## Divergence Notes

- None. Both Codex blockers (hardened validation, scripts mirror) are folded into the plan above before implementation.

## Loopback Triggers

- If Windows CI reveals a standard shim layout outside the two containment roots, loop back to research-plan with the fixture evidence instead of widening containment ad hoc.
