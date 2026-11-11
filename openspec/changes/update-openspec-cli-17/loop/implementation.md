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

### 2026-11-11 — S5 adversarial review, folded

One independent review round ran against the committed tree, the real binaries and the real upstream
diff. Everything it found was fixed in the change:

- **Blocker**: the integration delta's own text said the admitted window (`>=1.17.0`) was blocked; it now
  says `>=1.18.0`, matching the intent block and the release gate. `--strict` could not catch it because
  the contradiction is semantic, not structural.
- **The behavior claim was too narrow.** The review measured three more plan/filesystem-visible effects
  of the update rework: the reconcile also runs on `init`, legacy command roots count as configured
  tools (visible in `update --dry-run --json`), and earlier-release leftovers are swept without
  `--force`. Fixtures were added for the first two (init path and legacy detection, including the 1.16.1
  side); the sweep is recorded as an explicit non-obligation because a deterministic fixture needs a
  captured historical artifact, which upstream's `upgrade-from-releases` e2e owns.
- **A consumer was invented**: `openspec-cli-115` had no reader after the v15 boundary suite retired, so
  the alias is removed rather than carried on a false justification. The three historical comments that
  named it now say the alias retired here.
- Stale current-line prose was fixed in thirteen renamed suites (intent 1 said 1.14), `tool-init-state`
  (said stable 1.15.x), and the README headers; the report now publishes measured numbers
  (`tool-detection.ts` +31/−3, lockfile +10/−10) and lists archive as a required delivery step.

Not actioned (recorded): two long-standing suites still do not call `expectPinnedVersion`; both predate
this rotation and prove identity through their own fixture setup, so the gap is carried forward rather
than repaired inside a pin rotation.
