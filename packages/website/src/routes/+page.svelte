<script lang="ts">
  import { goto } from '$app/navigation'
  import { browser } from '$app/environment'
  import { getPreferredWebsiteLanguage } from '$lib/i18n/languages'
  import { onMount } from 'svelte'

  onMount(() => {
    if (!browser) return

    const language = getPreferredWebsiteLanguage(navigator.languages)
    void goto(`/${language}/`, { replaceState: true, noScroll: true })
  })
</script>

<svelte:head>
  <title>OpenSpec UI</title>
  <meta
    name="description"
    content="OpenSpecUI gives OpenSpec projects a visual frontend and static documentation site."
  />
  <link rel="canonical" href="https://www.openspecui.com/" />
</svelte:head>

<main class="sr-only" aria-live="polite">
  <h1>Opening OpenSpec UI.</h1>
</main>

<noscript>
  <main class="bg-terminal text-terminal-foreground grid min-h-dvh place-items-center px-4">
    <section
      class="border-terminal-border bg-terminal-muted max-w-lg border p-6 text-center shadow-sm"
    >
      <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">OpenSpec UI</p>
      <h1 class="font-nav mt-3 text-balance text-2xl tracking-tight">OpenSpec UI</h1>
      <p class="text-terminal-foreground/70 mt-3 text-sm">
        JavaScript is required to choose the website language automatically.
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-3 text-sm">
        <a class="bg-primary text-primary-foreground px-3 py-2 font-medium" href="/en/">English</a>
        <a class="border-terminal-border px-3 py-2 font-medium" href="/zh/">中文</a>
      </div>
    </section>
  </main>
</noscript>
