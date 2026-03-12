// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { applyHostedShellThemeColor, getHostedShellThemeColor } from './theme-color'

describe('hosted shell theme color', () => {
  it('updates every theme-color meta tag to the terminal color', () => {
    document.head.innerHTML = `
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#000000" media="(prefers-color-scheme: dark)" />
    `

    applyHostedShellThemeColor(document)

    const values = Array.from(
      document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
    ).map((element) => element.getAttribute('content'))
    expect(values).toEqual([getHostedShellThemeColor(), getHostedShellThemeColor()])
  })
})
