<script lang="ts">
  import { getAlternateLocale, localizePath } from '$lib/i18n/languages'
  import type { WebsiteContent, WebsiteLanguage } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
    lang: WebsiteLanguage
    pathname: string
  }

  let { content, lang, pathname }: Props = $props()
  const alternate = $derived(getAlternateLocale(lang))
</script>

<div class="flex items-center gap-2">
  <span class="text-terminal-foreground/72 text-xs">{content.meta.languageLabel}</span>
  <div
    class="border-terminal-border bg-terminal-muted inline-flex w-fit max-w-full items-center self-start overflow-hidden border shadow-none"
    role="group"
    aria-label={content.meta.languageLabel}
  >
    <a
      href={localizePath(pathname, 'en')}
      aria-current={lang === 'en' ? 'true' : undefined}
      class={[
        'px-2.5 py-1 text-xs font-medium transition-colors',
        lang === 'en'
          ? 'bg-primary text-primary-foreground'
          : 'text-terminal-foreground/72 hover:bg-terminal-hover hover:text-terminal-foreground',
      ].join(' ')}
    >
      EN
    </a>
    <a
      href={localizePath(pathname, 'zh')}
      aria-current={lang === 'zh' ? 'true' : undefined}
      class={[
        'px-2.5 py-1 text-xs font-medium transition-colors',
        lang === 'zh'
          ? 'bg-primary text-primary-foreground'
          : 'text-terminal-foreground/72 hover:bg-terminal-hover hover:text-terminal-foreground',
      ].join(' ')}
    >
      中文
    </a>
  </div>
  <span class="sr-only">{alternate}</span>
</div>
