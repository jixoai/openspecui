<script lang="ts">
  import { APP_URL, GITHUB_URL } from '$lib/constants'
  import type { WebsiteContent, WebsiteLanguage } from '$lib/i18n/schema'
  import type { Snippet } from 'svelte'

  interface Props {
    content: WebsiteContent
    lang: WebsiteLanguage
    pathname: string
    switcher: Snippet
  }

  let { content, lang, pathname, switcher }: Props = $props()
  const isHooks = $derived(pathname.includes('/hooks/'))
  const homePath = $derived(`/${lang}/`)
  const hooksPath = $derived(`/${lang}/hooks/`)
</script>

<header class="border-border bg-terminal text-terminal-foreground border-b">
  <div
    class="mx-auto flex max-w-[90rem] flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8"
  >
    <div class="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <a href={homePath} class="min-w-0">
        <p class="font-nav text-primary text-[11px] uppercase tracking-[0.24em]">
          {content.meta.siteTitle}
        </p>
        <div class="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
          <span class="font-nav truncate text-sm tracking-tight sm:text-base">
            www.openspecui.com
          </span>
          <span class="text-terminal-foreground/70 truncate text-xs">
            {content.meta.siteSubtitle}
          </span>
        </div>
      </a>

      <nav class="flex flex-wrap items-center gap-2 text-xs">
        <a
          href={homePath}
          aria-current={!isHooks ? 'page' : undefined}
          class={[
            'px-2.5 py-1 transition-colors',
            !isHooks
              ? 'bg-terminal-hover text-terminal-foreground'
              : 'text-terminal-foreground/70 hover:text-terminal-foreground',
          ].join(' ')}
        >
          {content.nav.home}
        </a>
        <a
          href={hooksPath}
          aria-current={isHooks ? 'page' : undefined}
          class={[
            'px-2.5 py-1 transition-colors',
            isHooks
              ? 'bg-terminal-hover text-terminal-foreground'
              : 'text-terminal-foreground/70 hover:text-terminal-foreground',
          ].join(' ')}
        >
          {content.nav.hooks}
        </a>
        <a
          href={APP_URL}
          target="_blank"
          rel="noreferrer"
          class="text-terminal-foreground/70 px-2.5 py-1 transition-colors hover:text-terminal-foreground"
        >
          {content.nav.app}
        </a>
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          class="text-terminal-foreground/70 px-2.5 py-1 transition-colors hover:text-terminal-foreground"
        >
          {content.nav.github}
        </a>
      </nav>
    </div>

    {@render switcher()}
  </div>
</header>
