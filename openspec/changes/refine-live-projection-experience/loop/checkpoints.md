<!--
Orthogonal intents (updated 2026-07-28 Asia/Shanghai):
1. Track the approved realtime waiting-experience Change from planning through implementation, PR, and archive gates.
2. Make every completion claim evidence-backed and synchronized with implementation reality.
3. Preserve the all-surface scope while preventing schema completion from being confused with code, CI, or owner acceptance.
4. Record the required delta-spec and strict-validation gate before this Change may be treated as implementation-ready.
5. Record the Web-first replan, P0/P1-A/P1-B evidence, and full Web/App migration without closing owner acceptance.

Original request (2026-07-23): "布局方面暂时不需要改动，后续社区有一个PR我会合并进来，那是关于kanban 的一个pr。所以本次change的主要优化点，在于更友好的UIUX，优化用户等待信息的时间感知。"
Original request (2026-07-23): "一次性把现有的页面都统一整改，因为这涉及到统一组件的封装和开发。全部改动，才能在中途暴露出所有隐含的可能、状态。这对于我们组件化的封装和开发非常重要。"
Original request (2026-07-23): "不用显示文字，可以用光影来替代，将它做成一种视觉语言，其实包括加载中等状态也是，尽量不要使用文字，而是使用视觉语言（动画、光影）等技术。"
Reviewer replan decision (2026-07-24): "先做 Web 侧(P2/3/4)，我会同步去修复 P0，等完成后你再看看能不能做 P1".
P0 revalidation (2026-07-25): the asserted watcher/snapshot failure is stale. Current Manager cache-hit
dependency tracking plus invalidation-key retirement passes the Root Snapshot 3/3 and real Git Router 7/7
replays; P1 may begin only through the bounded P1-A Dashboard Summary slice.
Owner loopback (2026-07-27): "统一修复所有类似的问题（我们也没不多，各个页面都检查一下，特别是app 那边新增的页面）".
Owner walkthrough transfer (2026-07-27): "绝大部分功能基本都通过了，更多的问题是在一些 UI/UX 的问题上，这属于后续需要打磨的问题。"
-->

## Checkpoint State

This checkpoint contains an applied Web/App candidate with focused evidence recorded in `implementation.md`.
Completion of the artifact schema or focused tests is not release completion: broad CI, PR review, and owner
browser/visual acceptance remain separate gates.

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

- [ ] 2.1 P1-A starts the version-2 Dashboard Summary invalidation/pull contract and its typed Web adapter. The migrated Summary subscription carries identity/generation/cause but no business data; no v1 alias or parallel client truth exists for that route. _(Phase 2)_
- [ ] 2.2 P1-A red evidence reaches the real Dashboard Summary adapter: A invalidates, B rebinds, A pull resolves late, and the pre-fix adapter can publish A incorrectly. _(Phase 2)_
- [ ] 2.3 P1-A green and mutation-resistance evidence proves only a matching identity/generation pull commits; removing the exact acceptance gate fails the same late-A fixture. _(Phase 2)_

P1-A evidence is recorded in `loop/implementation.md` as of 2026-07-25. Independent review rejected the
first candidate: a remounted cached A was not demoted to display-only on B's first wake, the loading benchmark
still waited for the removed Summary snapshot payload, and the Web A/B fixture erased its public wake type.
The correction candidate now has direct cached-A red/green/mutation evidence, an exact checked mocked callback
input, mismatch-resistant wake-to-pull benchmark measurement, two isolated real benchmark scenarios with
`fatalError: null`, and final focused Server/Web type/test greens. Independent review accepted the current
runtime contract in `d1740335` and reproduced both isolated scenarios. 2.1-2.3 and every P1-A checkbox stay
unchecked; neither the original remove-guard result nor the correction replay substitutes for checkpoint 2.2's
missing historical pre-v2 red.

- [x] 2.4 P2 visual primitives implemented and tested: composable root/data attributes, stable skeleton geometry, local revalidation/settle cues, truthful progress, reduced-motion path, hidden accessible status, and stable command labels. _(Phase 1; split 2A state law/adapters incl. the Web-side root-cause fix to `useAuthoritativeSubscription` reconnect/stopped/complete not flipping `isLoading` when cached data exists, then 2B atoms/CSS)_
- [x] 2.5 P3 inventory/regional routes migrated: Dashboard, Changes, Archives, Specs, Schemas, Context, Notifications, Git, and Search use the shared model without hiding current sibling content behind a route-wide wait branch. _(Phase 1; adapter targets v1 transport)_
- [x] 2.6 P4 details, workflows, Config, Settings, translation, overlays, editors, and terminal controls migrated with local update availability and no dirty-draft/overlay overwrite. _(Phase 1; adapter targets v1 transport)_
- [ ] 2.7 P5 static, accessibility, and visual-regression evidence completed: static mode has no fabricated Live/revalidation effect; mobile and reduced-motion fixtures are green; SSG uses shared display mapping. _(Phase 1 static/a11y deliverable; Phase 2 adds the full-gate closing evidence after P1)_
- [x] 2.8 Each package's implementation state, exact source/test owner, command output, red/green result, and mutation-resistance result are synchronized in `loop/implementation.md`.
- [x] 2.9 Recorded the 2026-07-27 fresh-document/App loopback before further code work: new browser Documents could not consume Server retained snapshots, App Store/Root owners waited for a first notice, App Environment could expose a false empty conclusion, and Sessions route ownership destroyed iframe Documents.
- [x] 2.10 P1-B returns a full typed Dashboard Summary projection state so a fresh Document can render Server-retained `stale-display-only` data immediately, then converge to matching current data without restoring authority early.
- [x] 2.11 P1-B red/green/mutation evidence proves dormant snapshot -> fresh client retained read, matching current convergence, late A/B rejection, and secondary-region admission without waiting for current Summary.
- [x] 2.12 App Store list/Doctor and Root Context owners perform one typed Pull before the first WebSocket notice; locator/generation retirement and current mutation authority remain intact.
- [x] 2.13 App Connections, Environment, Store Inventory, Store Inspector, and Context Matrix use shared visual lifecycle atoms, never report unresolved observations as empty, and retain settled sibling content during updates.
- [x] 2.14 HostedShell is owned by persistent AppLayout; `/sessions` controls visibility, and a focused router/unit fixture proves route round-trips preserve iframe DOM identity. Final multi-route visual acceptance remains owner-only.

### P7-A Project Web authentication admission

- [x] 2.15 Add a real `entry-client` red fixture proving missing/invalid credentials receive 401/403 but still import App transports and remain in initial Loading. Assert the pre-fix defect at App import/transport ownership, not at a mocked loading component.
- [x] 2.16 Before importing App, admit live Project Web through one protected health request. `200` proceeds; `401/403` renders a terminal `Authentication Required` state and starts no tRPC, WebSocket, or PTY owner; network/5xx remains an explicit recoverable connection failure. Static mode performs no admission request.
- [x] 2.17 Prove missing, invalid, valid, network failure, and static paths with checked fixtures. Removing or moving the 401/403 early return after App import must fail the same no-transport assertion.

### P7-B Static SSG output contract

- [x] 2.18 Add a real clean-build plus CLI-export red fixture: Vite 8 emits `dist-ssg/server/assets/entry-server-<hash>.js`, while the current exporter imports the absent `dist-ssg/server/entry-server.js`.
- [x] 2.19 Resolve the SSR entry through a build-owned manifest or deterministic output contract. Do not scan for an arbitrary first JavaScript file, depend on stale `dist-ssg`, or maintain a second handwritten filename.
- [x] 2.20 Prove dev monorepo and packaged `openspecui-ssg` export paths from clean artifacts, including Reference-bearing output. Bypassing the manifest/output resolver must fail the real CLI export fixture.

### P7-C Hosted iframe capability delegation

- [x] 2.21 Add a HostedShell red fixture showing the real Project Web iframe lacks Clipboard delegation while Terminal invokes `navigator.clipboard.readText/writeText`.
- [x] 2.22 Delegate only `clipboard-read; clipboard-write` to the backend-owned Project Web iframe. Do not add unrelated camera, microphone, display, filesystem, or wildcard capabilities.
- [x] 2.23 Assert the exact iframe permission surface and retain valid src/load behavior. Removing either Clipboard capability or widening the policy must fail the same focused test; final Clipboard behavior remains owner browser acceptance.

### P7-D App session observation and viewport budget

- [x] 2.24 Capture the intermittent disconnect case at the observation-to-SessionTabs boundary: the iframe receives offline state while the tab icon still renders its previous generation. Characterize whether focus/visibility refresh or competing generations cause the delay before changing production code.
- [x] 2.25 Make the tab icon, iframe treatment, and reconnect state consume one accepted locator/generation transition. Do not add polling, optimistic Offline, or a second tab-local connection fact.
- [x] 2.26 Make persistent Sessions consume the App shell's remaining block size on mobile. Prove `AppHeader + SessionTabs + TabIframe` fits one viewport with stable iframe identity; do not reintroduce route remounting.

### P7-E Store Inspector continuity and mobile containment

- [x] 2.27 Add focused evidence for operation admission/terminal feedback and blur/focus refresh. Determine whether the Inspector component remounts or only revalidates; preserve component identity and settled content in either case.
- [x] 2.28 Project accepted/running/terminal lifecycle immediately without inventing optimistic Store inventory. A focus refresh retains settled Inspector content and local selection while replacement data is display-only or updating.
- [x] 2.29 Constrain long Store ids, roots, metadata paths, diagnostics, and controls to the mobile inline size with wrapping/truncation and `min-width: 0`; add narrow component fixtures without redesigning Store Manager layout.

- [x] 2.30 Obtain focused review for P7-A through P7-E independently. Run package-level tests only after each owner is accepted, then run the existing broad gates once; agent fixtures remain preparation and the manager owns final visual/end-to-end acceptance.

## 3. PR and Release Gates

- [x] 3.1 Update `.changeset/refine-live-projection-experience-p1a.md` for the publishable Core/Server/Web protocol and presentation behavior; App remains private.
- [x] 3.2 Run focused Server/Web unit tests and Storybook/basic browser fixtures before broad gates; record that they test the real production or mutation boundary rather than a mocked downstream handler.
- [x] 3.3 Run static-facing checks after rebuilding fresh artifacts: required static unit tests and `pnpm --filter @openspecui/web build:ssg`.
- [x] 3.4 Run CI-equivalent local gates successfully: `pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck`, `pnpm test:ci`, and `pnpm test:browser:ci`.
- [x] 3.5 Open or update a feature-branch PR only after the local gates pass; do not push directly to protected `main`.
- [ ] 3.6 Record passing PR checks and the owner-only final browser walkthrough separately. Agent fixture evidence is not final end-to-end acceptance.

PR Quality run `30289438230` on head `0add7a9` did not satisfy 3.6. Changeset Gate and CI Scope passed, while
Fast Gate exposed a same-generation duplicate health probe during concurrent focus refresh and transport
disconnect; browser shards were consequently skipped. The controlled owner red/green/mutation correction is
recorded in `implementation.md`. Full local gates now pass; a new exact-head remote run is still required, and
the manager walkthrough remains a separate acceptance fact.

## 4. Merge Readiness

- [ ] 4.1 Confirm all P1-P5 work is complete, all strict/OpenSpec validation is green, no loopback trigger remains unresolved, and implementation notes match the checked source.
- [ ] 4.2 Obtain owner approval for merge after the final browser walkthrough. Do not treat automated checks as that approval.
- [ ] 4.3 Merge through the protected-branch PR workflow only after required checks and approval; follow Manager Mode release sequencing only if the manager explicitly authorizes release.
- [ ] 4.4 Archive this OpenSpec Change only after the merged implementation and durable specification sync are complete; archive status must not be used as a substitute for release evidence.
