/**
 * Orthogonal intents (created 2026-07-30 Asia/Shanghai):
 * 1. Bind the Stores Environment evidence subpage to current observed sources.
 *
 * Original request (2026-07-30): "Stores 完全可以融入 `Environment Center` 这个东西。"
 */
import { useNavigate } from '@tanstack/react-router'
import { StoresEnvironmentEvidence } from '../components/stores-environment-evidence'
import { buildStoresIndexPath } from '../lib/store-route-identity'
import { useStoresRuntime } from '../lib/stores-runtime'

/** Production route owner for `/stores/environments`. */
export function StoresEnvironmentsRoute() {
  const navigate = useNavigate()
  const runtime = useStoresRuntime()
  return (
    <StoresEnvironmentEvidence
      environments={runtime.environments}
      onBack={() => void navigate({ to: buildStoresIndexPath() })}
    />
  )
}
