/**
 * Orthogonal intents (updated 2026-08-03 Asia/Shanghai):
 * 1. Compose reusable OPSX detail headers, pages, tabs, diagnostics, and state panels.
 * 2. Preserve shared-element navigation and geometry-stable loading presentation.
 * 3. Keep compact Header actions physically separate from full-width status content.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢。"
 * Original request (2026-07-28): "你说的组件化封装是必要的。"
 * Original request (2026-08-03): prevent Change Detail evidence from growing the Header's right side.
 */
import { AccessibleStatus, DetailPanelSkeleton } from '@/components/realtime'
import { Tabs, type Tab } from '@/components/tabs'
import { cn } from '@/lib/utils'
import { VTLink, type VTLinkProps } from '@/lib/view-transitions/navigation'
import {
  getSharedElementBinding,
  type SharedElementDescriptor,
  type SharedElementHandoff,
} from '@/lib/view-transitions/shared-elements'
import type { OpsxEntityDiagnostic } from '@openspecui/core'
import type { LucideIcon } from 'lucide-react'
import { AlertTriangle, ArrowLeft } from 'lucide-react'
import type { ReactNode, RefObject } from 'react'
import type { TabsHandle } from '../tabs'

interface OpsxDetailHeaderProps {
  backTo: VTLinkProps['to']
  backTitle: string
  headerRef: RefObject<HTMLDivElement | null>
  sharedDescriptor: SharedElementDescriptor
  icon: LucideIcon
  title: ReactNode
  subtitle: ReactNode
  headerActions?: ReactNode
}

interface OpsxDetailPageProps extends OpsxDetailHeaderProps {
  diagnostics?: readonly OpsxEntityDiagnostic[]
  statusRegion?: ReactNode
  children: ReactNode
}

interface OpsxDetailLoadingPageProps
  extends Omit<OpsxDetailHeaderProps, 'title' | 'subtitle' | 'headerActions'> {
  handoff: SharedElementHandoff | null
  fallbackTitle: string
  fallbackSubtitle: string
  loadingMessage: string
}

interface OpsxDetailStatePanelProps {
  message: ReactNode
  tone?: 'default' | 'destructive'
}

interface OpsxDetailTabsProps {
  tabsRef: RefObject<TabsHandle | null>
  tabs: Tab[]
  selectedTab?: string
  onTabChange: (id: string) => void
  className?: string
}

function OpsxDetailHeader({
  backTo,
  backTitle,
  headerRef,
  sharedDescriptor,
  icon: Icon,
  title,
  subtitle,
  headerActions,
}: OpsxDetailHeaderProps) {
  return (
    <div
      data-testid="opsx-detail-header"
      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"
    >
      <div className="flex min-w-0 items-center gap-4">
        <VTLink
          to={backTo}
          vt={{ source: headerRef, sharedElements: sharedDescriptor }}
          className="hover:bg-muted rounded-md p-2 transition-colors"
          title={backTitle}
        >
          <ArrowLeft className="h-5 w-5" />
        </VTLink>
        <div
          ref={headerRef}
          {...getSharedElementBinding(sharedDescriptor, 'container')}
          className="flex min-w-0 flex-col gap-1"
        >
          <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
            <Icon
              {...getSharedElementBinding(sharedDescriptor, 'icon')}
              className="h-6 w-6 shrink-0"
            />
            <span {...getSharedElementBinding(sharedDescriptor, 'title')} className="truncate">
              {title}
            </span>
          </h1>
          <p className="text-muted-foreground truncate text-sm">{subtitle}</p>
        </div>
      </div>
      {headerActions}
    </div>
  )
}

export function OpsxDetailPage({
  diagnostics,
  statusRegion,
  children,
  ...headerProps
}: OpsxDetailPageProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <OpsxDetailHeader {...headerProps} />
      {statusRegion ? (
        <div data-testid="opsx-detail-status-region" className="min-w-0">
          {statusRegion}
        </div>
      ) : null}
      <OpsxDetailDiagnostics diagnostics={diagnostics ?? []} />
      {children}
    </div>
  )
}

export function OpsxDetailLoadingPage({
  handoff,
  fallbackTitle,
  fallbackSubtitle,
  loadingMessage,
  ...headerProps
}: OpsxDetailLoadingPageProps) {
  return (
    <OpsxDetailPage
      {...headerProps}
      title={handoff?.title ?? fallbackTitle}
      subtitle={handoff?.subtitle ?? fallbackSubtitle}
    >
      {/* The detail-loading body is a stable visual skeleton (luminance language) rather than routine copy.
          The shared-element header stays mounted so the detail View Transition does not snap. The hidden
          accessible equivalent preserves the loading semantic for assistive tech / reduced motion. */}
      <div className="vt-detail-content flex min-h-[240px] flex-1 flex-col" aria-busy="true">
        <AccessibleStatus>{loadingMessage ?? 'loading'}</AccessibleStatus>
        <DetailPanelSkeleton count={6} />
      </div>
    </OpsxDetailPage>
  )
}

export function OpsxDetailTabs({
  tabsRef,
  tabs,
  selectedTab,
  onTabChange,
  className,
}: OpsxDetailTabsProps) {
  return (
    <div className="vt-detail-content flex min-h-0 flex-1 flex-col">
      <Tabs
        ref={tabsRef}
        tabs={tabs}
        selectedTab={selectedTab}
        onTabChange={onTabChange}
        className={cn('min-h-0 flex-1', className)}
      />
    </div>
  )
}

export function OpsxDetailDiagnostics({
  diagnostics,
}: {
  diagnostics: readonly OpsxEntityDiagnostic[]
}) {
  if (diagnostics.length === 0) return null

  return (
    <div className="border-border bg-muted/20 flex flex-col gap-2 rounded-md border p-3 text-sm">
      {diagnostics.map((diagnostic, index) => (
        <div key={`${diagnostic.message}-${index}`} className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <div>
            <div className="font-medium capitalize">{diagnostic.level}</div>
            <div className="text-muted-foreground">
              {diagnostic.path ? `${diagnostic.path}: ` : ''}
              {diagnostic.message}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export function OpsxDetailStatePanel({ message, tone = 'default' }: OpsxDetailStatePanelProps) {
  return (
    <div
      className={cn(
        'vt-detail-content flex min-h-[240px] flex-1 items-center justify-center rounded-lg border border-dashed p-6 text-sm',
        tone === 'destructive' ? 'text-destructive border-destructive/40' : 'text-muted-foreground'
      )}
    >
      {message}
    </div>
  )
}
