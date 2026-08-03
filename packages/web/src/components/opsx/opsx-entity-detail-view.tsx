/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Own the shared loading, unavailable, and ready topology for OPSX entity details.
 * 2. Preserve routed Artifact, Content, and Folder presentation across active and archived entities.
 * 3. Forward compact Header actions, full-width status content, and caller-owned supplementary tabs.
 *
 * Original request (2026-07-28): share one schema-neutral detail surface across active Changes and Archives.
 * Original request (2026-08-03): add a Change-only Evidence tab without changing Archive Detail.
 */
import type { Tab } from '@/components/tabs'
import type { VTLinkProps } from '@/lib/view-transitions/navigation'
import type { SharedElementHandoff } from '@/lib/view-transitions/shared-elements'
import { useRoutedCarouselTabs } from '@/lib/view-transitions/tabs'
import type { OpsxEntityDiagnostic } from '@openspecui/core'
import type { LucideIcon } from 'lucide-react'
import { AlertCircle } from 'lucide-react'
import { useMemo, useRef, type ReactNode, type RefObject } from 'react'
import type { ArtifactOutputDescriptor } from './artifact-output-viewer'
import {
  OpsxDetailLoadingPage,
  OpsxDetailPage,
  OpsxDetailStatePanel,
  OpsxDetailTabs,
} from './opsx-detail-layout'
import {
  buildOpsxEntityDetailTabs,
  type OpsxEntityDetailContentFallback,
  type OpsxEntityDetailFolder,
} from './opsx-entity-detail-tabs'

interface OpsxEntityDetailViewProps {
  entityId: string
  sharedFamily: string
  backTo: VTLinkProps['to']
  backTitle: string
  icon: LucideIcon
  title?: ReactNode
  subtitle?: ReactNode
  headerActions?: ReactNode
  statusRegion?: ReactNode
  diagnostics?: readonly OpsxEntityDiagnostic[]
  handoff: SharedElementHandoff | null
  isLoading: boolean
  loadingMessage: string
  errorMessage?: string
  notFoundMessage?: string
  notFoundBackLabel?: string
  artifacts?: readonly ArtifactOutputDescriptor[]
  hideEmptyArtifacts?: boolean
  contentFallback?: OpsxEntityDetailContentFallback
  folder: OpsxEntityDetailFolder
  tabsQueryKey: string
  initialTab?: string
  supplementaryTabs?: readonly Tab[]
}

type OpsxEntityDetailReadyProps = Pick<
  OpsxEntityDetailViewProps,
  | 'artifacts'
  | 'hideEmptyArtifacts'
  | 'contentFallback'
  | 'folder'
  | 'tabsQueryKey'
  | 'initialTab'
  | 'backTo'
  | 'backTitle'
  | 'icon'
  | 'title'
  | 'subtitle'
  | 'headerActions'
  | 'statusRegion'
  | 'supplementaryTabs'
  | 'diagnostics'
  | 'entityId'
> & {
  headerRef: RefObject<HTMLDivElement | null>
  sharedDescriptor: { family: string; entityId: string }
}

function OpsxEntityDetailReadyView({
  artifacts = [],
  hideEmptyArtifacts = false,
  contentFallback,
  folder,
  tabsQueryKey,
  initialTab,
  backTo,
  backTitle,
  icon,
  title,
  subtitle,
  headerActions,
  statusRegion,
  supplementaryTabs,
  diagnostics,
  entityId,
  headerRef,
  sharedDescriptor,
}: OpsxEntityDetailReadyProps) {
  const tabs = useMemo(
    () =>
      buildOpsxEntityDetailTabs({
        artifacts,
        hideEmptyArtifacts,
        contentFallback,
        folder,
        supplementaryTabs,
      }),
    [artifacts, contentFallback, folder, hideEmptyArtifacts, supplementaryTabs]
  )

  const { tabsRef, selectedTab, onTabChange } = useRoutedCarouselTabs({
    queryKey: tabsQueryKey,
    tabs,
    initialTab: initialTab ?? tabs[0]?.id,
  })

  return (
    <OpsxDetailPage
      backTo={backTo}
      backTitle={backTitle}
      headerRef={headerRef}
      sharedDescriptor={sharedDescriptor}
      icon={icon}
      title={title ?? entityId}
      subtitle={subtitle ?? entityId}
      headerActions={headerActions}
      statusRegion={statusRegion}
      diagnostics={diagnostics}
    >
      <OpsxDetailTabs
        tabsRef={tabsRef}
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={onTabChange}
      />
    </OpsxDetailPage>
  )
}

export function OpsxEntityDetailView({
  entityId,
  sharedFamily,
  backTo,
  backTitle,
  icon,
  title,
  subtitle,
  headerActions,
  statusRegion,
  diagnostics,
  handoff,
  isLoading,
  loadingMessage,
  errorMessage,
  notFoundMessage,
  artifacts,
  hideEmptyArtifacts,
  contentFallback,
  folder,
  tabsQueryKey,
  initialTab,
  supplementaryTabs,
}: OpsxEntityDetailViewProps) {
  const headerRef = useRef<HTMLDivElement | null>(null)
  const sharedDescriptor = useMemo(
    () => ({ family: sharedFamily, entityId }) as const,
    [entityId, sharedFamily]
  )

  if (isLoading) {
    return (
      <OpsxDetailLoadingPage
        backTo={backTo}
        backTitle={backTitle}
        headerRef={headerRef}
        sharedDescriptor={sharedDescriptor}
        icon={icon}
        handoff={handoff}
        fallbackTitle={entityId}
        fallbackSubtitle={entityId}
        loadingMessage={loadingMessage}
      />
    )
  }

  if (notFoundMessage) {
    return (
      <OpsxDetailPage
        backTo={backTo}
        backTitle={backTitle}
        headerRef={headerRef}
        sharedDescriptor={sharedDescriptor}
        icon={icon}
        title={title ?? entityId}
        subtitle={subtitle ?? entityId}
        headerActions={headerActions}
        statusRegion={statusRegion}
        diagnostics={diagnostics}
      >
        <OpsxDetailStatePanel message={notFoundMessage} />
      </OpsxDetailPage>
    )
  }

  if (errorMessage) {
    return (
      <OpsxDetailPage
        backTo={backTo}
        backTitle={backTitle}
        headerRef={headerRef}
        sharedDescriptor={sharedDescriptor}
        icon={icon}
        title={title ?? entityId}
        subtitle={subtitle ?? entityId}
        headerActions={headerActions}
        statusRegion={statusRegion}
        diagnostics={diagnostics}
      >
        <OpsxDetailStatePanel
          tone="destructive"
          message={
            <span className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              {errorMessage}
            </span>
          }
        />
      </OpsxDetailPage>
    )
  }

  return (
    <OpsxEntityDetailReadyView
      entityId={entityId}
      backTo={backTo}
      backTitle={backTitle}
      icon={icon}
      title={title}
      subtitle={subtitle}
      headerActions={headerActions}
      statusRegion={statusRegion}
      diagnostics={diagnostics}
      headerRef={headerRef}
      sharedDescriptor={sharedDescriptor}
      artifacts={artifacts}
      hideEmptyArtifacts={hideEmptyArtifacts}
      contentFallback={contentFallback}
      folder={folder}
      tabsQueryKey={tabsQueryKey}
      initialTab={initialTab}
      supplementaryTabs={supplementaryTabs}
    />
  )
}
