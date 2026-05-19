import type { Element, ElementContent, Nodes, Properties, Root, RootContent, Text } from 'hast'

export interface TranslationPlaceholderProtocol {
  translatorInput: string
  sourceNodes: RootContent[]
  placeholders: readonly TranslationElementPlaceholder[]
}

export interface TranslationElementPlaceholder {
  id: string
  tagName: string
  properties: Properties
  sourceChildren: ElementContent[]
  displayPolicy: 'normal' | 'codeLike'
  translatableAttributes: readonly TranslationAttributePlaceholder[]
}

export interface TranslationAttributePlaceholder {
  id: string
  propertyName: 'title' | 'alt' | 'aria-label'
  sourceValue: string
}

export function createTranslationPlaceholderProtocol(
  sourceNodes: readonly ElementContent[]
): TranslationPlaceholderProtocol {
  const placeholders: TranslationElementPlaceholder[] = []
  let nextElementId = 1
  let nextAttributeId = 1

  const serializeNodes = (nodes: readonly ElementContent[]): string =>
    nodes.map((node) => serializeNode(node)).join('')

  const serializeNode = (node: ElementContent): string => {
    if (isText(node)) return node.value
    if (!isElement(node)) return ''

    const id = `x${nextElementId++}`
    const translatableAttributes = collectTranslatableAttributes(
      node,
      () => `a${nextAttributeId++}`
    )
    placeholders.push({
      id,
      tagName: node.tagName,
      properties: { ...node.properties },
      sourceChildren: cloneElementChildren(node.children),
      displayPolicy: isCodeLikeElement(node.tagName) ? 'codeLike' : 'normal',
      translatableAttributes,
    })
    const attrs = translatableAttributes
      .map((attribute) => ` ${attribute.id}="${escapeAttributeValue(attribute.sourceValue)}"`)
      .join('')
    return `<${id}${attrs}>${serializeNodes(node.children)}</${id}>`
  }

  return {
    translatorInput: serializeNodes(sourceNodes),
    sourceNodes: cloneElementChildren(sourceNodes),
    placeholders,
  }
}

export function getTranslatableBlockChildren(node: Element): ElementContent[] {
  return node.children.filter((child): child is ElementContent => {
    if (!isElementContent(child)) return false
    return !(isElement(child) && isBlockElement(child.tagName))
  })
}

export function getTranslationSourceText(nodes: readonly ElementContent[]): string {
  const parts: string[] = []
  const collect = (node: ElementContent) => {
    if (isText(node)) {
      if (node.value.trim()) parts.push(node.value)
      return
    }
    if (!isElement(node)) return
    for (const attribute of collectTranslatableAttributes(node, () => '')) {
      parts.push(attribute.sourceValue)
    }
    node.children.forEach(collect)
  }
  nodes.forEach(collect)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

export function restoreTranslatedPlaceholderFragment(
  translatedFragment: string,
  protocol: TranslationPlaceholderProtocol
): { target: string; targetNodes: RootContent[] } {
  const fallback = createSourceOnlyPlaceholderFallback(protocol)
  const parsed = new DOMParser().parseFromString(`<body>${translatedFragment}</body>`, 'text/html')
  const body = parsed.body
  const placeholderById = new Map(
    protocol.placeholders.map((placeholder) => [placeholder.id, placeholder])
  )
  const seenPlaceholderIds = new Set<string>()
  const restored = restoreDomChildren(body.childNodes, placeholderById, seenPlaceholderIds)
  if (!restored) return fallback

  const hasAllPlaceholders = protocol.placeholders.every((placeholder) =>
    seenPlaceholderIds.has(placeholder.id)
  )
  if (!hasAllPlaceholders) return fallback

  return {
    target: getHastTextContent({ type: 'root', children: restored }).trim(),
    targetNodes: restored,
  }
}

function collectTranslatableAttributes(
  node: Element,
  nextAttributeId: () => string
): TranslationAttributePlaceholder[] {
  const attributes: TranslationAttributePlaceholder[] = []
  for (const propertyName of ['title', 'alt', 'aria-label'] as const) {
    const value = node.properties?.[propertyName]
    if (typeof value === 'string' && value.trim()) {
      attributes.push({ id: nextAttributeId(), propertyName, sourceValue: value })
    }
  }
  return attributes
}

function restoreDomChildren(
  nodes: NodeListOf<ChildNode>,
  placeholderById: ReadonlyMap<string, TranslationElementPlaceholder>,
  seenPlaceholderIds: Set<string>
): RootContent[] | null {
  const restored: RootContent[] = []
  for (const node of nodes) {
    const child = restoreDomNode(node, placeholderById, seenPlaceholderIds)
    if (!child) return null
    restored.push(...child)
  }
  return restored
}

function restoreDomNode(
  node: ChildNode,
  placeholderById: ReadonlyMap<string, TranslationElementPlaceholder>,
  seenPlaceholderIds: Set<string>
): RootContent[] | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return [{ type: 'text', value: node.textContent ?? '' }]
  }
  if (!(node instanceof HTMLElement)) {
    return []
  }

  const id = node.tagName.toLowerCase()
  const placeholder = placeholderById.get(id)
  if (!placeholder) return null
  if (seenPlaceholderIds.has(id)) return null
  if (!hasOnlyExpectedSyntheticAttributes(node, placeholder)) return null
  seenPlaceholderIds.add(id)
  const children = restoreDomChildren(node.childNodes, placeholderById, seenPlaceholderIds)
  if (!children) return null

  return [
    {
      type: 'element',
      tagName: placeholder.tagName,
      properties: restorePlaceholderProperties(node, placeholder),
      children:
        placeholder.displayPolicy === 'codeLike'
          ? cloneElementChildren(placeholder.sourceChildren)
          : children.filter(isElementContent),
    },
  ]
}

function hasOnlyExpectedSyntheticAttributes(
  element: HTMLElement,
  placeholder: TranslationElementPlaceholder
): boolean {
  const expected = new Set(placeholder.translatableAttributes.map((attribute) => attribute.id))
  for (const attribute of element.getAttributeNames()) {
    if (!expected.has(attribute)) return false
  }
  return true
}

function createSourceOnlyPlaceholderFallback(protocol: TranslationPlaceholderProtocol): {
  target: string
  targetNodes: RootContent[]
} {
  return {
    target: getHastTextContent({ type: 'root', children: protocol.sourceNodes }),
    targetNodes: protocol.sourceNodes,
  }
}

function restorePlaceholderProperties(
  element: HTMLElement,
  placeholder: TranslationElementPlaceholder
): Properties {
  const properties = { ...placeholder.properties }
  if (placeholder.displayPolicy === 'codeLike') {
    const translatedText = element.textContent?.trim()
    if (translatedText) properties.title = translatedText
  }
  for (const attribute of placeholder.translatableAttributes) {
    const translatedValue = element.getAttribute(attribute.id)
    if (translatedValue === null) continue
    properties[attribute.propertyName] = translatedValue.trim()
  }
  return properties
}

function isBlockElement(tagName: string): boolean {
  return (
    /^h[1-6]$/.test(tagName) ||
    tagName === 'p' ||
    tagName === 'ul' ||
    tagName === 'ol' ||
    tagName === 'li' ||
    tagName === 'blockquote' ||
    tagName === 'table' ||
    tagName === 'thead' ||
    tagName === 'tbody' ||
    tagName === 'tr' ||
    tagName === 'td' ||
    tagName === 'th' ||
    tagName === 'pre'
  )
}

function isElementContent(node: RootContent): node is ElementContent {
  return node.type === 'text' || node.type === 'element' || node.type === 'comment'
}

function isCodeLikeElement(tagName: string): boolean {
  return tagName === 'code' || tagName === 'kbd' || tagName === 'samp'
}

function isElement(node: Nodes | RootContent | ElementContent): node is Element {
  return node.type === 'element'
}

function isText(node: Nodes | RootContent | ElementContent): node is Text {
  return node.type === 'text'
}

function cloneElementChildren(nodes: readonly ElementContent[]): ElementContent[]
function cloneElementChildren(nodes: readonly RootContent[]): RootContent[]
function cloneElementChildren(nodes: readonly RootContent[]): RootContent[] {
  return nodes.map(cloneHastNode)
}

function cloneHastNode<T extends RootContent>(node: T): T {
  if (isText(node)) return { ...node } as T
  if (isElement(node)) {
    return {
      ...node,
      properties: { ...node.properties },
      children: cloneElementChildren(node.children),
    } as T
  }
  return { ...node } as T
}

function getHastTextContent(node: Root | RootContent | ElementContent): string {
  if (isText(node)) return node.value
  if ('children' in node) return node.children.map(getHastTextContent).join('')
  return ''
}

function escapeAttributeValue(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}
