<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Assemble the single-page v9 narrative from the home section components.

Original request (2026-08-19): "单页叙事" — hero → features → surfaces → run it, in one scroll.
-->
<script lang="ts">
  import FeaturesSection from '$lib/components/home/features-section.svelte'
  import HeroSection from '$lib/components/home/hero-section.svelte'
  import RunItSection from '$lib/components/home/run-it-section.svelte'
  import SurfacesSection from '$lib/components/home/surfaces-section.svelte'
  import type { WebsiteContent } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()
</script>

<main>
  <HeroSection {content} />
  <FeaturesSection {content} />
  <SurfacesSection {content} />
  <RunItSection {content} />
</main>
