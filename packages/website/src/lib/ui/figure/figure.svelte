<!--
  jixoai Figure (ui/figure/figure.svelte — document-ontology R2
  batch 2, the float primitive; design §2, mechanism §1.1/§1.1c/§1.2).

  The float counterpart of the section tree: renders <figure
  data-jx-figure={kind}> with the §1.1c-frozen figcaption shape —
  label + number single-space joined, caption text after, the citedIn
  tail led by " · " inside its span — derives the ordinal inside
  $derived from the nearest domain's revision signal (registration
  order never assigns ordinals), and when it carries BOTH an id and a
  number registers a FigureTargetEntry whose number is a live
  accessor thunk (never a registration-time snapshot).

  citedIn GAP NOTE (design §2 — the mandatory header duty): the
  automatic backlink rendering machinery is deliberately absent —
  the automatic form of backlinks exists ONLY in the harvest layer
  (the inversion of the reference points' refids[]). The strings
  passed here are static display currency: they do NOT follow
  reorders (a "§ 3.1" can rot after its section moves — that rot
  pressure is exactly the regression driver). Regression condition =
  a genre genuinely needs an on-paper "cited-by list"; at that point
  add a reverse-registration context + a Figure read of it — purely
  additive, no shape break.

  BARE USE (outside every numbering domain): renders and harvests the
  kind but never numbers (one dev warn per instance — "Figure escaped
  any numbering domain"); an unnumbered Figure is NOT a legal
  reference target (the same loud fallback as a missing id —
  addressing walks explicit ids only; numbers are display currency,
  never addresses).

  STRUCTURAL PROPS (design §1.2): kind/citedIn are mount-time
  structure — changing them equals destroy-and-recreate (Svelte's
  remount migrates the registration naturally); there is no in-place
  mutation path by law.
-->
<!-- the init-time reads below capture structural props (kind/id)
     deliberately — design §1.2 freezes them as mount-time parameters:
     a change means remount, never an in-place mutation -->
<!-- svelte-ignore state_referenced_locally -->
<script lang="ts">
  import { getContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import {
    FIGURE_LABELS,
    NUMBERING_DOMAIN_KEY,
    createDomainRegistry,
    domainRegistryFromContext,
    figureOrdinal,
    targetRegistryFromContext,
    type DomainRegistry,
    type FigureKind,
    type FigureRecord,
    type NumberingDomain,
  } from './numbering.svelte';

  interface Props {
    /** the float's kind — both the counter family and the display-word source */
    kind: FigureKind;
    /** optional explicit address; no id = numbered but unreachable (numbers never address) */
    id?: string;
    /** caption body text (a value, never a snippet); absent = label + number only */
    caption?: string;
    /** manual cited-in annotations — static display strings, see the header gap note */
    citedIn?: string[];
    class?: string;
    /** the content slot — required semantics; an empty slot warns once in dev */
    children: Snippet;
  }

  let { kind, id, caption, citedIn, class: className = '', children }: Props = $props();

  // ── the nearest counting domain (init-time read — structural context) ──
  const domain = getContext<NumberingDomain>(NUMBERING_DOMAIN_KEY);
  if (!domain && import.meta.env?.DEV !== false) {
    console.warn(
      `[jx/figure] Figure escaped any numbering domain — rendering unnumbered ` +
        `(kind: "${kind}"; bare use renders and harvests, but is never a legal reference target)`,
    );
  }

  // ── the document-level domain registry (the page provider owns it) ──
  // A document-scoped kind without it degrades to the local domain's
  // own count (one dev warn — fix the provider, not the figure)
  let registry: DomainRegistry | undefined = domain ? domainRegistryFromContext() : undefined;
  if (domain && !registry && domain.floatScope[kind] === 'document') {
    if (import.meta.env?.DEV !== false) {
      console.warn(
        `[jx/figure] document-scope counting degraded to the local domain — ` +
          `no document domain registry in context (kind: "${kind}")`,
      );
    }
    registry = createDomainRegistry();
    registry.registerDomain(domain);
  }

  // ── the record + the el backfill: init registers el-less (SSR and
  //    the template-order proxy stay complete); bind:this lands the
  //    element, and this component-local $state tick re-derives the
  //    ordinal — the frozen module gains no write-back inlet. Post-
  //    attach mutations are the domain root observer's job; the tick
  //    only covers the attach/hydration window where no mutation ever
  //    fires (a component-internal detail, not a second signal law). ──
  const rec: FigureRecord = { kind, ...(id !== undefined ? { id } : {}) };
  let figureEl: HTMLElement | undefined = $state();

  $effect(() => {
    if (figureEl) rec.el = figureEl;
  });

  // ── the ordinal (§1.1: derived from the revision signal, never
  //    registration order; chapter = domainOrdinal.ordinal, document =
  //    the bare continuous count across the participating domains) ──
  const ordinal = $derived.by(() => {
    void figureEl; // the attach tick (see above)
    if (!domain || !registry) return null;
    return figureOrdinal(rec, domain, registry);
  });

  const numberDisplay = $derived(
    ordinal === null
      ? null
      : ordinal.scope === 'chapter'
        ? `${ordinal.domainOrdinal}.${ordinal.ordinal}`
        : String(ordinal.ordinal),
  );

  // ── registrations (init-time, SSR-complete: a target rendering
  //    before its reference resolves within the same single pass) ──
  const unregisterFigure = domain?.registerFigure(rec);

  const targets = targetRegistryFromContext();
  const unregisterTarget =
    domain && id !== undefined && targets
      ? targets.registerTarget({
          id,
          kind: 'figure',
          figureKind: kind,
          // live accessor thunk — reads the derived, so reorders flow through
          number: () => numberDisplay ?? '',
          title: null, // a caption is not a title
        })
      : undefined;

  $effect(() => {
    return () => {
      unregisterFigure?.();
      unregisterTarget?.();
    };
  });

  // ── empty content slot = author error (design §2): everything
  //    besides the figcaption must be blank for the warn to fire
  //    (Svelte renders empty blocks as comment placeholders — those
  //    count as blank too) ──
  $effect(() => {
    if (!figureEl) return;
    const besides = [...figureEl.childNodes].filter(
      (n) => !(n.nodeType === 1 && (n as Element).tagName === 'FIGCAPTION'),
    );
    const blank = besides.every(
      (n) => n.nodeType === 8 || (n.nodeType === 3 && (n.textContent ?? '').trim() === ''),
    );
    if (blank && import.meta.env?.DEV !== false) {
      console.warn(
        `[jx/figure] empty content slot — a Figure floats content and none was passed (kind: "${kind}")`,
      );
    }
  });
</script>

<figure
  bind:this={figureEl}
  data-jx-figure={kind}
  {id}
  data-number={numberDisplay ?? undefined}
  data-cited-in={citedIn && citedIn.length > 0 ? JSON.stringify(citedIn) : undefined}
  class={className}
>
  <!-- the §1.1c frozen caption shape (the byte-snapshot anchor): label
       and number single-space joined, caption text after, the citedIn
       tail led by " · " INSIDE the span; absent pieces leave no node.
       The joins are {' '} / {' · '} expressions because the compiler
       trims literal whitespace at block and tag edges — keep them -->
  <figcaption><span data-jx-figure-label>{FIGURE_LABELS[kind].caption}</span>{#if numberDisplay}{' '}<span data-jx-number>{numberDisplay}</span>{/if}{#if caption}{' '}<span>{caption}</span>{/if}{#if citedIn && citedIn.length > 0}<span data-cited-in={JSON.stringify(citedIn)}>{' · '}{citedIn.join(' · ')}</span>{/if}</figcaption>
  {@render children()}
</figure>
