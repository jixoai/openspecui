## Research Findings

- Current OpenSpecUI already uses `vite@8.0.0` for web-facing packages: `packages/app`, `packages/web`, `packages/website`, and `packages/xterm-input-panel`.
- Current Node-facing package builds are still `tsdown` based:
  - `packages/core` uses `tsdown ... --format esm --dts` for build and watch.
  - `packages/server` uses `tsdown src/index.ts --format esm --no-dts`.
  - `packages/cli` uses `tsdown` for CLI/library output after building/copying Web assets.
- `tsc` is not the runtime builder for these packages. It is used for typecheck only (`tsc --noEmit` or `tsc -p ... --noEmit`).
- Vite 8 is installed in this workspace through package-local dependencies, not as a root direct dependency. Local evidence from `packages/web/node_modules/vite/package.json` confirms version `8.0.0`.
- Vite 8 exposes `vite/module-runner` and server-side APIs including `createServerModuleRunner`, `createRunnableDevEnvironment`, and environment-specific resolve conditions.
- Official Vite docs show multi-entry library mode through `build.lib.entry` object and package `exports` mapping for secondary entry points.
- Official Vite docs and local types show `build.rollupOptions` remains accepted but deprecated/aliased in favor of `build.rolldownOptions` in Vite 8.
- Vite 8 default package resolve conditions are environment-specific. Local type/source inspection shows server-like environments use server conditions, and Vite APIs allow `resolve.conditions`.
- Local conditional exports experiment:
  - Node default resolves package `exports.default` / `dist`.
  - `tsx` default also resolves `dist`.
  - `tsx` with `NODE_OPTIONS=--conditions=development` resolves `development` / source `.ts` in a workspace-symlink style package.
  - `bun` default resolves `dist`; `NODE_OPTIONS=--conditions=development` did not switch Bun to the `development` branch in the local experiment.
  - Plain Node with `--conditions=development` resolves to `.ts`, but then fails for `.ts` under `node_modules` with Node's current type-stripping restriction.
- The user assumption "tsx dev automatically triggers development" is not true in the local experiment. Development condition must be explicit in the repo's dev runner.
- Local Vite 8 multi-entry library experiment with `build.lib.entry` produced clean separate ES outputs (`dist/index.mjs`, `dist/worker.mjs`) and preserved relative imports between entries.
- Local Vite 8 default client library build can apply browser asset semantics to Node code; `new URL('./index.ts', import.meta.url)` was transformed to a data URL. Node libraries must use SSR/Node build semantics, not default client library semantics.
- Local Vite 8 SSR library build preserved Node semantics for `node:fs`, `better-sqlite3`, and `new URL(..., import.meta.url)` when configured with `build.ssr: true` and explicit `rolldownOptions.output.entryFileNames`.
- Vite itself does not generate declaration files for libraries. Replacing `tsdown` fully would require `vite-plugin-dts`, `tsc` declaration emit, or keeping `tsdown`/another declaration pipeline.
- Local ModuleRunner experiment succeeded for importing a TypeScript module through a Vite dev server and `createServerModuleRunner`, but it required a running Vite server/module graph. This looks useful for framework-like development runtimes, not as a simple published CLI bin replacement.
- Worktree sibling servers are long-lived HTTP/WebSocket runtimes with process isolation, port ownership, logs, and shutdown semantics. `child_process` still fits this topology better than `worker_threads`.
- `worker_threads` may still be suitable for smaller local tasks that need lower startup cost and richer structured communication, but not as the first-line replacement for sibling OpenSpecUI server processes.

## Decision & Plan (For Approval)

Recommended exploration conclusion: do not replace `tsdown` with Vite 8 as the immediate next implementation step.

Adopt a smaller platform-law follow-up first:

1. Define conditional exports for development/source and default/dist resolution in Node-facing packages.
2. Add an explicit dev runner condition, for example `NODE_OPTIONS=--conditions=development`, to scripts that are expected to run workspace source.
3. Add BDD tests that prove workspace self-reference resolves to source in dev mode and to dist in default/published mode.
4. Keep `tsdown` as the Node package builder while this source-vs-dist law is introduced, because it already emits ESM and declarations for `core` with fewer moving parts.
5. Evaluate Vite 8 Node SSR library mode as a second-stage migration candidate only after the conditional export law is proven.

Candidate follow-up implementation phases:

- Phase A: Conditional export discipline.
  - Update package exports with `development` branches for self-reference and subpath entries.
  - Wrap dev scripts so `tsx` receives explicit development conditions.
  - Add resolver tests for `openspecui`, `@openspecui/server`, and `@openspecui/core` source/dist selection.
- Phase B: Builder spike, no production migration.
  - Create a temporary Vite 8 SSR multi-entry config for one low-risk Node package.
  - Compare output shape, externals, sourcemaps, declarations, shebang/bin handling, and package exports.
- Phase C: Decide builder direction.
  - Keep `tsdown` if Vite requires a separate declaration pipeline and offers no runtime-law advantage.
  - Move selected Node package builds to Vite SSR library mode only if it simplifies the build/runtime law without adding package-specific hacks.
  - Consider direct Rolldown only if Vite's web/app defaults keep leaking into Node package semantics.

## Capability Impact

### New or Expanded Behavior

- This loop produces a researched architecture decision for Node package build/runtime resolution.
- It defines the likely next platform law: explicit conditional exports for development source resolution and default published dist resolution.
- It clarifies that Vite 8 is already part of the repo, but not currently the Node package builder.

### Modified Behavior

- No production code behavior is modified in this research loop.
- No package scripts, exports, or build configs are changed in this loop.

## Risks and Mitigations

- Risk: Conditional exports with `.ts` source are not uniformly executable across Node, tsx, Bun, and Deno.
  - Mitigation: constrain the first implementation to the supported dev runner (`tsx` with explicit `NODE_OPTIONS=--conditions=development`) and keep published default exports on built JS.
- Risk: Vite 8 library mode defaults are browser-oriented and can rewrite Node semantics.
  - Mitigation: any Vite-based Node build must use SSR/Node semantics and regression tests for `node:` imports, `import.meta.url`, native externals, and CLI bin startup.
- Risk: Replacing `tsdown` removes the current declaration output path.
  - Mitigation: treat declaration generation as a first-class acceptance item; do not migrate without a `vite-plugin-dts`/`tsc`/other declaration strategy.
- Risk: ModuleRunner may look like a runtime silver bullet but add a Vite server dependency to CLI execution.
  - Mitigation: keep ModuleRunner scoped to dev/framework-style experiments unless it proves simpler than `tsx` for this repo's CLI/server runtime.
- Risk: Worker migration could collapse process isolation and server lifecycle boundaries.
  - Mitigation: keep worktree sibling servers on `child_process`; evaluate `worker_threads` only for smaller internal tasks with no independent HTTP/WebSocket server lifecycle.
- Risk: Existing dirty worktree contains handoff and translation changes.
  - Mitigation: keep this change research-only and avoid editing package code until the active changes are isolated or landed.

## Verification Strategy

- No production verification is required because this loop does not implement runtime changes.
- Research evidence already collected:
  - `package.json` script inspection for `core`, `server`, `cli`, and root build scripts.
  - Vite 8 package inspection from `packages/web/node_modules/vite`.
  - Context7/Vite docs lookup for Environment API, ModuleRunner, library mode, and resolve conditions.
  - Local conditional exports experiments for Node, `tsx`, Bun, and workspace symlink behavior.
  - Local Vite 8 multi-entry library build experiment.
  - Local Vite 8 SSR library build experiment for Node semantics.
  - Local Vite 8 ModuleRunner import experiment.
- Follow-up implementation verification, if approved:
  - BDD resolver tests for source/dist conditional exports.
  - CLI startup test with `NODE_OPTIONS=--conditions=development`.
  - Published/default mode test that does not require `.ts` source execution.
  - Worktree handoff process test confirming child runtime uses source in dev and dist in packaged mode.
  - Builder output tests if Vite SSR library mode is adopted.
