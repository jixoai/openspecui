<script lang="ts">
  // registry scrollbar probe (jixoai scrollbar law): imported ONCE in the
  // root layout — publishes the measured per-OS scrollbar widths the
  // padding-compensation recipes consume (registry item scrollbar-measure).
  // ($lib, not the doc'd @lib — SvelteKit's native alias)
  import '$lib/scrollbar-measure'
  import '$lib/styles/app.css'
  import { onMount } from 'svelte'
  import type { Snippet } from 'svelte'
  import { installWebsiteThemeSync } from '$lib/theme/theme-bootstrap'

  interface Props {
    children: Snippet
  }

  let { children }: Props = $props()

  onMount(() => {
    return installWebsiteThemeSync()
  })
</script>

{@render children()}
