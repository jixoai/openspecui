/**
 * Orthogonal intents (created 2026-09-18 Asia/Shanghai):
 * 1. Prove the markdown reading view renders task lines with the same widened semantics
 *    the admitted OpenSpec CLI 1.13.1 uses for counting (indentation, single-token
 *    markers incl. padded boxes, whitespace-only boxes, ordered markers).
 * 2. Prove non-task bracket forms (multi-token labels, links) stay plain text.
 *
 * Original request (2026-09-18): owner walkthrough — the Change Detail tasks view showed
 * 4 checkboxes (1 checked) beside a CLI-owned "Tasks 2/6" badge; the reading surface and
 * the CLI counts must describe the same document (update-openspec-cli-1131 follow-up).
 */
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { MarkdownContent } from '@/components/markdown-content'

const WIDENED_TASKS_DOC = [
  '# Tasks',
  '',
  '- [ ] Ordinary dash task',
  '+ [ ] Plus marker task',
  '1. [ ] Ordered dot task',
  '1) [x] Ordered paren done',
  '  - [~] Indented wave task',
  '- [ x] Padded done task',
  '- [1] Single token label task',
  '- [WIP] Multi token label (not a task)',
  '- [doc](./proposal.md) Link bullet (not a task)',
  '',
].join('\n')

function checkboxStates(): Array<{ label: string; checked: boolean }> {
  return screen
    .getAllByRole('checkbox')
    .map((node) => ({
      checked: (node as HTMLInputElement).checked,
      label: (node.parentElement?.textContent ?? '').trim(),
    }))
}

describe('MarkdownContent CLI 1.13.1 task-line parity', () => {
  afterEach(cleanup)

  it('renders widened CLI task forms as checkboxes with the CLI completion semantics', () => {
    render(<MarkdownContent>{WIDENED_TASKS_DOC}</MarkdownContent>)

    expect(checkboxStates()).toEqual([
      { label: 'Ordinary dash task', checked: false },
      { label: 'Plus marker task', checked: false },
      { label: 'Ordered dot task', checked: false },
      { label: 'Ordered paren done', checked: true },
      { label: 'Indented wave task', checked: false },
      { label: 'Padded done task', checked: true },
      { label: 'Single token label task', checked: false },
    ])
  })

  it('keeps multi-token labels and link bullets as plain text', () => {
    render(<MarkdownContent>{WIDENED_TASKS_DOC}</MarkdownContent>)

    expect(screen.getByText(/\[WIP\] Multi token label/)).toBeTruthy()
    expect(screen.getByText(/Link bullet \(not a task\)/)).toBeTruthy()
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(7)
    expect(
      checkboxes.some((node) => (node.parentElement?.textContent ?? '').includes('WIP'))
    ).toBe(false)
    expect(
      checkboxes.some((node) => (node.parentElement?.textContent ?? '').includes('Link bullet'))
    ).toBe(false)
  })
})
