import { useMemo } from 'react'

export type SharedElementSlot = 'container' | 'icon' | 'title'

export interface SharedElementDescriptor {
  family: string
  entityId: string
  slots?: readonly SharedElementSlot[]
}

export interface SharedElementHandoff {
  family: string
  entityId: string
  title?: string
  subtitle?: string
}

interface SharedElementNavigationState {
  __vtHandoff?: SharedElementHandoff
}

export interface SharedElementBindingProps {
  'data-vt-shared': string
}

function sanitizeSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+/g, '')
    .replace(/-+$/g, '')

  return normalized.length > 0 ? normalized : 'x'
}

export function getSharedElementName(
  descriptor: Pick<SharedElementDescriptor, 'family' | 'entityId'>,
  slot: SharedElementSlot
): string {
  return `vt-${sanitizeSegment(descriptor.family)}-${sanitizeSegment(descriptor.entityId)}-${slot}`
}

export function getSharedElementNames(
  descriptor: SharedElementDescriptor
): Array<[slot: SharedElementSlot, name: string]> {
  const slots = descriptor.slots ?? ['container', 'icon', 'title']
  return slots.map((slot) => [slot, getSharedElementName(descriptor, slot)])
}

export function getSharedElementBinding(
  descriptor: Pick<SharedElementDescriptor, 'family' | 'entityId'>,
  slot: SharedElementSlot
): SharedElementBindingProps {
  return {
    'data-vt-shared': getSharedElementName(descriptor, slot),
  }
}

export function useSharedElementBinding(
  descriptor: Pick<SharedElementDescriptor, 'family' | 'entityId'>,
  slot: SharedElementSlot
): SharedElementBindingProps {
  return useMemo(
    () => getSharedElementBinding(descriptor, slot),
    [descriptor.entityId, descriptor.family, slot]
  )
}

export function collectSharedElementEntries(
  root: ParentNode | null | undefined,
  descriptor: SharedElementDescriptor | null | undefined
): Array<[HTMLElement, string]> {
  if (!root || !descriptor) return []

  return getSharedElementNames(descriptor)
    .map(([_, name]) => {
      const selector = `[data-vt-shared="${name}"]`
      const selfMatch =
        root instanceof HTMLElement && root.matches(selector) ? [root] : ([] as HTMLElement[])
      const matches = [...selfMatch, ...root.querySelectorAll<HTMLElement>(selector)]
      const element = matches.at(-1) ?? null
      return element ? ([element, name] as const) : null
    })
    .filter((entry): entry is [HTMLElement, string] => entry !== null)
}

export function withSharedElementHandoffState<
  TState extends Record<string, unknown> | null | undefined,
>(
  state: TState,
  handoff: SharedElementHandoff
): (TState extends Record<string, unknown> ? TState : Record<string, never>) &
  SharedElementNavigationState {
  if (typeof state === 'object' && state != null) {
    return {
      ...(state as Record<string, unknown>),
      __vtHandoff: handoff,
    } as (TState extends Record<string, unknown> ? TState : Record<string, never>) &
      SharedElementNavigationState
  }

  return { __vtHandoff: handoff } as (TState extends Record<string, unknown>
    ? TState
    : Record<string, never>) &
    SharedElementNavigationState
}

export function readSharedElementHandoffState(state: unknown): SharedElementHandoff | null {
  if (typeof state !== 'object' || state == null) return null
  const handoff = (state as SharedElementNavigationState).__vtHandoff
  if (typeof handoff !== 'object' || handoff == null) return null
  if (typeof handoff.family !== 'string' || typeof handoff.entityId !== 'string') return null

  return {
    family: handoff.family,
    entityId: handoff.entityId,
    title: typeof handoff.title === 'string' ? handoff.title : undefined,
    subtitle: typeof handoff.subtitle === 'string' ? handoff.subtitle : undefined,
  }
}
