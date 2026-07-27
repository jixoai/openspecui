/**
 * Orthogonal intents (created 2026-07-20 Asia/Shanghai):
 * 1. Compose Settings OpenSpec diagnostics and initialization from one Environment Global subscription.
 *
 * Original request (2026-07-20): "Split OpenSpec diagnostics/initialization out of the oversized Settings route."
 */
import { useEnvironmentGlobalConfigSubscription } from '@/lib/use-planning-config'
import { useMemo } from 'react'
import {
  OpenSpecSettingsDiagnosticsSection,
  type SettingsEnvironmentDiagnostics,
} from './openspec-settings-diagnostics'
import {
  OpenSpecSettingsInitializationSection,
  type SettingsToolDeliveryInput,
} from './openspec-settings-initialization'

/** ToC positions owned by the parent Settings composition. */
export interface OpenSpecSettingsSectionsProps {
  diagnosticsIndex: number
  initializationIndex: number
}

/** Render live Settings diagnostics and tool initialization from independent facts. */
export function OpenSpecSettingsSections({
  diagnosticsIndex,
  initializationIndex,
}: OpenSpecSettingsSectionsProps) {
  const environment = useEnvironmentGlobalConfigSubscription()
  const environmentDiagnostics: SettingsEnvironmentDiagnostics = {
    data: environment.data,
    isLoading: environment.isLoading,
    refreshPending: environment.refreshPending,
    error: environment.error,
  }
  const environmentCurrent =
    !environment.isLoading &&
    !environment.refreshPending &&
    environment.error === null &&
    environment.data !== null &&
    environment.data !== undefined
  const profile = environment.data?.profileState
  const toolInput = useMemo<SettingsToolDeliveryInput | null>(
    () =>
      environmentCurrent && profile?.available && profile.delivery
        ? { delivery: profile.delivery, workflows: [...profile.workflows] }
        : null,
    [environmentCurrent, profile]
  )

  return (
    <>
      <OpenSpecSettingsDiagnosticsSection
        index={diagnosticsIndex}
        environment={environmentDiagnostics}
      />
      <OpenSpecSettingsInitializationSection
        index={initializationIndex}
        input={toolInput}
        environmentWaiting={environment.isLoading || environment.refreshPending}
        environmentError={environment.error}
      />
    </>
  )
}
