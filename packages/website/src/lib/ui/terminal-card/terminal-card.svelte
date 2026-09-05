<!--
  jixoai terminal card (registry/files/ui/terminal-card/terminal-card.svelte).
  The Broadside hero terminal, composed after the openspecui reference:
  traffic-light title bar, one large typed command line, outputs that
  surface line by line, 6px hard offset shadow. Commands type in
  character by character (one-time entrance — never looping); the cursor
  is a STATIC block (the jixoai motion law; the reference's blink
  predates it). Prerendered/no-JS shows the settled terminal; reduced
  motion renders everything instantly.

  Bezel law (Owner, 2026-08-21): same as terminal-header — dark-locked by
  default; theme="light" | "system" opts the card into the light CRT shell
  (scoped .jx-light token class re-renders inner tokens).

  Props:
    barTitle  window title (traffic-light bar label)
    command   the single command line (typed)
    outputs   lines surfaced sequentially after the command completes
    theme     'dark' | 'light' | 'system' (default 'dark')
    speed     typing pace multiplier (default 1; 2 = twice as fast).
              Clamped to >= 0.25. Pacing is read on mount, so a live
              control applies its value by re-mounting (e.g. {#key}).

  tw4 (2026-08-24): bezel paint, traffic lights, the static block
  cursor and the color-scheme lock ride token utilities in the markup
  (the color-mix output tint too); ONLY the line-reveal state machine
  (.jx-out/.jx-out-shown + reduced-motion) stays in terminal-card.css —
  D1-exempt residue on the unlayered carve-out.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { cn } from '$lib/utils';
  import './terminal-card.css';

  interface Props {
    barTitle: string;
    command: string;
    outputs: readonly string[];
    theme?: 'dark' | 'light' | 'system';
    speed?: number;
  }

  let { barTitle, command, outputs, theme = 'dark', speed = 1 }: Props = $props();

  // scoped token class: dark (default lock) or jx-light (css-defined)
  let scope = $state<'dark' | 'light'>(theme === 'light' ? 'light' : 'dark');

  $effect(() => {
    if (theme !== 'system') {
      scope = theme === 'light' ? 'light' : 'dark';
      return;
    }
    const media = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => (scope = media.matches ? 'dark' : 'light');
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  });

  // Prerendered/no-JS output shows the settled terminal; hydration
  // restarts the typing story.
  // svelte-ignore state_referenced_locally
  let typed = $state(command);
  // svelte-ignore state_referenced_locally
  let shownLines = $state(outputs.length);

  onMount(() => {
    const reduce =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    // pacing: the authored rhythm divided by the speed multiplier
    const pace = Math.max(0.25, speed || 1);

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => clearTimeout(timer);

    typed = '';
    shownLines = 0;

    const revealOutputs = (line: number) => {
      if (cancelled) return;
      if (line >= outputs.length) return;
      shownLines = line + 1;
      timer = setTimeout(() => revealOutputs(line + 1), 110 / pace);
    };
    const typeNext = (index: number) => {
      if (cancelled) return;
      if (index <= command.length) {
        typed = command.slice(0, index);
        timer = setTimeout(() => typeNext(index + 1), (42 + Math.random() * 40) / pace);
      } else {
        timer = setTimeout(() => revealOutputs(0), 140 / pace);
      }
    };
    timer = setTimeout(() => typeNext(0), 300 / pace);

    return () => {
      cancelled = true;
      clear();
    };
  });
</script>

<div
  data-jx-terminal
  class={cn(
    'border-border bg-terminal text-terminal-foreground w-full border shadow',
    scope === 'dark' ? 'dark [color-scheme:dark]' : 'jx-light [color-scheme:light]',
  )}
>
  <div
    class="text-terminal-foreground/55 flex items-center gap-1.5 border-b px-3.5 py-2 font-nav text-xs tracking-[0.1em]"
  >
    <span data-jx-light-dot class="w-2 h-2 flex-none border border-current bg-[oklch(0.7_0.18_25)]" aria-hidden="true"></span>
    <span data-jx-light-dot data-jx-light-yellow class="w-2 h-2 flex-none border border-current bg-[oklch(0.85_0.17_95)]" aria-hidden="true"></span>
    <span data-jx-light-dot data-jx-light-green class="w-2 h-2 flex-none border border-current bg-[oklch(0.75_0.17_150)]" aria-hidden="true"></span>
    <span class="ml-2 truncate">{barTitle}</span>
  </div>
  <div class="p-4 sm:p-5">
    <p class="text-lg font-semibold tracking-tight sm:text-xl">
      <span class="text-primary mr-2">$</span><span>{typed}</span><span class="jx-cursor inline-block w-[0.58em] h-[1.05em] bg-terminal-foreground align-text-bottom ml-0.5" aria-hidden="true"></span>
    </p>
    <div class="mt-3 space-y-1 text-[13px] leading-5">
      {#each outputs as line, index (line)}
        <p class={cn('jx-out', index < shownLines && 'jx-out-shown')}>{line}</p>
      {/each}
    </div>
  </div>
</div>
