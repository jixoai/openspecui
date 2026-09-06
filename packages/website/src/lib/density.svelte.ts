/**
 * jixoai density context (registry/files/lib/density.svelte.ts,
 * design-language-kernel §2, 2026-08-26).
 *
 * The Svelte channel of the two-channel density contract: policy
 * resolution ONLY — no pixels, no style writes, no cn(). Providers
 * wrap this once (getter-backed, one stable object); consumers
 * resolve their OPINION (`explicit ?? inherited ?? local fallback`)
 * and stamp `data-density` ONLY when one exists — no opinion stamps
 * NOTHING so the css scope channel (ambient [data-density]
 * ancestors, the root default) keeps flowing through the subtree
 * (fleet law 2026-08-28, generalizing the chrome-density-tier nav
 * ruling: a manufactured 'default' stamp re-scopes the element and
 * cuts off ambient inheritance). The css scope channel lives in the
 * theme sheet.
 */

import { getContext, setContext } from 'svelte';
import { getContextPlugins, defineContextDef, type ContextDef } from './context-plugin.svelte';
import { defineAxisSlot, type DefaultsSlot } from './defaults.svelte';

export type Density = 'lg' | 'default' | 'sm' | 'xs' | '2xs';

export const DEFAULT_DENSITY: Density = 'default';

export interface DensityContext {
  /** the inherited OPINION — undefined means this provider passes NO
      opinion down (chrome-density-tier r3, Codex r2 P1): consumers'
      resolveDensity chains treat it exactly like a missing context,
      so a chrome-composed bar never manufactures an inherited
      opinion; the getter keeps the pair reactive under rerenders */
  readonly density: Density | undefined;
}

export const DENSITY_KEY = Symbol('jx-density');

/**
 * The density def — the identity object plugins target
 * (context-plugin-v2 D2). A factory product of the kernel this
 * module now imports directly (the mirror law holds: both trees
 * resolve './context-plugin.svelte' at the same relative position;
 * the registry item's install completeness rides its declared
 * dependency). The value type carries the FULL resolution domain —
 * `Density | undefined` (D1/A1): a no-opinion resolution flows
 * through the hooks as undefined (the fleet law — a plugin must not
 * manufacture a stamp), so the hook author and the apply site see
 * the same truth.
 */
export const DENSITY_DEF: ContextDef<'density', Density | undefined> = defineContextDef({
  key: 'density',
  defaults: (): Density | undefined => DEFAULT_DENSITY,
  ssrSafe: DEFAULT_DENSITY,
});

export function resolveDensity(
  explicit: Density | undefined,
  inherited: DensityContext | undefined,
  fallback?: Density,
): Density | undefined {
  // explicit -> inherited -> optional LOCAL fallback. No opinion
  // resolves to undefined: the consumer stamps nothing and the
  // ambient css scope channel flows through (a local fallback, when
  // given, is a real opinion — e.g. Table defaults sm only when NO
  // parent provider exists)
  const resolved = explicit ?? inherited?.density ?? fallback;
  // the plugin entry: the chained projection of the terminal value.
  // Reading the scope here (inside the consumer's $derived) keeps the
  // chain reactive — filter/before hooks that read env (e.g. the
  // medium) re-run the resolution when the medium flips. The scope's
  // chain was composed once at its plugin root; this is a lookup, not
  // a recomposition. No scope / no targeting plugin → identity fast
  // path: no hook runs, the reference passes through untouched.
  // (D3-C: the window is a hard contract — outside component
  // initialisation Svelte's own lifecycle_outside_component
  // propagates, never caught, never normalized.)
  const scope = getContextPlugins();
  if (scope === undefined) return resolved;
  return scope.apply(DENSITY_DEF, resolved);
}

export function getDensityContext(): DensityContext | undefined {
  return getContext<DensityContext | undefined>(DENSITY_KEY);
}

export function provideDensity(density: () => Density | undefined): DensityContext {
  const context: DensityContext = {
    get density() {
      return density();
    },
  };
  setContext(DENSITY_KEY, context);
  return context;
}

// ---- the density axis slot (context-defaults-economy task 1.2) ---------
// The Defaults seam's density half: `explicit ?? ambient ?? own ??
// undefined` wrapping resolveDensity's FULL semantics — the plugin
// chain rides the terminal value, and a no-opinion resolution stays
// undefined (the fleet law: no stamp, the ambient css scope channel
// keeps flowing). Construction captures only own (惰性律); the
// ambient read is this module's closure-held getter, lazily
// evaluated at resolve time inside the consumer's window (the hard
// window contract, D3-C — the read runs only where it is legal). A
// family's local fallback (Table's 'sm', ghostty-term's 'default')
// declares as the own argument, never an inline component fallback.
// Density is a closed five-value union (2xs joined 2026-09-05-density-2xs:
// opt-in pro-tool rung, never a default) with no family narrowing, so
// the slot is deliberately non-generic (the gate's explicit-type-
// argument rule exempts it).

/**
 * The ambient density read for the slot's resolver — the
 * closure-held getter protocol (lazy, getter-endorsed so reads land
 * in the consumer's $derived dependency graph; the hard window
 * contract means the read runs only inside a component window,
 * where it is always legal).
 */
function ambientDensity(): DensityContext | undefined {
  return getContext<DensityContext | undefined>(DENSITY_KEY);
}

/**
 * The density axis slot: `explicit ?? ambient ?? own ?? undefined`
 * (resolveDensity's full semantics, plugin chain included). The
 * resolved value may BE undefined — no opinion → no stamp → the
 * ambient css scope channel keeps flowing (fleet law). Non-generic
 * by design (a no-opinion axis needs no family narrowing).
 */
export function densitySlot(own?: Density): DefaultsSlot<Density | undefined> {
  return defineAxisSlot<Density | undefined>('density', (explicit) => {
    // the ambient read happens ONLY when the explicit lane is silent
    // — an explicit prop never tracks the ambient getter (no wasted
    // re-derivation; the plugin chain still rides the terminal value
    // through resolveDensity's own scope read)
    const inherited = explicit === undefined ? ambientDensity() : undefined;
    return resolveDensity(explicit, inherited, own);
  });
}
