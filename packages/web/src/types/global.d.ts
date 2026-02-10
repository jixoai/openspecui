import type { ExportSnapshot } from '../ssg/types'

declare global {
  interface Window {
    __OPENSPEC_BASE_PATH__?: string
    __OPENSPEC_STATIC_MODE__?: boolean
    __INITIAL_DATA__?: ExportSnapshot
  }
}

export {}
