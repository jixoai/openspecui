/**
 * jixoai press-button family Defaults
 * (registry/files/ui/press-button/press-button-defaults.svelte.ts,
 * context-defaults-economy task 2.1, 2026-09-03).
 *
 * The press-button family's SINGLE declared ambient contract (design.md
 * Defaults 定位): one `PressButtonDefaults` object whose slots cover
 * every vocabulary-hit style prop —
 *   - variant: the paint axis slot, own 'outline' (the variant
 *     grammar's frozen table row for PressButton — the five-value
 *     ladder + the link interaction exception). Resolution
 *     `explicit ?? ambient(zone) ?? 'outline'` replaces the retired
 *     inline `variant ?? group?.variant ?? 'outline'` chain: same
 *     values on every path — ONE paint key feeds providers and
 *     consumers alike (single-key law), and the wide values array
 *     keeps PressButton's own explicit 'link' resolving while no
 *     zone lane can ever carry it.
 *   - density: the no-opinion axis slot. The button carries NO
 *     density own: no provider and no explicit prop resolve
 *     undefined, stamp nothing, and the ambient css scope channel
 *     keeps flowing (fleet law).
 *
 * 惰性律: construction captures own/values only; the context reads
 * happen at resolve time inside the consumer's $derived window. This
 * file is a member of the registry:ui item (installs with the family,
 * byte mirrored, zero kernel imports).
 */
import { defineComponentDefaults } from '$lib/defaults.svelte';
import { densitySlot } from '$lib/density.svelte';
import { definePaintSlot } from '$lib/paint.svelte';

/**
 * The family slot, values-first (slot-values-first D1): the five-value
 * tuple IS the family union's source — the const-generic constraint
 * locks it ⊆ the axis's PaintVariant at compile time, and the
 * availability gate asserts it ≡ the frozen table row (bidirectional
 * — 漏值/多值 both fail). The CANONICAL wide union belongs to the
 * paint axis (lib/paint's PaintVariant); press-button.svelte's
 * PressButtonVariant alias points at THIS slot's ReturnType (the
 * family's five values, the declaration point made unique) — F3's
 * lib→ui one-way street keeps ui→lib the only import direction.
 */
// own = the grammar's frozen default, never a local choice
export const pressButtonVariantSlot = definePaintSlot(
  ['fill', 'tonal', 'outline', 'ghost', 'link'],
  'outline',
);

/** the ladder's five values as a type — ReturnType 反查 (the values
 *  tuple above is the union's source; the barrel re-exports this
 *  name) */
export type PressButtonPaintVariant = ReturnType<typeof pressButtonVariantSlot>;

export const PressButtonDefaults = defineComponentDefaults({
  variant: pressButtonVariantSlot,
  density: densitySlot(),
});
