export type TerminalKeybindingResult = 'allow' | 'block'
export type TerminalKeybindingCommand = 'copy' | 'paste' | 'select-all'

export interface TerminalKeybindingTarget {
  hasSelection?: () => boolean
  getSelection?: () => string
  clearSelection?: () => void
  selectAll?: () => void
  paste?: (data: string) => void
}

export interface TerminalKeybindingContext {
  terminal: TerminalKeybindingTarget
  writeInput: (data: string) => boolean
  zoomFont: (delta: number) => void
  resetFontSize: () => void
  clipboard?: Pick<Clipboard, 'readText' | 'writeText'>
  onAsyncError?: (error: unknown) => void
}

export interface TerminalKeybinding {
  id: string
  handle: (
    event: KeyboardEvent,
    context: TerminalKeybindingContext
  ) => TerminalKeybindingResult | null
}

export interface TerminalCommandBinding {
  id: string
  command: TerminalKeybindingCommand
  run: (context: TerminalKeybindingContext) => TerminalKeybindingResult
}

function isKeydown(event: KeyboardEvent): boolean {
  return event.type === 'keydown'
}

function keyEquals(event: KeyboardEvent, key: string): boolean {
  return event.key.toLowerCase() === key
}

function hasPrimaryModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey
}

function hasPlainPrimaryModifier(event: KeyboardEvent): boolean {
  return hasPrimaryModifier(event) && !event.altKey
}

function resolveClipboard(
  context: TerminalKeybindingContext
): Pick<Clipboard, 'readText' | 'writeText'> | null {
  if (context.clipboard) return context.clipboard
  if (typeof navigator === 'undefined') return null
  return navigator.clipboard ?? null
}

function runAsync(task: Promise<void>, context: TerminalKeybindingContext): void {
  void task.catch((error: unknown) => {
    context.onAsyncError?.(error)
  })
}

async function copySelection(context: TerminalKeybindingContext, selection: string): Promise<void> {
  const clipboard = resolveClipboard(context)
  if (!clipboard?.writeText) return
  await clipboard.writeText(selection)
}

async function pasteClipboard(context: TerminalKeybindingContext): Promise<void> {
  const clipboard = resolveClipboard(context)
  if (!clipboard?.readText) return
  const text = await clipboard.readText()
  if (!text) return

  try {
    context.terminal.paste?.(text)
    if (context.terminal.paste) return
  } catch {
    // Fall back to raw PTY input when a renderer exposes paste but rejects it.
  }
  context.writeInput(text)
}

export const defaultTerminalKeybindings: readonly TerminalKeybinding[] = [
  {
    id: 'terminal.copy-selection',
    handle: (event, context) => {
      if (!isKeydown(event) || !hasPlainPrimaryModifier(event) || !keyEquals(event, 'c')) {
        return null
      }
      if (!context.terminal.hasSelection?.()) return 'allow'

      return copySelectionCommand(context)
    },
  },
  {
    id: 'terminal.paste-clipboard',
    handle: (event, context) => {
      if (!isKeydown(event) || !hasPlainPrimaryModifier(event) || !keyEquals(event, 'v')) {
        return null
      }
      return pasteClipboardCommand(context)
    },
  },
  {
    id: 'terminal.select-all',
    handle: (event, context) => {
      if (!isKeydown(event) || !event.metaKey || event.ctrlKey || event.altKey) return null
      if (!keyEquals(event, 'a')) return null
      return selectAllCommand(context)
    },
  },
  {
    id: 'terminal.zoom-in',
    handle: (event, context) => {
      if (!isKeydown(event) || !hasPrimaryModifier(event)) return null
      if (event.key !== '=' && event.key !== '+') return null

      context.zoomFont(1)
      return 'block'
    },
  },
  {
    id: 'terminal.zoom-out',
    handle: (event, context) => {
      if (!isKeydown(event) || !hasPrimaryModifier(event) || event.key !== '-') return null

      context.zoomFont(-1)
      return 'block'
    },
  },
  {
    id: 'terminal.zoom-reset',
    handle: (event, context) => {
      if (!isKeydown(event) || !hasPrimaryModifier(event) || event.key !== '0') return null

      context.resetFontSize()
      return 'block'
    },
  },
]

function copySelectionCommand(context: TerminalKeybindingContext): TerminalKeybindingResult {
  if (!context.terminal.hasSelection?.()) return 'allow'

  const selection = context.terminal.getSelection?.() ?? ''
  if (!selection) return 'allow'

  runAsync(copySelection(context, selection), context)
  return 'block'
}

function pasteClipboardCommand(context: TerminalKeybindingContext): TerminalKeybindingResult {
  if (!resolveClipboard(context)?.readText) return 'allow'

  runAsync(pasteClipboard(context), context)
  return 'block'
}

function selectAllCommand(context: TerminalKeybindingContext): TerminalKeybindingResult {
  if (!context.terminal.selectAll) return 'allow'

  context.terminal.selectAll()
  return 'block'
}

export const defaultTerminalCommandBindings: readonly TerminalCommandBinding[] = [
  {
    id: 'terminal.command.copy-selection',
    command: 'copy',
    run: copySelectionCommand,
  },
  {
    id: 'terminal.command.paste-clipboard',
    command: 'paste',
    run: pasteClipboardCommand,
  },
  {
    id: 'terminal.command.select-all',
    command: 'select-all',
    run: selectAllCommand,
  },
]

export class TerminalKeybindingRegistry {
  constructor(
    private readonly bindings = defaultTerminalKeybindings,
    private readonly commandBindings = defaultTerminalCommandBindings
  ) {}

  handleKeyEvent(
    event: KeyboardEvent,
    context: TerminalKeybindingContext
  ): TerminalKeybindingResult {
    for (const binding of this.bindings) {
      const result = binding.handle(event, context)
      if (result) return result
    }
    return 'allow'
  }

  runCommand(
    command: TerminalKeybindingCommand,
    context: TerminalKeybindingContext
  ): TerminalKeybindingResult {
    const binding = this.commandBindings.find((item) => item.command === command)
    return binding?.run(context) ?? 'allow'
  }
}
