<!--
  jixoai NavigationMenuIndicator
  (registry/files/ui/navigation-menu/navigation-menu-indicator.svelte,
  2026-09-01).
  The OPTIONAL sliding-active part of the navigation-menu family — the
  indicator technology sunk OUT of the site chrome (TerminalHeader kept
  a private copy because the family offered no surface to hang it on).
  Render it as a child of <NavigationMenu>; it measures the bar's
  current entry — [data-jx-navmenu-link][aria-current="page"] or
  [data-jx-navmenu-trigger][aria-current="true"], NEVER an entry inside
  an open [popover] panel (mega links carry their own current truth)
  and never one owned by a NESTED plain <nav> (Codex P2, 2026-09-02:
  an inline panel's nav is its own current truth — see ownedEntry) —
  and slides to it.

  TWO motion laws (Owner ruling, 2026-09-01 — the offering, not a
  default):

    motion="navigation" (default)  for PAGE-LEVEL nav under View
      Transitions: the indicator carries a view-transition-name, so a
      same-named element on the next document morphs across the
      navigation (the app owns the transition wiring — SvelteKit
      onNavigate startViewTransition, or cross-document VT). A stamped
      name is INERT when no transition ever runs. Same-document entry
      moves still animate (WAAPI below) — the two laws compose.

    motion="waapi"                  for apps with NO View Transitions:
      pure Web Animations API sliding, no view-transition-name — the
      nav never pays for a name it does not use.

  The WAAPI engine (both modes): one element, measured geometry
  (offsetLeft/offsetTop — layout coords, scroll/RTL-safe), animated
  between the previous and next box on entry changes; the FIRST
  placement, resize/font-driven remeasures and prefers-reduced-motion
  JUMP instead of animating. Two interrupt laws (2026-09-02): a
  mid-flight slide is re-anchored from its CURRENT computed frame
  (never the stale previous target), and a RUNNING View Transition
  suppresses the overlay entirely (the morph carries the motion — see
  the B-1 note in measure()). Repaint triggers are DOM-delegated (the
  part owns no nav data): an aria-current+childList MutationObserver
  (late-mounted current entries get their settling measure), a
  ResizeObserver on the bar, and fonts.ready. jsdom (no WAAPI, no RO)
  degrades to direct style writes — everything stays truthful.

  The part stamps position:relative on its bar (idempotent) so the
  entries' offsetParent and the indicator's containing block agree.
  Default paint: the restrained tonal fill (tabs-pill dialect,
  ink-inverting through tokens); the class seam carries site chrome
  (e.g. a backdrop-filter brightness pill over a dark bezel).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { cn } from '$lib/utils';
  import { NavigationMenuDefaults } from './navigation-menu-defaults.svelte';

  interface Props {
    /** the motion law: 'navigation' stamps a view-transition-name for
        page-level morphs under View Transitions (inert without them);
        'waapi' is the pure Web Animations path — no name, no cost */
    motion?: 'navigation' | 'waapi';
    /** the view-transition-name under motion="navigation"
        (one page-level indicator per name) */
    name?: string;
    /** slide duration in ms (reduced-motion ignores it) */
    duration?: number;
    /** the slide's timing curve */
    easing?: string;
    /** hug inset per edge, px — DEFAULT 0: the indicator spans the
        measured entry exactly (it IS the entry's active background).
        Breathing inside the entry is a declared decision, never a
        guessed constant — a consumer states the number it designed */
    inset?: number;
    class?: string;
  }

  let {
    motion = 'navigation',
    name = 'jx-nav-indicator',
    duration = 240,
    easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)',
    inset,
    class: className = '',
  }: Props = $props();

  // THE DEFAULTS READ POINT (context-defaults-economy 3.3): one line —
  // inset resolves through the family contract (the literal slot: own
  // 0 declared in NavigationMenuDefaults, auditable in one place; the
  // sheet size slot's number sibling)
  const d = $derived(NavigationMenuDefaults.resolve({ inset }));

  let indEl = $state<HTMLSpanElement | null>(null);

  /** the bar this part renders in: the nearest nav — or, when composed
   *  into chrome AROUND the family (TerminalHeader's pill box hosts the
   *  part beside the consumer's nav), the immediate parent box */
  const barEl = (): HTMLElement | null => indEl?.closest('nav') ?? indEl?.parentElement ?? null;

  /** the current DIRECT entry of THIS bar — mega-panel links (inside a
   *  [popover]) carry their own current truth and never steal the bar's
   *  indicator (the TerminalHeader law, verbatim) */
  function currentEntry(): HTMLElement | null {
    const bar = barEl();
    if (!bar) return null;
    return (
      [...bar.querySelectorAll<HTMLElement>(
        '[data-jx-navmenu-link][aria-current="page"], [data-jx-navmenu-trigger][aria-current="true"]',
      )].find((el) => el.closest('[popover]') === null && ownedEntry(el, bar)) ?? null
    );
  }

  /** OWNED-nav scoping (Codex P2, 2026-09-02): the [popover] exclusion
   *  alone let a nested plain <nav> inside an INLINE panel leak its
   *  aria-current links to the outer bar. The family root's walk scope
   *  is nav-identity (navigation-menu.svelte navTriggers:
   *  closest('nav') === navEl); this bar may also be a CHROME BOX
   *  (the TerminalHeader pill — the consumer nav lands inside it), so
   *  ownership is the shape-aware form: the entry's nearest nav must be
   *  the bar's SINGLE nav layer — the bar itself, or a nav with no
   *  further nav between it and the bar. A deeper chain means an inner
   *  nav owns that link's current truth (nested panels, footers). */
  function ownedEntry(el: HTMLElement, bar: HTMLElement): boolean {
    const nav = el.closest('nav');
    if (nav === null || nav === bar) return true;
    if (!bar.contains(nav)) return false;
    const outer = nav.parentElement?.closest('nav') ?? null;
    return outer === null || !bar.contains(outer);
  }

  type Geo = { x: number; y: number; w: number; h: number };
  let prev: Geo | null = null;
  let first = true;
  /** the in-flight WAAPI slide (B-3, 2026-09-02): kept so an interrupt
   *  can cancel it — its fill would keep repainting the stale target */
  let running: Pick<Animation, 'cancel'> | null = null;

  /** the mid-flight frame off the computed style: the live 2D matrix
   *  (tx/ty) + the animated box. Engines resolving no matrix (jsdom
   *  echoes the authored translate, never a matrix) yield null — the
   *  caller stands on the previous target */
  function snapshotFlight(ind: HTMLElement): Geo | null {
    const cs = getComputedStyle(ind);
    const m = /^matrix\(([^)]*)\)$/.exec(cs.transform);
    const w = parseFloat(cs.width);
    const h = parseFloat(cs.height);
    if (!m || !Number.isFinite(w) || !Number.isFinite(h)) return null;
    const t = m[1].split(',').map((v) => Number(v.trim()));
    if (t.length < 6 || t.some((v) => !Number.isFinite(v))) return null;
    return { x: t[4], y: t[5], w, h };
  }

  function measure(animate: boolean) {
    const bar = barEl();
    const ind = indEl;
    if (!bar || !ind) return;
    const entry = currentEntry();
    if (!entry) {
      running?.cancel();
      running = null;
      ind.style.opacity = '0';
      prev = null;
      return;
    }
    // clamped at 0: a degenerate box (jsdom's zero layout) still writes
    // a legal style instead of a dropped negative one
    const next: Geo = {
      x: entry.offsetLeft + d.inset,
      y: entry.offsetTop + d.inset,
      w: Math.max(0, entry.offsetWidth - d.inset * 2),
      h: Math.max(0, entry.offsetHeight - d.inset * 2),
    };
    const reduce =
      typeof matchMedia === 'function' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches;
    // B-3 (2026-09-02): a fast second flip interrupts the slide — the
    // honest `from` is the flight's CURRENT frame, not the previous
    // target (jump-to-target-then-slide-back reads as a glitch).
    // Snapshot BEFORE cancel (a cancelled animation stops contributing;
    // computed style falls back to the stale underlying target) and
    // BEFORE the restyle below (after it, computed reads the NEW box)
    let from: Geo | null = prev;
    if (running) {
      from = snapshotFlight(ind) ?? prev;
      running.cancel();
      running = null;
    }
    // B-1 (2026-09-02; probe .agents/scripts/probe-vt-waapi.mjs, real
    // Chromium): under motion="navigation" SvelteKit's onNavigate flips
    // aria-current INSIDE the VT updateCallback, so the MO below fires
    // in that window (log: updateCallback-start → mo-fired →
    // updateCallback-end; document.activeViewTransition non-null there)
    // and capture-new would snapshot the overlay's t≈0 frame — the
    // morph degenerates to a static indicator. While a VT runs, SKIP
    // the overlay: the style writes below land the NEW box before the
    // capture and the VT morph itself carries the motion (jsdom has no
    // activeViewTransition — the gate is inert there)
    const inVT =
      (document as Document & { activeViewTransition?: unknown }).activeViewTransition != null;
    // the style lands immediately; a legal move paints an animation OVER
    // it — the element is never left mid-flight if WAAPI is missing
    ind.style.opacity = '1';
    ind.style.width = `${next.w}px`;
    ind.style.height = `${next.h}px`;
    ind.style.transform = `translate(${next.x}px, ${next.y}px)`;
    if (animate && !first && !reduce && !inVT && from && typeof ind.animate === 'function') {
      running = ind.animate(
        [
          {
            transform: `translate(${from.x}px, ${from.y}px)`,
            width: `${from.w}px`,
            height: `${from.h}px`,
          },
          {
            transform: `translate(${next.x}px, ${next.y}px)`,
            width: `${next.w}px`,
            height: `${next.h}px`,
          },
        ],
        { duration, easing },
      );
    }
    prev = next;
    first = false;
  }

  // stamp the bar as the measuring box (idempotent — a bar already
  // positioned by its chrome keeps its own box)
  $effect(() => {
    const bar = barEl();
    if (bar && getComputedStyle(bar).position === 'static') {
      bar.style.position = 'relative';
    }
    measure(false);
  });

  // DOM-delegated repaint triggers: route swaps flip aria-current; box
  // resizes and late font loads shift geometry — all remeasure QUIETLY.
  // childList too (B-6, 2026-09-02): a current entry mounted AFTER the
  // bar measured (hydration order) carries its aria-current ready-made —
  // attributeFilter never fires for a brand-new node, so the insertion
  // itself is the settling measure. The childList arm is RELEVANCE-
  // FILTERED (CR-1 P3-4, 2026-09-02): the nav subtree mutates for
  // reasons that never move the current entry (badges, labels), and an
  // unfiltered observe cancelled the in-flight animation on every one
  // of them — only a mutation that touches the current entry's box
  // (its own insertion, or an insertion inside it) may remeasure
  onMount(() => {
    const bar = barEl();
    if (!bar) return;
    const touchesCurrent = (muts: MutationRecord[]): boolean =>
      muts.some((m) => {
        if (m.type === 'attributes') return true; // an aria-current flip
        const current = currentEntry();
        if (current && (m.target === current || current.contains(m.target as Node))) return true;
        return [...m.addedNodes].some(
          (n) => n instanceof HTMLElement && (n.hasAttribute('aria-current') || !!n.querySelector('[aria-current]')),
        );
      });
    const mo = new MutationObserver((muts) => {
      if (touchesCurrent(muts)) measure(true);
    });
    mo.observe(bar, { subtree: true, childList: true, attributeFilter: ['aria-current'] });
    const ro =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => measure(false));
    ro?.observe(bar);
    document.fonts?.ready.then(() => measure(false)).catch(() => {});
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  });
</script>

<span
  bind:this={indEl}
  data-jx-navmenu-ind=""
  data-motion={motion}
  aria-hidden="true"
  class={cn(
    'pointer-events-none absolute top-0 left-0 z-0 opacity-0 rounded-[calc(var(--radius)-2px)] bg-[color-mix(in_oklab,var(--jx-tonal)_14%,transparent)]',
    className,
  )}
  style={motion === 'navigation' ? `view-transition-name: ${name};` : undefined}
></span>
