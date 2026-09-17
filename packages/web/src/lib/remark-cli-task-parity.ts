/**
 * Orthogonal intents (created 2026-09-18 Asia/Shanghai):
 * 1. Render task lines in the markdown reading view with the same widened semantics the
 *    admitted OpenSpec CLI 1.13.1 uses for counting, so the reading surface and CLI task
 *    counts never describe the same document differently.
 *
 * Original request (2026-09-18): owner walkthrough — the Change Detail tasks view showed
 * 4 checkboxes (1 checked) beside a CLI-owned "Tasks 2/6" badge; the reading surface and
 * the CLI counts must agree (update-openspec-cli-1131 follow-up).
 */
import type { Plugin } from 'unified'
import { visit } from 'unist-util-visit'

/**
 * Structural mdast subset this plugin touches (declared locally because `@types/mdast` is
 * not a direct dependency of the web package).
 */
interface MdastTextNode {
  type: 'text'
  value: string
}

interface MdastParagraphNode {
  type: 'paragraph'
  children: Array<{ type: string }>
}

interface MdastListItemNode {
  type: 'listItem'
  checked?: boolean | null
  children: Array<{ type: string }>
}

interface MdastRootNode {
  type: 'root'
}

/**
 * Box prefix of a CLI 1.13.1 task line: at most one non-`]`/non-whitespace token
 * (optionally padded with whitespace) or a whitespace-only box. Mirrors
 * references/openspec/src/utils/task-progress.ts (pinned v1.13.1); the marker and
 * indentation are already consumed by list parsing, and links parse into link nodes
 * (never leading text), so the CLI's link-continuation guard holds structurally.
 */
const CLI_TASK_BOX_PREFIX = /^\[(?:\s*([^\]\s]?)\s*\]|\s+\])(?=\s|$)/

/**
 * Mark unrecognized widened-form list items as task items with the CLI completion
 * semantics. GFM-recognized items (checked already set) are left untouched.
 */
export const remarkCliTaskParity: Plugin<[], MdastRootNode> = () => (tree) => {
  visit(tree, 'listItem', (node) => {
    const item = node as unknown as MdastListItemNode
    if (item.checked !== null && item.checked !== undefined) return
    const paragraph = item.children.find(
      (child): child is MdastParagraphNode => child.type === 'paragraph'
    )
    const first = paragraph?.children[0]
    if (!first || first.type !== 'text') return
    const text = first as MdastTextNode
    const match = CLI_TASK_BOX_PREFIX.exec(text.value)
    if (!match) return
    item.checked = (match[1] ?? '').toLowerCase() === 'x'
    text.value = text.value.slice(match[0].length)
  })
}
