## Implementation State

Implemented the development conditional export runtime law across the source-mode
Node runtime path.

Completed slices:

1. Added BDD coverage for conditional export maps in `openspecui`, `@openspecui/server`, `@openspecui/core`, and `@openspecui/search`.
2. Added a real Node resolver fixture proving default package resolution selects `dist` and explicit `--conditions=development` selects source `.ts` entries.
3. Added BDD coverage that source-mode worktree child commands inherit `NODE_OPTIONS=--conditions=development`.
4. Added `development` and `default` branches to required package exports while preserving published `import` entries.
5. Updated source dev scripts to set an expandable `NODE_OPTIONS="${NODE_OPTIONS:+$NODE_OPTIONS }--conditions=development"` prefix.
6. Updated worktree startup to use a worker-thread runtime owned by the package root entry. The CLI root entry exports `createWorktreeServerWorker()` and self-bootstraps from its own `import.meta.url`.
7. Removed the dedicated worker entry as a runtime law. The manager consumes a worker factory and no longer knows `index.mjs`, `index.ts`, or any worker file name.
8. Added worker `ready` / `error` messages so the manager no longer waits only on HTTP polling.
9. Replaced full Git overview construction in `git.switchWorktree` with a lightweight worktree target lookup.
10. Moved watcher-pool initialization out of the synchronous server ready path; HTTP/tRPC runtime readiness no longer waits for native watcher startup.
11. Added a dedicated changeset for the affected publishable packages.
12. Added BDD coverage for repeated/nested worktree switching: source bootstrap URL canonicalization, root-owned worker handoff delegation, and server ready before background warmup.
13. Fixed second-switch source worker failures by stripping parent `tsx` loader query/hash state from source self-bootstrap entry URLs.
14. Replaced nested worker-tree ownership with root-owned handoff delegation. Child worktree servers now forward `git.switchWorktree` requests to their parent owner over a typed worker message protocol.
15. Deferred kernel/search/dashboard/watcher warmup until after the HTTP runtime is ready so worker `ready` is not blocked by background data work.

## Decisions Taken

- Keep `tsdown` as the builder. This change only defines runtime resolution law.
- Use Node conditional exports as the platform boundary: source-mode runtimes opt into `development`, published/default runtimes stay on built artifacts.
- Keep `bin.openspecui` on `./dist/cli.mjs`; executable bins are not conditional export entries.
- Propagate the law through `NODE_OPTIONS`, because `tsx` does not automatically activate `development`.
- Treat `@openspecui/search` as part of this law because `@openspecui/server` imports `@openspecui/search` and `@openspecui/search/node` at runtime.
- Do not run nested `pnpm` for source-mode worktree children. The parent `pnpm openspecui` lifecycle environment can leak package-selection state into the child and make it exit cleanly before opening a server.
- Use `worker_threads` as the default worktree runtime.
- Make the root package entry the worker authority. The root entry creates workers with `new Worker(new URL(import.meta.url), ...)` in built mode, so the same bundled module is the parent API and worker entry.
- Keep source mode self-bootstrap inside the root entry. Direct `new Worker(new URL(import.meta.url))` against `src/index.ts` is not enough once conditional exports enter another package source graph that uses relative `.js` specifiers; the source branch starts a tiny eval bootstrap and re-enters the same root entry with `tsx/esm/api`.
- Keep the process fallback as an adapter fallback for callers that do not provide a worker factory; product startup provides the factory.
- Keep Git page overview as the rich data source for display, but make `git.switchWorktree` use a lightweight target lookup that does not calculate ahead/behind/diff stats.
- Treat watcher initialization as background runtime infrastructure. Server readiness for handoff is the health/runtime-capability contract, not native watcher startup completion.
- Treat the initial CLI runtime as the root handoff owner. Worktree servers created inside workers must not recursively own new sibling runtimes; they delegate nested switches back to the parent owner through a typed worker message protocol.
- Treat source worker entry URLs as stable module identities. Runtime-loader query/hash state such as `tsx-namespace` is private to the current loader instance and must not be inherited by the next self-bootstrap worker.
- Treat background warmup as non-readiness work. Kernel, search, dashboard, and watcher warmup may start after the HTTP server is reachable, but they cannot delay worktree handoff readiness.

## Platform Updates

- Package exports are now the shared dev/default runtime contract for Node-facing OpenSpecUI packages.
- Source-mode worktree child startup no longer depends on stale local `dist` for package self-references.
- Source-mode worktree startup is now independent of pnpm lifecycle state and avoids a child process: the manager starts a worker thread through the root entry's worker factory and carries `--conditions=development` only as an execution condition.
- Worker startup is self-describing at the entry boundary. The manager owns lifecycle, readiness, health compatibility, and cache policy; the package root owns how to clone itself into a worker in source and built modes.
- Worktree runtime readiness is message-driven for worker runtimes: the worker sends `ready` after its server starts, while health compatibility remains the contract check.
- Server startup no longer synchronously waits for `initWatcherPool(projectDir)`. Reactive file subscriptions can attach once the watcher pool is ready, but handoff readiness is not held hostage by native watcher initialization.
- `git.switchWorktree` now resolves targets with `git worktree list --porcelain` and canonical path matching instead of constructing full overview stats.
- Runtime compatibility checking from the handoff hardening change remains a separate guard: it rejects old sibling runtimes, while this change makes source-mode sibling runtimes resolve the same source law.

## Divergence Notes

- The original implementation boundary listed `openspecui`, `@openspecui/server`, and `@openspecui/core`. Implementation added `@openspecui/search` after source inspection showed server runtime imports it directly.
- The first dev-script implementation used a single-quoted `NODE_OPTIONS` assignment. BDD caught the shell expansion risk, and the scripts now use a double-quoted expandable assignment.
- A smoke probe using `tsx --eval` with top-level await failed because that eval path transforms as CJS. The final smoke used an async IIFE instead and exercised the real worktree child startup path.
- Real `git.switchWorktree` repro against `pnpm openspecui --dir /Users/kzf/Dev/GitHub/jixoai-labs/agenter` found a deeper startup bug: nested pnpm printed `None of the selected packages has a "dev" script` and exited `0` before readiness.
- The first direct `node + tsx` attempt changed the failure to `ERR_MODULE_NOT_FOUND: Cannot find package '@openspecui/core'` because the child `cwd` was repo root. Moving source-mode child `cwd` to `packages/cli` fixed package resolution.
- A temporary single-file self-bootstrap experiment proved `new Worker(import.meta.url)` as a string is invalid in Node (`ERR_WORKER_PATH`), while `new Worker(new URL(import.meta.url), ...)` works in both `tsx index.ts` and `tsdown` + `node dist/index.mjs`.
- A second temporary dependency-graph experiment proved direct `.ts` worker entry plus conditional-exported package source is not enough when that package source imports relative `.js` specifiers. The stable source-mode law is therefore a tiny root-owned bootstrap that imports the same root entry through `tsx/esm/api`.
- Real timing showed the worker itself could reach ready in about 1.2s, but the first manager implementation still waited too long because the worker `ready` message could arrive before listener registration. The runtime now caches ready/error state.
- Real timing also showed full `buildGitWorktreeOverview` is unnecessary on the switch path. The switch target resolver now avoids ahead/behind/diff collection.
- Source worker entry initially imported a helper via a static relative `.js` specifier. Real tRPC verification showed that the inherited `tsx` worker loader did not rewrite that nested import, so the worker authority moved into the root entry and source mode uses the entry-owned bootstrap.
- Built self-bootstrap smoke reached ready and health using `packages/cli/dist/index.mjs`; source self-bootstrap smoke reached ready and health using `packages/cli/src/index.js` through the root-owned bootstrap.
- Real tRPC timing after entry self-bootstrap: switching from `pnpm openspecui --dir /Users/kzf/Dev/GitHub/jixoai-labs/agenter --no-open --port 3170` to `/Users/kzf/Dev/GitHub/jixoai-labs/agenter/.worktree/refine-cli-shell-chat-tui-v9` took `2458ms`, and child health exposed `notifications.subscribe` plus `config.notifications`.
- Real repeated-switch repro found a second-hop failure after the first successful handoff. Sequence `3180 -> 3104 -> another worktree` returned HTTP 500 with `SyntaxError: Unexpected token '{'` in Node ESM compile. The root cause was inherited `?tsx-namespace=...` state in the source bootstrap entry URL; the next loader namespace did not match it, so Node compiled raw TypeScript.
- Real repeated-switch verification after canonicalization succeeded for `main -> refine-cli-shell-chat-tui-v9 -> chattui-ux-design -> main`, but returning to main initially created a new nested server. Root-owned worker handoff now returns the original root URL when switching back to main.
- Hot repeated-switch verification after root-owned handoff reused already-started sibling runtimes: switching from root to `refine-cli-shell-chat-tui-v9` returned `http://localhost:3104` in `850ms`, then switching to `chattui-ux-design` returned `http://localhost:3105` in `162ms`.
- Cold worker startup still has environment-dependent variance. One real run showed `5.0s` for the first target and `27.8s` for a cold second target, while health after handoff was `12-25ms`. This points to cold runtime/warmup contention, not repeated-switch correctness. Warmup is now deferred from readiness, and sub-second cold start remains a separate optimization radar.

## Verification

- Red evidence:
  - `pnpm --filter openspecui test -- src/dev-conditional-exports.test.ts` failed when `@openspecui/search` lacked `development/default` export branches.
  - `pnpm --filter openspecui test -- src/dev-conditional-exports.test.ts` failed when dev scripts used the non-expandable single-quoted `NODE_OPTIONS` assignment.
  - Real tRPC `git.switchWorktree` failed with `Worktree server exited before becoming ready (exit 0)` when source-mode handoff used nested pnpm.
  - Real tRPC `git.switchWorktree` then failed with `exit 1` and `ERR_MODULE_NOT_FOUND` until source-mode child `cwd` moved to `packages/cli`.
  - Worker smoke initially failed on source-mode `.js` imports until the root-owned bootstrap used `tsx/esm/api` to re-enter the package root.
  - Real tRPC `git.switchWorktree` then failed after the worker loader helper was split into a separate source file, because the source worker could not resolve `./worktree-server-worker-loader.js`. The worker authority is now in the root entry and the manager never points at helper files.
  - A temporary direct `.ts` worker-entry experiment failed on conditional-exported package source with nested `./value.js` import. This established that source mode needs the root-owned bootstrap instead of raw `.ts` worker entry.
  - Real repeated tRPC switch failed on the second hop with HTTP 500 and `SyntaxError: Unexpected token '{'` until source self-bootstrap stripped inherited `tsx` loader query/hash state.
  - `pnpm --filter openspecui test -- src/worktree-instance-manager.test.ts` failed before implementation because `normalizeSourceBootstrapEntryUrl` did not exist.
  - `pnpm --filter openspecui test -- src/worktree-server-worker-handoff.test.ts` failed before implementation because the root-owned handoff protocol module did not exist.
  - `pnpm --filter @openspecui/server test -- src/server-startup.test.ts` failed before implementation because `startServer()` triggered watcher warmup before returning.
- Green evidence:
  - `pnpm --filter openspecui test -- src/dev-conditional-exports.test.ts src/worktree-instance-manager.test.ts`
  - `pnpm --filter openspecui test -- src/worktree-server-worker-handoff.test.ts src/worktree-instance-manager.test.ts src/dev-conditional-exports.test.ts`
  - `pnpm --filter openspecui typecheck`
  - `pnpm --filter @openspecui/server typecheck`
  - `pnpm --filter @openspecui/server test -- src/server-startup.test.ts src/router.test.ts`
  - `pnpm --filter @openspecui/core typecheck`
  - `pnpm --filter @openspecui/search typecheck`
  - `pnpm --filter openspecui exec tsdown` emitted `dist/index.mjs` and the shared executable chunk containing `createWorktreeServerWorker()`.
  - Temporary self-bootstrap experiment: `tsx index.ts` and `tsdown` + `node dist/index.mjs` both started a worker from `new Worker(new URL(import.meta.url), ...)`.
  - Source self-bootstrap smoke from `packages/cli/src/index.js` reached `/api/health` and returned `notifications.subscribe` plus `config.notifications`.
  - Built self-bootstrap smoke from `packages/cli/dist/index.mjs` reached `/api/health` and returned `notifications.subscribe` plus `config.notifications`.
  - Real tRPC verification from `pnpm openspecui --dir /Users/kzf/Dev/GitHub/jixoai-labs/agenter --no-open --port 3131` switched to `/Users/kzf/Dev/GitHub/jixoai-labs/agenter/.worktree/chattui-ux-design`; child health at `http://localhost:3102/api/health` returned `projectDir`, `hostedShellProtocolVersion: 1`, and runtime capabilities `notifications.subscribe` plus `config.notifications`.
  - Real tRPC timing after worker runtime and lightweight target lookup: `pnpm openspecui --dir /Users/kzf/Dev/GitHub/jixoai-labs/agenter --no-open --port 3135` switched to `/Users/kzf/Dev/GitHub/jixoai-labs/agenter/.worktree/refine-cli-shell-chat-tui-v9` in `2924ms`.
  - Final real tRPC timing after root-entry self-bootstrap: cold switch was `2458ms`, and child health exposed `notifications.subscribe` plus `config.notifications`.
  - Final repeated-switch smoke after canonicalized source bootstrap and root-owned handoff: `3180 -> 3104 -> 3105 -> 3180` succeeded without `Unexpected token`, and hot sibling reuse returned `3104` in `850ms` and `3105` in `162ms`.
  - `openspec validate --all --strict --no-interactive`

## Loopback Triggers

- If another Node-facing workspace package is imported at runtime by source-mode CLI/server code, add it to this export law before relying on source handoff.
- If a non-Node runtime must participate in worktree handoff, research its conditional export behavior before assuming `NODE_OPTIONS` applies.
- If `tsx` changes its condition handling or package resolution behavior, rerun the resolver BDD before changing builder strategy.
- If source-mode worktree startup changes again, keep both the temporary self-bootstrap experiment and a real tRPC switch-worktree verification in the loop; manager-level smoke alone does not cover worker entry semantics or pnpm lifecycle inheritance.
- If switching must become sub-second from a cold target, the next law change is prewarmed project runtimes or a persistent control-plane queue. Root-owned handoff fixes repeated-switch topology, but cold worktree runtime startup can still vary with CLI probing, search/dashboard warmup, and TypeScript source loading.
