/**
 * Orthogonal intents (updated 2026-08-28 Asia/Shanghai):
 * 1. Measure inline-end versus responsive block-end Header Action geometry in real Chromium.
 * 2. Prove long paths and raw CLI evidence remain horizontally contained at mobile, tablet, and desktop widths.
 * 3. Prove the Evidence workspace detail pane owns primary vertical scrolling at every container
 *    topology, with the crowded drill exchanging list and detail surfaces.
 * 4. Prove title identity receives width priority and continuous long titles wrap instead of truncating.
 * 5. Stop at component-browser preparation rather than claiming owner visual acceptance.
 *
 * Original request (2026-08-03): move unbounded Change Detail evidence out of the Header into a dedicated tab.
 * Owner correction (2026-08-03): keep Actions at title inline-end until responsive wrapping and unify subtitle badges.
 * Owner correction (2026-08-03): use `auto 1fr` to prioritize title identity and wrap long titles.
 * Original request (2026-08-28): "使用移动端的 list-detail 思维……分成两栏，左侧 list，右侧详情。这种结构替代手风琴会更好"
 * Owner acceptance boundary (2026-07-20): final end-to-end visual walkthrough belongs to the owner.
 */
import {
  ChangeContextSummary,
  type ChangeReferenceEvidence,
} from '@/components/change-context-summary'
import { EvidenceWorkspace } from '@/components/evidence-workspace'
import { ChangeCommandBar } from '@/components/opsx/change-command-bar'
import { OperationInputsDialogAction } from '@/components/opsx/operation-inputs'
import { OpsxDetailPage, OpsxDetailTabs } from '@/components/opsx/opsx-detail-layout'
import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { GitBranch } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'

vi.mock('@/lib/view-transitions/navigation', () => ({
  VTLink: ({
    children,
    to,
    ...props
  }: { children?: ReactNode; to: string } & Omit<ComponentProps<'a'>, 'href'>) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/view-transitions/shared-elements', () => ({
  getSharedElementBinding: () => ({}),
}))

vi.mock('@/components/folder-editor-viewer', () => ({
  FolderEditorViewer: () => <div>Folder content</div>,
}))

vi.mock('@/components/opsx/artifact-output-viewer', () => ({
  ArtifactOutputViewer: ({ artifact }: { artifact: { id: string } }) => (
    <div>{`Artifact content: ${artifact.id}`}</div>
  ),
  ContentFallbackViewer: () => <div>Content fallback</div>,
}))

const longSegment = 'team-owned-reference-boundary-with-a-long-nontrivial-identity'
const longTitle =
  'fixChangeDetailTitlePriorityWithAnExtremelyLongContinuousIdentityThatMustRemainCompletelyReadableWithoutSingleLineTruncation'

function changeStatus(): ChangeStatus {
  const artifactPaths = Object.fromEntries(
    Array.from({ length: 12 }, (_, index) => [
      `artifact-${index + 1}`,
      {
        outputPath: `loop/${longSegment}/artifact-${index + 1}.md`,
        resolvedOutputPath: `/workspace/openspec/changes/${longSegment}/loop/artifact-${index + 1}.md`,
        existingOutputPaths: [
          `/workspace/openspec/changes/${longSegment}/loop/artifact-${index + 1}.md`,
        ],
      },
    ])
  )

  return {
    changeName: longTitle,
    schemaName: 'opsx-collab-pr-loop',
    isPlanningComplete: false,
    applyRequires: ['implementation'],
    artifacts: [
      { id: 'implementation', outputPath: 'loop/implementation.md', status: 'ready', requires: [] },
    ],
    provenance: {
      kind: 'cli',
      planningHome: {
        kind: 'repo',
        root: `/workspace/${longSegment}`,
        changesDir: `/workspace/${longSegment}/openspec/changes`,
        defaultSchema: 'opsx-collab-pr-loop',
      },
      changeRoot: `/workspace/${longSegment}/openspec/changes/fix-change-detail-evidence-surface`,
      artifactPaths,
      nextSteps: Array.from({ length: 8 }, (_, index) => `Complete evidence task ${index + 1}.`),
      actionContext: {
        mode: 'repo-local',
        sourceOfTruth: 'repo',
        planningArtifacts: Object.keys(artifactPaths),
        linkedContext: [{ name: longSegment }],
        allowedEditRoots: [`/workspace/${longSegment}`],
        requiresAffectedAreaSelection: false,
        constraints: Array.from(
          { length: 6 },
          (_, index) => `Constraint ${index + 1}: ${longSegment}.`
        ),
      },
      root: { path: `/workspace/${longSegment}`, source: 'store', store_id: longSegment },
      evidence: {
        command: 'status',
        success: true,
        stdout: JSON.stringify({ changeName: longSegment.repeat(8) }),
        stderr: '',
        exitCode: 0,
        payload: { evidence: Array.from({ length: 20 }, () => longSegment) },
        diagnostics: [],
        selector: { store: longSegment },
      },
    },
  }
}

function references(): CliReferenceIndexEntry[] {
  return Array.from({ length: 10 }, (_, index) => ({
    store_id: `${longSegment}-${index + 1}`,
    status: [
      {
        severity: index === 0 ? 'error' : 'warning',
        code: 'reference_boundary_evidence',
        message: `${longSegment} must remain readable without horizontal overflow.`,
      },
    ],
  }))
}

function ChangeEvidenceHarness() {
  const status = changeStatus()
  const referenceEvidence: ChangeReferenceEvidence = {
    state: 'current',
    references: references(),
  }

  return (
    <main
      data-testid="change-detail-browser-host"
      className="flex h-[640px] min-h-0 w-full min-w-0 overflow-hidden"
    >
      <OpsxDetailPage
        backTo="/changes"
        backTitle="Back to Changes"
        headerRef={{ current: null }}
        sharedDescriptor={{ family: 'changes', entityId: status.changeName }}
        icon={GitBranch}
        title={status.changeName}
        subtitle={<ChangeContextSummary status={status} referenceEvidence={referenceEvidence} />}
        headerActions={
          <ChangeCommandBar
            status={status}
            selectedArtifactId="implementation"
            applyInputsAction={
              <OperationInputsDialogAction
                title="Apply inputs"
                context="Preserve the project-specific evidence boundary."
              />
            }
            onComposeAction={() => undefined}
            onArchive={() => undefined}
            onVerify={() => undefined}
          />
        }
        statusRegion={<div role="status">Direct status</div>}
      >
        <OpsxDetailTabs
          tabsRef={{ current: null }}
          tabs={[
            { id: 'artifact', label: 'Artifact', content: <div>Artifact content</div> },
            {
              id: 'evidence',
              label: 'Evidence',
              content: (
                <EvidenceWorkspace
                  changeId="fix-change-detail-evidence-surface"
                  status={status}
                  referenceEvidence={referenceEvidence}
                />
              ),
            },
          ]}
          selectedTab="evidence"
          onTabChange={() => undefined}
        />
      </OpsxDetailPage>
    </main>
  )
}

afterEach(async () => {
  cleanup()
  window.history.replaceState({}, '', '/')
  await page.viewport(1280, 720)
})

describe.each([390, 768, 1280])('Change Evidence workspace at %ipx', (width) => {
  it('keeps the Header bounded and evidence inside the workspace scroll owner', async () => {
    await page.viewport(width, 720)
    render(<ChangeEvidenceHarness />)

    const host = screen.getByTestId('change-detail-browser-host')
    const header = screen.getByTestId('opsx-detail-header')
    const identity = screen.getByTestId('opsx-detail-header-identity')
    const actions = screen.getByTestId('opsx-detail-header-actions')
    const title = screen.getByRole('heading', { level: 1 }).querySelector('span')
    const statusRegion = screen.getByTestId('opsx-detail-status-region')
    const workspace = screen.getByRole('region', { name: 'Change Evidence' })
    const listPane = workspace.querySelector<HTMLElement>('[data-evidence-pane="list"]')
    const detailPane = workspace.querySelector<HTMLElement>('[data-evidence-pane="detail"]')
    if (!listPane || !detailPane) throw new Error('Expected both evidence panes')

    await waitFor(() => expect(host.getBoundingClientRect().width).toBe(width))
    expect(title).not.toBeNull()
    if (!title) throw new Error('Expected the Detail Header title span')
    expect(getComputedStyle(title).whiteSpace).toBe('normal')
    expect(getComputedStyle(title).overflowWrap).toBe('anywhere')
    expect(title.getBoundingClientRect().height).toBeGreaterThan(
      Number.parseFloat(getComputedStyle(title).fontSize) * 1.2
    )
    expect(header).not.toContainElement(statusRegion)
    expect(header.nextElementSibling).toBe(statusRegion)
    const identityHeight = identity.getBoundingClientRect().height
    const actionsHeight = actions.getBoundingClientRect().height
    if (width === 1280) {
      expect(identity.getBoundingClientRect().width).toBeGreaterThan(
        actions.getBoundingClientRect().width
      )
      expect(actions.getBoundingClientRect().top).toBeLessThan(
        identity.getBoundingClientRect().bottom
      )
      expect(header.getBoundingClientRect().height).toBeLessThanOrEqual(
        Math.max(identityHeight, actionsHeight) + 1
      )
    } else {
      expect(actions.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        identity.getBoundingClientRect().bottom
      )
      expect(header.getBoundingClientRect().height).toBeLessThanOrEqual(
        identityHeight + actionsHeight + 13
      )
    }

    // The detail pane is the tab's primary reading surface and owns vertical scrolling.
    expect(getComputedStyle(detailPane).overflowY).toBe('auto')
    expect(getComputedStyle(detailPane).overflowX).toBe('hidden')

    const rows = within(listPane).getAllByRole('button')
    const rowById = (id: string) => rows.find((row) => row.getAttribute('data-evidence-row') === id)
    const summaryRow = rowById('summary-paths')
    const cliRow = rowById('cli-result')
    if (!summaryRow || !cliRow) throw new Error('Expected summary and CLI evidence rows')

    // The ResizeObserver seam settles asynchronously after the viewport change.
    await waitFor(() =>
      expect(workspace.getAttribute('data-evidence-topology')).toBe(
        width === 390 ? 'crowded' : 'spacious'
      )
    )

    if (width === 390) {
      // Crowded container: the list is the entry surface and rows drill into the detail.
      expect(listPane.getBoundingClientRect().width).toBeGreaterThan(0)
      fireEvent.click(summaryRow)
      expect(screen.getByRole('button', { name: 'Back to evidence list' })).toBeVisible()
      fireEvent.click(screen.getByRole('button', { name: /Artifact outputs/ }))
      fireEvent.click(screen.getByRole('button', { name: /^References/ }))
      fireEvent.click(screen.getByRole('button', { name: 'Back to evidence list' }))
      // Back keeps the drilled detail mounted: re-entering shows the disclosures still open.
      fireEvent.click(summaryRow)
      expect(screen.getByRole('button', { name: /Artifact outputs/ })).toBeVisible()
    } else {
      // Spacious container: the list and the selected detail render side by side.
      expect(listPane.getBoundingClientRect().width).toBeGreaterThan(0)
      expect(detailPane.getBoundingClientRect().width).toBeGreaterThan(0)
      expect(
        listPane.getBoundingClientRect().right <= detailPane.getBoundingClientRect().left + 1
      ).toBe(true)
      fireEvent.click(summaryRow)
      fireEvent.click(screen.getByRole('button', { name: /Artifact outputs/ }))
      fireEvent.click(screen.getByRole('button', { name: /^References/ }))
    }

    // The long summary section (12 artifact outputs, 10 references, constraints) drives the
    // detail pane's own vertical scrolling while staying horizontally contained.
    await waitFor(() => expect(detailPane.scrollHeight).toBeGreaterThan(detailPane.clientHeight))
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
    expect(statusRegion.scrollWidth).toBeLessThanOrEqual(statusRegion.clientWidth)
    expect(detailPane.scrollWidth).toBeLessThanOrEqual(detailPane.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth
    )

    // Long raw CLI evidence stays bounded: the payload pre wraps and scrolls internally
    // instead of widening the pane or the page.
    fireEvent.click(cliRow)
    fireEvent.click(screen.getByRole('button', { name: /Raw CLI payload/ }))
    await waitFor(() => {
      expect(detailPane.querySelector('[data-evidence-detail="cli-result"] pre')).not.toBeNull()
    })
    const rawPayload = detailPane.querySelector<HTMLElement>(
      '[data-evidence-detail="cli-result"] pre'
    )
    if (!rawPayload) throw new Error('Expected the raw payload pre')
    expect(rawPayload.scrollHeight).toBeGreaterThan(rawPayload.clientHeight)
    expect(rawPayload.scrollWidth).toBeLessThanOrEqual(rawPayload.clientWidth)
    expect(detailPane.scrollWidth).toBeLessThanOrEqual(detailPane.clientWidth)
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
  })
})

describe('Change Evidence routed tab boundary', () => {
  function RoutedDetailHarness() {
    return (
      <div className="flex h-[640px] min-h-0 w-full min-w-0">
        <OpsxEntityDetailView
          entityId="add-auth"
          sharedFamily="changes"
          backTo="/changes"
          backTitle="Back to Changes"
          icon={GitBranch}
          title="Add auth"
          subtitle="Schema: spec-driven"
          handoff={null}
          isLoading={false}
          loadingMessage="Loading change"
          artifacts={[{ id: 'proposal', outputPath: 'proposal.md', status: 'ready' }]}
          folder={{ changeId: 'add-auth' }}
          tabsQueryKey="artifact"
          supplementaryTabs={[
            { id: 'evidence', label: 'Evidence', content: <div>Routed Evidence content</div> },
          ]}
        />
      </div>
    )
  }

  it('selects Evidence from the production query owner', async () => {
    window.history.replaceState({}, '', '/changes/add-auth?artifact=evidence')

    render(<RoutedDetailHarness />)

    expect(await screen.findByText('Routed Evidence content')).toBeVisible()
    expect(screen.queryByText('Artifact content: proposal')).not.toBeVisible()
  })

  it('keeps Artifact as the default without an explicit query', async () => {
    window.history.replaceState({}, '', '/changes/add-auth')

    render(<RoutedDetailHarness />)

    expect(await screen.findByText('Artifact content: proposal')).toBeVisible()
    expect(screen.queryByText('Routed Evidence content')).not.toBeVisible()
  })
})
