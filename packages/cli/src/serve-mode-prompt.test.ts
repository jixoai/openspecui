/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Prove the Radio forwards the approved options and preselected default to clack.
 * 2. Prove cancellation maps to null while a selection maps to the chosen ServeMode.
 *
 * Original request (2026-08-01): "全局偏好选中默认 radio，仍需 Enter 确认。"
 *
 * NOTE: @clack/prompts requires a real TTY raw-mode terminal, so it is mocked here.
 * Contract assertions cover the options/initialValue we forward and the null/selection
 * mapping we return. Final visual Radio behavior is verified by the owner walkthrough.
 */
import { vi } from 'vitest'

const { selectMock } = vi.hoisted(() => ({ selectMock: vi.fn() }))
vi.mock('@clack/prompts', () => ({
  select: selectMock,
  // `isCancel` returns true only for the symbol clack emits on cancel.
  isCancel: (value: unknown) => typeof value === 'symbol',
}))

import { promptForServeMode, SERVE_MODE_PROMPT_MESSAGE } from './serve-mode-prompt.js'

function lastSelectCall() {
  return selectMock.mock.calls.at(-1)?.[0] as {
    message: string
    options: { value: string; label: string; hint?: string }[]
    initialValue: string
  }
}

describe('serve mode prompt', () => {
  it('forwards the Direct Web and App options with the given default', async () => {
    selectMock.mockResolvedValue('web')

    const mode = await promptForServeMode({ initialValue: 'web' })

    expect(mode).toBe('web')
    const call = lastSelectCall()
    expect(call.message).toBe(SERVE_MODE_PROMPT_MESSAGE)
    expect(call.initialValue).toBe('web')
    expect(call.options).toEqual([
      { value: 'web', label: 'Direct Web', hint: 'open in this browser' },
      { value: 'app', label: 'App', hint: 'multi-workspace desktop shell' },
    ])
  })

  it('defaults the preselection to Direct Web when no preference is provided', async () => {
    selectMock.mockResolvedValue('app')

    const mode = await promptForServeMode()

    expect(mode).toBe('app')
    expect(lastSelectCall().initialValue).toBe('web')
  })

  it('maps a clack cancellation to null', async () => {
    selectMock.mockResolvedValue(Symbol('cancel'))

    await expect(promptForServeMode({ initialValue: 'app' })).resolves.toBeNull()
  })
})
