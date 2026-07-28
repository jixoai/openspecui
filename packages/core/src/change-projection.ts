/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Define the shared progressive active-Change row projection contract.
 * 2. Preserve row-level failures independently from completed rows and terminal transport errors.
 * 3. Represent known and unknown progress without allowing fabricated percentages.
 * 4. Keep workflow Status, Apply, and artifact details outside the list-row payload.
 *
 * Original request (2026-07-23): "现在页面数据的加载数据非常慢（比如dashboard页面、changes页面都要等待非常久，页面刷新后，似乎后台没有缓存一样，也要加载很久。"
 */
import type { ChangeMeta } from './adapter.js'

/** A row-level failure that does not discard successfully projected Change rows. */
export interface ChangeProjectionRowError {
  changeId: string
  message: string
}

/** Stable completed data for one active-Change inventory projection. */
export interface ChangeProjectionData {
  rows: ChangeMeta[]
  errors: ChangeProjectionRowError[]
}

/** One bounded incremental delivery from the active-Change inventory. */
export interface ChangeProjectionBatch {
  rows: ChangeMeta[]
  errors: ChangeProjectionRowError[]
  progress: { completed: number; total: number | 'unknown' }
}
