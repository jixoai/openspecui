<!--
Orthogonal intents (created 2026-07-19 Asia/Shanghai):
1. Track the independent Project Binding settlement implementation.
2. Require typed public-boundary and mutation-resistance evidence.
3. Keep W1/W3 and downstream checkpoints out of this Change.
-->

# Checkpoints

- [x] B2.1 Define a correlated typed write-then-converge response with launch-write, `rootPreview`, transition state,
      root provenance, diagnostics, stdout/stderr, and exit status.
- [x] B2.2 Make `updateProjectBinding` return after a physically confined, reactively settled launch-file
      write and one detached preview attempt; subscriptions perform asynchronous Planning-root convergence.
- [x] B2.3 Add checked public Router/server, partial CLI failure, physical symlink/reactive settlement,
      and mutation-resistance red tests for the exact response/settlement transition.
- [x] B2.4 Preserve Config dirty declarations and a generation-safe launch repair path through stale,
      delayed, or failed subscription convergence.
- [x] B2.5 Run focused tests, typecheck, clean SSG, one bounded direct-Web flow on the corrected SHA,
      independent review evidence, and owner acceptance of single-page plus same-project multi-tab
      Store A -> B convergence.

Evidence note (2026-07-19): B2.1-B2.2 are implemented. Independent review reopened B2.3-B2.4 because
the first green fixture subscribed to an internal Root Context helper, selected Root B through mutable
fixture state instead of the written launch config, and under-asserted raw CLI evidence. The first Web
candidate also treated matching declarations as convergence even when the subscribed Root Context was
still A or had failed. The correction must use the public Project Binding subscription, derive B from
the launch file, assert ready/error CLI evidence, and require matching ready Root identity before dirty
state clears. The detached-preview failure variant remains `preview-error`; it must not be relabeled as
a failed Manager transition. B2.5 remains open pending correction review, direct-Web acceptance, and
full gates.

Correction commit `c85ce12` improved B2.3-B2.4 but did not close them: the checked fixture now uses the public
`planningConfig.subscribeProjectBinding` route, derives Root B from the written launch config, and
asserts typed ready and preview-error CLI evidence. Web tests cover stale Root A, stale data scope,
Root error, and retained B data with a subscription error. Independent review found that the result type
still permits contradictory preview/transition pairs; the preview-error fixture loses Root B provenance;
the launch write bypasses the physical/reactive owner; stale/error states lock the repair controls; and a
newer draft has no generation protection from a late older emission. B2.1-B2.4 are therefore open.
B2.5 remains open for corrected direct-Web evidence, clean SSG, full gates, and independent review.

Implementation evidence (2026-07-19): the corrected candidate models ready/converging and
error/preview-error as one correlated union, writes launch config through the physical/reactive owner,
preserves Root B when Context alone fails, and moves draft generation/settlement into a narrow Web hook.
Checked red runs failed on the old union, raw writer, locked repair controls, removed Root identity check,
and removed pending retirement. Focused Core/Server/Web tests and typechecks pass. B2.1-B2.4 are closed;
B2.5 remains open for the explicitly separate clean SSG, direct-Web, full-gate, and independent-review lane.

Exact-SHA evidence (2026-07-20): `04850287955c0031d0de2bcae15a96ffdc2ea067` passed clean SSG,
format, lint, all 15 workspace typechecks, the complete unit suite, xterm browser `60 passed / 1 skipped`,
Web browser `12/12`, and two independent code reviews with no P0/P1/P2. The one bounded direct-Web
attempt proved initial Root A on the pinned CLI and isolated data home, then the agent-browser session
hung during screenshot/snapshot/fill and was terminated without retry. No A-to-B action, mobile geometry,
or terminal browser state was observed on this SHA. B2.5 therefore remains open pending an owner-selected
browser evidence path; this automation failure is not classified as a product defect.

Owner decision (2026-07-20): use one deterministic Playwright fixture for the real W2 A-to-B flow and
manual owner acceptance for unit-page/multi-tab behavior. Do not migrate the existing browser suite or
retry the hung agent-browser session. The fixture must run on the exact implementation SHA with pinned
CLI, isolated `XDG_DATA_HOME`, same-origin Project Web, desktop/mobile assertions, and cleanup.

Fixture delivery evidence (2026-07-20): `43ea0cd` added the opt-in Playwright command and `7ea2c8a`
removed upper/lower-case proxy variables from its isolated environment. On the final fixture state, the
explicit script typecheck and `pnpm --filter @openspecui/web test:project-binding` both exited 0. The raw
fixture result pinned OpenSpec SHA `e1b51d111ab446b54dee2d6159ac245f0339ae52`, passed desktop `1280x800`
and mobile `390x844`, reported `browserErrors: 0`, and left ports `14236/14237`, child processes, and
temporary roots clean. `pnpm format:check` and `git diff --check` also exited 0. The three preceding
failures were fixture-only startup, path canonicalization, and unscoped-tab assertion corrections; no
production defect was inferred from them. B2.5 remains open pending clean SSG/full gates and owner manual
single-page/multi-tab acceptance.

Final gate evidence (2026-07-20, exact SHA `89de4df0d763e033e204c19302b43569e1cbc442`): clean SSG,
`pnpm format:check`, `pnpm lint:ci`, `pnpm typecheck` (15 workspace projects), `pnpm test:ci`,
`pnpm test:browser:ci` (xterm 60 passed / 1 skipped; Web 12/12), and `git diff --check` all exited 0.
The clean SSG output was rebuilt after removing `packages/web/dist-ssg` and `packages/web/.vite`.
Only pre-existing scroll-button/dynamic-import build warnings and jsdom Canvas warnings appeared. No
fixture process, backend/Vite listener, or temporary root remained after cleanup. B2.5 is still open only
for the owner's manual single-page and multi-tab acceptance plus this independent review.

Independent review correction (2026-07-20): the first review found a P2 in `cleanupBrowser`: a stuck
`context.close()` could prevent `browser.close()` from being attempted. `89de4df` closes both handles
concurrently, isolates each close error, and retains the outer five-second bound. The explicit fixture
typecheck and opt-in Playwright run passed again on that SHA; no P0/P1/P2 remains. A separate prior
Active-Root-A/Refreshing observation had no exact SHA or raw logs and did not reproduce on the clean
fixture, so it remains unverified characterization rather than a production defect.

Do not start W3, `6.12+`, merge, archive, or release from this Change.

Owner acceptance (2026-07-20): the owner confirmed the W2-specific manual checks: single-page Store A ->
Store B converges with `Transition: converging`, Project Binding and Active Root show B, and a second
same-project page converges through its subscription without stale draft or false success/error state.
This closes B2.5. It does not close parent `6.11`'s separate App multi-project tab acceptance.
