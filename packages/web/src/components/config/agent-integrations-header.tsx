/**
 * Orthogonal intents (created 2026-08-01 Asia/Shanghai):
 * 1. Expose Agent Integrations as a low-frequency Config title action.
 * 2. Give the live-only Agent page one predictable Config return and page identity.
 *
 * Original request (2026-08-01): keep Agent configuration under Config as a secondary page.
 */
import { VTLink } from '@/lib/view-transitions/navigation'
import { ArrowLeft, Bot } from 'lucide-react'

/** Config title action for the live Agent delivery workbench. */
export function AgentIntegrationsAction() {
  return (
    <VTLink
      to="/config/agents"
      aria-label="Manage Agent Integrations"
      className="border-border hover:bg-muted focus-visible:ring-primary inline-flex h-9 shrink-0 items-center gap-2 rounded-md border px-3 text-xs font-medium outline-none focus-visible:ring-2"
    >
      <Bot className="h-4 w-4" aria-hidden />
      Agents
    </VTLink>
  )
}

/** Header for the Config-owned Agent Integrations page. */
export function AgentIntegrationsHeader() {
  return (
    <header className="space-y-3">
      <VTLink
        to="/config"
        className="text-muted-foreground hover:text-foreground focus-visible:ring-primary inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-xs outline-none focus-visible:ring-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Config
      </VTLink>
      <div>
        <h1 className="font-nav flex min-w-0 items-center gap-2 text-2xl font-bold">
          <Bot className="h-6 w-6 shrink-0" aria-hidden />
          Agent Integrations
        </h1>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm">
          Configure official OpenSpec delivery policy, inspect physical artifacts, and reconcile
          Agent integrations from one Server-owned surface.
        </p>
      </div>
    </header>
  )
}
