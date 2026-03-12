## Implementation State

- Loop initialized from clean `main`, then the requirement expanded from browser-only routing to whole-PR-quality affected-package routing.
- Replaced the draft inline scope shell logic with versioned scripts:
  - `scripts/lib/ci-scope.mjs`
  - `scripts/ci-scope.mjs`
  - `scripts/ci-fast-gate.mjs`
- Added unit coverage for the scope model in `scripts/lib/ci-scope.test.ts`.
- Updated `.github/workflows/pr-quality.yml` to consume the scope outputs for both `Fast Gate` and `Browser Gate`.
- Local verification completed:
  - `pnpm exec vitest run scripts/lib/ci-scope.test.ts`
  - `pnpm --filter openspecui exec node -e "const fs=require('node:fs'); const yaml=require('yaml'); yaml.parse(fs.readFileSync('../../.github/workflows/pr-quality.yml','utf8')); console.log('pr-quality.yml parsed');"`
  - `pnpm format:check`
  - `pnpm lint:ci`
  - `pnpm typecheck`
  - `pnpm test:ci`
  - `pnpm test:browser:ci`

## Decisions Taken

- Move scope detection into a script so package graph logic is testable and reusable.
- Model known implicit edges explicitly instead of pretending workspace manifests are complete.
- Preserve `Fast Gate` and `Browser Gate` as stable aggregate check names while routing their internal work by affected scope.
- Treat shared root/config/workflow changes as broad coverage, while package-local changes use reverse-dependency closure.

## Divergence Notes

- Requirement expanded after the initial local draft, so the workflow file was reworked before any PR was opened.
- Existing non-failing jsdom CSS parse warnings still appear in `packages/web` tests around `::scroll-button` / anchor-position CSS, but they remain unrelated to this workflow-only loop.

## Loopback Triggers

- If CI reveals a missing implicit dependency edge or a protected-check regression, loop back and tighten the scope model before merge.
