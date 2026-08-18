/**
 * Orthogonal intents (updated 2026-08-19 Asia/Shanghai):
 * 1. Verify the single-page v9 narrative renders with current compatibility guidance.
 * 2. Prove App and Direct Web choices emit explicit production CLI modes.
 * 3. Guard against retired (PWA) and pending-rework (translation platform) surfaces returning.
 *
 * Original request (2026-08-19): "只提供现有最新版本的信息"
 * Owner IA decision (2026-08-19): "翻译功能不要提，因为我可能会做大重构。"
 */
import { en } from '$lib/i18n/locales/en'
import HomePage from '$lib/pages/home-page.svelte'
import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'

describe('HomePage', () => {
  it('publishes the v9 narrative and feature index without retired surfaces', () => {
    render(HomePage, { content: en })

    const heading = screen.getByRole('heading', { level: 1 })
    expect(heading).toHaveTextContent(
      /Operate OpenSpec through a UI that stays\s*close to the CLI\./
    )
    expect(screen.getByText(en.run.compat)).toBeVisible()

    for (const item of en.features.items) {
      // Each title appears in the index rail and in its feature row.
      expect(screen.getAllByText(item.title).length).toBeGreaterThanOrEqual(2)
    }
    for (const item of en.surfaces.items) {
      expect(screen.getByText(item.title)).toBeVisible()
      expect(screen.getByText(`$ ${item.command}`)).toBeVisible()
    }

    expect(screen.queryByText(/PWA/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/translation/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/app\.openspecui\.com/)).not.toBeInTheDocument()
  })

  it('settles the terminal typing story with full command and outputs', async () => {
    render(HomePage, { content: en })

    await waitFor(
      () => {
        expect(screen.getAllByText(en.terminal.command)).toHaveLength(2)
      },
      { timeout: 5000 }
    )
    expect(screen.getByText(en.terminal.outputs[0])).toBeVisible()
    expect(screen.getByText(en.terminal.outputs[3])).toBeVisible()
  })

  it('launch controls emit explicit production CLI modes', async () => {
    render(HomePage, { content: en })

    expect(screen.getByText('npx openspecui@latest --app')).toBeVisible()
    expect(screen.getByText('npx openspecui@latest export -o ./dist')).toBeVisible()
    expect(screen.getByText('$ openspecui --auth')).toBeVisible()

    await fireEvent.change(screen.getByLabelText('RUNNER'), { target: { value: 'pnpm' } })

    expect(screen.getByText('pnpx openspecui@latest --app')).toBeVisible()
    expect(screen.getByText('pnpx openspecui@latest export -o ./dist')).toBeVisible()

    await fireEvent.click(screen.getByRole('button', { name: /APP MODE/ }))

    expect(screen.getByText('pnpx openspecui@latest --web')).toBeVisible()
    expect(screen.getByText(en.run.serveWebSummary)).toBeVisible()
    expect(screen.queryByText(en.run.serveAppSummary)).not.toBeInTheDocument()
  })
})
