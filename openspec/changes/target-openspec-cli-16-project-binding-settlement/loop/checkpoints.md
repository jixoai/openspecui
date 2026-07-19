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
- [ ] B2.5 Run focused tests, typecheck, clean SSG, one bounded direct-Web flow on the corrected SHA, and
      independent review evidence.

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

Do not start W3, `6.12+`, merge, archive, or release from this Change.
