<!--
Orthogonal intents (updated 2026-07-25 Asia/Shanghai):
1. Track the approved realtime waiting-experience Change from planning through implementation, PR, and archive gates.
2. Make every completion claim evidence-backed and synchronized with implementation reality.
3. Preserve the all-surface scope while preventing schema completion from being confused with code, CI, or owner acceptance.
4. Record the required delta-spec and strict-validation gate before this Change may be treated as implementation-ready.
5. Record the Web-first execution replan and the current P0 revalidation, then authorize only the bounded
   P1-A Dashboard Summary v2 vertical slice.

Original request (2026-07-23): "布局方面暂时不需要改动，后续社区有一个PR我会合并进来，那是关于kanban 的一个pr。所以本次change的主要优化点，在于更友好的UIUX，优化用户等待信息的时间感知。"
Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。"
Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。"
Reviewer replan decision (2026-07-24): "先做 Web 侧(P2/3/4)，我会同步去修复 P0，等完成后你再看看能不能做 P1".
P0 revalidation (2026-07-25): the asserted watcher/snapshot failure is stale. Current Manager cache-hit
dependency tracking plus invalidation-key retirement passes the Root Snapshot 3/3 and real Git Router 7/7
replays; P1 may begin only through the bounded P1-A Dashboard Summary slice.
-->

## Checkpoint State

This is a planning-complete checkpoint with an unreviewed Web-first candidate recorded in
`implementation.md`. Completion of this artifact schema is not implementation completion: delta
specifications, strict validation, all implementation packages, CI, PR review, and owner browser acceptance
remain open.

Every completed implementation item must update `loop/implementation.md` with the changed owner, actual red/green/mutation-resistance evidence, commands, results, and any divergence before its checkbox is checked.

## 1. Research and Planning

- [x] 1.1 Intake captured objectively in `loop/intake.md`, including the no-layout/Kanban boundary, full-surface scope, eight-state model, and owner-only final acceptance.
- [x] 1.2 Codebase research recorded in `loop/research-plan.md`, including Projection Work transport facts, subscription-shape fragmentation, route/overlay inventory, CSS/view-transition assets, and test infrastructure.
- [x] 1.3 Owner-approved direction recorded: push invalidation to identity-bound pull, visual lifecycle language, composable shadcn-style atoms, display-only action locks, draft protection, native motion, and `overflow-anchor: auto`.
- [x] 1.4 Added delta specs for `realtime-projection-experience`, `live-projection-work`, `web-rendering`, `opsx-ui-views`, `opsx-config-center`, and `opsx-terminal-panel`, with complete requirements and scenarios for push-to-pull, eight states, authority/cause, static truthfulness, visual/accessibility behavior, drafts, and local command activity.
- [x] 1.5 Ran `openspec validate refine-live-projection-experience --strict` successfully after delta specs were added on 2026-07-23 Asia/Shanghai.

## 2. Implementation

Execution order: Phase 1 is the recorded v1 Web candidate. P0 is resolved by revalidation, not a new repair.
Phase 2 begins only with P1-A Dashboard Summary: a data-free v2 subscription, a server-owned typed pull,
and its identity/generation-safe Web adapter. Trends, Git, Changes, coalescing, and user-action bypass stay
outside P1-A.

- [ ] 2.1 P1-A starts the version-2 Dashboard Summary invalidation/pull contract and its typed Web adapter. The migrated Summary subscription carries identity/generation/cause but no business data; no v1 alias or parallel client truth exists for that route. *(Phase 2)*
- [ ] 2.2 P1-A red evidence reaches the real Dashboard Summary adapter: A invalidates, B rebinds, A pull resolves late, and the pre-fix adapter can publish A incorrectly. *(Phase 2)*
- [ ] 2.3 P1-A green and mutation-resistance evidence proves only a matching identity/generation pull commits; removing the exact acceptance gate fails the same late-A fixture. *(Phase 2)*
- [ ] 2.4 P2 visual primitives implemented and tested: composable root/data attributes, stable skeleton geometry, local revalidation/settle cues, truthful progress, reduced-motion path, hidden accessible status, and stable command labels. *(Phase 1; split 2A state law/adapters incl. the Web-side root-cause fix to `useAuthoritativeSubscription` reconnect/stopped/complete not flipping `isLoading` when cached data exists, then 2B atoms/CSS)*
- [ ] 2.5 P3 inventory/regional routes migrated: Dashboard, Changes, Archives, Specs, Schemas, Context, Notifications, Git, and Search use the shared model without hiding current sibling content behind a route-wide wait branch. *(Phase 1; adapter targets v1 transport)*
- [ ] 2.6 P4 details, workflows, Config, Settings, translation, overlays, editors, and terminal controls migrated with local update availability and no dirty-draft/overlay overwrite. *(Phase 1; adapter targets v1 transport)*
- [ ] 2.7 P5 static, accessibility, and visual-regression evidence completed: static mode has no fabricated Live/revalidation effect; mobile and reduced-motion fixtures are green; SSG uses shared display mapping. *(Phase 1 static/a11y deliverable; Phase 2 adds the full-gate closing evidence after P1)*
- [ ] 2.8 Each package's implementation state, exact source/test owner, command output, red/green result, and mutation-resistance result are synchronized in `loop/implementation.md`.
- [ ] 2.9 Any loopback trigger is recorded before further code work: missing typed provenance, invented lifecycle state, global draft ownership, layout/Kanban collision, divergent SSG mapping, invalid red test, or newly discovered cache/worker/polling product decision.

## 3. PR and Release Gates

- [ ] 3.1 Add a `.changeset/*.md` file if implementation changes publishable package behavior; record an explicit docs/CI-only exemption only when valid.
- [ ] 3.2 Run focused Server/Web unit tests and Storybook/basic browser fixtures before broad gates; record that they test the real production or mutation boundary rather than a mocked downstream handler.
- [ ] 3.3 Run static-facing checks after rebuilding fresh artifacts: required static unit tests and `pnpm --filter @openspecui/web build:ssg`.
- [ ] 3.4 Run CI-equivalent local gates successfully: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci`.
- [ ] 3.5 Open or update a feature-branch PR only after the local gates pass; do not push directly to protected `main`.
- [ ] 3.6 Record passing PR checks and the owner-only final browser walkthrough separately. Agent fixture evidence is not final end-to-end acceptance.

## 4. Merge Readiness

- [ ] 4.1 Confirm all P1-P5 work is complete, all strict/OpenSpec validation is green, no loopback trigger remains unresolved, and implementation notes match the checked source.
- [ ] 4.2 Obtain owner approval for merge after the final browser walkthrough. Do not treat automated checks as that approval.
- [ ] 4.3 Merge through the protected-branch PR workflow only after required checks and approval; follow Manager Mode release sequencing only if the manager explicitly authorizes release.
- [ ] 4.4 Archive this OpenSpec Change only after the merged implementation and durable specification sync are complete; archive status must not be used as a substitute for release evidence.
