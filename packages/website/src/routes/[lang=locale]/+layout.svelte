<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { LayoutData } from './$types'
  import LanguageSwitcher from '$lib/components/language-switcher.svelte'
  import SiteFooter from '$lib/components/site-footer.svelte'
  import SiteHeader from '$lib/components/site-header.svelte'
  import ThemeSwitcher from '$lib/components/theme-switcher.svelte'

  interface Props {
    children: Snippet
    data: LayoutData
  }

  let { children, data }: Props = $props()
</script>

<div class="bg-background text-foreground min-h-dvh">
  <SiteHeader content={data.content} lang={data.lang} pathname={data.pathname}>
    {#snippet switcher()}
      <div class="flex flex-wrap items-center gap-2">
        <ThemeSwitcher content={data.content} />
        <LanguageSwitcher content={data.content} lang={data.lang} pathname={data.pathname} />
      </div>
    {/snippet}
  </SiteHeader>

  {@render children()}

  <SiteFooter content={data.content} />
</div>
