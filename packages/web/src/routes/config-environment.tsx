/**
 * Orthogonal intents (created 2026-08-02 Asia/Shanghai):
 * 1. Give machine-level OpenSpec environment configuration a focused live Config route.
 * 2. Preserve Environment defaultStore, feature flags, raw JSON, and projection lifecycle ownership.
 *
 * Owner Config-workbench decision (2026-08-01): move Environment Global to `/config/environment`.
 * Original request (2026-08-01): "Environment Global Config 好像已经包含了我们要的agents相关配置，这个页面是不是也要重构？"
 */
import { ConfigOwnerHeader, ConfigWorkbenchPage } from '@/components/config/config-workbench'
import { EnvironmentGlobalConfigSection } from '@/components/config/environment-global-config-section'
import { Settings2 } from 'lucide-react'

/** Live Config route for machine-level OpenSpec environment configuration. */
export function ConfigEnvironment() {
  return (
    <ConfigWorkbenchPage
      current="environment"
      header={
        <ConfigOwnerHeader
          title="Environment"
          description="Manage machine defaults and inspect the CLI-owned global configuration source."
          icon={<Settings2 className="h-6 w-6 shrink-0" aria-hidden />}
        />
      }
    >
      <EnvironmentGlobalConfigSection isStatic={false} />
    </ConfigWorkbenchPage>
  )
}
