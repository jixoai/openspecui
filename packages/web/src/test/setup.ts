/**
 * Orthogonal intents (updated 2026-07-18 Asia/Shanghai):
 * 1. Install shared DOM matchers for Web unit tests.
 * 2. Polyfill PointerEvent only in test environments that provide MouseEvent.
 *
 * Original request (2026-07-15): "这是额外的工作还是可以和 live 版本保持尽可能的一致？"
 * Derived requirement (2026-07-18): Static server tests must execute in a browser-global-free Node environment.
 */
import '@testing-library/jest-dom/vitest'

if (
  typeof globalThis.PointerEvent === 'undefined' &&
  typeof globalThis.MouseEvent !== 'undefined'
) {
  globalThis.PointerEvent = MouseEvent as typeof PointerEvent
}
