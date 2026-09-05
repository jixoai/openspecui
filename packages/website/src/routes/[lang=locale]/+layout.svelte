<!--
Orthogonal intents (updated 2026-09-06 Asia/Shanghai):
1. Compose the registry site chrome (terminal-header / terminal-footer /
   theme-toggle) around the locale pages; header/footer/theme-switcher
   hand-rolled components retired with the registry adoption.
2. Keep language-switcher project-owned (it rides the header switcher slot).

Original request (2026-09-06): 官网接入 @jixoai registry（jixoai-ui 0.3.0）。
-->
<script lang="ts">
  import LanguageSwitcher from '$lib/components/language-switcher.svelte'
  import { GITHUB_URL, OPENSPEC_URL } from '$lib/constants'
  import NavigationMenuLink from '$lib/ui/navigation-menu/navigation-menu-link.svelte'
  import NavigationMenu from '$lib/ui/navigation-menu/navigation-menu.svelte'
  import TerminalFooter from '$lib/ui/terminal-footer/terminal-footer.svelte'
  import { TerminalFooterColumn } from '$lib/ui/terminal-footer/index'
  import TerminalHeader from '$lib/ui/terminal-header/terminal-header.svelte'
  import ThemeToggle from '$lib/ui/theme-toggle/theme-toggle.svelte'
  import type { Snippet } from 'svelte'
  import type { LayoutData } from './$types'

  interface Props {
    children: Snippet
    data: LayoutData
  }

  let { children, data }: Props = $props()

  const content = $derived(data.content)
  const lang = $derived(data.lang)
  const pathname = $derived(data.pathname)
  const isHooks = $derived(pathname.includes('/hooks/'))
  const homePath = $derived(`/${lang}/`)
  const hooksPath = $derived(`/${lang}/hooks/`)
  const copyrightYear = new Date().getFullYear()
</script>

<div class="bg-background text-foreground min-h-dvh">
  <TerminalHeader
    brand={content.meta.siteTitle}
    domain="www.openspecui.com"
    subtitle={content.meta.siteSubtitle}
    homeHref={homePath}
    switcherFrame={false}
  >
    <NavigationMenu label={content.meta.siteTitle}>
      <NavigationMenuLink href={homePath} current={!isHooks}>
        {content.nav.home}
      </NavigationMenuLink>
      <NavigationMenuLink href={hooksPath} current={isHooks}>
        {content.nav.hooks}
      </NavigationMenuLink>
      <NavigationMenuLink href={GITHUB_URL} target="_blank" rel="noreferrer">
        {content.nav.github} ↗
      </NavigationMenuLink>
    </NavigationMenu>

    {#snippet switcher()}
      <div class="flex flex-wrap items-center gap-2">
        <ThemeToggle variant="full" />
        <LanguageSwitcher {content} {lang} {pathname} />
      </div>
    {/snippet}

    {#snippet drawer()}
      <nav class="flex flex-col gap-1 py-3" aria-label={content.meta.siteTitle}>
        <NavigationMenuLink href={homePath} current={!isHooks} class="px-3">
          {content.nav.home}
        </NavigationMenuLink>
        <NavigationMenuLink href={hooksPath} current={isHooks} class="px-3">
          {content.nav.hooks}
        </NavigationMenuLink>
        <NavigationMenuLink href={GITHUB_URL} target="_blank" rel="noreferrer" class="px-3">
          {content.nav.github} ↗
        </NavigationMenuLink>
      </nav>
    {/snippet}
  </TerminalHeader>

  {@render children()}

  <TerminalFooter ghost={content.footer.ghost} copyright={`Copyright © ${copyrightYear} ${content.footer.copyright}`}>
    <TerminalFooterColumn>
      <a href={OPENSPEC_URL} target="_blank" rel="noreferrer">
        {content.links.openspecTitle} ↗
      </a>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer">
        {content.links.githubTitle} ↗
      </a>
    </TerminalFooterColumn>
  </TerminalFooter>
</div>
