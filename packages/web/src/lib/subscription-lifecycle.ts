/**
 * Orthogonal intents (created 2026-07-23 Asia/Shanghai):
 * 1. Own cached subscription snapshots for Web projection hooks.
 * 2. Retire one Hook-instance generation before a replacement can publish.
 * 3. Gate state and cache publication from live subscriptions and static loaders together.
 *
 * Original owner report (2026-07-22): "整个过程中，几乎都在 Loading。"
 * Review finding (2026-07-23): ordinary subscriptions could publish after their owner retired.
 */

/** Internal cache shared by subscription projections for remount continuity. */
const subscriptionCache = new Map<string, unknown>()

interface Unsubscribable {
  unsubscribe(): void
}

interface SubscriptionCacheSnapshot<T> {
  data: T | undefined
  hasCached: boolean
}

/**
 * One effect generation. Publication is deliberately centralized here so a retired loader and a retired
 * transport callback have exactly the same cache and React-state eligibility boundary.
 */
class SubscriptionLifecycleGeneration {
  #retired = false
  #subscription: Unsubscribable | null = null

  constructor(private readonly owner: SubscriptionLifecycleOwner) {}

  snapshot<T>(cacheKey: string | undefined): SubscriptionCacheSnapshot<T> {
    return this.owner.snapshot(cacheKey)
  }

  attach(subscription: Unsubscribable): void {
    if (!this.isCurrent()) {
      subscription.unsubscribe()
      return
    }
    this.#subscription = subscription
  }

  publish(effect: () => void): boolean {
    if (!this.isCurrent()) return false
    effect()
    return true
  }

  publishData<T>(cacheKey: string | undefined, data: T, effect: () => void): boolean {
    return this.publish(() => {
      if (cacheKey) subscriptionCache.set(cacheKey, data)
      effect()
    })
  }

  retire(): void {
    if (this.#retired) return
    this.#retired = true
    this.owner.release(this)
    this.#subscription?.unsubscribe()
    this.#subscription = null
  }

  private isCurrent(): boolean {
    return !this.#retired && this.owner.isCurrent(this)
  }
}

/** Internal owner shared by one public subscription Hook instance across effect generations. */
export class SubscriptionLifecycleOwner {
  #current: SubscriptionLifecycleGeneration | null = null

  begin(): SubscriptionLifecycleGeneration {
    this.#current?.retire()
    const generation = new SubscriptionLifecycleGeneration(this)
    this.#current = generation
    return generation
  }

  snapshot<T>(cacheKey: string | undefined): SubscriptionCacheSnapshot<T> {
    if (cacheKey === undefined || !subscriptionCache.has(cacheKey)) {
      return { data: undefined, hasCached: false }
    }
    return { data: subscriptionCache.get(cacheKey) as T, hasCached: true }
  }

  isCurrent(generation: SubscriptionLifecycleGeneration): boolean {
    return this.#current === generation
  }

  release(generation: SubscriptionLifecycleGeneration): void {
    if (this.#current === generation) this.#current = null
  }
}

/** Prime a projection cache from a completed non-subscription preparation path. */
export function primeSubscriptionCache<T>(cacheKey: string, data: T): void {
  subscriptionCache.set(cacheKey, data)
}
