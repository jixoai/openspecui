<!--
  jixoai navigation menu — the ROOT half
  (registry/files/ui/navigation-menu/navigation-menu.svelte).
  The site-nav pattern: a horizontal bar of top-level triggers, each
  with an OPTIONAL panel of links — the part raw popovers don't give
  you is the NAVIGATION contract, so this is an independent thin
  coordinator (batch-4 ruling), not "just popovers":

    top-level focus walking is the bar's: ←/→ move between triggers
    (roving tabindex over triggers, like tabs — a nav bar is walked,
    not hunted); Enter/Space/click opens the panel; Escape closes and
    focus returns to the trigger. While a panel is open, walking swaps
    panels without a close bounce (menubar glide — keyboard-driven).

  CLICK OPEN ONLY (Owner ruling, 2026-08-25 — the terminal-header
  law, realigned here 2026-08-25 after a drift round): the hover path,
  its 150ms intent, its grace timers and its pointer corridor are
  RETIRED. Panels are the Popover primitive's LAWS on a native
  popover=auto surface (light dismiss + one-at-a-time + top layer all
  browser-native; CSS anchor positioning with try-fallbacks; the WAAPI
  surface-motion entry/exit — see navigation-menu-panel.svelte);
  triggers are BUTTONS, so the open/close toggle rides the DECLARATIVE
  popovertarget wire (the primitive's zero-listener path — the invoker
  association exempts the trigger from light dismiss by construction,
  no click-order race), and open state mirrors ONLY through the panel's
  native toggle seam, so aria-expanded never lies. Panels carry REAL
  LINKS — navigation-menu moves you through a site; actions belong to
  dropdown-menu. The current section marks its trigger aria-current
  (the page's own truth, passed in — the menu never guesses).

  Composition-first (2026-08-25, composition-first-apis): the bar owns
  STATE + BEHAVIOR only — the open-panel id, the roving tab stop, the
  arrow walk — never membership ORDER. The walk queries
  button[aria-haspopup] scoped to entries whose closest nav is THIS
  bar and that sit inside no [popover] panel (mega-panel content and
  nested nav families never leak); the glide resolves the next trigger
  → panel through its aria-controls, the same derived id the panel's
  handles register under (first registration wins; a conditionally
  removed panel leaves no ghost handle).
  (props-discipline sweep, 2026-08-25)
-->
<script module lang="ts">
  /** imperative panel surface — registered at INIT under the PANEL id */
  export interface NavigationMenuPanelHandles {
    show(source?: HTMLElement): void;
    hide(): void;
  }

  /** the bar's context surface: state + behavior, never membership order */
  export interface NavigationMenuApi {
    readonly density: import('$lib/density.svelte').Density | undefined;
  /** the OPINION behind the resolution — undefined when the bar fell
      back to 'default' (triggers/panels stamp ONLY this, so a bar with
      no density opinion rides the ambient css scope — e.g. a chrome
      band — instead of re-scoping its subtree) */
  readonly densityOpinion: import('$lib/density.svelte').Density | undefined;
    /** first-wins registry for the arrow-walk glide; key = `${itemId}-panel` */
    register(panelId: string, anchorName: string, handles: NavigationMenuPanelHandles): void;
    /** identity-guarded: only the winning registrant can remove itself */
    unregister(panelId: string, handles: NavigationMenuPanelHandles): void;
    /** the open panel's derived id ('' = closed) — mirrors the toggle seam only */
    readonly openPanelId: string;
    /** the roving tab stop: trigger id ('' = unresolved — see below) */
    readonly tabStop: string;
    setTabStop(triggerId: string): void;
    /** the popover toggle seam's state mirror (panels report here) */
    markOpen(panelId: string): void;
    markClosed(panelId: string): void;
    /** floating-surface variant for every panel in the bar */
    readonly variant: import('./navigation-menu-defaults.svelte').NavigationMenuSurfaceVariant;
  }

  /** context key — global symbol registry (independent registry items) */
  export const NAVIGATION_MENU_KEY = Symbol.for('jx-navmenu');
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { setContext } from 'svelte';
  import { provideDensity, resolveDensity, getDensityContext, type Density } from '$lib/density.svelte';
  import { cn } from '$lib/utils';
  import { NavigationMenuDefaults, type NavigationMenuSurfaceVariant } from './navigation-menu-defaults.svelte';

  interface Props extends HTMLAttributes<HTMLElement> {
    density?: Density;
    /** nav landmark label */
    label?: string;
    /** floating-surface variant: solid | acrylic | auto (acrylic unless
        the environment asks for reduced transparency) */
    variant?: NavigationMenuSurfaceVariant;
    class?: string;
    children: Snippet;
  }

  let { label = 'site', density, variant, class: className = '', children, ...rest }: Props = $props();

  // Density stamping law (chrome-density-tier, 2026-08-26): the CSS
  // scope channel stamps ONLY an OPINION — the attribute lands when the
  // consumer passed `density` or a Svelte-context provider resolved one;
  // with no opinion the nav rides the AMBIENT css scope (the root default
  // density, or a chrome band like the TerminalHeader bezel's
  // data-jx-chrome) instead of re-scoping its subtree and cutting ambient
  // inheritance off. The context channel mirrors the law: no opinion →
  // nothing provided, so nested consumers never see a manufactured
  // inheritance.
  //
  // ---- the density lane: inherit-then-provide, boundary-legal ------
  // Both CAPTURES are load-bearing and EAGER (r11 first contract,
  // context-defaults-economy 3.3): each getDensityContext() rides a
  // $derived.by ARGUMENT subtree, which evaluates at its own statement —
  // BEFORE provideDensity writes the key below — so each captures the
  // PARENT's context object; a lazily-evaluated read would resolve the
  // key to the nav's OWN write and self-reference through the very
  // getter it feeds (derived_references_self — the pre-3.3 bare capture
  // this replaces). The returned getters read ONLY the captured object
  const resolvedDensity = $derived.by(
    ((inherited) => () => resolveDensity(density, inherited))(getDensityContext()),
  );
  // context is an OPINION channel too: the provider is ALWAYS on and
  // carries the honest opinion (undefined = none flows down — consumed
  // exactly like a missing context) — a conditional init-time provide
  // would not survive density prop rerenders in either direction
  // (Codex r2 P1)
  const densityOpinion = $derived.by(
    ((inherited) => () => density ?? inherited?.density)(getDensityContext()),
  );
  provideDensity(() => densityOpinion);

  // THE DEFAULTS READ POINT (context-defaults-economy 3.3), riding ON
  // TOP of the provider lane as the family's single audited read point:
  // the density slot's ambient read resolves the key to the nav's own
  // write, whose getter is the captured-parent opinion above, so the
  // chain TERMINATES; variant resolves through the literal slot (own
  // 'auto' declared in NavigationMenuDefaults, auditable in one place)
  const d = $derived(NavigationMenuDefaults.resolve({ density, variant }));

  const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

  let navEl = $state<HTMLElement | null>(null);
  /** open state mirrors ONLY the panels' native toggle seam — the
      native toggle event covers click, light dismiss, Escape and
      one-at-a-time, so aria-expanded never lies */
  let openPanelId = $state('');
  /** the roving tab stop follows arrow focus; '' = unresolved (the
   *  empty-state law: every trigger renders tabbable until the bar
   *  trims to one after mount — the current-section trigger first) */
  let tabStop = $state('');

  // ── the panel registry: first-wins on BOTH keys (panel id and the
  //    sanitized anchor name — `foo/bar` vs `foo?bar` both → `foo-bar`
  //    collide on the anchor while carrying distinct DOM ids). Later
  //    registrants are ignored and their handles never fire.
  const panels = new Map<string, NavigationMenuPanelHandles>();
  const anchors = new Map<string, string>();

  setContext<NavigationMenuApi>(NAVIGATION_MENU_KEY, {
    get density() {
      return resolvedDensity;
    },
    get densityOpinion() {
      return densityOpinion;
    },
    register(panelId, anchorName, handles) {
      if (panels.has(panelId) || anchors.has(anchorName)) {
        if (dev) {
          console.error(
            `jixoai navigation-menu: duplicate registration — panel id "${panelId}" / anchor name "${anchorName}" already claimed; first registration wins`,
          );
        }
        return;
      }
      panels.set(panelId, handles);
      anchors.set(anchorName, panelId);
    },
    unregister(panelId, handles) {
      if (panels.get(panelId) !== handles) return;
      panels.delete(panelId);
      for (const [anchorName, owner] of anchors) {
        if (owner === panelId) anchors.delete(anchorName);
      }
    },
    get openPanelId() {
      return openPanelId;
    },
    get tabStop() {
      return tabStop;
    },
    setTabStop(triggerId) {
      tabStop = triggerId;
    },
    markOpen(panelId) {
      openPanelId = panelId;
    },
    markClosed(panelId) {
      if (openPanelId === panelId) openPanelId = '';
    },
    get variant() {
      return d.variant;
    },
  });

  /** the BAR's walk scope: haspopup buttons under this nav and inside
   *  no [popover] panel (mega-panel content and nested nav families
   *  never leak into the walk) */
  function navTriggers(): HTMLButtonElement[] {
    return [
      ...(navEl?.querySelectorAll<HTMLButtonElement>('button[aria-haspopup="true"]') ?? []),
    ].filter((el) => el.closest('nav') === navEl && el.closest('[popover]') === null);
  }

  /** the bar's own keyboard walk — arrows move between triggers */
  function handleKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const triggers = navTriggers();
    if (triggers.length === 0) return;
    const current = triggers.indexOf(document.activeElement as HTMLButtonElement);
    if (current === -1) return;
    event.preventDefault();
    const next =
      triggers[(current + (event.key === 'ArrowRight' ? 1 : -1) + triggers.length) % triggers.length];
    tabStop = next.id;
    next.focus();
    // an open panel follows the walk (menubar glide behavior): hide the
    // open one, show the next — both through the registered handles,
    // resolved from the trigger's aria-controls (the derived id)
    const nextPanelId = next.getAttribute('aria-controls');
    if (openPanelId !== '' && nextPanelId && nextPanelId !== openPanelId) {
      panels.get(openPanelId)?.hide();
      panels.get(nextPanelId)?.show(next);
    }
  }

  // trim the empty-state tab stop after mount ('' → the current
  // section's trigger, else the first) and re-resolve when the focused
  // trigger disappears (keyed reorders keep their stop while it lives)
  $effect(() => {
    if (!navEl) return;
    const stops = navTriggers();
    if (tabStop === '' || !stops.some((t) => t.id === tabStop)) {
      tabStop =
        (stops.find((t) => t.getAttribute('aria-current') === 'true') ?? stops[0])?.id ?? '';
    }
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -- the
     nav hosts the top-level arrow walk; its triggers are the
     interactive elements -->
<nav
  bind:this={navEl}
  data-jx-navmenu=""
  class={cn('flex flex-wrap items-stretch gap-1', className)}
  {...rest}
  data-density={d.density}
  aria-label={label}
  onkeydown={handleKeydown}
>
  {@render children()}
</nav>
