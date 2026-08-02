/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Give the CLI-selected Active Root configuration a focused live/static Config route.
 * 2. Preserve the existing raw file projection and mutation lifecycle before structured editing begins.
 *
 * Owner Config-workbench decision (2026-08-01): move Active Root to `/config/root`.
 * Original request (2026-08-01): "这也意味着我们需要对现有的 Active Root Config 做可视化改造。"
 */
import { ActiveRootConfigSection } from '@/components/config/active-root-config-section'
import { ConfigOwnerHeader, ConfigWorkbenchPage } from '@/components/config/config-workbench'
import { isStaticMode } from '@/lib/static-mode'
import { FileText } from 'lucide-react'

/** Config route for the selected Planning Root's physical config document. */
export function ConfigRoot() {
  const staticMode = isStaticMode()
  return (
    <ConfigWorkbenchPage
      current="root"
      header={
        <ConfigOwnerHeader
          title="Active Root"
          description="Inspect and edit the configuration owned by the CLI-selected Planning Root."
          icon={<FileText className="h-6 w-6 shrink-0" aria-hidden />}
        />
      }
    >
      <ActiveRootConfigSection isStatic={staticMode} />
    </ConfigWorkbenchPage>
  )
}
