/**
 * Orthogonal intents (created 2026-07-31 Asia/Shanghai):
 * 1. Prove observation refresh procedures are public read queries even when they update internal caches or stamps.
 * 2. Keep domain mutations outside the readonly refresh inventory.
 *
 * Original request (2026-07-31): "这个只是辅助‘只读’的动作，它的本质仍然是Readonly，所以把它改成只读才是解决问题的根本"
 */
import { describe, expect, it } from 'vitest'
import { appRouter } from './router.js'

const READONLY_REFRESH_PROCEDURES = [
  ['dashboard.refreshGitSnapshot', appRouter.dashboard.refreshGitSnapshot],
  ['git.refresh', appRouter.git.refresh],
  ['planningCliProjection.refresh', appRouter.planningCliProjection.refresh],
  ['stores.refreshProjection', appRouter.stores.refreshProjection],
  [
    'planningConfig.refreshEnvironmentGlobalProjection',
    appRouter.planningConfig.refreshEnvironmentGlobalProjection,
  ],
  [
    'planningConfig.refreshEnvironmentGlobalFileProjection',
    appRouter.planningConfig.refreshEnvironmentGlobalFileProjection,
  ],
  ['rootContext.refreshProjection', appRouter.rootContext.refreshProjection],
  ['localModels.refreshProfiles', appRouter.localModels.refreshProfiles],
  ['localModels.refreshArtifacts', appRouter.localModels.refreshArtifacts],
  ['localCt2Models.refreshArtifacts', appRouter.localCt2Models.refreshArtifacts],
  ['localLlamaModels.refreshArtifacts', appRouter.localLlamaModels.refreshArtifacts],
] as const

describe('readonly refresh procedure contract', () => {
  it.each(READONLY_REFRESH_PROCEDURES)('registers %s as a query', (_path, procedure) => {
    expect(procedure._def.type).toBe('query')
  })
})
