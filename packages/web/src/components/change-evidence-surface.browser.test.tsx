/**
 * Orthogonal intents (created 2026-08-03 Asia/Shanghai):
 * 1. Measure Change Detail Header, status-region, and Evidence-tab geometry in real Chromium.
 * 2. Prove long paths and raw CLI evidence remain horizontally contained at mobile, tablet, and desktop widths.
 * 3. Prove Evidence owns primary vertical scrolling after complete evidence is disclosed.
 * 4. Stop at component-browser preparation rather than claiming owner visual acceptance.
 *
 * Original request (2026-08-03): move unbounded Change Detail evidence out of the Header into a dedicated tab.
 * Owner acceptance boundary (2026-07-20): final end-to-end visual walkthrough belongs to the owner.
 */
import {
  ChangeContextSummary,
  type ChangeReferenceEvidence,
} from '@/components/change-context-summary'
import { ChangeEvidencePanel } from '@/components/change-evidence-panel'
import { OpsxDetailPage, OpsxDetailTabs } from '@/components/opsx/opsx-detail-layout'
import { OpsxEntityDetailView } from '@/components/opsx/opsx-entity-detail-view'
import type { ChangeStatus, CliReferenceIndexEntry } from '@openspecui/core'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { FileSearch, GitBranch } from 'lucide-react'
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
    changeName: 'fix-change-detail-evidence-surface',
    schemaName: 'opsx-collab-pr-loop',
    isComplete: false,
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
        subtitle="Schema: opsx-collab-pr-loop · 0/1 artifacts"
        headerActions={
          <button type="button" aria-label="Inspect Change evidence" className="p-2">
            <FileSearch className="h-4 w-4" />
          </button>
        }
        statusRegion={
          <ChangeContextSummary status={status} referenceEvidence={referenceEvidence} />
        }
      >
        <OpsxDetailTabs
          tabsRef={{ current: null }}
          tabs={[
            { id: 'artifact', label: 'Artifact', content: <div>Artifact content</div> },
            {
              id: 'evidence',
              label: 'Evidence',
              content: (
                <ChangeEvidencePanel status={status} referenceEvidence={referenceEvidence} />
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

describe.each([390, 768, 1280])('Change Evidence at %ipx', (width) => {
  it('keeps the Header bounded and complete evidence inside its tab scroll owner', async () => {
    await page.viewport(width, 720)
    render(<ChangeEvidenceHarness />)

    const host = screen.getByTestId('change-detail-browser-host')
    const header = screen.getByTestId('opsx-detail-header')
    const statusRegion = screen.getByTestId('opsx-detail-status-region')
    const evidence = screen.getByRole('region', { name: 'Change Evidence' })

    await waitFor(() => expect(host.getBoundingClientRect().width).toBe(width))
    expect(header).not.toContainElement(statusRegion)
    expect(header.nextElementSibling).toBe(statusRegion)
    expect(header.getBoundingClientRect().height).toBeLessThan(100)
    expect(getComputedStyle(evidence).overflowY).toBe('auto')
    expect(getComputedStyle(evidence).overflowX).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: /Artifact outputs/ }))
    fireEvent.click(screen.getByRole('button', { name: /^References/ }))
    fireEvent.click(screen.getByRole('button', { name: /CLI result/ }))
    fireEvent.click(screen.getByRole('button', { name: /Raw CLI payload/ }))

    await waitFor(() => expect(evidence.scrollHeight).toBeGreaterThan(evidence.clientHeight))
    expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth)
    expect(statusRegion.scrollWidth).toBeLessThanOrEqual(statusRegion.clientWidth)
    expect(evidence.scrollWidth).toBeLessThanOrEqual(evidence.clientWidth)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth
    )
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
