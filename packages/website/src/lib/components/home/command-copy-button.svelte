<!--
Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
1. Provide the single click-to-copy terminal command button used by surfaces and run-it rows.
2. Own the copied feedback lifecycle (icon chip swap + 1.4s reset) and reset it when the command changes.

Owner correction (2026-08-19): "是不是很多地方你都是复制粘贴不做组件化的" — extracted from four pasted copies.
Original request (2026-08-19): "THREE SURFACES 这里需要能支持点击复制命令。" / "RUN IT 这里也需要支持点击复制"
Owner layout refinement (2026-08-19): "最好把开头的 `$` 这个作为一个独立的头部…要基于空格去换行"
Owner icon decision (2026-08-19): "这个 COPY 和 COPIED 改成图标吧，这样会比较稳定" — fixed-size icon chip; state moves to the aria-label.
-->
<script lang="ts">
  import { copyTextToClipboard } from '$lib/clipboard'
  import Check from 'lucide-svelte/icons/check'
  import Copy from 'lucide-svelte/icons/copy'

  interface Props {
    command: string
    copyLabel: string
    copiedLabel: string
    class?: string
    'data-run-command'?: boolean
  }

  let {
    command,
    copyLabel,
    copiedLabel,
    class: className = '',
    'data-run-command': dataRunCommand,
  }: Props = $props()

  let copied = $state(false)
  let copyTimer: ReturnType<typeof setTimeout> | undefined
  // svelte-ignore state_referenced_locally
  let lastCommand = command

  $effect(() => {
    // A changed command invalidates stale copied feedback (e.g. serve flag/runner switches).
    if (command !== lastCommand) {
      lastCommand = command
      copied = false
      clearTimeout(copyTimer)
    }
  })

  async function copyCommand() {
    await copyTextToClipboard(command)
    copied = true
    clearTimeout(copyTimer)
    copyTimer = setTimeout(() => {
      copied = false
    }, 1400)
  }
</script>

<button
  type="button"
  aria-label={`${copied ? copiedLabel : copyLabel} ${command}`}
  onclick={copyCommand}
  data-run-command={dataRunCommand}
  class="bg-terminal text-terminal-foreground flex w-full items-start justify-between gap-2 px-3 py-2.5 text-left text-sm transition-[background-color] duration-150 hover:bg-[color-mix(in_oklab,var(--color-terminal)_86%,var(--color-terminal-foreground))] {className}"
>
  <span class="text-primary shrink-0" aria-hidden="true">$</span>
  <span class="block min-w-0 flex-1 wrap-break-word">{command}</span>
  <span
    class="border-current inline-flex h-5 w-5 shrink-0 items-center justify-center border transition-colors duration-150"
    class:bg-primary={copied}
    class:text-primary-foreground={copied}
  >
    {#if copied}
      <Check class="h-3 w-3" aria-hidden="true" />
    {:else}
      <Copy class="h-3 w-3" aria-hidden="true" />
    {/if}
  </span>
</button>
