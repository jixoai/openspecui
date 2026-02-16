import type { IconNode } from 'lucide'
import {
  Combine,
  createElement,
  Keyboard,
  MousePointer2,
  Move,
  Pin,
  PinOff,
  SendHorizontal,
  SlidersHorizontal,
  Type,
  X,
} from 'lucide'

/**
 * Icon helpers for InputPanel components.
 * Uses the `lucide` package for consistent, high-quality SVG icons.
 * Each function returns an SVGElement that Lit can render directly in templates.
 */

function createIcon(icon: IconNode, size: number): SVGElement {
  const el = createElement(icon)
  el.setAttribute('width', String(size))
  el.setAttribute('height', String(size))
  return el
}

/** X / Close icon */
export function iconX(size = 16) {
  return createIcon(X, size)
}

/** Settings / Sliders icon */
export function iconSettings(size = 16) {
  return createIcon(SlidersHorizontal, size)
}

/** Send icon */
export function iconSend(size = 16) {
  return createIcon(SendHorizontal, size)
}

/** Text cursor / Type icon — for Input tab */
export function iconType(size = 12) {
  return createIcon(Type, size)
}

/** Keyboard icon — for Keys tab */
export function iconKeyboard(size = 12) {
  return createIcon(Keyboard, size)
}

/** Touchpad / Move icon — for Trackpad tab */
export function iconMove(size = 12) {
  return createIcon(Move, size)
}

/** Mouse pointer icon — for cursor overlay */
export function iconMousePointer2(size = 12) {
  return createIcon(MousePointer2, size)
}

/** Combine icon — for Shortcuts tab */
export function iconCombine(size = 12) {
  return createIcon(Combine, size)
}

/** Pin icon — for Fixed layout */
export function iconPin(size = 12) {
  return createIcon(Pin, size)
}

/** PinOff icon — for Floating layout */
export function iconPinOff(size = 12) {
  return createIcon(PinOff, size)
}
