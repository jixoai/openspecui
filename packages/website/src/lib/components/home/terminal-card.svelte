<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Render the Boot Log terminal typing card merged into the Broadside hero.
2. Degrade to the fully rendered terminal under reduced motion or without JavaScript.

Original request (2026-08-19): "还喜欢 BootLog 的那个终端打字的效果，把 BootLog 的这个效果卡片合并到 broadside 中"
-->
<script lang="ts">
  import { onMount } from 'svelte'

  interface Props {
    barTitle: string
    command: string
    outputs: readonly string[]
  }

  let { barTitle, command, outputs }: Props = $props()

  // Prerendered/no-JS output shows the settled terminal; hydration restarts the typing story.
  // svelte-ignore state_referenced_locally
  let typed = $state(command)
  // svelte-ignore state_referenced_locally
  let shownLines = $state(outputs.length)
  let timer: ReturnType<typeof setTimeout> | undefined

  onMount(() => {
    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    let cancelled = false
    typed = ''
    shownLines = 0

    const revealOutputs = (line: number) => {
      if (cancelled) return
      if (line >= outputs.length) return
      shownLines = line + 1
      timer = setTimeout(() => revealOutputs(line + 1), 110)
    }
    const typeNext = (index: number) => {
      if (cancelled) return
      if (index <= command.length) {
        typed = command.slice(0, index)
        timer = setTimeout(() => typeNext(index + 1), 42 + Math.random() * 40)
      } else {
        timer = setTimeout(() => revealOutputs(0), 140)
      }
    }
    timer = setTimeout(() => typeNext(0), 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  })
</script>

<div
  class="border-border bg-terminal text-terminal-foreground w-full border shadow-[6px_6px_0_0_var(--shadow-c)]"
>
  <div
    class="text-terminal-foreground/55 flex items-center gap-1.5 border-b border-[color-mix(in_oklab,var(--color-terminal-foreground)_18%,var(--color-terminal))] px-3.5 py-2 font-nav text-xs tracking-[0.1em]"
  >
    <span class="h-2 w-2 border border-current bg-red-400" aria-hidden="true"></span>
    <span class="h-2 w-2 border border-current bg-yellow-400" aria-hidden="true"></span>
    <span class="h-2 w-2 border border-current bg-green-400" aria-hidden="true"></span>
    <span class="ml-2 truncate">{barTitle}</span>
  </div>
  <div class="p-4 sm:p-5">
    <p class="text-lg font-semibold tracking-tight sm:text-xl">
      <span class="text-primary mr-2">$</span><span data-terminal-command>{typed}</span><span
        class="terminal-cursor"
        aria-hidden="true"></span>
    </p>
    <div class="mt-3 space-y-1 text-[13px] leading-5">
      {#each outputs as line, index (line)}
        <p
          class="text-terminal-foreground/65 terminal-output"
          class:is-shown={index < shownLines}
          data-terminal-output={index}
        >
          {line}
        </p>
      {/each}
    </div>
  </div>
</div>

<style>
  .terminal-cursor {
    display: inline-block;
    width: 0.58em;
    height: 1.05em;
    background: var(--color-terminal-foreground);
    vertical-align: text-bottom;
    margin-left: 2px;
    animation: terminal-blink 1.06s steps(2, jump-none) infinite;
  }

  .terminal-output {
    opacity: 0;
    transform: translateY(5px);
  }

  .terminal-output.is-shown {
    opacity: 1;
    transform: none;
    transition:
      opacity 150ms ease-out,
      transform 170ms ease-out;
  }

  @keyframes terminal-blink {
    0%,
    49% {
      opacity: 1;
    }
    50%,
    100% {
      opacity: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .terminal-cursor {
      animation: none;
    }
    .terminal-output {
      opacity: 1;
      transform: none;
      transition: none;
    }
  }
</style>
