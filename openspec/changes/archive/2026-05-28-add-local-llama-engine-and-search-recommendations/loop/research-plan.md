## Research Findings

- `packages/core/src/runtime-package-manager.ts` already detects host package managers from `DENO_VERSION`, `npm_config_user_agent`, `npm_execpath`, ancestor `package.json#packageManager`, lockfiles, and fallback, and it already builds install commands for `npm`, `pnpm`, `yarn`, `bun`, `vp`, and `deno`.
- `packages/server/src/runtime-package-host.ts` resolves the runtime host package root as either `openspecui` or `@openspecui/server`, and uses `npm list --json --omit=dev --depth=1` to inspect the host dependency tree.
- `packages/server/src/translation-engine-service.ts` currently branches on `browser`, `local`, `local-ct2`, and `openai`; the managed local engines are still hard-coded as a pair, and the runtime factory loader imports `@openspecui/local-translator` and `@openspecui/local-ct2-translator` directly.
- `packages/web/src/routes/settings-translation-panel.tsx` still models the managed local UI as `local` plus `local-ct2`; the search panel is wired to open remote catalog loading only after interaction, and there is no default recommendation path for empty search input.
- `packages/web/src/lib/use-search.ts` returns an empty result set immediately when the query is blank, so the current search hook has no built-in recommendation fallback.
- `packages/server/src/search-service.ts` already supports reactive rebuilds and query/reactive-query separation, so recommendation behavior can be added without changing the indexing model itself.
- The active OpenSpec change is `add-local-llama-engine-and-search-recommendations`, and the change is currently blocked only because `loop/research-plan.md` was missing.

## Decision & Plan (For Approval)

- Keep this as a small release line: add `local-llama` as a managed translation engine, make `node-llama-cpp` install through the existing runtime package manager abstraction, and fix HuggingFace search so empty input can surface default recommendations.
- Treat engine installation truth and search recommendation truth as platform capabilities, not UI special cases: each engine owns its own detection/install adapter, while the shared settings panel only consumes the lifecycle and logs.
- Use `openspecui` as the runtime host root for dependency detection and `npm list --json` truth, not `@openspecui/server`, because the bundled package is the install surface that matters to users.
- Keep package-manager selection host-driven; do not hard-code `npm` except as a fallback when host detection cannot resolve anything else.
- Scope the release to the new engine, the search recommendation fallback, and the small bug fixes needed to keep the managed-local UI and lifecycle flow coherent.

## Capability Impact

### New or Expanded Behavior

- `local-llama` becomes a first-class managed local translation engine.
- `node-llama-cpp` is installed on demand through the host package manager strategy.
- Empty HuggingFace search input yields a default recommendation list instead of an empty state.

### Modified Behavior

- Managed local engine detection, install gating, and runtime readiness need to be generalized beyond the existing `local` / `local-ct2` pair.
- The settings panel should show install gating and logs before the normal model card flow when an engine is missing.

## Risks and Mitigations

- Risk: expanding the managed-local engine list can create more hard-coded branching in the service and panel. Mitigation: centralize engine manifests and install/lifecycle helpers so new engines only provide their own adapter data.
- Risk: package-manager assumptions can break install flows in non-npm hosts. Mitigation: keep host detection and command generation on the existing runtime-package-manager abstraction and use `deno` / `vp` support only through that layer.
- Risk: empty-query recommendations can drift away from the search index contract. Mitigation: keep the recommendation path inside the same search service/provider pipeline and cover it with tests.
- Risk: the release can look done while the UI still hides missing-engine states. Mitigation: verify the install gate, install log, and post-install transition in browser tests before finalizing.

## Verification Strategy

- Update or add unit tests for runtime package manager selection and install command generation.
- Add service-level tests for managed engine lifecycle detection, installation gating, and local-llama readiness.
- Add search tests for empty-query recommendation fallback and the existing non-empty query path.
- Run the repo CI-equivalent checks before release prep: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci`.
- Rebuild static UI artifacts if the settings/search surfaces change: `pnpm --filter @openspecui/web build:ssg`.
