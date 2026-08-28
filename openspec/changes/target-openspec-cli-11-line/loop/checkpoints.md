<!--
Orthogonal intents (created 2026-08-28 Asia/Shanghai):
1. Provide the resumable execution checkpoint for implementation agents.
2. Bind each checkpoint to its focused gate before broader CI.

Original request (2026-08-28): "子代理持续返回，你负责初步的 review 和整合，持续分发推进，直到所有任务完成"
-->

# OpenSpecUI 11 checkpoints

## CP0 — planning baseline (DONE)

- `references/openspec` at v1.11.0 (`a0ddb60d040c61f4907436a9d91310934b1dda63`).
- `references/openspec-1.11.0-report.md` with executed 1.10.0/1.11.0 observations.
- Change artifacts: `.openspec.yaml`, `loop/{intake,research-plan,implementation,checkpoints}.md`,
  `specs/{openspec-cli-integration,opsx-workflow-ui,opsx-config-center,projection-contract-truth}/spec.md`.

## CP1 — change review closed (PENDING)

Codex change review via herdr; findings folded back into this Change before Batch A starts. Owner-default
decisions confirmed or vetoed here.

## CP2 — core contracts land (PENDING)

Focused gates (run from repo root):

```bash
pnpm --filter @openspecui/core test -- src/openspec-compat.test.ts
pnpm --filter @openspecui/core test -- src/cli-contracts
pnpm --filter @openspecui/core test -- src/agent-delivery-registry.test.ts src/tool-init-state.test.ts
```

## CP3 — pinned fixtures prove the line (DONE 2026-08-28)

Fixture helper `packages/core/src/__tests__/official-cli-v11-fixtures.ts` mirrors the v9 helper; owner tests
follow the existing `packages/core/src/official-cli-19-*.test.ts` layout as `official-cli-v11-*.test.ts` and
re-point their version loops. Commands run after the devDep aliases land:

```bash
pnpm install            # resolves openspec-cli-110/-111 aliases
cd packages/core
npx vitest run src/official-cli-v11-workflow-fixtures.test.ts \
  src/official-cli-v11-batch-status-fixtures.test.ts \
  src/official-cli-v11-show-diff-fixtures.test.ts \
  src/official-cli-v11-validation-fixtures.test.ts \
  src/official-cli-v11-default-store-fixtures.test.ts \
  src/official-cli-v11-nested-spec-fixtures.test.ts \
  src/opsx-kernel-schemas-root.fixtures.test.ts src/upstream-contract-regression.test.ts
```

Until those files exist, this checkpoint is not executable — that is expected at planning time and must not
be marked DONE on the strength of the v9 matrix alone.

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
- `README.md` + `README-zh.md` + `packages/cli/README.md` under the release README law.
- No publish; Owner decides release.

## Stop rules

- A failed focused owner test stops the slice; no broader gate runs until it is green.
- Any finding that touches shared files goes to the integrator, not the subagent.
- Browser evidence is preparation only; the Owner walkthrough is the acceptance boundary.
