/**
 * Orthogonal intents (updated 2026-08-01 Asia/Shanghai):
 * 1. Compose Settings OpenSpec diagnostics with a read-only Agent Integrations projection.
 * 2. Keep Environment diagnostics independent from Config-owned Agent management authority.
 *
 * Original request (2026-07-20): "Split OpenSpec diagnostics/initialization out of the oversized Settings route."
 * Original request (2026-08-01): Settings only summarizes Agent state and links management to Config.
 */
import { useEnvironmentGlobalConfigSubscription } from '@/lib/use-planning-config'
import {
  OpenSpecSettingsDiagnosticsSection,
  type SettingsEnvironmentDiagnostics,
} from './openspec-settings-diagnostics'
import { OpenSpecSettingsAgentIntegrationsSection } from './openspec-settings-initialization'

/** ToC positions owned by the parent Settings composition. */
export interface OpenSpecSettingsSectionsProps {
  diagnosticsIndex: number
  agentIntegrationsIndex: number
}

/** Render live diagnostics and the read-only Agent Integrations summary. */
export function OpenSpecSettingsSections({
  diagnosticsIndex,
  agentIntegrationsIndex,
}: OpenSpecSettingsSectionsProps) {
  const environment = useEnvironmentGlobalConfigSubscription()
  const environmentDiagnostics: SettingsEnvironmentDiagnostics = {
    data: environment.data,
    isLoading: environment.isLoading,
    refreshPending: environment.refreshPending,
    error: environment.error,
  }

  return (
    <>
      <OpenSpecSettingsDiagnosticsSection
        index={diagnosticsIndex}
        environment={environmentDiagnostics}
      />
      <OpenSpecSettingsAgentIntegrationsSection index={agentIntegrationsIndex} />
    </>
  )
}
