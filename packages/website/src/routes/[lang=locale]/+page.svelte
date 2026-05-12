<script lang="ts">
  import HomePage from '$lib/pages/home-page.svelte'
  import type { PageData } from './$types'

  interface Props {
    data: PageData
  }

  let { data }: Props = $props()
</script>

<svelte:head>
  <title>{data.content.meta.homeTitle}</title>
  <meta name="description" content={data.content.meta.homeDescription} />
  <link rel="canonical" href={`https://www.openspecui.com/${data.lang}/`} />
  <link rel="alternate" hreflang="en" href="https://www.openspecui.com/en/" />
  <link rel="alternate" hreflang="zh-CN" href="https://www.openspecui.com/zh/" />
</svelte:head>

<HomePage content={data.content} lang={data.lang} />
