import { EventEmitter } from 'events'
import { watch, type FSWatcher } from 'fs'
import { join } from 'path'

/**
 * File change event types
 */
export type FileChangeType = 'spec' | 'change' | 'archive' | 'project'

/**
 * File change event payload
 */
export interface FileChangeEvent {
  type: FileChangeType
  action: 'create' | 'update' | 'delete'
  id?: string
  path: string
  timestamp: number
}

/**
 * OpenSpec file watcher
 * Watches the openspec/ directory for changes and emits events
 */
export class OpenSpecWatcher extends EventEmitter {
  private watchers: FSWatcher[] = []
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private debounceMs: number

  constructor(
    private projectDir: string,
    options: { debounceMs?: number } = {}
  ) {
    super()
    this.debounceMs = options.debounceMs ?? 100
  }

  private get openspecDir() {
    return join(this.projectDir, 'openspec')
  }

  private get specsDir() {
    return join(this.openspecDir, 'specs')
  }

  private get changesDir() {
    return join(this.openspecDir, 'changes')
  }

  private get archiveDir() {
    return join(this.changesDir, 'archive')
  }

  /**
   * Start watching for file changes
   */
  start(): void {
    this.stop() // Clean up any existing watchers

    // Watch specs directory
    this.watchDir(this.specsDir, (filename, eventType) => {
      const match = filename.match(/^([^/]+)\//)
      if (match) {
        this.emitDebounced(`spec:${match[1]}`, {
          type: 'spec',
          action: eventType === 'rename' ? 'create' : 'update',
          id: match[1],
          path: join(this.specsDir, filename),
          timestamp: Date.now(),
        })
      }
    })

    // Watch changes directory
    this.watchDir(this.changesDir, (filename, eventType) => {
      // Skip archive directory events (handled separately)
      if (filename.startsWith('archive/')) return

      const match = filename.match(/^([^/]+)\//)
      if (match) {
        this.emitDebounced(`change:${match[1]}`, {
          type: 'change',
          action: eventType === 'rename' ? 'create' : 'update',
          id: match[1],
          path: join(this.changesDir, filename),
          timestamp: Date.now(),
        })
      }
    })

    // Watch archive directory
    this.watchDir(this.archiveDir, (filename, eventType) => {
      const match = filename.match(/^([^/]+)\//)
      if (match) {
        this.emitDebounced(`archive:${match[1]}`, {
          type: 'archive',
          action: eventType === 'rename' ? 'create' : 'update',
          id: match[1],
          path: join(this.archiveDir, filename),
          timestamp: Date.now(),
        })
      }
    })

    // Watch project-level files
    this.watchDir(this.openspecDir, (filename, eventType) => {
      if (filename === 'project.md' || filename === 'AGENTS.md') {
        this.emitDebounced(`project:${filename}`, {
          type: 'project',
          action: eventType === 'rename' ? 'create' : 'update',
          path: join(this.openspecDir, filename),
          timestamp: Date.now(),
        })
      }
    })

    this.emit('started')
  }

  /**
   * Stop watching for file changes
   */
  stop(): void {
    for (const watcher of this.watchers) {
      watcher.close()
    }
    this.watchers = []

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer)
    }
    this.debounceTimers.clear()

    this.emit('stopped')
  }

  /**
   * Watch a directory recursively
   */
  private watchDir(
    dir: string,
    callback: (filename: string, eventType: 'rename' | 'change') => void
  ): void {
    try {
      const watcher = watch(dir, { recursive: true }, (eventType, filename) => {
        if (filename) {
          callback(filename, eventType as 'rename' | 'change')
        }
      })

      watcher.on('error', (error) => {
        this.emit('error', error)
      })

      this.watchers.push(watcher)
    } catch (error) {
      // Directory might not exist yet, that's ok
      this.emit('warning', `Could not watch ${dir}: ${error}`)
    }
  }

  /**
   * Emit event with debouncing to avoid duplicate events
   */
  private emitDebounced(key: string, event: FileChangeEvent): void {
    const existing = this.debounceTimers.get(key)
    if (existing) {
      clearTimeout(existing)
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(key)
      this.emit('change', event)
    }, this.debounceMs)

    this.debounceTimers.set(key, timer)
  }
}

/**
 * Create a file change observable for use with tRPC subscriptions
 */
export function createFileChangeObservable(watcher: OpenSpecWatcher) {
  return {
    subscribe: (observer: {
      next: (event: FileChangeEvent) => void
      error?: (error: Error) => void
      complete?: () => void
    }) => {
      const changeHandler = (event: FileChangeEvent) => {
        observer.next(event)
      }

      const errorHandler = (error: Error) => {
        observer.error?.(error)
      }

      watcher.on('change', changeHandler)
      watcher.on('error', errorHandler)

      return {
        unsubscribe: () => {
          watcher.off('change', changeHandler)
          watcher.off('error', errorHandler)
        },
      }
    },
  }
}
