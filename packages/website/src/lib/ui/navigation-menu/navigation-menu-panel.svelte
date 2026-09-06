<!--
  jixoai navigation menu panel
  (registry/files/ui/navigation-menu/navigation-menu-panel.svelte).
  The Popover primitive's LAWS as a part: a native popover="auto"
  surface (light dismiss, Escape, one-at-a-time, top layer — all
  browser), CSS Anchor Positioning against the Item's anchor span
  (position-area + position-try fallbacks, anchors-visible hiding;
  popover.css carries the geometry), and the WAAPI surface-motion
  entry/exit. The consumer authors the mega-grid INSIDE — children are
  panel content, any markup.

  Derives its id from the Item (`${item.id}-panel`, the registry key
  the trigger's aria-controls points at) and REGISTERS its imperative
  handles {show, hide} under that PANEL id at INIT (sync, SSR-executed
  — onMount is never the only registration path), unregistering
  onDestroy: the bar's arrow-walk glide is the only caller, and a
  conditionally removed panel leaves no ghost handle.

  Escape is EXPLICIT: preventDefault on the keydown cancels the native
  close request, so without the imperative hide focus would return
  over a still-open panel (Codex r1 blocking #1, browser-reproduced).
  (props-discipline sweep, 2026-08-25): no ...rest — the panel's popover/id/role/ontoggle wiring is load-bearing family law; a consumer attribute spread could clobber the popover surface, the derived panel id or the toggle seam (the declared exception class in the sweep instruction).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import { onDestroy } from 'svelte';
  import { getContext } from 'svelte';
  import { createSurfaceMotion, surfaceMotionSupported } from '$lib/surface-motion';
  import { cn } from '$lib/utils';
  import {
    NAVIGATION_MENU_KEY,
    type NavigationMenuApi,
    type NavigationMenuPanelHandles,
  } from './navigation-menu.svelte';
  import {
    NAVIGATION_MENU_ITEM_KEY,
    type NavigationMenuItemApi,
  } from './navigation-menu-item.svelte';
  import '$lib/ui/popover/popover.css';

  interface Props {
    class?: string;
    children: Snippet;
  }

  let { class: className = '', children }: Props = $props();

  const bar = getContext<NavigationMenuApi>(NAVIGATION_MENU_KEY);
  const item = getContext<NavigationMenuItemApi>(NAVIGATION_MENU_ITEM_KEY);
  if (!bar || !item) {
    throw new Error(
      'jixoai navigation-menu: NavigationMenuPanel must live inside a NavigationMenuItem inside a NavigationMenu',
    );
  }

  const panelId = `${item.id}-panel`;

  let panelEl = $state<HTMLElement | null>(null);

  // registered at INIT under the PANEL id — the bar's glide calls
  // these; the popover-API guards mirror the primitive's handle
  // passthroughs verbatim
  const handles: NavigationMenuPanelHandles = {
    show(source?: HTMLElement) {
      const el = panelEl;
      if (el && typeof el.showPopover === 'function' && !el.matches(':popover-open')) {
        // `source` names the invoking control where the popover spec
        // supports it; engines without the options bag ignore it
        (el as HTMLElement & { showPopover(options?: { source?: HTMLElement }): void }).showPopover(
          source ? { source } : undefined,
        );
      }
    },
    hide() {
      const el = panelEl;
      if (el && typeof el.hidePopover === 'function' && el.matches(':popover-open')) {
        el.hidePopover();
      }
    },
  };
  bar.register(panelId, item.anchorName, handles);
  onDestroy(() => {
    motion.destroy();
    bar.unregister(panelId, handles);
  });

  // ── MOTION KERNEL — the shared declarative half (r29): see
  // lib/surface-motion.ts. WAAPI animates ONE @property number
  // (--jx-p); every visible property is a CSS formula of it (the
  // declarative motion law in jixoai.css). The kernel here wires the
  // panel's toggle seam and the live anchor (the Item's span)
  const motion = createSurfaceMotion(() => panelEl, { anchor: () => item.anchorEl });

  // the single native seam: open state is read LIVE from
  // :popover-open at fire time and reported to the bar — the ONLY
  // open-state source, so aria-expanded never lies
  function handleToggle(): void {
    if (panelEl?.matches(':popover-open')) {
      bar.markOpen(panelId);
      motion.play(1);
      motion.startTracking();
    } else {
      panelEl?.classList.remove('jx-rest');
      motion.play(0);
      motion.stopTracking();
      bar.markClosed(panelId);
    }
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      handles.hide();
      document.getElementById(`${item.id}-trigger`)?.focus();
    }
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -- Escape
     handling only; the panel's links are the interactive elements. The
     hide() is EXPLICIT: preventDefault on the keydown cancels the
     native close request, so without it focus would return over a
     still-open panel (Codex r1 blocking #1, browser-reproduced) -->
<div
  id={panelId}
  popover="auto"
  data-jx-navmenu-panel=""
  class={cn(
    'jx-pop jx-surface',
    surfaceMotionSupported && 'jx-waapi',
    'w-fit max-w-[min(92vw,26rem)]',
    className,
  )}
  data-variant={bar.variant}
  data-density={bar.density}
  bind:this={panelEl}
  style="position-anchor: {item.anchorName}; --jx-surface-in-x: 0px; --jx-surface-in-y: 6px; --jx-surface-ox: 6px; --jx-surface-oy: 6px; inset-area: bottom span-left; position-area: bottom span-left;"
  ontoggle={handleToggle}
  onkeydown={handleKeydown}
>
  <!-- surface body (fill + acrylic blur + the ::after shadow layer) +
       scroll ring (floating-surface law arch r3: the platform element
       paints nothing) -->
  <div data-jx-navmenu-shadow="" class="jx-surface-shadow" aria-hidden="true"></div>
  <!-- the REAL shadow layer: a DOM child because pseudo-elements are
       unreachable from WAAPI — the kernel animates it in lockstep -->
  <div data-jx-navmenu-surface="" class="jx-surface-body">
    <div
      data-jx-navmenu-scroll=""
      class="max-h-[72vh] overflow-auto [scrollbar-gutter:stable_both-edges] [padding:var(--jx-pop-pad,12px_14px)] [padding-inline:max(var(--jx-pop-pad-inline,14px)-var(--jx-scrollbar-thin,0px),0px)]"
    >
      <div class="flex flex-col" data-jx-navmenu-panel-body="">
        {@render children()}
      </div>
    </div>
  </div>
</div>
