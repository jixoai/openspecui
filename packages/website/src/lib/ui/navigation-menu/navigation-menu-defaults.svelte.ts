/**
 * jixoai navigation-menu family Defaults
 * (registry/files/ui/navigation-menu/navigation-menu-defaults.svelte.ts,
 * context-defaults-economy task 3.3, 2026-09-03).
 *
 * The navigation-menu family's SINGLE declared ambient contract
 * (design.md Defaults 定位): one `NavigationMenuDefaults` object whose
 * slots cover every vocabulary-hit style prop —
 *   - density: the no-opinion axis slot. The bar is a STRUCTURAL
 *     provider (the panel registry + the roving walk) whose density
 *     lane is inherit-then-provide by the frozen provider duties (the
 *     eager captures in navigation-menu.svelte feed provideDensity;
 *     the legacy reads stay confined there). The contract carries NO
 *     own: no provider and no explicit prop resolve undefined, stamp
 *     nothing, and the nav rides the AMBIENT css scope (fleet law +
 *     the chrome-density-tier stamping law).
 *   - variant: the LITERAL family (own 'auto') — the floating-surface
 *     paint, the same grammar as the dialog and sheet families
 *     (classification b: declared own, no axis yet; a surface axis
 *     would first have to freeze the union). The slot resolves
 *     `explicit ?? own` and never reads context.
 *   - inset: the OPEN-domain literal family (own 0) on the indicator —
 *     a per-edge px measure of the hug box, classification b over a
 *     free numeric domain (the sheet size slot's number sibling,
 *     defineOpenSlot): breathing inside the entry is a declared
 *     decision, never a guessed constant.
 *
 * 惰性律: construction captures own only; context reads happen at
 * resolve time inside the consumer's $derived window. This file is a
 * member of the registry:ui item (installs with the family, byte
 * mirrored, zero kernel imports).
 */
import { defineComponentDefaults, defineLiteralSlot, defineOpenSlot } from '$lib/defaults.svelte';
import { densitySlot } from '$lib/density.svelte';

export const navigationMenuSurfaceVariantSlot = defineLiteralSlot(['solid', 'acrylic', 'auto'], 'auto');

/** the OPEN-domain form ([B1]: a per-edge px measure is a free number,
 *  no closed union to enumerate) — the explicit type argument is the
 *  only enforcement face (NoInfer + = never, the absentSlot
 *  discipline); the day a size axis closes the union this slot
 *  migrates back to the values form */
export const navigationMenuInsetSlot = defineOpenSlot<number>(0);

/**
 * The floating-surface paint variant — the family grammar, single-sourced
 * here (navigation-menu.svelte's Props and this contract share the one
 * union; the dialog and sheet families declare their own same-shaped
 * unions). ReturnType 反查 — the slot's values tuple is the union's
 * source.
 */
export type NavigationMenuSurfaceVariant = ReturnType<typeof navigationMenuSurfaceVariantSlot>;

export const NavigationMenuDefaults = defineComponentDefaults({
  density: densitySlot(),
  variant: navigationMenuSurfaceVariantSlot,
  inset: navigationMenuInsetSlot,
});
