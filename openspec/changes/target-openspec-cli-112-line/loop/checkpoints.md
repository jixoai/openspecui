<!--
Orthogonal intents (created 2026-09-03 Asia/Shanghai):
1. Provide the resumable execution checkpoint for implementation agents.
2. Bind each checkpoint to its focused gate before broader CI.

Original request (2026-09-03): "Openspec 1.12.0 刚刚放出来，你更新一下，调查变更内容，然后开始规划适配工作，我们将用标准工作流worktree来推进"
-->

# OpenSpecUI 12 checkpoints

## CP0 — planning baseline (DONE 2026-09-03)

- Worktree `../openspecui-cli112` on branch `target-openspec-cli-112-line`.
- `references/openspec` at v1.12.0 (`e062b9572be933564ba3899d059377dfa1393e32`); pin guards re-anchored in the
  branch's first commit (`scripts/prepare-openspec-reference.mjs`, `upstream-contract-regression.test.ts`,
  `w2-project-binding-playwright.ts`, `root-context-cold-start.integration.test.ts`); pinned build verified
  (`prepare-openspec-reference.mjs` ran green under the new EXPECTED_COMMIT).
- `references/openspec-1.12.0-report.md` with executed 1.12.0 observations (pinned build + npm-published
  parity).
- Change artifacts: `.openspec.yaml`, `loop/{intake,research-plan,implementation,checkpoints}.md`,
  `specs/{openspec-cli-integration,opsx-workflow-ui,opsx-config-center,projection-contract-truth}/spec.md`.

## CP1 — change review closed (DONE 2026-09-03)

Codex change review via herdr (`v12-change-reviewer`, gpt-5.6-terra xhigh): Round-A 6/10 with five blockers →
all adopted (commit 0e5fff17); Round-B 8/10 with zero blockers → all eight suggestions adopted. The
single-series `>=1.12.0 <1.13.0` window stands as the Owner-default decision. Implementation batches may
start.

## CP2 — core contracts land (PENDING)

Focused gates (run from repo root):

```bash
pnpm --filter @openspecui/core test -- src/openspec-compat.test.ts
pnpm --filter @openspecui/core test -- src/cli-contracts
pnpm --filter @openspecui/core test -- src/agent-delivery-registry.test.ts src/tool-init-state.test.ts
```

## CP3 — pinned fixtures prove the line (PENDING)

Fixture helper `packages/core/src/__tests__/official-cli-v12-fixtures.ts` mirrors the v11 helper; owner tests
follow the existing `official-cli-v11-*.test.ts` layout as `official-cli-v12-*.test.ts` and re-point their
version loops. Commands run after the devDep alias lands:

```bash
pnpm install            # resolves the openspec-cli-112 alias (openspec-cli-111 retained for boundaries)
cd packages/core
npx vitest run src/official-cli-v12-validation-findings-fixtures.test.ts \
  src/official-cli-v12-validation-fixtures.test.ts \
  src/official-cli-v12-agent-delivery-fixtures.test.ts \
  src/opsx-kernel-schemas-root.fixtures.test.ts src/upstream-contract-regression.test.ts
```

The exact suite set may grow with slices 2/3; every newly accepted 1.12 contract must be executable here, and
the pinned 1.11.0 boundary rejections (`--report findings` rejected) must be asserted in the same matrix.
Until those files exist, this checkpoint is not executable — that is expected at planning time and must not
be marked DONE on the strength of the v11 matrix alone.

## CP4 — transport + projections land (PENDING)

```bash
pnpm --filter @openspecui/core test -- src/opsx-kernel
pnpm --filter @openspecui/server test
pnpm --filter @openspecui/web test -- <focused component tests>
```

## CP5 — broad gates before PR (PENDING)

```bash
pnpm format:check && pnpm lint:ci && pnpm typecheck && pnpm test:ci && pnpm test:browser:ci
```

Subset runs must be justified in PR notes when package-local.

## CP6 — release prep (PENDING)

- `.changeset/*.md` major bump for the fixed group.
- `README.md` + `README-zh.md` (current line only; versioned historical README archives stay untouched) +
  `packages/cli/README.md` under the release README law.
- Changeset covers the fixed group `["openspecui", "@openspecui/*"]` (ignoring `@openspecui/ai-provider`);
  `changeset status` plus a dry run prove `11.1.0 -> 12.0.0` for every publishable package.
- AGENTS.md v12 architecture-decision entry; correct the two stale v1.7.0 submodule-pin statements.
- No publish; Owner decides release.

## Stop rules

- A failed focused owner test stops the slice; no broader gate runs until it is green.
- Any finding that touches shared files goes to the integrator, not the subagent.
- Browser evidence is preparation only; the Owner walkthrough is the acceptance boundary.
