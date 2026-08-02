/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Give every Config owner one route-local, self-describing navigation plane.
 * 2. Keep narrow containers free of horizontal page scrolling through a responsive grid.
 * 3. Defer page scrolling to the application main host while keeping domain-local editors contained.
 *
 * Owner Config-workbench decision (2026-08-01): replace fixed-owner and dynamic Schema tabs with route-backed pages.
 * Original request (2026-08-01): "还是说我们应该把它迁移到 config 页面下，毕竟 config 页面下有做二级页面的一个前例。"
 */
import { isStaticMode } from '@/lib/static-mode'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  ArrowLeft,
  Bot,
  Boxes,
  FileText,
  LayoutDashboard,
  Link2,
  Settings2,
  Waypoints,
} from 'lucide-react'
import type { ReactNode } from 'react'

export type ConfigSectionId =
  | 'overview'
  | 'project'
  | 'root'
  | 'environment'
  | 'agents'
  | 'schemas'
  | 'context'

interface ConfigNavigationItem {
  id: ConfigSectionId
  label: string
  href: string
  icon: ReactNode
  liveOnly?: boolean
}

const CONFIG_NAVIGATION: readonly ConfigNavigationItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    href: '/config',
    icon: <LayoutDashboard className="h-4 w-4" aria-hidden />,
  },
  {
    id: 'project',
    label: 'Project Binding',
    href: '/config/project',
    icon: <Link2 className="h-4 w-4" aria-hidden />,
    liveOnly: true,
  },
  {
    id: 'root',
    label: 'Active Root',
    href: '/config/root',
    icon: <FileText className="h-4 w-4" aria-hidden />,
  },
  {
    id: 'environment',
    label: 'Environment',
    href: '/config/environment',
    icon: <Settings2 className="h-4 w-4" aria-hidden />,
    liveOnly: true,
  },
  {
    id: 'agents',
    label: 'Agents',
    href: '/config/agents',
    icon: <Bot className="h-4 w-4" aria-hidden />,
    liveOnly: true,
  },
  {
    id: 'schemas',
    label: 'Schemas',
    href: '/config/schemas',
    icon: <Boxes className="h-4 w-4" aria-hidden />,
  },
  {
    id: 'context',
    label: 'Context',
    href: '/config/context',
    icon: <Waypoints className="h-4 w-4" aria-hidden />,
  },
]

/** Shared route frame for one Config owner page. */
export function ConfigWorkbenchPage({
  children,
  current,
  header,
}: {
  children: ReactNode
  current: ConfigSectionId
  header: ReactNode
}) {
  const staticMode = isStaticMode()
  const navigation = staticMode
    ? CONFIG_NAVIGATION.filter((item) => item.liveOnly !== true)
    : CONFIG_NAVIGATION

  return (
    <div
      data-testid="config-workbench"
      data-config-section={current}
      className="@container/config flex min-h-full w-full min-w-0 flex-col overflow-x-clip"
    >
      <div className="shrink-0 space-y-4 px-4 pt-4">
        {header}
        <nav
          aria-label="Config sections"
          className="@[36rem]:grid-cols-4 @[72rem]:grid-cols-7 grid min-w-0 grid-cols-2 gap-2"
        >
          {navigation.map((item) => {
            const selected = current === item.id
            return (
              <VTLink
                key={item.id}
                to={item.href}
                aria-current={selected ? 'page' : undefined}
                className={`focus-visible:ring-primary flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium outline-none focus-visible:ring-2 ${
                  selected
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                {item.icon}
                <span className="min-w-0 truncate">{item.label}</span>
              </VTLink>
            )
          })}
        </nav>
      </div>
      <div className="min-w-0 p-4">{children}</div>
    </div>
  )
}

/** Consistent title identity for focused Config owner routes. */
export function ConfigOwnerHeader({
  backHref = '/config',
  backLabel = 'Config',
  description,
  icon,
  title,
  trailing,
}: {
  backHref?: string
  backLabel?: string
  description: string
  icon: ReactNode
  title: string
  trailing?: ReactNode
}) {
  return (
    <header className="space-y-3">
      <VTLink
        to={backHref}
        aria-label={`Back to ${backLabel}`}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-primary inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-xs outline-none focus-visible:ring-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {backLabel}
      </VTLink>
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
            {icon}
            <span className="min-w-0 truncate">{title}</span>
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm">{description}</p>
        </div>
        {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
      </div>
    </header>
  )
}
