/**
 * CodeMirror 6 Markdown Live Preview Extension
 *
 * 隐藏 Markdown 语法标记，显示富文本效果
 * 参考 codemirror-rich-markdoc 的实现方式
 */
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin, ViewUpdate, WidgetType } from '@codemirror/view'
import type { SyntaxNodeRef } from '@lezer/common'
import { tags as t } from '@lezer/highlight'

/** 需要隐藏的语法标记 token */
const HIDDEN_TOKENS = [
  'HeaderMark', // # ## ###
  'EmphasisMark', // * _
  'LinkMark', // [ ] ( )
  'URL', // 链接 URL
  'HardBreak', // 硬换行
  'QuoteMark', // >
  'ListMark', // - * 1.
]

/** 装饰定义 */
const hiddenDecoration = Decoration.mark({ class: 'cm-md-hidden' })
const codeBlockLine = Decoration.line({ class: 'cm-md-codeblock-line' })
const codeBlockStart = Decoration.line({ class: 'cm-md-codeblock-line-start' })
const codeBlockEnd = Decoration.line({ class: 'cm-md-codeblock-line-end' })
const codeBlockInactive = Decoration.line({ class: 'cm-md-codeblock-inactive' })
const linkDecoration = Decoration.mark({ class: 'cm-md-link' })
const imageDecoration = Decoration.mark({ class: 'cm-md-image' })
const fadedDecoration = Decoration.mark({ class: 'cm-md-faded' })
const taskFadedDecoration = Decoration.mark({ class: 'cm-md-task-faded' })
const fenceDecoration = Decoration.mark({ class: 'cm-md-fence' })
const orderedDecoration = (label: number, faded: boolean) =>
  Decoration.replace({
    widget: new OrderedListNumberWidget(label, faded),
    inclusive: false,
  })

class OrderedListNumberWidget extends WidgetType {
  constructor(
    private label: number,
    private faded: boolean
  ) {
    super()
  }
  eq(other: OrderedListNumberWidget): boolean {
    return this.label === other.label && this.faded === other.faded
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.textContent = `${this.label}.`
    span.className = `cm-md-olist${this.faded ? ' cm-md-olist-faded' : ''}`
    return span
  }
}

class BulletWidget extends WidgetType {
  constructor(private faded: boolean) {
    super()
  }
  eq(other: BulletWidget): boolean {
    return this.faded === other.faded
  }
  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.textContent = '•'
    span.className = `cm-md-ulmark${this.faded ? ' cm-md-olist-faded' : ''}`
    return span
  }
}

class TaskCheckboxWidget extends WidgetType {
  constructor(private checked: boolean) {
    super()
  }
  eq(other: TaskCheckboxWidget): boolean {
    return this.checked === other.checked
  }
  toDOM(): HTMLElement {
    const box = document.createElement('span')
    box.className = `cm-md-task ${this.checked ? 'cm-md-task-checked' : ''}`
    box.ariaHidden = 'true'
    return box
  }
}

function applyCodeBlockLines(
  view: EditorView,
  node: SyntaxNodeRef,
  widgets: { from: number; to: number; decoration: Decoration }[],
  isSelected: boolean
) {
  const firstLine = view.state.doc.lineAt(node.from).number
  const lastLine = view.state.doc.lineAt(node.to).number
  const hasClosingFence =
    node.to - node.from > 3 && view.state.doc.sliceString(node.to - 3, node.to) === '```'

  for (let lineNo = firstLine; lineNo <= lastLine; lineNo++) {
    const line = view.state.doc.line(lineNo)
    widgets.push({ from: line.from, to: line.from, decoration: codeBlockLine })
    if (lineNo === firstLine) {
      widgets.push({ from: line.from, to: line.from, decoration: codeBlockStart })
      if (!isSelected && hasClosingFence) {
        widgets.push({ from: line.from, to: line.from, decoration: codeBlockInactive })
      }
    }
    if (lineNo === lastLine) {
      widgets.push({ from: line.from, to: line.from, decoration: codeBlockEnd })
    }
  }
}

/** Markdown 预览 ViewPlugin */
class MarkdownPreviewPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const widgets: { from: number; to: number; decoration: Decoration }[] = []
    const selectionRanges = view.state.selection.ranges
    const selectedLines: Array<{ from: number; to: number }> = selectionRanges.map((r) => {
      const lineFrom = view.state.doc.lineAt(r.from)
      const lineTo = view.state.doc.lineAt(r.to)
      return { from: Math.min(lineFrom.from, lineTo.from), to: Math.max(lineFrom.to, lineTo.to) }
    })
    const listStack: number[] = []

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter(node: SyntaxNodeRef) {
          const { name } = node.type
          const isSelectedLine = selectedLines.some(
            (range) => node.from < range.to && node.to > range.from
          )
          const parentName = node.node.parent?.name ?? ''
          const grandName = node.node.parent?.parent?.name ?? ''
          const isOrderedList =
            parentName.includes('OrderedList') || grandName.includes('OrderedList')
          const text = view.state.doc.sliceString(node.from, node.to)

          if (name === 'OrderedList') {
            listStack.push(1)
            return
          }

          // 代码块：若选区包含则保持原文，应用行装饰；否则也仅应用行装饰（不替换内容）
          if (name === 'FencedCode') {
            const overlapsSelection = selectedLines.some(
              (range) => node.from < range.to && node.to > range.from
            )
            applyCodeBlockLines(view, node, widgets, overlapsSelection)
            return false
          }

          // 链接文本样式
          if (name === 'Link') {
            const label = node.node.getChild('LinkLabel')
            if (label) {
              widgets.push({
                from: label.from,
                to: label.to,
                decoration: linkDecoration,
              })
            }
          }

          // 图片标记
          if (name === 'Image') {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: imageDecoration,
            })
          }

          // 列表项 bullet 样式
          if (name === 'ListMark') {
            if (isOrderedList) {
              const current = listStack[listStack.length - 1] ?? 1
              if (isSelectedLine) {
                // 光标所在行：显示原始文本，淡化但可编辑
                widgets.push({
                  from: node.from,
                  to: node.to,
                  decoration: fadedDecoration,
                })
              } else {
                widgets.push({
                  from: node.from,
                  to: node.to,
                  decoration: orderedDecoration(current, false),
                })
              }
              if (listStack.length) {
                listStack[listStack.length - 1] = current + 1
              }
              return
            }

            // 无序列表：未选中行用圆点，选中行显示原始符号（淡化且可编辑）
            if (isSelectedLine) {
              widgets.push({
                from: node.from,
                to: node.to,
                decoration: fadedDecoration,
              })
            } else {
              widgets.push({
                from: node.from,
                to: node.to,
                decoration: Decoration.replace({
                  widget: new BulletWidget(false),
                  inclusive: false,
                }),
              })
            }
            return
          }

          // 任务列表 checkbox
          if (name === 'TaskMarker') {
            const checked = /\[[xX]\]/.test(text)
            if (isSelectedLine) {
              widgets.push({
                from: node.from,
                to: node.to,
                decoration: taskFadedDecoration,
              })
            } else {
              widgets.push({
                from: node.from,
                to: node.to,
                decoration: Decoration.replace({
                  widget: new TaskCheckboxWidget(checked),
                  inclusive: false,
                }),
              })
            }
            return
          }

          // 代码块 fence 与语言标记
          if (name === 'CodeMark' || name === 'CodeInfo') {
            const decoration = isSelectedLine ? fadedDecoration : fenceDecoration
            widgets.push({
              from: node.from,
              to: node.to,
              decoration,
            })
            return
          }

          // HeaderMark 需要包含后面的空格
          if (name === 'HeaderMark') {
            const decoration = isSelectedLine ? fadedDecoration : hiddenDecoration
            widgets.push({
              from: node.from,
              to: node.to + 1, // +1 包含空格
              decoration,
            })
            return
          }

          // 隐藏语法标记
          if (HIDDEN_TOKENS.includes(name)) {
            if (isSelectedLine) {
              widgets.push({
                from: node.from,
                to: node.to,
                decoration: fadedDecoration,
              })
              return
            }
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: hiddenDecoration,
            })
          }
        },
        leave(node) {
          if (node.name === 'OrderedList') {
            listStack.pop()
          }
        },
      })
    }

    // 按位置排序，构建 DecorationSet
    widgets.sort((a, b) => a.from - b.from || a.to - b.to)
    return Decoration.set(widgets.map((w) => w.decoration.range(w.from, w.to)))
  }
}

const markdownPreviewPlugin = ViewPlugin.fromClass(MarkdownPreviewPlugin, {
  decorations: (v) => v.decorations,
})

/** 富文本样式定义 - 使用 HighlightStyle */
const markdownHighlightStyle = HighlightStyle.define([
  // 标题样式
  {
    tag: t.heading1,
    fontWeight: 'bold',
    fontSize: '1.75em',
    lineHeight: '1.3',
  },
  {
    tag: t.heading2,
    fontWeight: 'bold',
    fontSize: '1.5em',
    lineHeight: '1.3',
  },
  {
    tag: t.heading3,
    fontWeight: 'bold',
    fontSize: '1.25em',
    lineHeight: '1.3',
  },
  {
    tag: t.heading4,
    fontWeight: 'bold',
    fontSize: '1.1em',
  },
  {
    tag: t.heading5,
    fontWeight: 'bold',
    fontSize: '1em',
  },
  {
    tag: t.heading6,
    fontWeight: 'bold',
    fontSize: '0.9em',
    color: 'var(--color-muted-foreground)',
  },
  // 强调样式
  {
    tag: t.strong,
    fontWeight: 'bold',
  },
  {
    tag: t.emphasis,
    fontStyle: 'italic',
  },
  // 链接样式
  {
    tag: t.link,
    color: 'var(--color-primary, #3b82f6)',
    textDecoration: 'underline',
  },
  // 行内代码
  {
    tag: t.monospace,
    fontFamily: 'var(--font-mono)',
    padding: '1px 4px',
  },
  // 引用块
  {
    tag: t.quote,
    color: 'var(--color-muted-foreground)',
    fontStyle: 'italic',
  },
  // 删除线
  {
    tag: t.strikethrough,
    textDecoration: 'line-through',
  },
])

/** CSS 主题样式 */
const markdownPreviewTheme = EditorView.baseTheme({
  // 隐藏语法标记
  '.cm-md-hidden': {
    display: 'none',
  },
  // 防止背景行与编辑器边框叠加
  '.cm-line': {
    position: 'relative',
  },
  // 代码块样式
  '.cm-md-codeblock': {
    backgroundColor: 'color-mix(in srgb, currentColor 5%, transparent)',
    borderRadius: '10px',
    display: 'block',
    padding: '12px',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.9em',
    border: '1px solid color-mix(in srgb, currentColor 12%, transparent)',
  },
  '.cm-md-codeblock-line': {
    backgroundColor: 'color-mix(in srgb, currentColor 4%, transparent)',
    paddingInline: '4px',
    marginBottom: 0,
    marginInlineStart: '4px',
  },
  '.cm-md-codeblock-line-start': {
    borderTopLeftRadius: '8px',
    borderTopRightRadius: '8px',
  },
  '.cm-md-codeblock-line-end': {
    borderBottomLeftRadius: '8px',
    borderBottomRightRadius: '8px',
    marginBottom: '6px',
  },
  '.cm-md-codeblock-inactive': {
    opacity: 0.6,
  },
  // ``` fences & lang info
  '.cm-md-fence': {
    color: 'color-mix(in srgb, currentColor 55%, transparent)',
    letterSpacing: '0.03em',
    fontWeight: 600,
  },
  // 链接样式
  '.cm-md-link': {
    color: 'var(--color-primary, #3b82f6)',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  // 图片容器
  '.cm-md-image': {
    display: 'inline-block',
  },
  // 有序列表编号
  '.cm-md-olist': {
    color: 'var(--color-muted-foreground)',
    paddingRight: '0.35em',
    fontVariantNumeric: 'tabular-nums',
  },
  '.cm-md-olist.cm-md-olist-faded': {
    color: 'color-mix(in srgb, currentColor 45%, transparent)',
  },
  // 活动行上的原始 Markdown 标记淡化显示
  '.cm-md-faded': {
    color: 'color-mix(in srgb, currentColor 40%, transparent)',
    opacity: 0.55,
  },
  '.cm-md-task': {
    display: 'inline-block',
    width: '0.95em',
    height: '0.95em',
    borderRadius: '3px',
    border: '1px solid color-mix(in srgb, currentColor 30%, transparent)',
    marginRight: '0.35em',
    background: 'color-mix(in srgb, var(--background) 80%, transparent)',
  },
  '.cm-md-task-checked': {
    background: 'color-mix(in srgb, var(--primary) 35%, transparent)',
    borderColor: 'color-mix(in srgb, var(--primary) 60%, transparent)',
    position: 'relative',
  },
  '.cm-md-task-checked::after': {
    content: '""',
    position: 'absolute',
    inset: '2px 3px 2px 3px',
    borderBottom: '2px solid var(--background)',
    borderRight: '2px solid var(--background)',
    transform: 'rotate(35deg)',
    opacity: 0.9,
  },
  '.cm-md-task-faded': {
    opacity: 0.55,
  },
  // 无序列表标记
  '.cm-md-ulmark': {
    color: 'oklch(0.18 0 0)', // 近似黑色
    fontWeight: 700,
    paddingRight: '0.2em',
  },
  // 引用块左边框
  '.cm-line:has(.tok-quote)': {
    borderLeft: '3px solid color-mix(in srgb, currentColor 30%, transparent)',
    paddingLeft: '12px',
  },
})

/** 导出 Markdown 实时预览扩展 */
export function markdownPreview(): Extension {
  return [markdownPreviewPlugin, syntaxHighlighting(markdownHighlightStyle), markdownPreviewTheme]
}
