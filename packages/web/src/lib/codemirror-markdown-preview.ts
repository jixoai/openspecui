/**
 * CodeMirror 6 Markdown Live Preview Extension
 *
 * 隐藏 Markdown 语法标记，显示富文本效果
 * 参考 codemirror-rich-markdoc 的实现方式
 */
import { HighlightStyle, syntaxHighlighting, syntaxTree } from '@codemirror/language'
import type { Extension } from '@codemirror/state'
import type { DecorationSet } from '@codemirror/view'
import { Decoration, EditorView, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import type { SyntaxNodeRef } from '@lezer/common'

/** 需要隐藏的语法标记 token */
const HIDDEN_TOKENS = [
  'HeaderMark', // # ## ###
  'EmphasisMark', // * _
  'CodeMark', // `
  'LinkMark', // [ ] ( )
  'URL', // 链接 URL
  'HardBreak', // 硬换行
  'QuoteMark', // >
  'ListMark', // - * 1.
  'CodeInfo', // ```language
]

/** 装饰定义 */
const hiddenDecoration = Decoration.mark({ class: 'cm-md-hidden' })
const bulletDecoration = Decoration.mark({ class: 'cm-md-bullet' })
const codeBlockDecoration = Decoration.mark({ class: 'cm-md-codeblock' })
const linkDecoration = Decoration.mark({ class: 'cm-md-link' })
const imageDecoration = Decoration.mark({ class: 'cm-md-image' })

/** Markdown 预览 ViewPlugin */
class MarkdownPreviewPlugin {
  decorations: DecorationSet

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view)
  }

  update(update: ViewUpdate): void {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view)
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const widgets: { from: number; to: number; decoration: Decoration }[] = []

    for (const { from, to } of view.visibleRanges) {
      syntaxTree(view.state).iterate({
        from,
        to,
        enter(node: SyntaxNodeRef) {
          const { name } = node.type

          // 代码块整体样式
          if (name === 'FencedCode') {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: codeBlockDecoration,
            })
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
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: bulletDecoration,
            })
            return
          }

          // HeaderMark 需要包含后面的空格
          if (name === 'HeaderMark') {
            widgets.push({
              from: node.from,
              to: node.to + 1, // +1 包含空格
              decoration: hiddenDecoration,
            })
            return
          }

          // 隐藏语法标记
          if (HIDDEN_TOKENS.includes(name)) {
            widgets.push({
              from: node.from,
              to: node.to,
              decoration: hiddenDecoration,
            })
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
    fontFamily: 'ui-monospace, monospace',
    backgroundColor: 'color-mix(in srgb, currentColor 10%, transparent)',
    borderRadius: '3px',
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
  // 列表 bullet 样式
  '.cm-md-bullet': {
    display: 'none',
  },
  '.cm-md-bullet::after': {
    display: 'inline !important',
    content: '"•"',
    color: 'var(--color-muted-foreground)',
    marginRight: '0.5em',
  },
  // 代码块样式
  '.cm-md-codeblock': {
    backgroundColor: 'color-mix(in srgb, currentColor 5%, transparent)',
    borderRadius: '6px',
    display: 'block',
    padding: '12px',
    fontFamily: 'ui-monospace, monospace',
    fontSize: '0.9em',
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
  // 引用块左边框
  '.cm-line:has(.tok-quote)': {
    borderLeft: '3px solid color-mix(in srgb, currentColor 30%, transparent)',
    paddingLeft: '12px',
  },
})

/** 导出 Markdown 实时预览扩展 */
export function markdownPreview(): Extension {
  return [
    markdownPreviewPlugin,
    syntaxHighlighting(markdownHighlightStyle),
    markdownPreviewTheme,
  ]
}
