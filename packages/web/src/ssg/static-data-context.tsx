/**
 * Static data context for SSG
 */
import type { ExportSnapshot } from '@openspecui/core'
import { createContext, useContext, type ReactNode } from 'react'

interface StaticDataContextValue {
  snapshot: ExportSnapshot | null
  basePath: string
  isStatic: boolean
}

const StaticDataContext = createContext<StaticDataContextValue>({
  snapshot: null,
  basePath: '/',
  isStatic: false,
})

export function StaticDataProvider({
  children,
  snapshot,
  basePath = '/',
}: {
  children: ReactNode
  snapshot: ExportSnapshot | null
  basePath?: string
}) {
  return (
    <StaticDataContext.Provider value={{ snapshot, basePath, isStatic: true }}>
      {children}
    </StaticDataContext.Provider>
  )
}

export function useStaticData() {
  return useContext(StaticDataContext)
}

export function useStaticSnapshot() {
  return useContext(StaticDataContext).snapshot
}

export function useIsStaticMode() {
  return useContext(StaticDataContext).isStatic
}

export function useBasePath() {
  return useContext(StaticDataContext).basePath
}
