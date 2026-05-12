<script lang="ts">
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
