/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Summarize every Config owner and keep direct readiness failures in the overview plane.
 * 2. Expose route-backed local navigation plus Init, Guide, and Context title actions.
 * 3. Keep static publication read-only without starting Project, Environment, or Agent live owners.
 *
 * Owner Config-workbench decision (2026-08-01): `/config` becomes the overview for route-backed owner pages.
 * Owner Config-Guide decision (2026-08-01): keep Guide in the Config title action plane.
 * Original request (2026-08-01): "我希望在Config页面加一个 `Guide` 的按钮，点击后使用js引导库来引导用户完成相关的openspec项目配置。"
 */
import { useConfigGuide } from '@/components/config/config-guide'
import { ConfigWorkbenchPage, type ConfigSectionId } from '@/components/config/config-workbench'
import { useProjectInitialization } from '@/components/config/project-initialization'
import { ResolvedContextAction } from '@/components/config/resolved-context-header'
import { isStaticMode } from '@/lib/static-mode'
import { useAgentIntegrations } from '@/lib/use-agent-integrations'
import { useOpsxConfigBundleSubscription } from '@/lib/use-opsx'
import {
  useActiveRootConfigViewSubscription,
  useEnvironmentGlobalConfigSubscription,
  useProjectBindingSubscription,
} from '@/lib/use-planning-config'
import { useRootActionState } from '@/lib/use-root-action-state'
import { VTLink } from '@/lib/view-transitions/navigation'
import {
  AlertCircle,
  Bot,
  Boxes,
  Compass,
  FileText,
  Link2,
  Settings2,
  SlidersHorizontal,
  WandSparkles,
  Waypoints,
} from 'lucide-react'
import type { ReactNode } from 'react'

type OverviewStatus = 'attention' | 'blocked' | 'loading' | 'ready' | 'static'

interface OverviewCardModel {
  description: string
  error?: string
  href?: string
  icon: ReactNode
  id: Exclude<ConfigSectionId, 'overview'>
  status: OverviewStatus
  statusLabel: string
  summary: string
  title: string
}

const STATUS_CLASS: Record<OverviewStatus, string> = {
  ready: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  attention: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  blocked: 'border-destructive/40 bg-destructive/10 text-destructive',
  loading: 'border-border bg-muted text-muted-foreground',
  static: 'border-border bg-muted text-muted-foreground',
}

function ConfigOverviewHeader() {
  const initialization = useProjectInitialization()
  const guide = useConfigGuide()
  const staticMode = isStaticMode()
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
          <SlidersHorizontal className="h-6 w-6 shrink-0" aria-hidden />
          Config
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Configure declarations by owner, then verify the CLI-selected result through Resolved
          Context.
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {initialization?.projection && !initialization.projection.initialized ? (
          <button
            type="button"
            onClick={initialization.open}
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium"
          >
            <WandSparkles className="h-4 w-4" aria-hidden />
            Init
          </button>
        ) : null}
        {!staticMode ? (
          <button
            id="config-guide-overview-action"
            data-config-guide-overview="true"
            type="button"
            disabled={!guide?.canStart}
            onClick={guide?.active ? guide.restart : guide?.start}
            title={
              guide?.canStart
                ? 'Guide Project Binding, Active Root, Agent Delivery, and Resolved Context.'
                : 'Initialize the local OpenSpec project before starting the Guide.'
            }
            className="border-border bg-background text-foreground hover:bg-muted inline-flex h-9 items-center gap-2 rounded-md border px-3 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Compass className="h-4 w-4" aria-hidden />
            {guide?.active ? 'Restart Guide' : 'Guide'}
          </button>
        ) : null}
        <ResolvedContextAction />
      </div>
    </header>
  )
}

function OverviewCard({ model }: { model: OverviewCardModel }) {
  const content = (
    <>
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-muted-foreground shrink-0">{model.icon}</span>
          <h2 className="min-w-0 truncate text-sm font-semibold">{model.title}</h2>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-medium ${STATUS_CLASS[model.status]}`}
        >
          {model.statusLabel}
        </span>
      </div>
      <p className="text-muted-foreground text-xs">{model.description}</p>
      <p className="text-sm">{model.summary}</p>
      {model.error ? (
        <div role="alert" className="text-destructive flex items-start gap-1.5 text-xs">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>{model.error}</span>
        </div>
      ) : null}
    </>
  )

  const className =
    'border-border bg-card flex min-h-40 min-w-0 flex-col gap-3 rounded-lg border p-4'
  return model.href ? (
    <VTLink
      to={model.href}
      aria-label={model.title}
      className={`${className} hover:border-primary/40 hover:bg-muted/30 focus-visible:ring-primary outline-none focus-visible:ring-2`}
    >
      {content}
    </VTLink>
  ) : (
    <section aria-label={model.title} className={className}>
      {content}
    </section>
  )
}

function ConfigOverviewCards({ models }: { models: readonly OverviewCardModel[] }) {
  return (
    <div className="@[42rem]:grid-cols-2 @[72rem]:grid-cols-3 grid min-w-0 gap-3">
      {models.map((model) => (
        <OverviewCard key={model.id} model={model} />
      ))}
    </div>
  )
}

function LiveConfigOverview() {
  const project = useProjectBindingSubscription()
  const root = useActiveRootConfigViewSubscription()
  const environment = useEnvironmentGlobalConfigSubscription()
  const agents = useAgentIntegrations()
  const schemas = useOpsxConfigBundleSubscription()
  const context = useRootActionState()

  const agentIssueCount =
    agents.data?.states.reduce((count, state) => count + (state.issues.length > 0 ? 1 : 0), 0) ?? 0
  const projectReferenceCount = project.data?.binding.references.entries.length ?? 0
  const schemaCount = schemas.data?.schemas.length ?? 0
  const models: OverviewCardModel[] = [
    {
      id: 'project',
      title: 'Project Binding',
      description: 'Launch-project Store and read-only Reference declarations.',
      href: '/config/project',
      icon: <Link2 className="h-4 w-4" aria-hidden />,
      status: project.error ? 'blocked' : project.isLoading && !project.data ? 'loading' : 'ready',
      statusLabel: project.error
        ? 'Blocked'
        : project.isLoading && !project.data
          ? 'Loading'
          : 'Observed',
      summary: project.data
        ? `${project.data.binding.store.state} Store · ${projectReferenceCount} References`
        : 'Waiting for launch-project declarations.',
      error: project.error?.message,
    },
    {
      id: 'root',
      title: 'Active Root',
      description: 'Physical config selected by the current Planning Root.',
      href: '/config/root',
      icon: <FileText className="h-4 w-4" aria-hidden />,
      status: root.error
        ? 'blocked'
        : root.isLoading && !root.data
          ? 'loading'
          : root.data?.exists
            ? 'ready'
            : 'attention',
      statusLabel: root.error
        ? 'Blocked'
        : root.isLoading && !root.data
          ? 'Loading'
          : root.data?.exists
            ? 'Available'
            : 'Missing',
      summary: root.data?.exists
        ? root.data.filePath || 'Published config document'
        : 'No config file exists in the selected Root.',
      error: root.error?.message,
    },
    {
      id: 'environment',
      title: 'Environment',
      description: 'Machine defaultStore, feature flags, and global source evidence.',
      href: '/config/environment',
      icon: <Settings2 className="h-4 w-4" aria-hidden />,
      status: environment.error
        ? 'blocked'
        : environment.isLoading && !environment.data
          ? 'loading'
          : environment.authority.state === 'current'
            ? 'ready'
            : 'attention',
      statusLabel: environment.error
        ? 'Blocked'
        : environment.isLoading && !environment.data
          ? 'Loading'
          : environment.authority.state === 'current'
            ? 'Current'
            : 'Refreshing',
      summary: environment.data
        ? (environment.data.configPath ?? 'Global config path is unavailable.')
        : 'Waiting for the CLI-owned environment projection.',
      error: environment.error?.message,
    },
    {
      id: 'agents',
      title: 'Agent Delivery',
      description: 'Official delivery policy, physical inventory, migration, and repair.',
      href: '/config/agents',
      icon: <Bot className="h-4 w-4" aria-hidden />,
      status: agents.error
        ? 'blocked'
        : agents.isLoading && !agents.data
          ? 'loading'
          : agentIssueCount > 0
            ? 'attention'
            : 'ready',
      statusLabel: agents.error
        ? 'Blocked'
        : agents.isLoading && !agents.data
          ? 'Loading'
          : agentIssueCount > 0
            ? 'Attention'
            : 'Current',
      summary: agents.data
        ? `${agents.data.registry.length} Agents · ${agentIssueCount} with issues`
        : 'Waiting for the Server-owned Agent projection.',
      error: agents.error?.message,
    },
    {
      id: 'schemas',
      title: 'Schemas',
      description: 'Resolved workflow Schema catalog and physical detail workspaces.',
      href: '/config/schemas',
      icon: <Boxes className="h-4 w-4" aria-hidden />,
      status: schemas.error
        ? 'blocked'
        : schemas.isLoading && !schemas.data
          ? 'loading'
          : schemaCount > 0
            ? 'ready'
            : 'attention',
      statusLabel: schemas.error
        ? 'Blocked'
        : schemas.isLoading && !schemas.data
          ? 'Loading'
          : schemaCount > 0
            ? 'Available'
            : 'Empty',
      summary: schemas.data ? `${schemaCount} resolved Schemas` : 'Waiting for the Schema catalog.',
      error: schemas.error?.message,
    },
    {
      id: 'context',
      title: 'Resolved Context',
      description: 'Effective Root, Store, References, and current action authority.',
      href: '/config/context',
      icon: <Waypoints className="h-4 w-4" aria-hidden />,
      status:
        context.status === 'ready' ? 'ready' : context.status === 'blocked' ? 'blocked' : 'loading',
      statusLabel:
        context.status === 'ready'
          ? 'Ready'
          : context.status === 'blocked'
            ? 'Blocked'
            : 'Resolving',
      summary:
        context.context?.planningRoot?.path ??
        (context.status === 'ready'
          ? 'Root Context is current.'
          : 'Waiting for CLI-selected Root Context.'),
      error: context.status === 'blocked' ? context.message : undefined,
    },
  ]

  return <ConfigOverviewCards models={models} />
}

function StaticConfigOverview() {
  const root = useActiveRootConfigViewSubscription()
  const schemas = useOpsxConfigBundleSubscription()
  const schemaCount = schemas.data?.schemas.length ?? 0
  const models: OverviewCardModel[] = [
    {
      id: 'project',
      title: 'Project Binding',
      description: 'Launch-project declarations are intentionally excluded from publication.',
      icon: <Link2 className="h-4 w-4" aria-hidden />,
      status: 'static',
      statusLabel: 'Not published',
      summary: 'Open this project live to inspect or edit Project Binding.',
    },
    {
      id: 'root',
      title: 'Active Root',
      description: 'Read-only configuration content included in this snapshot.',
      href: '/config/root',
      icon: <FileText className="h-4 w-4" aria-hidden />,
      status: root.error ? 'blocked' : root.isLoading && !root.data ? 'loading' : 'static',
      statusLabel: root.error ? 'Blocked' : root.isLoading && !root.data ? 'Loading' : 'Snapshot',
      summary: root.data?.exists
        ? 'Published config document is available.'
        : 'No config document published.',
      error: root.error?.message,
    },
    {
      id: 'environment',
      title: 'Environment',
      description: 'Machine paths and global configuration are private runtime facts.',
      icon: <Settings2 className="h-4 w-4" aria-hidden />,
      status: 'static',
      statusLabel: 'Not published',
      summary: 'Static output carries no Environment mutation or machine-path authority.',
    },
    {
      id: 'agents',
      title: 'Agent Delivery',
      description: 'Agent inventory and mutation authority remain live-only.',
      icon: <Bot className="h-4 w-4" aria-hidden />,
      status: 'static',
      statusLabel: 'Not published',
      summary: 'Static output contains no Agent policy or physical inventory.',
    },
    {
      id: 'schemas',
      title: 'Schemas',
      description: 'Read-only Schema catalog and published physical documents.',
      href: '/config/schemas',
      icon: <Boxes className="h-4 w-4" aria-hidden />,
      status: schemas.error ? 'blocked' : schemas.isLoading && !schemas.data ? 'loading' : 'static',
      statusLabel: schemas.error
        ? 'Blocked'
        : schemas.isLoading && !schemas.data
          ? 'Loading'
          : 'Snapshot',
      summary: schemas.data
        ? `${schemaCount} published Schemas`
        : 'Waiting for published Schema data.',
      error: schemas.error?.message,
    },
    {
      id: 'context',
      title: 'Resolved Context',
      description: 'Publication-redacted Root and Reference provenance.',
      href: '/config/context',
      icon: <Waypoints className="h-4 w-4" aria-hidden />,
      status: 'static',
      statusLabel: 'Snapshot',
      summary: 'Inspect the publication-safe Context evidence boundary.',
    },
  ]

  return <ConfigOverviewCards models={models} />
}

/** Route-backed Config overview. */
export function Config() {
  const staticMode = isStaticMode()
  return (
    <ConfigWorkbenchPage current="overview" header={<ConfigOverviewHeader />}>
      {staticMode ? <StaticConfigOverview /> : <LiveConfigOverview />}
    </ConfigWorkbenchPage>
  )
}
