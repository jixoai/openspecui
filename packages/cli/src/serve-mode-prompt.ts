/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Own the interactive serve-mode Radio lifecycle over an already-verified TTY.
 * 2. Treat Ctrl-C / EOF cancellation as an explicit null so the caller decides exit behavior.
 *
 * Original request (2026-07-29): "如果发现没有 app daemon，那么会出现一个 [Y/n] 选项。" (superseded)
 * Original request (2026-08-01): "改成交互式 Radio；全局偏好选中默认 radio，仍需 Enter 确认。"
 */
import { isCancel, select } from '@clack/prompts'
import type { ServeMode } from './serve-presentation-plan.js'

const SERVE_MODE_OPTIONS: ReadonlyArray<{ value: ServeMode; label: string; hint: string }> = [
  { value: 'web', label: 'Direct Web', hint: 'open in this browser' },
  { value: 'app', label: 'App', hint: 'multi-workspace desktop shell' },
]

export interface ServeModePromptInput {
  /** Remembered preference used to preselect a Radio option; defaults to Direct Web when unset. */
  initialValue?: ServeMode
}

export const SERVE_MODE_PROMPT_MESSAGE = 'Start OpenSpecUI as'

/**
 * Ask for the serve presentation mode on an already-verified interactive terminal.
 * Returns `null` when the user cancels (Ctrl-C / ESC); the caller must abort.
 */
export async function promptForServeMode(
  input: ServeModePromptInput = {}
): Promise<ServeMode | null> {
  const result = await select<ServeMode>({
    message: SERVE_MODE_PROMPT_MESSAGE,
    options: [...SERVE_MODE_OPTIONS],
    initialValue: input.initialValue ?? 'web',
  })
  return isCancel(result) ? null : result
}
