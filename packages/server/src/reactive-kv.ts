import { EventEmitter } from 'node:events'

/**
 * In-memory reactive key-value store.
 *
 * - No disk persistence — devices own their own storage (e.g. IndexedDB).
 * - Emits 'change' events when values are set or deleted.
 * - Designed for cross-device sync scenarios where the server acts as a
 *   transient rendezvous point.
 */
export class ReactiveKV {
  private store = new Map<string, unknown>()
  private emitter = new EventEmitter()

  constructor() {
    this.emitter.setMaxListeners(200)
  }

  get<T = unknown>(key: string): T | undefined {
    return this.store.get(key) as T | undefined
  }

  set(key: string, value: unknown): void {
    this.store.set(key, value)
    this.emitter.emit('change', key)
    this.emitter.emit(`change:${key}`, value)
  }

  delete(key: string): boolean {
    const existed = this.store.delete(key)
    if (existed) {
      this.emitter.emit('change', key)
      this.emitter.emit(`change:${key}`, undefined)
    }
    return existed
  }

  has(key: string): boolean {
    return this.store.has(key)
  }

  keys(): string[] {
    return [...this.store.keys()]
  }

  /** Subscribe to changes for a specific key. Returns unsubscribe function. */
  onKey(key: string, listener: (value: unknown) => void): () => void {
    const event = `change:${key}`
    this.emitter.on(event, listener)
    return () => {
      this.emitter.off(event, listener)
    }
  }

  /** Subscribe to all changes. Returns unsubscribe function. */
  onChange(listener: (key: string) => void): () => void {
    this.emitter.on('change', listener)
    return () => {
      this.emitter.off('change', listener)
    }
  }
}

/** Singleton instance shared across the server lifetime */
export const reactiveKV = new ReactiveKV()
