/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Provide one ES2022-compatible typed deferred primitive for checked Server fixtures.
 *
 * Original request (2026-07-24): "apply openspec-change: close-openspec-cli16-delivery-gaps"
 */

/** A typed externally settled promise for deterministic asynchronous fixture coordination. */
export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: unknown) => void
}

/** Create a deferred without requiring the ES2024 `Promise.withResolvers` API. */
export function createDeferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>['resolve']
  let reject!: Deferred<T>['reject']
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve
    reject = promiseReject
  })
  return { promise, reject, resolve }
}
