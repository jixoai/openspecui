import type { Element, Properties, RootContent, Text } from 'hast'
import { Fragment, type ReactNode } from 'react'
import { CodeBlock } from './markdown-content'

export function renderTranslatedHastNodes(nodes: readonly RootContent[]): ReactNode {
  return nodes.map((node, index) => (
    <Fragment key={`translated-hast-${index}`}>{renderTranslatedHastNode(node)}</Fragment>
  ))
}

function renderTranslatedHastNode(node: RootContent): ReactNode {
  if (node.type === 'text') return (node as Text).value
  if (node.type !== 'element') return null

  const element = node as Element
  const children = element.children.map((child, index) => (
    <Fragment key={`translated-hast-child-${index}`}>{renderTranslatedHastNode(child)}</Fragment>
  ))
  const props = toReactElementProps(element.properties)

  switch (element.tagName) {
    case 'strong':
      return <strong {...props}>{children}</strong>
    case 'em':
      return <em {...props}>{children}</em>
    case 'del':
      return <del {...props}>{children}</del>
    case 'sub':
      return <sub {...props}>{children}</sub>
    case 'sup':
      return <sup {...props}>{children}</sup>
    case 'mark':
      return <mark {...props}>{children}</mark>
    case 'code':
      return (
        <CodeBlock
          className={typeof props.className === 'string' ? props.className : undefined}
          title={typeof props.title === 'string' ? props.title : undefined}
        >
          {getHastNodeTextContent(element)}
        </CodeBlock>
      )
    case 'kbd':
      return <kbd {...props}>{children}</kbd>
    case 'samp':
      return <samp {...props}>{children}</samp>
    case 'var':
      return <var {...props}>{children}</var>
    case 'a':
      return <a {...props}>{children}</a>
    case 'span':
      return <span {...props}>{children}</span>
    case 'img':
      return <img {...props} />
    default:
      return <span>{children}</span>
  }
}

function getHastNodeTextContent(node: RootContent): string {
  if (node.type === 'text') return node.value
  if (node.type !== 'element') return ''
  return node.children.map(getHastNodeTextContent).join('')
}

function toReactElementProps(properties: Properties): Record<string, unknown> {
  const props: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) continue
    if (key === 'className' || key === 'class') {
      props.className = Array.isArray(value) ? value.join(' ') : String(value)
      continue
    }
    if ((key === 'href' || key === 'src') && typeof value === 'string') {
      const safeUrl = transformSafeMarkdownUrl(value)
      if (safeUrl) props[key] = safeUrl
      continue
    }
    props[key === 'aria-label' ? 'aria-label' : key] = value
  }
  return props
}

const SAFE_URL_PROTOCOL_PATTERN = /^(https?|ircs?|mailto|xmpp)$/i

export function transformSafeMarkdownUrl(value: string): string {
  const colon = value.indexOf(':')
  const questionMark = value.indexOf('?')
  const numberSign = value.indexOf('#')
  const slash = value.indexOf('/')

  if (
    colon === -1 ||
    (slash !== -1 && colon > slash) ||
    (questionMark !== -1 && colon > questionMark) ||
    (numberSign !== -1 && colon > numberSign) ||
    SAFE_URL_PROTOCOL_PATTERN.test(value.slice(0, colon))
  ) {
    return value
  }

  return ''
}
