/**
 * SSG module exports
 */
export type { ExportSnapshot } from '@openspecui/core'
export { getRoutes, getTitle, render } from './entry-server'
export {
  StaticDataProvider,
  useBasePath,
  useIsStaticMode,
  useStaticData,
  useStaticSnapshot,
} from './static-data-context'
