<!--
  jixoai card grid (registry/files/ui/card-grid/card-grid.svelte).
  Ships its OWN IO-driven stagger (Owner ruling, 2026-08-24, rev.2):
  an internal IntersectionObserver arms the entrance when the grid
  enters the viewport; cards then animate on the TIME axis with
  per-index delays — the cascade completes regardless of scroll
  behavior (a scroll-progress-driven range would freeze mid-opacity
  whenever scrolling stops). Independent of — and coexisting with —
  the site's scroll-driven reveal: consumers must NOT wrap cards in
  data-reveal; the grid owns its children's entrance. The hidden state
  keys on html.js (the theme's liveness flag): no-JS and pre-hydration
  stay fully visible.

  A grid + subgrid layout that equalizes cards visually: the grid defines
  two rows (header / body); every direct child spans both and opts into
  `grid-template-rows: subgrid`, so card HEADERS align to one shared
  height and card BODIES share the tallest body — no more ragged card
  tops or unequal card bottoms. The grid NEVER asks what a child is: any
  two-block card qualifies unchanged (first block = header, second =
  body — section-card's structural separator rides its header row's
  bottom edge, so the lines align across the row through the same
  equalized header row the old border-b used).

  THE FOOT MODE (Owner, 2026-09-03): `foot` declares a THIRD shared row
  — headers align, bodies fill, FEET align at the band bottoms — for
  zone-trio cards (the card component: head/body/foot, integer-placed).
  The mode is EXPLICIT, never presence-inferred: mixed spans in one
  grid silently misplace bands (auto-placement packs a span-2 card into
  a span-3 card's third row), so the landlord — not the tenants —
  declares the row contract. Footed cards in the default two-row mode
  overflow their foot into an implicit row: don't.

  The layout rules are on consumer children on purpose: the cards come
  from the consumer's children snippet, so no markup of ours can carry
  their paint (the subgrid law must reach them through the cascade).
  The jx- prefix keeps the global surface safe.

  Responsive: columns are `auto-fit, minmax(min(100%, --jx-grid-min), 1fr)`
  — pass `min` to control the collapse width. The default 320px is tuned
  for the 90rem page column: two equal columns through the laptop band
  (~60–64rem containers, so 4-card groups land 2×2 instead of a ragged
  3+1) while desktop (~86rem+) keeps four columns. A lone child would
  stretch into a full-width banner (auto-fit collapses every empty
  track), so it is capped at an editorial measure. Cards without subgrid
  support fall back to ordinary stacked rows (no worse than before).

  tw4 (2026-08-24): the grid container's own paint rides utilities;
  every rule that reaches the consumer-authored children (subgrid laws,
  the only-child cap, the entrance state machine) stays in
  card-grid.css — D1-exempt residue.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { cn } from '$lib/utils';
  import './card-grid.css';

  interface Props {
    /** Minimum column width before the grid collapses a column. */
    min?: string;
    /** Declare the THIRD shared row (head/body/FOOT equalization) for
        zone-trio cards — explicit, never inferred from the children. */
    foot?: boolean;
    class?: string;
    children: import('svelte').Snippet;
  }

  let { min = '320px', foot = false, class: className = '', children }: Props = $props();

  let gridEl = $state<HTMLElement | null>(null);

  // the internal entrance: ONE observer on the grid; the first
  // intersection arms .is-entered and the CSS time-cascade takes over
  onMount(() => {
    const grid = gridEl;
    if (!grid) return;
    const reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || typeof IntersectionObserver === 'undefined') {
      grid.classList.add('is-entered');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            grid.classList.add('is-entered');
            io.disconnect();
          }
        }
      },
      { threshold: 0 },
    );
    io.observe(grid);
    return () => io.disconnect();
  });
</script>

<div
  class={cn(
    'jx-card-grid grid grid-cols-[repeat(auto-fit,minmax(min(100%,var(--jx-grid-min)),1fr))] gap-5 items-stretch',
    className,
  )}
  style="--jx-grid-min: {min}"
  data-rows={foot ? 'foot' : undefined}
  bind:this={gridEl}
>
  {@render children()}
</div>
