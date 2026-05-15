import type { Root, RootContent, TableCell, TableRow } from 'mdast'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { gfmFromMarkdown } from 'mdast-util-gfm'
import { toString } from 'mdast-util-to-string'
import { gfm } from 'micromark-extension-gfm'
import type { Node, Parent, Position } from 'unist'

export type MarkdownFactKind =
  | 'root'
  | 'heading'
  | 'paragraph'
  | 'list'
  | 'listItem'
  | 'blockquote'
  | 'table'
  | 'tableRow'
  | 'tableCell'
  | 'code'
  | 'thematicBreak'
  | 'html'
  | 'definition'
  | 'footnoteDefinition'
  | 'unknown'

export interface MarkdownSourcePoint {
  line: number
  column: number
  offset?: number
}

export interface MarkdownSourceRange {
  start: MarkdownSourcePoint
  end: MarkdownSourcePoint
  rawMarkdown: string
}

export interface MarkdownFact {
  id: string
  kind: MarkdownFactKind
  /**
   * Original mdast node type. Useful when `kind` is `unknown` or when upstream
   * syntax extensions add new node types before OpenSpecUI teaches semantics.
   */
  mdastType: string
  text: string
  parentId?: string
  children: string[]
  range?: MarkdownSourceRange
  depth?: 1 | 2 | 3 | 4 | 5 | 6
  ordered?: boolean
  checked?: boolean
  language?: string
  value?: string
}

export interface MarkdownFactsDocument {
  sourceMarkdown: string
  rootId: string
  facts: MarkdownFact[]
}

type FactParentNode = Parent & Node
type SupportedNode = Root | RootContent | TableRow | TableCell

export function toMarkdownFactKind(type: string): MarkdownFactKind {
  switch (type) {
    case 'root':
    case 'heading':
    case 'paragraph':
    case 'list':
    case 'listItem':
    case 'blockquote':
    case 'table':
    case 'tableRow':
    case 'tableCell':
    case 'code':
    case 'thematicBreak':
    case 'html':
    case 'definition':
    case 'footnoteDefinition':
      return type
    default:
      return 'unknown'
  }
}

export function parseMarkdownFacts(sourceMarkdown: string): MarkdownFactsDocument {
  const root = fromMarkdown(sourceMarkdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  })
  const facts: MarkdownFact[] = []
  const nodeIdByNode = new Map<Node, string>()

  const visit = (node: SupportedNode, parentId?: string) => {
    const fact = createFact(node, sourceMarkdown, facts.length, parentId)
    facts.push(fact)
    nodeIdByNode.set(node, fact.id)

    if (isParentNode(node)) {
      for (const child of node.children) {
        if (!isSupportedNode(child)) continue
        visit(child, fact.id)
        const childId = nodeIdByNode.get(child)
        if (childId) {
          fact.children.push(childId)
        }
      }
    }
  }

  visit(root)

  return {
    sourceMarkdown,
    rootId: 'md-1',
    facts,
  }
}

function createFact(
  node: SupportedNode,
  sourceMarkdown: string,
  index: number,
  parentId?: string
): MarkdownFact {
  const base: MarkdownFact = {
    id: `md-${index + 1}`,
    kind: toMarkdownFactKind(node.type),
    mdastType: node.type,
    text: getNodeText(node),
    children: [],
    range: toSourceRange(sourceMarkdown, node.position),
    ...(parentId ? { parentId } : {}),
  }

  switch (node.type) {
    case 'heading':
      return {
        ...base,
        depth: node.depth,
      }
    case 'list':
      return {
        ...base,
        ordered: Boolean(node.ordered),
      }
    case 'listItem':
      return {
        ...base,
        ...(typeof node.checked === 'boolean' ? { checked: node.checked } : {}),
      }
    case 'code':
      return {
        ...base,
        text: node.value,
        value: node.value,
        ...(node.lang ? { language: node.lang } : {}),
      }
    case 'html':
      return {
        ...base,
        value: node.value,
      }
    default:
      return base
  }
}

function toSourceRange(
  sourceMarkdown: string,
  position: Position | undefined
): MarkdownSourceRange | undefined {
  if (!position) return undefined

  const startOffset = position.start.offset
  const endOffset = position.end.offset
  const rawMarkdown =
    typeof startOffset === 'number' && typeof endOffset === 'number'
      ? sourceMarkdown.slice(startOffset, endOffset)
      : ''

  return {
    start: {
      line: position.start.line,
      column: position.start.column,
      ...(typeof startOffset === 'number' ? { offset: startOffset } : {}),
    },
    end: {
      line: position.end.line,
      column: position.end.column,
      ...(typeof endOffset === 'number' ? { offset: endOffset } : {}),
    },
    rawMarkdown,
  }
}

function getNodeText(node: SupportedNode): string {
  if (node.type === 'code' || node.type === 'html') {
    return node.value
  }

  return toString(node, {
    includeHtml: true,
    includeImageAlt: true,
  }).trim()
}

function isParentNode(node: Node): node is FactParentNode {
  return Array.isArray((node as Partial<FactParentNode>).children)
}

function isSupportedNode(node: Node): node is SupportedNode {
  switch (node.type) {
    case 'blockquote':
    case 'code':
    case 'definition':
    case 'footnoteDefinition':
    case 'heading':
    case 'html':
    case 'list':
    case 'listItem':
    case 'paragraph':
    case 'table':
    case 'tableRow':
    case 'tableCell':
    case 'thematicBreak':
      return true
    default:
      return isParentNode(node)
  }
}
