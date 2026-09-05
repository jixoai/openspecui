<!--
  jixoai navigation menu item
  (registry/files/ui/navigation-menu/navigation-menu-item.svelte).
  The pairing unit of the family: the Popover primitive's anchor law
  made a part. It owns the ONE id — an explicit `id` prop (optional
  here), else the component's $props.id() — and exposes {id,
  anchorName, anchorEl} through item context; Trigger and Panel derive
  their ids from it (`${id}-trigger` / `${id}-panel`) and the panel
  registers its imperative handles under the derived PANEL id (the
  ID/handle protocol: aria-controls always resolves, the wire never
  depends on render order).

  The anchor span carries anchor-name for CSS Anchor Positioning and
  feeds the panel's motion kernel its live axis. The panel renders
  inside the span as a closed popover (display:none until open, top
  layer once open) — it contributes no box, so the span's geometry IS
  the trigger's.

  The id is IMMUTABLE after mount (changing it is caller error —
  dev-mode console warn; the protocol's stability is what aria-controls
  and the anchor name are built on).
  (props-discipline sweep, 2026-08-25)
-->
<script module lang="ts">
  /** the item's context surface: the ONE id + its derived anchor */
  export interface NavigationMenuItemApi {
    readonly id: string;
    /** `--jx-navmenu-<sanitized-id>` (chars outside [a-zA-Z0-9-] collapse — case-preserving, CSS idents are case-sensitive) */
    readonly anchorName: string;
    /** the anchor span — the kernel's live anchor axis */
    readonly anchorEl: HTMLElement | null;
  }

  /** context key — global symbol registry (independent registry items) */
  export const NAVIGATION_MENU_ITEM_KEY = Symbol.for('jx-navmenu-item');
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { setContext } from 'svelte';
  import { cn } from '$lib/utils';

  interface Props extends HTMLAttributes<HTMLSpanElement> {
    /** the ONE id: Trigger/Panel derive theirs from it. Mount-stable. */
    id?: string;
    class?: string;
    children: Snippet;
  }

  // $props.id() must live in its own top-level initializer (compiler law)
  const autoId = $props.id();

  let { id = autoId, class: className = '', children, ...rest }: Props = $props();

  const dev = (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

  // $derived keeps the anchor name truthful if the id ever flips —
  // though the id is mount-stable by contract (warned below)
  const anchorName = $derived(`--jx-navmenu-${id.replace(/[^a-zA-Z0-9-]+/g, '-')}`);

  let lastId: string | undefined;
  $effect(() => {
    if (lastId !== undefined && id !== lastId && dev) {
      console.warn(
        'jxoai navigation-menu: NavigationMenuItem id is mount-stable by contract — changing it is caller error',
      );
    }
    lastId = id;
  });

  let anchorEl = $state<HTMLElement | null>(null);

  setContext<NavigationMenuItemApi>(NAVIGATION_MENU_ITEM_KEY, {
    get id() {
      return id;
    },
    get anchorName() {
      return anchorName;
    },
    get anchorEl() {
      return anchorEl;
    },
  });
</script>

<span
  data-jx-navmenu-item=""
  class={cn('inline-flex', className)}
  {...rest}
  style="anchor-name: {anchorName}"
  bind:this={anchorEl}
>
  {@render children()}
</span>
