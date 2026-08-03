/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Prove compact Header actions remain inside the OPSX Detail Header.
 * 2. Prove arbitrary-height status content renders as a full-width Header sibling.
 *
 * Original request (2026-08-03): prevent Change Detail evidence from growing the Header's right side.
 */
import { render, screen } from '@testing-library/react'
import { GitBranch } from 'lucide-react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { OpsxDetailPage } from './opsx-detail-layout'

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({ children, to }: { children?: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
}))

describe('OpsxDetailPage', () => {
  it('keeps status content outside the compact Header', () => {
    render(
      <OpsxDetailPage
        backTo="/changes"
        backTitle="Back to Changes"
        headerRef={{ current: null }}
        sharedDescriptor={{ family: 'changes', entityId: 'add-auth' }}
        icon={GitBranch}
        title="Add auth"
        subtitle="Schema: spec-driven"
        headerActions={<button type="button">Compact action</button>}
        statusRegion={<div>Arbitrarily long status and evidence content</div>}
      >
        <div>Detail body</div>
      </OpsxDetailPage>
    )

    const header = screen.getByTestId('opsx-detail-header')
    const statusRegion = screen.getByTestId('opsx-detail-status-region')
    expect(header).toContainElement(screen.getByRole('button', { name: 'Compact action' }))
    expect(header).not.toContainElement(statusRegion)
    expect(header.nextElementSibling).toBe(statusRegion)
    expect(statusRegion).toHaveTextContent('Arbitrarily long status and evidence content')
  })
})
