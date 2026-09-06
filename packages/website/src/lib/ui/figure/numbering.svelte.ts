/**
 * jixoai figure/numbering — the R2 line-primitive interface module
 * (document-ontology R2, batch 0, frozen per design §1.2).
 *
 * THE CONTRACT this module owns (batch 0 of the change's task graph —
 * the integrator lands it and freezes it; batches 1/2/3 consume it
 * without modification):
 *
 *   1. TargetRegistry — the route-page-scoped document target
 *      registry (Reference resolution walks it; never the paint or
 *      physics keys). One instance per route page, created by the
 *      page-root provider; dies with the page (no prior-page leaks).
 *   2. NumberingDomain / DomainRegistry — the two-phase counter
 *      domains (Owner rulings Q3–Q8 + Codex rounds; setContext runs
 *      BEFORE template DOM exists, so the factory takes no root —
 *      attachRoot(el) lands at bind:this time, and SSR never calls
 *      it: the template-order proxy orders the static tree, which is
 *      identical to compareDocumentPosition until the first DOM
 *      mutation, so hydration's first frame stays SSR-consistent).
 *
 * Laws this module enforces by construction:
 *   - REGISTRATION ORDER NEVER ASSIGNS ORDINALS. Consumers derive
 *     ordinals from the revision signal + compareDocumentPosition
 *     (§1.1(b)); this module exposes the records and the revision,
 *     never an assigned number.
 *   - Numbers/titles register as accessor thunks (read-on-call,
 *     reactive inside $derived) — never registration-time snapshots.
 *   - Disposers are idempotent; duplicate ids warn in dev with the
 *     FIRST live registration the winner; a disposing winner
 *     promotes the earliest still-live candidate in the same settle.
 */
import { getContext } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';

export type FigureKind = 'figure' | 'table' | 'equation' | 'listing';

/** the single-source display words: caption (full) / reference (short) */
export const FIGURE_LABELS: Record<FigureKind, { caption: string; reference: string }> = {
  figure: { caption: 'Figure', reference: 'Fig' },
  table: { caption: 'Table', reference: 'Table' },
  equation: { caption: 'Equation', reference: 'Eq' },
  listing: { caption: 'Listing', reference: 'Listing' },
};

export const NUMBERING_DOMAIN_KEY = Symbol.for('jx-numbering-domain');
export const DOCUMENT_TARGETS_KEY = Symbol.for('jx-document-targets');
export const DOCUMENT_DOMAINS_KEY = Symbol.for('jx-document-domains');

// ── the target registry (Reference resolution) ─────────────────────

export type FigureTargetEntry = {
  id: string;
  kind: 'figure';
  figureKind: FigureKind;
  readonly number: () => string;
  readonly title: null;
};

export type SectionTargetEntry = {
  id: string;
  kind: 'section';
  readonly number: () => string | null;
  readonly title: () => string;
};

export type TargetEntry = FigureTargetEntry | SectionTargetEntry;

export interface TargetRegistry {
  registerTarget(entry: TargetEntry): () => void;
  getTarget(id: string): TargetEntry | undefined;
}

export function createTargetRegistry(): TargetRegistry {
  // same-id candidates in registration order; the winner is the
  // first LIVE entry and promotion on dispose is earliest-still-live
  const entries = new SvelteMap<string, TargetEntry[]>();

  const disposer = (id: string, entry: TargetEntry) => {
    let gone = false;
    return () => {
      if (gone) return; // idempotent
      gone = true;
      const list = entries.get(id);
      if (!list) return;
      const at = list.indexOf(entry);
      if (at >= 0) list.splice(at, 1);
      if (list.length === 0) entries.delete(id);
    };
  };

  return {
    registerTarget(entry) {
      const list = entries.get(entry.id);
      if (list && list.length > 0 && import.meta.env?.DEV !== false) {
        // winner keeps the slot; the candidate stays live for promotion
        console.warn(
          `[jx/numbering] duplicate target id "${entry.id}" — the first live registration wins; this one waits for promotion`,
        );
      }
      if (list) list.push(entry);
      else entries.set(entry.id, [entry]);
      return disposer(entry.id, entry);
    },
    getTarget(id) {
      const list = entries.get(id);
      return list && list.length > 0 ? list[0] : undefined;
    },
  };
}

/** consumers read the route-page instance; the page-root provider sets it */
export function targetRegistryFromContext(): TargetRegistry | undefined {
  return getContext<TargetRegistry>(DOCUMENT_TARGETS_KEY);
}

// ── the numbering domains (Section's counter machinery) ─────────────

export interface SectionRecord {
  el?: Element;
  id?: string;
  /**
   * the structural parent's record — the component-tree parent, which
   * IS the nearest ancestor Section host in both regimes (SSR has no
   * DOM; the record chain is the template-order proxy of the el
   * chain). A domain's unique parentless record is its root.
   */
  parent?: SectionRecord | null;
}

export interface FigureRecord {
  el?: Element;
  kind: FigureKind;
  id?: string;
}

export interface NumberingDomain {
  /** lands the domain root at bind:this time (idempotent; SSR never calls) */
  attachRoot(el: Element): void;
  registerSection(rec: SectionRecord): () => void;
  registerFigure(rec: FigureRecord): () => void;
  /** the in-domain revision signal — bumped only by the root observer */
  readonly domainRevision: number;
  /** undefined until attachRoot — the template-order proxy covers SSR */
  readonly root: Element | undefined;
  readonly parent: NumberingDomain | null;
  readonly floatScope: Partial<Record<FigureKind, 'chapter' | 'document'>>;
  /** the records consumers derive ordinals from (order never assigned) */
  readonly sections: readonly SectionRecord[];
  readonly figures: readonly FigureRecord[];
  /** the owning Section's teardown — disconnects the root observer */
  dispose(): void;
}

export function createNumberingDomain(opts: {
  parent: NumberingDomain | null;
  floatScope?: Partial<Record<FigureKind, 'chapter' | 'document'>>;
}): NumberingDomain {
  const sections: SectionRecord[] = [];
  const figures: FigureRecord[] = [];
  // the revision is the ONLY reactive ordinal signal (§1.1(b)): the
  // root observer bumps it; consumers' $derived read it and re-sort
  // the records by compareDocumentPosition (never by list order)
  let domainRevision = $state(0);
  let root: Element | undefined;
  let observer: MutationObserver | undefined;

  const bump = () => {
    domainRevision++;
  };

  const register = <T>(list: T[], rec: T) => {
    list.push(rec);
    bump(); // membership is part of the in-domain signal surface
    let gone = false;
    return () => {
      if (gone) return;
      gone = true;
      const at = list.indexOf(rec);
      if (at >= 0) list.splice(at, 1);
      bump();
    };
  };

  return {
    attachRoot(el) {
      if (root === el) return; // idempotent for the same root
      if (root !== undefined) return; // one root per domain, by law
      root = el;
      if (typeof MutationObserver !== 'undefined') {
        observer = new MutationObserver(bump);
        observer.observe(el, { childList: true, subtree: true });
      }
    },
    registerSection: (rec) => register(sections, rec),
    registerFigure: (rec) => register(figures, rec),
    get domainRevision() {
      return domainRevision;
    },
    get root() {
      return root;
    },
    parent: opts.parent,
    floatScope: opts.floatScope ?? {},
    sections,
    figures,
    dispose() {
      observer?.disconnect();
      observer = undefined;
    },
  };
}

// ── the document-level domain registry ─────────────────────────────

export interface DomainRegistry {
  registerDomain(domain: NumberingDomain): () => void;
  readonly domains: readonly NumberingDomain[];
  /** bumped only by the route provider's document-level observer */
  readonly documentRevision: number;
  /** provider-only: the observer's bump inlet (SSR stays at 0) */
  notifyDocumentMutation(): void;
}

export function createDomainRegistry(): DomainRegistry {
  const domains: NumberingDomain[] = [];
  let documentRevision = $state(0);
  return {
    registerDomain(domain) {
      domains.push(domain);
      documentRevision++;
      let gone = false;
      return () => {
        if (gone) return;
        gone = true;
        const at = domains.indexOf(domain);
        if (at >= 0) domains.splice(at, 1);
        documentRevision++;
      };
    },
    get domains() {
      return domains;
    },
    get documentRevision() {
      return documentRevision;
    },
    notifyDocumentMutation() {
      documentRevision++;
    },
  };
}

/** consumers read the route-page instance; the page-root provider sets it */
export function domainRegistryFromContext(): DomainRegistry | undefined {
  return getContext<DomainRegistry>(DOCUMENT_DOMAINS_KEY);
}

// ── pure ordinal derivation (§1.1/§1.1b — computed structure ships
//    logic, not markup; consumers run these inside $derived) ─────────
//
// The proxy law: when EVERY record in the compared set carries an
// attached el, ordinals derive from compareDocumentPosition; the
// moment any record is unattached (SSR, pre-attach), the set falls
// back to list order — which equals template order, which equals
// static DOM order (first-frame consistency's source). Registration
// order is never the SOURCE of truth in the DOM-present regime.

const documentOrder = (a: { el?: Element }, b: { el?: Element }): number => {
  if (a === b) return 0;
  const pos = a.el!.compareDocumentPosition(b.el!);
  return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
};

const sorted = <T extends { el?: Element }>(list: readonly T[]): T[] => {
  const copy = [...list];
  if (copy.length > 1 && copy.every((r) => r.el)) copy.sort(documentOrder);
  return copy;
};

const ordinalOf = <T extends { el?: Element }>(list: readonly T[], rec: T): number =>
  sorted(list).indexOf(rec) + 1;

/** the owning domain's chapter ordinal — top-level domains only; a
 *  nested domain root always renders its local restart (1) */
export function domainOrdinal(domain: NumberingDomain, registry: DomainRegistry): number {
  void registry.documentRevision; // the signal read (invalidates on root moves)
  if (domain.parent !== null) return 1;
  const topLevel = [...registry.domains.filter((d) => d.parent === null)];
  const rootEl = (d: NumberingDomain) => d.sections.find((s) => !s.parent)?.el;
  if (topLevel.length > 1 && topLevel.every((d) => rootEl(d))) {
    topLevel.sort((a, b) =>
      rootEl(a)!.compareDocumentPosition(rootEl(b)!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1,
    );
  }
  return topLevel.indexOf(domain) + 1; // identity on the domain object itself
}

export interface FigureOrdinal {
  scope: 'chapter' | 'document';
  /** the 1-based position in its counting set */
  ordinal: number;
  /** the owning domain's top-level ordinal (the chapter prefix) */
  domainOrdinal: number;
}

export function figureOrdinal(
  record: FigureRecord,
  domain: NumberingDomain,
  registry: DomainRegistry,
): FigureOrdinal {
  const scope: 'chapter' | 'document' =
    domain.floatScope[record.kind] === 'document' ? 'document' : 'chapter';
  if (scope === 'chapter') {
    void domain.domainRevision; // the signal read
    const peers = domain.figures.filter((f) => f.kind === record.kind);
    return { scope, ordinal: ordinalOf(peers, record), domainOrdinal: domainOrdinal(domain, registry) };
  }
  // document scope: iterate EVERY participating domain (top-level and
  // nested alike — each declares its own participation), collect that
  // kind's records, and order the UNION by document position (never
  // domain-list order: F1, F2, F3 — not F1, F3, F2)
  void registry.documentRevision; // the signal read
  const peers = registry.domains
    .filter((d) => d.floatScope[record.kind] === 'document')
    .flatMap((d) => d.figures.filter((f) => f.kind === record.kind));
  return { scope, ordinal: ordinalOf(peers, record), domainOrdinal: domainOrdinal(domain, registry) };
}

/** §1.1b's sole algorithm — the root gets its domain ordinal (nested
 *  roots restart at 1); descendants walk the parent chain: root +
 *  '.' + sibling ordinals per level (3 → 3.2 → 3.2.1). A bare or
 *  unnumbered context yields null (never invents a number). */
export function sectionNumber(
  record: SectionRecord,
  domain: NumberingDomain,
  registry: DomainRegistry,
): string | null {
  void domain.domainRevision;
  void registry.documentRevision; // the signal reads
  const root = domain.sections.find((s) => !s.parent);
  if (root === record) {
    return String(domainOrdinal(domain, registry));
  }
  if (!root || !record.parent) return null; // orphaned — no path to the root
  const path: number[] = [];
  let cursor: SectionRecord | undefined = record;
  while (cursor && cursor !== root) {
    const siblings = domain.sections.filter((s) => s.parent === cursor!.parent);
    path.unshift(ordinalOf(siblings, cursor));
    cursor = cursor.parent ?? undefined;
  }
  if (cursor !== root) return null; // chain escaped the domain — illegal shape
  return `${domainOrdinal(domain, registry)}.${path.join('.')}`;
}
