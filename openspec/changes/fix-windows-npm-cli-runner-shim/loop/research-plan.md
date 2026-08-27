## Research Findings

1. Failure chain (issue #258, Windows 11 + global npm CLI 1.9.0):
   `ConfigManager.resolveCliRunner` → `expandCliRunnerCandidates` (`config.ts:341`, `resolveShellExecutablePath` uses `where.exe` + PATHEXT preference from the issue #209 hotfix, so the candidate becomes `...\npm\openspec.cmd`) → `probeCliRunner` (`config.ts:418`) → `runBufferedCommand` → `spawnSafe` (`spawn-safe.ts:118`) → `resolveWindowsCommandInvocation` (`command-invocation.ts:160`).
2. `resolveNodeCommandShim` (`command-invocation.ts:106-127`) extracts the JS entry only via `/%~dp0([^"\r\n]*?\.(?:c|m)?js)/gi`. That matches only the legacy npm shim shape. npm ≥7 (cmd-shim v4+; the local npm 11 bundle was read directly) emits `SET dp0=%~dp0` and a final call line referencing `"%dp0%\node_modules\<pkg>\bin\entry.js"`; the `%~dp0` literal never precedes the entry path, so extraction returns null and the resolver throws the "opaque Windows command shim" error. The same shape hits `npx.cmd`/`pnpm.cmd`/`yarn.cmd`, so every fallback candidate also fails, producing "No available OpenSpec CLI runner."
3. `sniffGlobalCli` (`config.ts:558-595`) probes the resolved `.cmd` with `execFileAsync` (`shell` unset). Modern Node refuses to spawn `.bat`/`.cmd` without a shell (EINVAL), so the probe degrades to `hasGlobal:false` — Settings shows "Global CLI not found" while the CLI runs fine from a terminal.
4. `BASE_PACKAGE_MANAGER_RUNNERS` (`config.ts:106-112`) uses unversioned specs. `@latest` is currently 1.11.0, outside the v9 accepted range (`openspec-compat.ts`: `OPENSPEC_CLI_TARGET_SERIES='1.9'`, `OPENSPEC_CLI_ACCEPTED_RANGE='>=1.8.0 <1.10.0'`). With shims fixed, a shim-less machine would resolve a runner the version gate then blocks.
5. `installGlobalCliStream` (`server/src/router.ts:2196`) and the Web display (`web/src/lib/use-cli-runner.tsx:171`, `web/src/routes/settings.tsx` labels) install/present the unversioned spec, so the Settings action itself installs a version the gate rejects.
6. A parallel implementation exists in `scripts/lib/package-manager-shim.mjs:23-35` (same legacy-only regex); it backs `scripts/lib/command-invocation.mjs`, `scripts/windows-installed-cli-smoke.sh.ts`, and `scripts/diagnose-cli-runner.mjs`. Fixing only Core would leave the Windows distribution-gate smoke and the diagnostic unable to parse modern shims.
7. Independent review (Codex, gpt-5.6-terra xhigh, 2026-08-28): root cause 9/10 confirmed (A/B/C all verified against the workspace); plan initially 6/10 with two blockers — (a) the pre-existing extractor already permits `%~dp0..\evil.js` escapes, drive-letter absolute paths, and follows symlinks without containment, so the widened parser must add a validation layer rather than just a broader regex; legitimate `node_modules/.bin/..\..` entries must keep resolving; (b) the `scripts/` mirror must be fixed in the same delivery.

## Decision & Plan (For Approval)

1. `command-invocation.ts`: export a pure `extractNodeCommandShimEntryTokens(source)` that matches both `%~dp0<rel>` and `%dp0%\<rel>` entry references, plus an fs-backed `resolveNodeCommandShimEntry(commandShim, source)` that validates each token (non-empty; no NUL, drive-letter, UNC, or unexpanded `%`), resolves it against the shim directory, requires `realpathSync.native` + `statSync().isFile()`, and contains the real entry within the real shim directory or its parent directory (global-prefix and `.bin/..` layouts respectively). `resolveNodeCommandShim` consumes these; opaque non-shape shims are still rejected.
2. `config.ts`: pin the five fallback runner specs to `@${OPENSPEC_CLI_TARGET_SERIES}` imported from `./openspec-compat.js` (no cycle: that module imports only zod); rewrite the `sniffGlobalCli` local probe on `runBufferedCommand` while keeping its result contract (`hasGlobal`/`version`/`latestVersion`/`hasUpdate`/`error`) unchanged.
3. `server/src/router.ts` `installGlobalCliStream` + `web` display/labels: install and present `@${OPENSPEC_CLI_TARGET_SERIES}`; when the registry `latestVersion` is outside the accepted range (via `classifyOpenSpecCliVersion(...).supported`), Settings presents the target series instead of the out-of-range version as the update target.
4. `scripts/lib/package-manager-shim.mjs`: mirror the hardened extraction (same tokens + same validation semantics).
5. Tests: cross-platform pure-extraction and fs-containment tests (macOS-runnable red first), fallback-spec assertions, `sniffGlobalCli` outcome tests, and Windows-gated integration fixtures for the modern shim in both Core and scripts.

## Capability Impact

### New or Expanded Behavior

- Standard modern npm Windows shims (global prefix and `node_modules/.bin`) now resolve to `node.exe + entry.js` and execute without `cmd.exe`.
- Hardened entry validation closes the pre-existing escape/absolute-path/symlink weaknesses for both shim generations.

### Modified Behavior

- Auto-fallback runners and the Settings global install action now target the supported CLI series instead of `@latest`.
- The Settings update label never names an out-of-range version as the update target.
- `sniffGlobalCli` executes the resolved runner through the same spawn-safe boundary as production CLI execution.

## Risks and Mitigations

- Over-strict containment could reject exotic but legitimate installs: containment allows the shim directory and its parent (both standard layouts); anything else fails closed to the existing explicit opaque rejection, which is diagnosable via the runner diagnostic.
- Pinning fallbacks goes stale when the release line moves: the spec derives from `OPENSPEC_CLI_TARGET_SERIES`, the same constant that drives the compatibility gate, so lines move together.
- Mirrored logic in `scripts/` can drift: both sides gain byte-equivalent fixtures; drift risk is accepted because scripts must stay zero-dependency (documented residual).

## Verification Strategy

- Red evidence: new macOS-runnable extraction test fails against the current parser at the named fixed point (modern-shim fixture → no entry).
- Focused lanes: `pnpm --filter @openspecui/core test -- src/command-invocation.test.ts src/config.test.ts`, `node scripts/...` script tests via `pnpm test:root`, server/web focused tests for the touched files.
- Full local gates before PR: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, `pnpm test:browser:ci` (or the documented scoped subset with justification).
- Windows CI gate covers the win32-gated integration fixtures and the real installed-CLI smoke.
- Codex review of the final diff before merge; Owner browser walkthrough remains the acceptance boundary.
