<!--
  jixoai terminal header
  (registry/files/ui/terminal-header/terminal-header.svelte).
  The site nav bar: a strict two-wing layout — LEFT carries the brand
  (logo slot + wordmark + domain/subtitle, the page's identity), RIGHT
  carries the navigation pill group plus the switcher slot. The wings
  never mix.

  Theme lock: the bar is a CRT bezel locked DARK by default; components
  inside render with dark tokens because the wrapper carries the scoped
  token class (dark). Declare theme="light" or "system" to unlock.

  Chrome scope (chrome-density-tier, 2026-08-26): the ROW stamps
  data-jx-chrome — the pointer-modality band (hit 32px, icon 16px,
  sm-tier text/gaps). Controls composed into the bar (pills,
  switcher, hamburger, logo slot) follow the ONE band; the drawer
  below the row and the composed panels' surfaces stay on the density
  axis — panels re-scope at their root, so their control law (44px
  touch floor) survives inside the bezel.

  Composition-first (2026-08-25, composition-first-apis — BREAKING): the
  header owns CHROME ONLY and is a thin composition surface OVER the
  NavigationMenu family. The nav slot hosts consumer-composed parts —
  NavigationMenuItem/Trigger/Panel with the mega grids authored INSIDE
  the panels, links-only entries as NavigationMenuLink or bare anchors.
  The three-level TerminalNavItem config tree, panelAction and
  navColumns are DEAD: what renders is the consumer's tree; the header
  wraps it in the bezel. What survives here, verbatim in behavior:

    - the pill-group box + the family's NavigationMenuIndicator over
      the composed entries (indicator migration, 2026-09-01: the
      private 70-line DOM-delegated engine is RETIRED — the part
      carries the measurement, the WAAPI slide, the quiet laws and the
      vt-nav-active morph name; the bezel paint (backdrop brightener,
      never a fill) rides the class seam + terminal-header.css)
    - the mobile drawer SHELL: the hamburger fold, the grid-rows
      0fr→1fr collapse, the bounded scroll viewport, Escape→close with
      focus returned to the hamburger, and the tier-cross reset; the
      drawer CONTENTS are the `drawer` snippet, and bind:open is the
      consumer's reset signal for its own drawer state
    - closeAll(): navigation cleanup — hides every open [popover] panel
      under the header (composed NavigationMenu panels included, found
      by DOM query — the header never tracked them) and resets the
      drawer; consumers call it from their router hook (the registry
      component stays app-agnostic)

  Responsive — two deliberate tiers:
    ≥sm   one row: brand LEFT; pill group + switcher RIGHT
    <sm   row 1: logo + brand LEFT; switcher + hamburger RIGHT; the
          drawer opens as a stacked disclosure below the bar
  (props-discipline sweep, 2026-08-25)
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';
  import NavigationMenuIndicator from '../navigation-menu/navigation-menu-indicator.svelte';
  import './terminal-header.css';

  interface Props extends HTMLAttributes<HTMLElement> {
    /** the wordmark line of the brand block */
    brand: string;
    /** second brand line (the domain) */
    domain?: string;
    /** third brand line — desktop tier only */
    subtitle?: string;
    /** the brand block's link target */
    homeHref?: string;
    /** bezel theme lock: dark (default) | light | system */
    theme?: 'dark' | 'light' | 'system';
    /** the brand mark (logo slot) */
    logo?: Snippet;
    /** the right-wing control slot (theme pair toggle, hue switcher…) */
    switcher?: Snippet;
    /** wrap the switcher slot in the bezel frame (border + p-0.5, the
        38px outer band shared with the pill box). DEFAULT ON — the
        frame law; opt OUT for consumers whose control carries its own
        frame/padding (e.g. the blueprint's compact ThemeToggle — a
        framed-in-frame control double-borders and breaks the band) */
    switcherFrame?: boolean;
    /** the desktop nav slot — compose NavigationMenu parts here */
    children?: Snippet;
    /** the mobile drawer contents (the stacked tier's nav) */
    drawer?: Snippet;
    /** the mobile drawer's open state (bind:open) — the consumer's
        reset signal: closing clears its own drawer state */
    open?: boolean;
    class?: string;
  }

  let {
    brand,
    domain,
    subtitle,
    homeHref = '/',
    theme = 'dark',
    logo,
    switcher,
    switcherFrame = true,
    drawer,
    open = $bindable(false),
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  // scoped token class: dark (default lock) or jx-light (css-defined)
  let scope = $state<'dark' | 'light'>(theme === 'light' ? 'light' : 'dark');

  $effect(() => {
    if (theme !== 'system') {
      scope = theme === 'light' ? 'light' : 'dark';
      return;
    }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => (scope = media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  });

  let headerEl = $state<HTMLElement | null>(null);

  /* -----------------------------------------------------------------
   * Navigation cleanup (consumers call this from their router hook —
   * SvelteKit onNavigate; the registry component stays app-agnostic).
   * Panels are no longer tracked by the header: whatever [popover]
   * surfaces the composed nav opened under this header get hidden by
   * DOM query, and the drawer resets. The bound open state flows to
   * the consumer synchronously, so its drawer-state reset effect runs
   * without lag.
   * --------------------------------------------------------------- */
  export function closeAll(): void {
    open = false;
    if (!headerEl) return;
    for (const panel of headerEl.querySelectorAll<HTMLElement>('[popover]')) {
      if (typeof panel.hidePopover === 'function' && panel.matches(':popover-open')) {
        panel.hidePopover();
      }
    }
  }

  // crossing the sm breakpoint (rotate, resize) never carries nav state
  // across tiers — composed panels hide, the disclosure resets
  onMount(() => {
    const mobile = matchMedia('(max-width: 639.98px)');
    const onCross = () => closeAll();
    mobile.addEventListener('change', onCross);
    return () => mobile.removeEventListener('change', onCross);
  });

  // mobile drawer: Escape closes it while open and returns focus to the
  // hamburger (the fold itself rides the button's aria-expanded state)
  let burgerEl = $state<HTMLElement | null>(null);

  $effect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        open = false;
        burgerEl?.focus();
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });
</script>

<header
  bind:this={headerEl}
  class={cn(
    'jx-nav bg-terminal text-terminal-foreground border-b border-border',
    scope === 'dark' ? 'dark [color-scheme:dark]' : 'jx-light [color-scheme:light]',
    className,
  )}
  {...rest}
>
  <div class="mx-auto w-full max-w-[90rem] px-4 sm:px-6 lg:px-8">
    <!-- the chrome band rides the ROW, not the header root: the
         drawer below and the composed panels' surfaces stay on the
         density axis (control law), only the bar's controls follow
         the pointer-modality band -->
    <div data-jx-chrome="" class="flex items-center justify-between gap-4 py-3">
      <!-- LEFT WING · the brand -->
      <a href={homeHref} class="flex min-w-0 flex-1 items-center gap-3">
        {#if logo}
          <span class="flex h-[var(--jx-hit)] w-[var(--jx-hit)] flex-none items-center justify-center">
            {@render logo()}
          </span>
        {/if}
        <span class="flex min-w-0 flex-col gap-0.5">
          <span class="font-nav text-primary text-[11px] uppercase tracking-[0.24em] leading-tight">
            {brand}
          </span>
          {#if domain}
            <span class="font-nav truncate text-sm leading-tight">{domain}</span>
          {/if}
          {#if subtitle}
            <span class="hidden truncate text-[11px] leading-tight opacity-60 lg:block">
              {subtitle}
            </span>
          {/if}
        </span>
      </a>

      <!-- RIGHT WING · the nav pill slot + controls -->
      <div class="flex flex-none items-center gap-3">
        <!-- the pill box: chrome the composed nav lands in (the nav
             landmark itself is the consumer's NavigationMenu root).
             The INDICATOR is the family's part, sunk here (2026-09-01):
             it measures against this box (the part's parent fallback),
             slides via WAAPI on the bezel curve, and morphs across
             pages through the preserved vt-nav-active name; the bezel
             paint — backdrop brightener, never a fill — rides the css
             key on the part's hook (utilities overridden through the
             class seam: transparent ground, square corners). The
             retired engine's 150ms ease-out opacity fade (appear/
             disappear) is restored through the same seam (B-8,
             2026-09-02 — "verbatim in behavior" made whole; the first
             placement stays instant: the fade only arms after the
             initial paint) -->
        <div
          class="relative hidden items-center border border-terminal-foreground/25 p-0.5 sm:flex"
        >
          <NavigationMenuIndicator
            name="vt-nav-active"
            duration={450}
            easing="cubic-bezier(0.22, 1, 0.36, 1)"
            class="bg-transparent rounded-none transition-opacity duration-150 ease-out"
          />
          {@render children?.()}
        </div>
        <!-- frame law (walkthrough report, 2026-08-26): every bezel
             control cluster wears the SAME outer frame as the pill box
             (border + p-0.5 around the 32px chrome band = 38px outer),
             so the pill group, the switcher and the hamburger read as
             one aligned row -->
        {#if switcher}
          {#if switcherFrame}
            <div class="flex border border-terminal-foreground/25 p-0.5">
              {@render switcher()}
            </div>
          {:else}
            {@render switcher()}
          {/if}
        {/if}
        <span class="flex border border-terminal-foreground/25 p-0.5 sm:hidden">
        <button
          type="button"
          class="flex min-h-[var(--jx-hit)] min-w-[var(--jx-hit)] flex-col items-center justify-center gap-[3px]"
          aria-expanded={open}
          aria-label="Toggle navigation"
          bind:this={burgerEl}
          onclick={() => (open = !open)}
        >
          <span class="jx-bar block h-[1.5px] w-[var(--jx-icon)] bg-terminal-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"></span>
          <span class="block h-[1.5px] w-[var(--jx-icon)] bg-terminal-foreground"></span>
          <span class="jx-bar block h-[1.5px] w-[var(--jx-icon)] bg-terminal-foreground transition-transform duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"></span>
        </button>
        </span>
      </div>
    </div>

    <!-- mobile drawer: the consumer's drawer snippet stacked below the
         bar; the inner scroller bounds it to the viewport so every link
         stays reachable -->
    <div
      class="grid grid-rows-[0fr] transition-[grid-template-rows] duration-200 sm:hidden"
      class:grid-rows-[1fr]={open}
    >
      <div class="overflow-hidden">
        <div
          data-jx-mobile-scroll
          class="max-h-[calc(100dvh-4.75rem)] overflow-y-auto overscroll-contain [scrollbar-gutter:stable_both-edges] [-webkit-overflow-scrolling:touch]"
        >
          {@render drawer?.()}
        </div>
      </div>
    </div>
  </div>
</header>
