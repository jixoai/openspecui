<!--
Orthogonal intents (updated 2026-10-25 Asia/Shanghai):
1. Convert the verified 1.15.0 line delta into five ordered slices after the Round-A dual-channel fold.

Original request (2026-10-25): "开工"
-->

# OpenSpecUI 15 research plan (Round-A folded)

Evidence: `references/openspec-1.15.0-report.md` (pin `v1.15.0` @ `8e0288df`; 13 commits, src 28 files
+1617/-344; list/show/validate/status/instructions/parsers/command-generation/config cores byte-identical;
agent-contract.md and upstream openspec/ spec deltas empty).

Baseline: branch point `3f1c7ca7` (origin/main); planning baseline `df541f25` → Round-A folds
`ef...`/this commit. Review order per the focused-review law: each slice's green gate IS its focused
review and must pass before broad gates; Codex Round-C is the implementation review before PR.

### Slice 1 — Compat constants + scope contract + mirrors (serial; core + scripts)

Full compat constant table (Round-A P1-1: all ten, including the two test-asserted misses and the three
dead exports, rotated for truth):

| Constant | Target |
| --- | --- |
| `OPENSPECUI_TARGET_MAJOR` | `15` |
| `OPENSPEC_CLI_TARGET_SERIES` | `'1.15'` |
| `OPENSPEC_CLI_SUPPORTED_SERIES` | `['1.15']` |
| `OPENSPEC_CLI_MIN_VERSION` | `'1.15.0'` |
| `OPENSPEC_CLI_TARGET_MIN_VERSION` | `'1.15.0'` |
| `OPENSPEC_CLI_RECOMMENDED_MIN_VERSION` | `'1.15.0'` |
| `OPENSPEC_CLI_NEXT_SERIES_MIN_VERSION` | `'1.16.0'` |
| `OPENSPEC_CLI_ACCEPTED_RANGE` | `'>=1.15.0 <1.16.0'` |
| `OPENSPEC_CLI_RECOMMENDED_RANGE` | `'>=1.15.0 <1.16.0'` |
| `OPENSPEC_CLI_REFERENCE_TAG_PATTERN` | `'v1.15.*'` |

- `cli-contracts/workflow.ts`: `install.scope` enum gains `'standalone'`.
- **Unit regression (Codex Round-A P1-3)**: `CliVersionSchema` decodes a payload with
  `install.scope: 'standalone'` — red on the old enum, green after; plus the four historical values
  keep decoding (spec scenario).
- `openspec-compat.test.ts`: literals rotate; classification cases accept 1.15.0 / reject 1.14.3 /
  reject stable `1.16.0` explicitly / reject `1.16.0-alpha` / accept `openspec 1.15.0`.
- **Mirror scripts (research P1-4)**: `scripts/diagnose-cli-runner.mjs:45` +
  `scripts/diagnose-cli-runner.test.mjs:55,70,97` (literals + boundary assertions: 1.14 reject /
  1.15 accept) and `scripts/setup-example.ts:243` — both carry "Keep in sync" comments.
- Red: compat tests + mirror test fail against old constants (record). Green: slice tests + core
  typecheck.

### Slice 2 — Agent registry + generator staleness rotation (serial; core)

(Round-A research P0-1 — the entire line was missing from the first draft.)

- `agent-delivery-registry.ts`: `AgentCliSeries = '1.15'`; `AgentProvenanceCliSeries` gains `'1.15'`
  with `'1.14'` as history; `agentCliSeriesOrder` adds 14→15 ordering; `parseOpenSpecCliSeries`
  returns `'1.15'` for minor 15; series selection comment: **no new tools upstream** (AI_TOOLS
  byte-identical) — pure series rotation, every physical fact carried forward.
- `tool-init-state.ts`: `PINNED_AGENT_GENERATOR_VERSION = '1.15.0'`; `replacementLabel` → 1.15.
- Tests that are green-today-by-asserting-the-gap and MUST be rewritten (the "helpful green" trap):
  `agent-delivery-registry.test.ts:934` (`selectAgentDeliveryRegistry('1.15.0')` → `[]` becomes
  non-empty; `1.14.0` classification cases move to history), `tool-init-state.test.ts` generator
  stamps, `agent-delivery-projection-service.test.ts` (1.14.0 → [] AND 1.15.0 → non-empty),
  `agent-integrations-router.test.ts:268`.
- Green: the four test files + core typecheck.

### Slice 3 — Fixture rotation + boundary rewrite (serial; core)

- `packages/core/package.json`: add `openspec-cli-115 = npm:@fission-ai/openspec@1.15.0`;
  `openspec-cli-114` stays `@1.14.3`; remove `openspec-cli-113`; install once (lockfile via install).
- New helper `__tests__/official-cli-v15-fixtures.ts` (`PINNED_OPENSPEC_V15_VERSIONS = ['1.15.0']`,
  bins → `openspec-cli-115`). **`official-cli-v14-fixtures.ts` is KEPT** (`['1.14.3']`, bins →
  `openspec-cli-114`) for the boundary suite (research P1-2).
- `git mv` the 13 `official-cli-v14-*.test.ts` → `official-cli-v15-*.test.ts` (imports to the v15
  helper; per-file headers gain a 2026-10-25 line note only — historical intent structure untouched).
- **14th helper consumer (research P1-2)**: `opsx-kernel-schemas-root.fixtures.test.ts` moves to the
  v15 helper with local bins key `'1.15.0'`.
- Boundary rewrite: `official-cli-v13-boundary-fixtures.test.ts` →
  `official-cli-v14-boundary-fixtures.test.ts` — 1.14.3 identity, v15-gate unsupported
  classification, 1.15-only surfaces absent (`update --dry-run` unknown option, `install` unknown
  command — both verified on the real binary), v14-era member assertions retained as positive 1.14
  facts; consumes the KEPT v14 helper.
- CP1 observation order: alias+helper first, run the renamed matrix before touching assertion
  literals; expected-red classes (Round-A fold): identity/literal/role + **admitted-session samples**
  + **capability-gated evidence** + mirror-consistency. Contract reds stop the slice.
- Green: renamed matrix + boundary + schemas-root + core typecheck.

### Slice 4 — Cross-package alignment + guards + docs + changeset (serial close)

- **Admitted-session sample rotation (research P1-3)**: 18 files use `'1.14.0'` as an admitted-session
  version; capability-gated ones genuinely red after Slice 1 (e.g.
  `change-diff-evidence-service.test.ts:95-120` gates `requirementDiff` on capabilities) — rotate
  samples to `1.15.0` and restore the gated expectations; `cli-validate-findings-router.test.ts:202`
  message literal `'>=1.14.0 <1.15.0'` rotates.
- Pin guards: upstream-contract-regression → `8e0288df…`; server cold-start constant + two version
  literals → 1.15.0; prepare script EXPECTED_COMMIT; w2 SHA + version; schemas-root (done in Slice 3).
- `tool-subscription-router.test.ts:684`: derive `@1.15` from `OPENSPEC_CLI_TARGET_SERIES`.
- Docs: CLAUDE.md pointer → 1.15.0 report (1.14.3 to history); AGENTS.md pin line
  `(v15: v1.15.0, 8e0288df)` + history gains v1.14.3 + clean-build law + 2026-10-25 decision;
  settings.tsx:368-372 comment-only wording (constants derive naturally — research non-blocker).
- **README face (research P1-5)**: `README.md` + `README-zh.md` support tables rotate; new archive
  copies `README-1.14.0.md` + `README-zh-1.14.0.md` with legacy links; `packages/cli/README.md`
  scoped to v15. Dist-tag fact: `resolveReleaseChannel` returns `latest` for any stable → 15.0.0
  flips npm latest from 14.0.3; `@^14` remains installable; release notes must point standalone users
  at `openspec install`/`openspec update` (B2 deferral side effect).
- `.changeset/target-openspec-cli-15-line.md`: **major** bump, four-package naming + fixed-group
  propagation.
- Green: renamed-matrix rerun + guards + server/web/core typechecks.

### Verification

Focused per slice (exec + substring filters) before broad gates; broad gates serial at close;
vision smoke walkthrough (Agent inventory under a 1.15.0 session is the one user-visible face);
Codex Round-C; PR → archive → release (Owner confirmation; major: latest flips, `@^14` legacy).
