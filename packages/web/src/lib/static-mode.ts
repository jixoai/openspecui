/**
 * Static Mode Detection and Data Loading
 *
 * This module detects whether the app is running in static export mode
 * and provides data snapshot loading functionality.
 */

import type { ExportSnapshot } from '../ssg/types'

let staticModeDetected: boolean | null = null

const isDev = import.meta.env.DEV

// Check for static mode flag set by SSG at build time
// This is the preferred detection method - no network requests needed
if (typeof window !== 'undefined' && window.__OPENSPEC_STATIC_MODE__ === true && !isDev) {
  staticModeDetected = true
  console.log('[static-mode] Detected static export mode (via flag)')
}

/**
 * Check if running in static export mode
 * Static mode is detected by:
 * 1. window.__OPENSPEC_STATIC_MODE__ flag (set by SSG)
 * 2. Fallback: attempting to load data.json
 */
export async function detectStaticMode(): Promise<boolean> {
  if (staticModeDetected !== null) {
    return staticModeDetected
  }

  if (isDev) {
    staticModeDetected = false
    return staticModeDetected
  }

  // Fallback: check for data.json
  try {
    const basePath = getBasePath()
    const dataUrl = `${basePath}data.json`.replace('//', '/')
    const response = await fetch(dataUrl, { method: 'HEAD', cache: 'no-store' })
    const contentType = response.headers.get('content-type')
    staticModeDetected = response.ok && Boolean(contentType?.includes('application/json'))
  } catch {
    staticModeDetected = false
  }

  return staticModeDetected
}

/**
 * Check if running in static export mode (synchronous)
 */
export function isStaticMode(): boolean {
  return staticModeDetected === true
}

/**
 * Set static mode (used during app initialization)
 */
export function setStaticMode(value: boolean): void {
  staticModeDetected = value
}

// SSR basePath - set during server-side rendering
let ssrBasePath: string | null = null

/**
 * Set base path for SSR (called before rendering)
 */
export function setSSRBasePath(basePath: string): void {
  ssrBasePath = basePath
}

/**
 * Get the base path for the application
 */
export function getBasePath(): string {
  // SSR mode: use the set basePath
  if (ssrBasePath !== null) {
    return ssrBasePath
  }
  // Browser mode: use window variable
  if (typeof window !== 'undefined') {
    return window.__OPENSPEC_BASE_PATH__ || './'
  }
  return './'
}

/**
 * Get initial data injected by SSG (if available)
 */
export function getInitialData(): ExportSnapshot | null {
  if (typeof window !== 'undefined' && window.__INITIAL_DATA__) {
    return window.__INITIAL_DATA__
  }
  return null
}

/**
 * Load the data snapshot in static mode
 */
export async function loadStaticSnapshot(): Promise<ExportSnapshot | null> {
  // First check for injected data (faster, no network request)
  const initialData = getInitialData()
  if (initialData) {
    return initialData
  }

  // Fallback: fetch from data.json
  const isStatic = await detectStaticMode()
  if (!isStatic) {
    return null
  }

  try {
    const basePath = getBasePath()
    const dataUrl = `${basePath}data.json`.replace('//', '/')
    const response = await fetch(dataUrl)

    if (!response.ok) {
      console.error('Failed to load data snapshot:', response.statusText)
      return null
    }

    const snapshot = (await response.json()) as ExportSnapshot
    return snapshot
  } catch (error) {
    console.error('Error loading static snapshot:', error)
    return null
  }
}

/**
 * Static snapshot cache - loaded once and reused
 */
let snapshotCache: ExportSnapshot | null | undefined = undefined

/**
 * Get the cached snapshot or load it if not yet loaded
 */
export async function getStaticSnapshot(): Promise<ExportSnapshot | null> {
  if (snapshotCache !== undefined) {
    return snapshotCache
  }

  snapshotCache = await loadStaticSnapshot()
  return snapshotCache
}

/**
 * Check if snapshot is loaded
 */
export function isSnapshotLoaded(): boolean {
  return snapshotCache !== undefined && snapshotCache !== null
}

/**
 * Get snapshot metadata (timestamp, version, etc.)
 */
export function getSnapshotMeta() {
  if (!isSnapshotLoaded() || !snapshotCache) {
    return null
  }
  return snapshotCache.meta
}
