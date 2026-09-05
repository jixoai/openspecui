<!--
  jixoai navigation menu link
  (registry/files/ui/navigation-menu/navigation-menu-link.svelte).
  The bare in-bar link: a top-level entry with no panel, composing
  DIRECTLY under the NavigationMenu (no Item wrapper — there is no
  popover to pair). The current-state paint: `current` marks the link
  aria-current="page" (the page's own truth) with the brand color,
  verbatim from the pre-composed era.

  child({ props }) — the concrete element-kind law: the consumer
  renders their own <a {...props}> keeping the link semantics;
  consumer attributes appended after the spread REPLACE the part's
  (they own the consequences).
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAnchorAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  interface Props extends HTMLAnchorAttributes {
    /** the current page: paints aria-current="page" + the brand color */
    current?: boolean;
    class?: string;
    /** element replacement ({...props} keeps the link semantics) */
    child?: Snippet<[{ props: HTMLAnchorAttributes & { class: string } }]>;
    children: Snippet;
  }

  let { current = false, class: className = '', child, children, href, ...rest }: Props = $props();

  // the shared trigger/link paint; the current color state is a
  // conditional string (mirroring the pre-composed specificity order:
  // hover beats current on triggers, current wins at rest on links)
  const paint = $derived(
    cn(
      'jx-navmenu-link inline-flex min-h-[var(--jx-hit)] items-center gap-[var(--jx-gap)] px-[var(--jx-inset)] font-nav text-[length:var(--jx-text)] leading-[var(--jx-line)] uppercase tracking-[0.12em] no-underline transition-colors duration-150 ease-out focus-visible:outline-1 focus-visible:outline-ring focus-visible:-outline-offset-1',
      current ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      className,
    ),
  );

  const childProps = $derived<HTMLAnchorAttributes & { class: string }>({
    ...rest,
    href,
    'aria-current': current ? 'page' : undefined,
    // the marker rides childProps too — the TerminalHeader indicator
    // queries [data-jx-navmenu-link]; a child() replacement must stay
    // trackable (Codex impl-r1 P1-3)
    'data-jx-navmenu-link': '',
    class: paint,
  });
</script>

{#if child}
  {@render child({ props: childProps })}
{:else}
  <a
    {href}
    data-jx-navmenu-link=""
    aria-current={current ? 'page' : undefined}
    class={paint}
    {...rest}
  >
    {@render children()}
  </a>
{/if}
