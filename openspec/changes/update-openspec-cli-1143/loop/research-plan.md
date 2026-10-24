<!--
Orthogonal intents (created 2026-10-24 Asia/Shanghai):
1. Two-slice plan per the upstream-rotation skill (pin rotation; evidence/docs/changeset).

Original request (2026-10-24): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.3 patch research plan

Evidence: `references/openspec-1.14.3-report.md` (pin `v1.14.3` @ `c794978f`).

### CP0 — Planning baseline

Worktree `update-openspec-cli-1143` off `origin/main` (`e4894a4b`); submodule pinned `v1.14.3`;
report + change artifacts committed before review. Review per the upstream-rotation skill
(Round-A dual-channel: Codex inline-material mode per the provider-sandbox findings + research
subagent; Round-B approval gate).

### Slice 1 — Pin rotation (serial)

Ten known live surfaces (1.14.2 audited list) + whole-repo grep for strays.
Codex Round-A folds: baseline = branch point e4894a4b with planning commit 690728ce on top (say so
in the slice text); the v13-boundary file's three `1.14.2` literals are admitted-line values that
rotate while its `1.13.2` identity assertions stay verbatim (boundary evidence, never rotated);
the brace-depth fixtures keep their semantics — `assertBraceNesting` verified alive in the 1.14.3
outputs.ts (5 references) despite the braces dependency removal — and 1.14.3 ADDS a `MAX_BRACE_EXPANSIONS=1024` expansion-budget guard
(also verified); do not remove the depth fixtures, and "braces story closed" is wrong as a reason
for anything. alias `@1.14.3`,
PINNED_V14 versions/bins, v13-boundary three literals, schemas-root local bins key,
upstream-contract-regression `c794978f...`, cold-start constant + version literals, w2 SHA +
version, prepare script EXPECTED_COMMIT, CLAUDE.md pointer (1.14.3 report; 1.14.2 to history),
AGENTS.md pin line + clean-build law SHA + 2026-10-24 architecture decision.
Red: identity assertion expected 1.14.2 / received 1.14.3. **CP1 order (research fold)**: change
alias + helper first, immediately run the three 1.14.2-era fixtures (brace depth / x- keys /
unapplied-content) recording each green/red BEFORE touching any assertion literal — "zero
relaxations" must be an observation, not an assumption — then the whole v14 matrix (substring
filter `official-cli-v14` + boundary + schemas-root + upstream-regression), server cold-start
guard, typechecks. Audit grep + per-class disposition (research fold):

```
grep -rn -E '1\.14\.2|f80d860f|c794978f|openspec-cli-114|PINNED_OPENSPEC|EXPECTED_COMMIT' \
  packages scripts CLAUDE.md AGENTS.md  # then classify:
```
- live surfaces -> rotate (the ten listed)
- window/sample literals, NOT pins, leave alone: `agent-delivery-registry.test.ts:941`,
  `tool-init-state.test.ts:370,384,644`, `openspec-compat.test.ts:70`,
  `status-warnings-notice.test.tsx:25`, `change-view-status-warnings.test.tsx:162`
- `pnpm-lock.yaml` changes via install only
- `AGENTS.md` history list gains `v1.14.2 (f80d860f)` explicitly; the 1.14.2-era fixture
  provenance notes (e.g. workflow-fixtures header "1.14.2 change-metadata contract") gain a
  1.14.3 intent line.

### Slice 2 — Evidence/docs/changeset (serial close)

README audit (explicit `1.14.2` runtime claims — expected none); changeset four-package patch;
release-period incidents (flake or else) recorded into the implementation log per the skill's new
P6 obligation. No new fixture infrastructure expected: braces story closed upstream, x- keys and
unapplied-content fixtures from 1.14.2 stay valid (verify, don't assume — rerun the matrix first).

### Verification

Focused (per slice) then broad gates serial; vision smoke walkthrough (zero-production-change →
smoke level per the skill); Codex Round-C; PR → archive → release per the skill's delivery
reference.
