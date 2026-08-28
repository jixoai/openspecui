## User Input

- Original request (2026-08-28, GitHub issue #258): "I tried to install OpenSpecUI and then run it from the root project folder... I'm getting the 'No available OpenSpec CLI runner.' error." Environment: Windows 11 24H2, Node 24.14.0, npm 11.9.0, OpenSpecUI 9.0.2, OpenSpec 1.9.0 (in range).
- Original request (2026-08-28, Owner to ZCode): "看一下github上的issues 258，你先分析一下，如果确定问题，然后和codex复核一下。确定方案了就开始写测试复现并修复。"
- Community root-cause trace (2026-08-27, e-martin): a correctly installed in-range global CLI is refused because the npm `.cmd` shim is rejected as opaque; Settings reports "Global CLI not found" while `openspec --version` works from PATH; the npx fallback resolves `@latest` (1.11.0) which the v9 gate blocks.

## Objective Scope

1. `packages/core/src/command-invocation.ts`: resolve standard npm `cmd-shim` v4+ Windows shims (modern `SET dp0=%~dp0` + `"%dp0%\...\bin\*.js"` final-call shape) onto `node.exe + JavaScript entry`, in addition to the legacy `%~dp0<path>.js` shape, with hardened entry validation (reject drive-letter/UNC/NUL/unexpanded-`%` tokens; entry must be an existing real file within the shim directory or its parent directory, which covers both the global-prefix layout and the local `node_modules/.bin/..` layout).
2. Mirror the same hardened extraction in `scripts/lib/package-manager-shim.mjs` (used by the Windows installed-CLI smoke and the zero-dependency runner diagnostic) so repository release owners keep parity with Core.
3. `packages/core/src/config.ts`: pin the five auto-fallback package-manager runner specs to `@${OPENSPEC_CLI_TARGET_SERIES}` (fail closed against out-of-range `@latest`), and route the `sniffGlobalCli` local probe through `runBufferedCommand` so a resolved `.cmd` shim executes instead of failing EINVAL on modern Node.
4. `packages/server/src/router.ts` `installGlobalCliStream` and the matching `packages/web` install display/labels: install the target series instead of an unversioned spec, and never present an out-of-range registry `latestVersion` as the update target.

## Non-Goals

- Surfacing runner-resolution failure directly on the Dashboard (community suggestion 3; separate Web UX change).
- Executing or reinterpreting any non-standard (opaque) `.cmd` shim through `cmd.exe`; the existing explicit rejection stays.
- Changing the CLI compatibility gate or accepted range (`>=1.8.0 <1.10.0`).
- Changing `fetchLatestVersion` (it reports the registry fact "newest on npm").

## Acceptance Boundary

- A cross-platform (macOS-runnable) red-then-green test extracts the JS entry from a byte-accurate modern `cmd-shim` fixture and proves today's parser misses it.
- Hardening tests reject drive-letter, UNC, NUL, unexpanded-`%` tokens and entries escaping the shim directory/parent root, while a legitimate `node_modules/.bin/..`-style entry still resolves.
- `buildCliRunnerCandidates` fallback specs assert `@1.9` (derived from `OPENSPEC_CLI_TARGET_SERIES`, not hardcoded).
- `sniffGlobalCli` fixture test covers spawn-error, non-zero-exit, and success-version outcomes.
- Windows-gated integration tests extend with a modern-shim fixture (runs in the Windows CI gate).
- Local CI-relevant checks pass; the final browser walkthrough boundary remains Owner-owned.
