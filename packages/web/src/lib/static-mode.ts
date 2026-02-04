/**
 * Static Mode Detection and Data Loading
 *
 * This module detects whether the app is running in static export mode
 * and provides data snapshot loading functionality.
 */

import type { ExportSnapshot } from '../../../cli/src/export'

let staticModeDetected: boolean | null = null

// Try to detect static mode early by checking if data.json is present
// This runs synchronously at module load time
try {
  const basePath = (window.__OPENSPEC_BASE_PATH__ || '/').replace(/\/$/, '')
  const dataUrl = `${basePath}/data.json`.replace('//', '/')

  // Use a synchronous check: if we're in static mode, data.json should be available
  // We do this by attempting a synchronous XMLHttpRequest
  const xhr = new XMLHttpRequest()
  xhr.open('HEAD', dataUrl, false) // false = synchronous
  try {
    xhr.send(null)
    if (xhr.status === 200) {
      staticModeDetected = true
      console.log('[static-mode] Detected static export mode')
    }
  } catch {
    // If synchronous request fails (CORS, etc), fall back to async detection
    staticModeDetected = null
  }
} catch {
  staticModeDetected = null
}

/**
 * Check if running in static export mode
 * Static mode is detected by attempting to load data.json
 */
export async function detectStaticMode(): Promise<boolean> {
  if (staticModeDetected !== null) {
    return staticModeDetected
  }

  try {
    const basePath = getBasePath()
    const dataUrl = `${basePath}data.json`.replace('//', '/')
    const response = await fetch(dataUrl, { method: 'HEAD' })
    staticModeDetected = response.ok
  } catch {
    staticModeDetected = false
  }

  return staticModeDetected
}

/**
 * Check if running in static export mode (synchronous, may return null if not yet detected)
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

/**
 * Get the base path for the application
 */
export function getBasePath(): string {
  return window.__OPENSPEC_BASE_PATH__ || '/'
}

/**
 * Load the data snapshot in static mode
 */
export async function loadStaticSnapshot(): Promise<ExportSnapshot | null> {
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
