<!--
  jixoai TerminalFooter root (registry/files/ui/terminal-footer/terminal-footer.svelte,
  composition-first, 2026-08-25).
  The ghost wordmark closes the narrative: huge hollow brand word
  (text-stroke recipe, @supports fallback), meta row and © line. The
  old closed `links[]` data prop died — the meta row's content is
  composed as TerminalFooterColumn children (title prop + free links):

    <TerminalFooter ghost="JIXOAI/UI" copyright="© 2026 · MIT">
      <TerminalFooterColumn title="project">
        <a href="https://github.com/jixoai/ui">GitHub</a>
      </TerminalFooterColumn>
    </TerminalFooter>

  Links inside columns are consumer-authored; their muted→brand hover
  paint rides terminal-footer.css descendant rules (utilities cannot
  reach free children). The ext-icon injection of the closed form died
  with it — external-link affordances are caller content now.

  tw4 (2026-08-24, kept): ONLY the @supports fallback for engines
  without -webkit-text-stroke stays in terminal-footer.css — D1-exempt
  residue on the unlayered carve-out (it must override the
  text-transparent utility paint when it fires).
  (props-discipline sweep, 2026-08-25)
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import { cn } from '$lib/utils';
  import './terminal-footer.css';

  interface Props extends HTMLAttributes<HTMLElement> {
    /** the ghost wordmark (decorative, aria-hidden) */
    ghost: string;
    /** the © row text (defaults to the live year) */
    copyright?: string;
    class?: string;
    children: Snippet;
  }

  let { ghost, copyright, class: className = '', children, ...rest }: Props = $props();
  const year = new Date().getFullYear();
</script>

<footer
  data-jx-terminal-footer=""
  class={cn('mx-auto w-full max-w-[90rem] px-4 pb-10 pt-8 sm:px-6 lg:px-8', className)}
  {...rest}
>
  <p
    class={cn(
      'jx-footer-ghost font-nav select-none text-transparent text-[clamp(3rem,11vw,9rem)] leading-[0.9] [-webkit-text-stroke:1px_color-mix(in_oklab,var(--border)_55%,transparent)]',
    )}
    aria-hidden="true"
  >{ghost}</p>
  <div
    class="mt-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-[12.5px] text-muted-foreground"
  >
    <div data-jx-terminal-footer-columns="" class="flex flex-wrap items-start gap-x-8 gap-y-4">
      {@render children()}
    </div>
    <span>{copyright ?? `© ${year}`}</span>
  </div>
</footer>
