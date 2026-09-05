<!--
  jixoai TerminalFooterColumn (registry/files/ui/terminal-footer/
  terminal-footer-column.svelte, 2026-08-25).
  One column of the footer's meta row: a title (optional — omit for an
  untitled link stack) and FREE children — the links are authored by
  the consumer, not passed as data. Their hover-warm paint rides
  terminal-footer.css (descendant rules; utilities cannot reach
  consumer-authored anchors).
  (props-discipline sweep, 2026-08-25)
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';

  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** the column heading (omit for an untitled link stack) */
    title?: string;
    class?: string;
    children: Snippet;
  }

  let { title, class: className = '', children, ...rest }: Props = $props();
</script>

<div data-jx-terminal-footer-column="" class={cn('flex min-w-0 flex-col gap-1.5', className)} {...rest}>
  {#if title}
    <span class="font-nav text-[0.6875rem] uppercase tracking-[0.14em] text-muted-foreground">
      {title}
    </span>
  {/if}
  <div data-jx-terminal-footer-links="" class="flex min-w-0 flex-col items-start gap-1">
    {@render children()}
  </div>
</div>
