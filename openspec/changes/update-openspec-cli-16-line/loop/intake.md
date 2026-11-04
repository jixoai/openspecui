<!--
Orthogonal intents (created 2026-11-04 Asia/Shanghai):
1. Preserve the original request and the 1.16.0 → OpenSpecUI 16 line decision.
2. Record every Owner-default ruling taken without an interactive answer, each vetoable in review.
3. State the zero-production-change claim and what would falsify it.

Original request (2026-11-04): "后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流
推进上线。如果有需要我做视觉验收的你可以先生成带有图文的 HTML 报告给我（包含视觉验收的部分，不用所有页面）。
从今天起，你检查一下有没有需要更新的，自己去推进"
-->

# OpenSpec CLI 1.16.0 line intake (OpenSpecUI 16)

## User Input

> 后每隔 3 天检查一下有没有需要更新的，然后更近更新。按照标准工作流推进上线。如果有需要我做视觉验收的你可以先生成带有图文的 HTML 报告给我（包含视觉验收的部分，不用所有页面）。从今天起，你检查一下有没有需要更新的，自己去推进

Standing authorization recorded: the 3-day detection runs on its own, and a detected upstream
release is followed through the standard workflow **to release** without another prompt. A
visual-acceptance hand-off, if one becomes necessary, ships as an HTML report covering only the
pages that need eyes.

First scheduled detection (2026-11-04) found v1.16.0 and opened this line.

## Objective Scope

```text
OpenSpec CLI v1.16.0 (19 commits, src 12 files +404/-41, 0 merges)
  ├── O1  validate: bare {status} envelope on a broken project config   -> decode already covered; new fixture
  ├── O2  validate: scenario step-coverage WARNING (strict fails)        -> decode already covered; new fixture
  ├── O3  parser correctness (inline fence, `###Requirement:`)           -> CLI-owned, no mirror
  ├── O4  no-root error suggests a store matching the git origin         -> message-level, no mirror
  ├── O5  completion/zsh installer                                       -> CLI-owned
  └── O6  npm engine floor >=22.12.0                                     -> install-time, release-note material
```

Zero production projection changes: every observable delta rides a shape OpenSpecUI already
decodes through open-string diagnostics or `{level, path, line?, message}` findings. The line's
work is the window rotation, the fixture-role rotation, the registry/staleness rotation, and
the two new executable proofs.

## Owner-default decisions (vetoable in review)

1. **New major line, not a widening.** 1.16.0 is a new upstream minor series. The
   one-line-per-series law and the 2026-10-25 v15 decision ("1.16 not pre-claimed; admission is a
   separately verified decision") both point here. A `>=1.15.0 <1.17.0` widening would mix two
   series in one fixture matrix; it stays a fallback only. Recorded cost: the full v16 fixture
   file set and the boundary-suite rotation.
2. **`openspec-cli-114` retires.** Its only real consumer is the v14 boundary suite, which
   becomes the v15 boundary suite. Every other mention is a change-name comment. `openspec-cli-115`
   (1.15.0) becomes the boundary line, version unchanged.
3. **Boundary discriminator is the config-failure envelope**, not `update --dry-run`. Verified
   on the real binaries: 1.15.0 owns `update --dry-run` (exit 0), so it cannot discriminate this
   line; a broken `openspec/config.yaml` makes 1.16.0 answer the bare `{status}` envelope while
   1.15.0 still answers the ordinary report.
4. **No Node `engines` change in this repository.** OpenSpecUI's packages declare no `engines`
   and CI runs Node 24; the upstream floor is a consumer-facing fact for npm-installed CLI users,
   carried in the README/release notes rather than in package manifests.
5. **No changeset exception this time.** The rotation touches `packages/` (`openspec-compat.ts`,
   the fixture helper and suite renames, the registry, `tool-init-state.ts`), so
   `changeset-check.mjs` fires; a patch changeset for the four version-locked packages is
   included.
6. **No agent E2E walkthrough beyond the existing browser suites.** No UI ships; the Owner's final
   browser walkthrough boundary (2026-07-20 law) is unchanged.

## Falsifiers for the zero-production-change claim

- A validate answer this line cannot decode (the two unions must accept the new envelope).
- A finding whose `level` or shape falls outside the existing finding schema.
- Any new `install.scope` value or `version --json` member (none in this line's diff).
- Any change under `src/core/command-generation/` or to `AI_TOOLS` (verified none).
