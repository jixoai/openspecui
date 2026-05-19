## Implementation State

- Approved path: direct migration from Vite 7 to Vite 8.
- Implementation executed on branch `feat/upgrade-vite-8`.
- Scope includes all workspace packages that directly depend on Vite and all impacted shared build/test/release flows.

## Completed Work

- Upgraded direct Vite consumers to `vite@^8.0.0`:
  - `packages/app`
  - `packages/web`
  - `packages/website`
  - `packages/xterm-input-panel`
- Upgraded `@vitejs/plugin-react` to `^6.0.1` where React-based Vite apps require a Vite 8-compatible peer range.
- Upgraded Storybook Vite tooling for browser-tested packages:
  - `@storybook/addon-vitest`
  - `@storybook/web-components`
  - `@storybook/web-components-vite`
  - `storybook`
- Upgraded Vitest browser packages to `^4.1.0` in the Vite 8 browser-test paths.

## Verification Run

- `pnpm install`
- `pnpm format:check`
- `pnpm lint:ci`
- `pnpm typecheck`
- `pnpm --filter @openspecui/app build`
- `pnpm --filter @openspecui/website build`
- `pnpm --filter @openspecui/web build`
- `pnpm test:ci`
- `pnpm test:browser:ci`

## Decisions Taken

- Do not introduce `rolldown-vite` as an intermediate dependency.
- Upgrade `vite` and `@vitejs/plugin-react` together where required.
- Treat `packages/web` SSG/CLI build chain and `pnpm dev`/CLI integration as first-class migration targets.

## Divergence Notes

- `@tailwindcss/vite@4.2.1` still advertises a peer range capped at Vite 7, but all affected builds and tests passed under Vite 8 in this workspace. Treat this as upstream peer metadata lag unless a future regression proves otherwise.
- JSDOM logs stylesheet parse warnings for the existing anchor-position and `::scroll-button` CSS used by tabs in component tests. The tests remain green and this loop did not need an additional compatibility shim.
- Repo-wide removal of `jsdom` remains a separate testing-architecture cleanup. Current warnings come from pre-existing DOM unit tests in `packages/app`, `packages/web`, and `packages/website`, not from the Vite 8 upgrade itself.

## Loopback Triggers

- A hard incompatibility in Storybook/Vitest tooling that cannot be resolved without a separate major tool upgrade.
- A Vite 8 regression in `packages/web` SSG/CLI flows that requires splitting the work into a separate preparatory loop.
- A release/deploy regression that cannot be isolated to a small compatibility fix.
