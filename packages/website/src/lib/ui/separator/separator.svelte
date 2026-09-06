<!--
  jixoai separator (registry/files/ui/separator/separator.svelte).
  W3C-first: the horizontal separator IS <hr> — native semantics, native
  styling, zero ARIA. Only the vertical posture has no native element, so
  it takes the ARIA route: <div role="separator" aria-orientation>.

  The INK law (Owner ruling, 2026-09-01): a separator paints no COLOR —
  border-color is for borders, not for separators. The default ink is
  the backdrop's own CONTRAST GHOST: a backdrop-filter: contrast(0.5)
  strip reads as a tonal shift over ANY ground (near-black lifts toward
  mid, near-white dims — auto-adaptive, theme-agnostic, zero color
  tokens). Shaped variants — dashed (6/4), dense (3/3), dotted, wavy —
  are MASKS over the same contrast strip: one ink engine, many
  geometries. The fade variant rides the BLEND engine instead: an
  alpha-ramped white gradient under mix-blend-mode: difference inverts
  the backdrop toward mid — transparent → light → dark → light →
  transparent, visible on any ground (peak alpha capped at 0.6; an
  exact 50% backdrop is difference's blind spot — separator.css
  documents the math). Orientation swaps the mask axis
  (the vertical posture reads the same laws top-to-bottom).

  Length stays the consumer's job (block horizontal / inline-block
  vertical — width/height via the class prop or the parent's layout);
  the ink engine (backdrop-filter, mask data-URIs, blend) lives in
  separator.css — utilities cannot express it (the D1-exempt law).
-->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';
  import { SeparatorDefaults, type SeparatorVariant } from './separator-defaults.svelte';
  import './separator.css';

  interface Props extends HTMLAttributes<HTMLHRElement> {
    orientation?: 'horizontal' | 'vertical';
    /** the ink geometry: masks over the contrast ghost, or the blend
     *  engine for fade (transparent → light → dark → light →
     *  transparent); omitted → the contract own 'line'
     *  (SeparatorDefaults — a declared own, not ambient) */
    variant?: SeparatorVariant;
  }

  let { orientation = 'horizontal', variant, class: className = '', ...rest }: Props =
    $props();

  // the family Defaults is the single read point (context-defaults-
  // economy 3.2): the ink geometry rides its literal slot (own
  // 'line'); density is the no-opinion slot — nothing stamps, the
  // ambient css scope channel keeps flowing
  const d = $derived(SeparatorDefaults.resolve({ variant }));
</script>

{#if orientation === 'vertical'}
  <!-- component-owned semantics land AFTER the spread: role/aria here
       are not overridable — the separator contract is the component's -->
  <div
    data-jx-separator={d.variant}
    data-orientation="vertical"
    class={cn('inline-block self-stretch flex-none', className)}
    {...(rest as HTMLAttributes<HTMLDivElement>)}
    role="separator"
    aria-orientation="vertical"
  ></div>
{:else}
  <hr
    data-jx-separator={d.variant}
    data-orientation="horizontal"
    class={cn('flex-none m-0 border-0', className)}
    {...rest}
  />
{/if}
