<!--
Orthogonal intents (created 2026-10-29 Asia/Shanghai):
1. Actionable, verifiable checklist mapped to the five implementation phases.
2. Every item names its verification command or artifact.
-->

## CP0 — Pin barrier (serial)

- [x] `scripts/prepare-openspec-reference.mjs` `EXPECTED_COMMIT` rotates to
      `8e0288df12d401b0e183e2f47254d22528c1dffb` — verified by
      `node scripts/prepare-openspec-reference.mjs` in this worktree.
- [x] `packages/core/src/upstream-contract-regression.test.ts` commit
      assertion rotates (same commit).
- [x] `packages/server/src/root-context-cold-start.integration.test.ts` and
      `packages/web/scripts/w2-project-binding-playwright.ts` pin constants
      rotate.
- [x] `scripts/check-openspec-reference.mjs` repaired to the v1.15 assertion
      (or retired with its `ci-fast-gate.mjs` wiring updated) — verified by
      running the fast gate.

## CP1 — Core contracts

- [x] `packages/core/src/openspec-compat.ts`: window `>=1.15.0 <1.16.0`,
      series `1.15`, tag pattern `v1.15.*`, `updateDryRun` capability; header
      intent updated — verified by `pnpm --filter @openspecui/core exec vitest
run src/openspec-compat.test.ts`.
- [x] Typed `UpdatePlan` contract (three-key schema, action/notes enums,
      failure envelope with `status[]`/`update_error`) + executor method with
      exit-discipline tests — verified in
      `packages/core/src/cli-contracts/workflow.test.ts` additions against the
      pinned 1.15 fixture.
- [x] `CliVersionSchema.install.scope` gains `'standalone'` — fixture-proven.
- [x] Mirrored constants rotate: `packages/core/src/config.ts` fallback spec,
      `scripts/setup-example.ts` local copy.

## CP2 — Agent registry

- [x] `agent-delivery-registry.ts`: `AgentCliSeries = '1.15'`, provenance
      union absorbs `'1.14'`, order map + series parser rotate; tool entries
      unchanged — verified by registry unit tests.
- [x] `tool-init-state.ts` staleness baseline → `1.15.0` — verified by
      tool-init-state tests.

## CP3 — Fixtures

- [x] `packages/core/package.json`: add `openspec-cli-115`
      (`@fission-ai/openspec@1.15.0`); rotate `openspec-cli-114` to `1.14.3`;
      keep `openspec-cli-113`/`-112` per alias-retention precedent;
      `pnpm install` regenerates the lockfile.
- [x] New `__tests__/official-cli-v15-fixtures.ts` helper (versions
      `['1.15.0']`, bin map to the 115 alias, provenance + JSON-discipline
      guards).
- [x] 13 positive-matrix test files migrate to the v15 helper with 1.15
      member assertions; `official-cli-v13-boundary-fixtures.test.ts` retires;
      new `official-cli-v14-boundary-fixtures.test.ts` proves 1.14.3 rejection +
      1.15-only member absence (never v14-era member absence).
- [x] Upstream source anchors in `upstream-contract-regression.test.ts`
      re-derived against the v1.15.0 tree (byte-diff first; 1.11-era anchors
      re-verified).

## CP4 — Server / Web / CLI + preview

- [x] `agentIntegrationsRouter`: dry-run plan preview step ahead of the real
      update, typed evidence through the mutation ledger; capability-absent ⇒
      unavailable reason.
- [x] `config-agents.tsx`: Update flow renders the plan (wrapped paths,
      delete+add move pairing, notes by code, inline per-tool failures);
      real-update path unchanged.
- [x] Constants-driven surfaces verified current (cli-health-gate, settings
      diagnostics, validation-findings evidence, change-diff evidence, export).

## CP5 — Docs, changeset, delivery

- [x] Root `README.md` + `README-zh.md` + `packages/cli/README.md` version
      tables rotate; previous README archived per legacy-docs precedent.
- [x] `AGENTS.md`: v15 architecture decision after the 2026-10-06 entry; pin
      bullet; clean-build law reference.
- [x] `.changeset/*.md` major bump for publishable packages.
- [x] Local CI-equivalent subset green: `pnpm format:check`, `pnpm lint:ci`,
      `pnpm typecheck`, core full suite + scoped `test:ci` lanes.
- [x] Old-window grep gate clean (`1.14.0 <1.15.0`, `v1.14.*`, `87c3595`
      outside archive/legacy paths).
- [x] Adversarial subagent review completed and findings resolved; PR opened
      with the evidence summary.
