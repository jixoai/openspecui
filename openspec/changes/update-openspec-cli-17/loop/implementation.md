<!--
Orthogonal intents (created 2026-11-11 Asia/Shanghai):
1. Keep implementation reality synchronized with the plan.
2. Record corrections with their evidence, not just the final numbers.

Original request (2026-11-11): "检查 OpenSpec CLI 上游是否有新版本，并按仓库标准工作流跟进上线。"
-->

## Implementation Log

### 2026-11-11 — S1 window, S2 fixtures, S3 boundary proof

- Window/registry/generator constants rotated in `e52b21b8`; pin, alias and both `EXPECTED_COMMIT`
  guards in `0402e869`; truth surfaces (four spec deltas, READMEs, AGENTS, major changeset) in
  `2ce16001`. `openspec validate update-openspec-cli-17 --strict` is green and every living scenario
  is carried forward (the integration requirement adds a v16-retirement scenario; the inventory
  requirement is renamed via a legal RENAMED+MODIFIED pair because MODIFIED matches by title).
- The 18 v16 suites were renamed to v17 and run against `openspec-cli-117` (`1.17.0`); the v15 boundary
  suite retired with its line; two suites carry this line's proof: `official-cli-v16-boundary-fixtures`
  (1.16.1 identity, `unsupported` under the v17 gate, and the 1.17-only reconcile absent) and
  `official-cli-v17-update-reconcile-fixtures` (edited command kept and listed; deprecation notice
  while delivery includes commands). Typecheck lane configs follow the renames.
- The two v16-era behavior suites used 1.15.0 as a negative control; they now assert the same verdicts
  are **present** on the retained 1.16.1 boundary (carry-forward), because the historical "new in 1.16"
  proof retired with the v16 window.

### 2026-11-11 — S4 dependent surfaces

Admitted-session samples across core/server/web and the diagnose runner rotate to `1.17.0`; captured
1.14/1.15 CLI payloads stay at their capture versions (executable evidence, not admission facts);
`scripts/check-openspec-reference.mjs` moves its series guard to `v1.17.*`.

### 2026-11-11 — Gate notes (kept because they cost time)

- The local `format:check` without `FORMAT_CHECK_BASE_SHA` only inspects the working tree, so it reports
  green as soon as everything is committed. The honest local equivalent of CI is
  `FORMAT_CHECK_BASE_SHA=$(git merge-base origin/main HEAD) pnpm format:check`; it found
  `pnpm-lock.yaml`, which Prettier reflows (fixed in a formatting-only commit).
- `pnpm install` restored a `better-sqlite3` build compiled for NODE_MODULE_VERSION 137 (Node 24) into a
  Node 22 worktree, failing the two translation-cache tests. Local environment artifact, not a code
  regression: replaced with the ABI-127 build from the primary checkout; CI installs fresh.
- The pinned reference CLI had to be built in this fresh worktree
  (`node scripts/prepare-openspec-reference.mjs`) before the two reference-dependent server tests could
  run; both are green after the build.
