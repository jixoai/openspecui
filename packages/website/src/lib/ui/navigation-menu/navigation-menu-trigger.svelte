<!--
  jixoai navigation menu trigger
  (registry/files/ui/navigation-menu/navigation-menu-trigger.svelte).
  A real <button aria-haspopup="true"> reading the Item's context:
  id `${item.id}-trigger`, aria-controls `${item.id}-panel` — rendered
  whether or not the panel currently exists (a trigger without any
  panel ever rendered is caller error; the derived id is always
  stable). The open/close toggle rides the DECLARATIVE popovertarget
  wire (the Popover primitive's zero-listener path — the invoker
  association exempts the trigger from light dismiss by construction);
  aria-expanded mirrors ONLY the bar's toggle-seam state; the roving
  tabindex follows the bar's tab stop (the empty-state law: all
  triggers render tabbable until the bar trims after mount).

  The current-section paint: `current` marks THIS trigger
  aria-current="true" (the page's own truth, passed in — the menu
  never guesses) and the current/open color order law is preserved
  verbatim from the pre-composed era (open beats current, hover beats
  current-but-closed).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { getContext } from 'svelte';
  import { cn } from '$lib/utils';
  import { NAVIGATION_MENU_KEY, type NavigationMenuApi } from './navigation-menu.svelte';
  import {
    NAVIGATION_MENU_ITEM_KEY,
    type NavigationMenuItemApi,
  } from './navigation-menu-item.svelte';

  interface Props extends HTMLButtonAttributes {
    /** the current section: paints aria-current="true" + the brand color */
    current?: boolean;
    class?: string;
    children: Snippet;
  }

  let { current = false, class: className = '', children, ...rest }: Props = $props();

  const bar = getContext<NavigationMenuApi>(NAVIGATION_MENU_KEY);
  const item = getContext<NavigationMenuItemApi>(NAVIGATION_MENU_ITEM_KEY);
  if (!bar || !item) {
    throw new Error(
      'jixoai navigation-menu: NavigationMenuTrigger must live inside a NavigationMenuItem inside a NavigationMenu',
    );
  }

  const triggerId = `${item.id}-trigger`;
  const panelId = `${item.id}-panel`;
</script>

<button
  type="button"
  data-jx-navmenu-trigger=""
  data-density={bar.densityOpinion}
  aria-haspopup="true"
  aria-current={current ? 'true' : undefined}
  class={cn(
    'jx-navmenu-trigger inline-flex min-h-[var(--jx-hit)] cursor-pointer items-center gap-[var(--jx-gap)] px-[var(--jx-inset)] font-nav text-[length:var(--jx-text)] leading-[var(--jx-line)] uppercase tracking-[0.12em] no-underline transition-colors duration-150 ease-out focus-visible:outline-1 focus-visible:outline-ring focus-visible:-outline-offset-1',
    bar.openPanelId === panelId
      ? 'text-foreground'
      : current
        ? 'text-primary hover:text-foreground'
        : 'text-muted-foreground hover:text-foreground',
    className,
  )}
  onfocus={() => bar.setTabStop(triggerId)}
  {...rest}
  id={triggerId}
  popovertarget={panelId}
  aria-expanded={bar.openPanelId === panelId}
  aria-controls={panelId}
  tabindex={bar.tabStop === '' || bar.tabStop === triggerId ? 0 : -1}
>
  {@render children()}
</button>
