<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Provide the shared brutalist press button (primary/outline) for links and actions.

Owner correction (2026-08-19): "应该组件化就组件化，哪怕是我们官网这种小网站" — extracted from hero CTA duplicates.
-->
<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    variant?: 'primary' | 'outline' | 'copied'
    href?: string
    onclick?: () => void
    type?: 'button' | 'submit'
    children: Snippet
  }

  let {
    variant = 'outline',
    href,
    onclick,
    type = 'button',
    children,
  }: Props = $props()

  const base =
    'inline-flex items-center gap-2.5 border border-border px-3.5 py-2.5 text-sm font-medium transition-[transform,box-shadow,background-color] duration-150 shadow-xs hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-md active:translate-x-px active:translate-y-px active:shadow-none'
  const variants = {
    primary: 'bg-primary text-primary-foreground',
    outline: 'bg-background hover:bg-muted',
    copied: 'bg-secondary text-secondary-foreground',
  } as const
  const classes = $derived(`${base} ${variants[variant]}`)
</script>

{#if href}
  <a {href} target="_blank" rel="noreferrer" class={classes}>{@render children()}</a>
{:else}
  <button {type} {onclick} class={classes}>{@render children()}</button>
{/if}
