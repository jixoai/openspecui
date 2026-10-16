<!--
Orthogonal intents (created 2026-10-16 Asia/Shanghai):
1. Define the acceptance checkpoints for the 1.14.2 patch rotation.

Original request (2026-10-16): "过了几天了，你看看 openspec 有没有更新。有的话我们就要继续跟进了"
-->

# OpenSpec CLI 1.14.2 checkpoints

## CP0 — Planning baseline
- [x] Worktree + branch + submodule pin `v1.14.2` (`f80d860f`).
- [x] Evidence report + change artifacts written.
- [ ] Codex change review approved.

## CP1 — Pin rotation
- [ ] Alias + lockfile + PINNED_V14_VERSIONS/bins + EXPECTED_COMMIT + live pin guards + CLAUDE.md.
- [ ] Red recorded (identity assertion vs stale 1.14.1).
- [ ] v14 fixture matrix green against 1.14.2 (zero relaxations).

## CP2 — Fixture evidence + docs + changeset
- [ ] x- extension-key fixture case (no warning) + X-Foo (warns).
- [ ] AGENTS.md pin line + 2026-10-16 architecture decision; README audited.
- [ ] Changeset for the 14.x patch.

## CP3 — Review, walkthrough, delivery
- [ ] Codex implementation review (score recorded).
- [ ] Vision ego-browser walkthrough (preparation evidence).
- [ ] Broad gates green; PR merged; change archived; resources released.
- [ ] Owner final walkthrough boundary unchanged.
