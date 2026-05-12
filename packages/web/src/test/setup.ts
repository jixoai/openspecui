import '@testing-library/jest-dom/vitest'

if (typeof globalThis.PointerEvent === 'undefined') {
  globalThis.PointerEvent = MouseEvent as typeof PointerEvent
}
