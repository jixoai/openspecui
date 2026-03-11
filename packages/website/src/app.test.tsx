import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from './app'
import i18n, { websiteI18nReady } from './i18n'

describe('website app', () => {
  beforeEach(async () => {
    await websiteI18nReady
    window.localStorage.clear()
    await i18n.changeLanguage('en')
  })

  it('renders english content and switches to chinese', async () => {
    render(<App />)

    expect(
      screen.getByText('Operate OpenSpec through a UI that stays close to the CLI.')
    ).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '中文' }))

    await waitFor(() => {
      expect(screen.getByText('用一个贴近 CLI 本质的 UI 来操作 OpenSpec。')).toBeTruthy()
    })
    expect(document.documentElement.lang).toBe('zh-CN')
  })
})
