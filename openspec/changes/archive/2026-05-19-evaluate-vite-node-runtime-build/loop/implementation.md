## Implementation State

- This is a research-only loop.
- No production package code, build scripts, exports, or runtime behavior were changed.
- Evidence was collected from current repository scripts, Vite 8 documentation, installed Vite 8 package metadata, and disposable local experiments.

## Decisions Taken

- Do not immediately replace `tsdown` with Vite 8 for Node-facing packages.
- Treat the actual platform problem as source-vs-dist runtime resolution law, not as a builder swap by itself.
- Prefer a follow-up change that introduces conditional exports plus explicit development conditions while keeping `tsdown` as the current Node package builder.
- Keep Vite 8 SSR multi-entry library mode as a second-stage builder candidate after the conditional export law is proven.
- Keep worktree sibling servers on `child_process`; consider `worker_threads` only for smaller internal tasks without independent HTTP/WebSocket lifecycle.

## Research Evidence

- `tsx` does not automatically select the `development` export condition.
- `NODE_OPTIONS=--conditions=development` makes `tsx` select source `.ts` in a workspace-symlink style package.
- Bun did not select the `development` branch from `NODE_OPTIONS=--conditions=development` in the local experiment.
- Node can resolve the `development` branch but cannot directly execute `.ts` under `node_modules` in the tested case.
- Vite 8 multi-entry library mode emits clean separate ES entries.
- Vite 8 default client library mode is unsafe for Node package semantics unless configured as SSR/Node.
- Vite 8 SSR library mode can preserve Node imports and `import.meta.url` semantics with explicit output configuration.
- Vite ModuleRunner can execute TS modules through a Vite server/module graph, but that is not a simple published CLI bin replacement.

## Divergence Notes

- An existing `upgrade-vite-8` change already documents and implements the frontend Vite 7 to Vite 8 upgrade. This loop is separate because it evaluates Node package build/runtime architecture.
- The current checkout contains unrelated handoff and document-translation edits. This research loop intentionally avoided modifying those code paths.

## Loopback Triggers

- If the user wants immediate implementation, create a separate follow-up change for conditional exports/source resolution instead of expanding this research loop.
- If a future experiment shows Vite SSR library mode can also solve declarations, CLI bin shebangs, externals, and source/dist resolution more simply than `tsdown`, revisit the builder recommendation.
