<!--
  jixoai section card (registry/files/ui/section-card/section-card.svelte).
  The content atom of the site grammar: bordered card, header block with
  eyebrow (brand hue, font-nav, tracked 0.24em), font-nav title, text-pretty
  summary, body snippet slot. tone="hero" is for inner-page heads.

  THE STRUCTURAL SEPARATOR (Owner, 2026-09-03 rev.2): the header zone's
  authored border-b RETIRED — the dividing line is a structural
  <Separator> instance pinned to the header row's bottom edge
  (section-card.css: grid-area 1/1 + align-self end, edge-to-edge, zones
  pad themselves — the Dialog r13/r14 economy). Integer cell placement
  resolves identically standalone and inside every card-grid subgrid
  band, so the line aligns across a row through the equalized header
  row. It ships with the component; consumers never hand-write one.

  DENSITY ADOPTION (Owner, 2026-09-03): the closed density aliases own
  the card's compactness — token-derived formulas that resolve to the
  exact legacy pixels at the default scope (padding-inline inset+1u =
  16px, header padding-block stack+1u = 12px, body stack+2u = 16px,
  eyebrow secondary−¼u = 11px, summary --jx-text/--jx-line = 13/20).
  The old sm: viewport variants RETIRE: compactness is the density
  axis's one job (the kernel's closed-set law) — a second viewport axis
  is how dual-axis drift starts. xs/sm share the spacing rungs by the
  scale's design; they differ on the TEXT step (and that difference now
  actually renders — before adoption the density demo showed four
  pixel-identical panes).

  THE NUMBERING TREE (document-ontology R2, design §1/§1.1b): declaring
  `numbering` makes this section three things at once — a numbered
  subtree root, a float counter domain (per floatScope) and the deep
  node-count reset point. Undeclared descendants inside a domain
  subtree number themselves automatically (3 → 3.1 → 3.2 → 3.2.1);
  sections outside every domain subtree stay byte-for-byte today's
  component (the 1.3 status-quo gate). The ordinals derive from
  compareDocumentPosition over the domain's revision signal —
  registration order never assigns ordinals, and the number lands as
  BOTH the root's data-number attribute and a leading
  <span data-jx-number> inside the heading (never aria-hidden —
  "3.2 Methods" is the accessible heading text; the node is fully
  absent when unnumbered, which is what keeps the status-quo lane
  byte-identical: the numbered/unnumbered heading split rides the
  existing heading block's branch structure, not a nested block that
  would leave dev-mode anchors). Addressing walks the explicit id prop
  only — numbers are display currency, never addresses.
-->
<script lang="ts">
  import { getContext, onDestroy, setContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import Separator from '../separator/separator.svelte';
  import './section-card.css';
  import { SectionCardDefaults, type SectionCardTone } from './section-card-defaults.svelte';
  import {
    NUMBERING_DOMAIN_KEY,
    createDomainRegistry,
    createNumberingDomain,
    domainRegistryFromContext,
    sectionNumber,
    targetRegistryFromContext,
    type DomainRegistry,
    type FigureKind,
    type NumberingDomain,
    type SectionRecord,
  } from '../figure/numbering.svelte';

  /** The section-record chain context (component-private): every
   *  Section publishes {record, registry} so descendants read their
   *  structural parent — the nearest ancestor Section host. In SSR the
   *  record chain is the el chain's template-order proxy. */
  const SECTION_CHAIN_KEY = Symbol.for('jx-section-record-chain');

  interface Props {
    eyebrow?: string;
    title: string;
    summary?: string;
    children: Snippet;
    class?: string;
    headingLevel?: 1 | 2;
    tone?: SectionCardTone;
    /** data-family on the section root (toc-engine parent extent). */
    family?: string;
    /** data-region on the section root (toc-engine leaf). */
    region?: string;
    /** data-region on the HEADER block only — the section's own leaf when
     *  its body carries child regions (non-overlapping by construction). */
    headerRegion?: string;
    /** The line primitive this section plays in the document ontology
     *  (ontology design §2) — emitted as data-role, harvested as
     *  section.role. Default 'section' always ships: the factory default
     *  IS the declaration, no guessing left to the harvester. */
    role?: 'section' | 'entry' | 'sequence' | 'float' | 'note' | 'ref' | 'break';
    /** The ordering semantics the section's children declare (ontology
     *  design §5) — emitted as data-ordering only when passed; absent
     *  means no ordering claim (harvested as null). */
    ordering?: 'linear' | 'alpha' | 'timeline' | 'tree';
    /** Mount-time structural declaration: this section is a numbering
     *  subtree root + float counter domain (ontology R2 design §1).
     *  'decimal' is the only scheme this round. Immutable at mount:
     *  post-mount updates warn once (dev) and are ignored —
     *  restructuring means remounting (design §1.2). */
    numbering?: 'decimal';
    /** Counter scope per float kind — domain-level ONLY (a per-Float
     *  scope makes counter identity undecidable; forbidden shape).
     *  Defaults to chapter for every kind; 'document' is the ASME-style
     *  running exception. Without numbering it is an invalid shape:
     *  dev warn, ignored (tasks 1.2). */
    floatScope?: Partial<Record<FigureKind, 'chapter' | 'document'>>;
    /** The line-primitive address (P1-5): lands on the <section> root
     *  and registers a SectionTargetEntry in the document target
     *  registry — absent id means numbered but unreferenceable (the
     *  same law as Figure). Mount-time structural param. */
    id?: string;
  }

  let {
    eyebrow,
    title,
    summary,
    children,
    class: className = '',
    headingLevel = 2,
    tone,
    family,
    region,
    headerRegion,
    role = 'section',
    ordering,
    numbering,
    floatScope,
    id,
  }: Props = $props();

  // ── the numbering tree (design §1/§1.1b) ─────────────────────────────
  // Immutable precondition (§1.2): numbering/floatScope/id are mount-
  // time structural params — a change equals destroy-and-rebuild in
  // real usage, so the component snapshots them and ignores updates
  // (the initial-value capture below is the point, not an accident).
  // svelte-ignore state_referenced_locally
  const frozen = { numbering, floatScope, id };
  const declaresNumbering = frozen.numbering !== undefined;
  if (!declaresNumbering && frozen.floatScope !== undefined && import.meta.env?.DEV !== false) {
    console.warn(
      '[jx/section-card] floatScope without numbering is an invalid shape — ignored (counter scope declares on a numbering root only)',
    );
  }

  // Read the ambient domain BEFORE publishing our own (setContext would
  // shadow the getter otherwise): a declared root nests into the
  // nearest ancestor domain; an undeclared section joins it; a section
  // with no ambient domain stays unnumbered — today's behavior.
  const outerDomain = getContext<NumberingDomain | undefined>(NUMBERING_DOMAIN_KEY);
  const chain = getContext<{ record: SectionRecord; registry: DomainRegistry | undefined } | undefined>(
    SECTION_CHAIN_KEY,
  );
  const domain: NumberingDomain | null = declaresNumbering
    ? createNumberingDomain({ parent: outerDomain ?? null, floatScope: frozen.floatScope })
    : (outerDomain ?? null);

  const record: SectionRecord = frozen.id === undefined ? {} : { id: frozen.id };
  const disposers: (() => void)[] = [];
  let registry: DomainRegistry | undefined;

  if (declaresNumbering && domain) {
    setContext(NUMBERING_DOMAIN_KEY, domain);
    // the route provider's registry; a standalone root without one
    // falls back to a local single-domain registry (independent use
    // still numbers — sibling-root ordinals just cannot see each other)
    registry = domainRegistryFromContext() ?? createDomainRegistry();
    disposers.push(registry.registerDomain(domain));
    disposers.push(domain.registerSection(record)); // the root: parentless
  } else if (domain) {
    // an undeclared descendant inside the domain subtree numbers by
    // structure: parent = the nearest ancestor Section host's record
    registry = domainRegistryFromContext() ?? chain?.registry;
    if (chain?.record) record.parent = chain.record;
    disposers.push(domain.registerSection(record));
  }
  // else: outside every numbering domain — no record, no number

  // publish the record chain for descendants (the structural wire)
  setContext(SECTION_CHAIN_KEY, { record, registry });

  // §1.1c: the ordinal is display currency derived from the revision
  // signal (registration order never assigns ordinals); null when the
  // section sits outside every domain or the chain escapes its root
  const number = $derived(
    domain && registry ? sectionNumber(record, domain, registry) : null,
  );

  // tasks 1.4: register the addressable entry — live accessor thunks
  // over the $derived ordinal and the title prop, never snapshots;
  // silently skipped without a route provider
  const targets = targetRegistryFromContext();
  if (targets && frozen.id !== undefined) {
    disposers.push(
      targets.registerTarget({
        id: frozen.id,
        kind: 'section',
        number: () => number,
        title: () => title,
      }),
    );
  }

  // bind:this time: the record gains its el (the document-order regime)
  // and a declared root attaches (starting the domain's observer; SSR
  // never runs this — the template-order proxy covers the static tree)
  let sectionEl: HTMLElement | undefined = $state();
  $effect(() => {
    const el = sectionEl;
    if (!el) return;
    record.el = el;
    if (declaresNumbering && domain) domain.attachRoot(el);
  });

  // the immutable-params gate: warn once on any post-mount change, then
  // ignore — the frozen snapshot above already sealed the behavior
  let immutableWarned = false;
  $effect(() => {
    const n = numbering; // track the live props
    const f = floatScope;
    const i = id;
    if (immutableWarned) return;
    if (n !== frozen.numbering || f !== frozen.floatScope || i !== frozen.id) {
      immutableWarned = true;
      if (import.meta.env?.DEV !== false) {
        console.warn(
          '[jx/section-card] numbering/floatScope/id are mount-time structural params — post-mount updates are ignored (restructure by remounting)',
        );
      }
    }
  });

  onDestroy(() => {
    for (const dispose of disposers) dispose();
    if (declaresNumbering && domain) domain.dispose();
  });

  // THE DEFAULTS READ POINT (context-defaults-economy 3.3): one line —
  // tone resolves through the family contract (the literal slot: own
  // 'default' declared in SectionCardDefaults, auditable in one place)
  const d = $derived(SectionCardDefaults.resolve({ tone }));

  const titleClassName = $derived(
    d.tone === 'hero'
      ? 'font-nav max-w-[24ch] text-balance text-[clamp(1.58rem,2.55vw,2.7rem)] tracking-normal leading-[1.2] sm:max-w-[22ch] lg:max-w-[24ch]'
      : 'font-nav text-balance text-[1.05rem] tracking-tight leading-tight sm:text-[1.22rem]',
  );
  const summaryClassName = $derived(
    d.tone === 'hero'
      ? 'max-w-[62ch] text-pretty text-[13px] leading-6 text-foreground/78 sm:text-[14px] sm:leading-6'
      : 'max-w-[64ch] text-pretty [font-size:var(--jx-text)] [line-height:var(--jx-line)] text-muted-foreground',
  );
</script>

<section
  data-jx-section
  bind:this={sectionEl}
  class={`border border-border bg-card shadow-2xs ${className}`}
  id={frozen.id}
  data-family={family}
  data-region={region}
  data-role={role}
  data-ordering={ordering}
  data-number={number ?? undefined}
>
  <div
    data-jx-section-header
    class="flex flex-col [gap:calc(var(--jx-stack)_+_var(--jx-unit))] [padding-inline:calc(var(--jx-inset)_+_var(--jx-unit))] [padding-block:calc(var(--jx-stack)_+_var(--jx-unit))]"
    data-region={headerRegion}
  >
    {#if eyebrow}
      <p
        class="font-nav text-primary [font-size:calc(var(--jx-text-secondary)_-_calc(var(--jx-unit)_/_4))] uppercase tracking-[0.24em]"
      >
        {eyebrow}
      </p>
    {/if}
    <div class="flex flex-col [gap:calc(var(--jx-stack)_+_calc(var(--jx-unit)_/_2))]">
      {#if headingLevel === 1 && number}
        <h1 class={titleClassName}><span data-jx-number>{number}</span>{'\u00A0'}{title}</h1>
      {:else if headingLevel === 1}
        <h1 class={titleClassName}>{title}</h1>
      {:else if number}
        <h2 class={titleClassName}><span data-jx-number>{number}</span>{'\u00A0'}{title}</h2>
      {:else}
        <h2 class={titleClassName}>{title}</h2>
      {/if}
      {#if summary}
        <p class={summaryClassName}>{summary}</p>
      {/if}
    </div>
  </div>
  <Separator data-jx-section-sep aria-hidden="true" />
  <div
    data-jx-section-body
    class="[padding-inline:calc(var(--jx-inset)_+_var(--jx-unit))] [padding-block:calc(var(--jx-stack)_+_calc(var(--jx-unit)_*_2))]"
  >
    {@render children()}
  </div>
</section>
