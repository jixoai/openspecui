<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the site-wide footer: ghost wordmark, follow links, and copyright.

Original request (2026-08-19): Broadside Log direction — the ghost word closes the single-page narrative.
-->
<script lang="ts">
  import { APP_URL, GITHUB_URL, OPENSPEC_URL } from '$lib/constants'
  import type { WebsiteContent } from '$lib/i18n/schema'

  interface Props {
    content: WebsiteContent
  }

  let { content }: Props = $props()
  const copyrightYear = new Date().getFullYear()
</script>

<footer class="mx-auto w-full max-w-[90rem] px-4 pb-10 pt-8 sm:px-6 lg:px-8">
  <p class="footer-ghost font-nav select-none" aria-hidden="true">{content.footer.ghost}</p>
  <div
    class="text-muted-foreground mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12.5px]"
  >
    <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
      <a href={APP_URL} target="_blank" rel="noreferrer" class="hover:text-primary transition-colors">
        {content.links.appTitle} ↗
      </a>
      <a
        href={OPENSPEC_URL}
        target="_blank"
        rel="noreferrer"
        class="hover:text-primary transition-colors"
      >
        {content.links.openspecTitle} ↗
      </a>
      <a href={GITHUB_URL} target="_blank" rel="noreferrer" class="hover:text-primary transition-colors">
        {content.links.githubTitle} ↗
      </a>
    </div>
    <p>Copyright © {copyrightYear} {content.footer.copyright}</p>
  </div>
</footer>

<style>
  .footer-ghost {
    font-size: clamp(3rem, 11vw, 9rem);
    line-height: 0.9;
    color: transparent;
    -webkit-text-stroke: 1px color-mix(in oklab, var(--color-border) 55%, transparent);
  }

  @supports not (-webkit-text-stroke: 1px black) {
    .footer-ghost {
      color: color-mix(in oklab, var(--color-border) 35%, transparent);
    }
  }
</style>
