/**
 * CodeEditor - 基于 CodeMirror 6 的代码/Markdown 编辑器组件
 *
 * 特性：
 * - 支持只读和编辑模式
 * - 根据文件类型自动选择语言高亮
 * - Markdown 文件支持实时预览（隐藏语法标记）
 * - 移动端友好
 */
import { markdownPreview } from '@/lib/codemirror-markdown-preview'
import { selectAll } from '@codemirror/commands'
import { javascript } from '@codemirror/lang-javascript'
import { json } from '@codemirror/lang-json'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { yaml } from '@codemirror/lang-yaml'
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { languages } from '@codemirror/language-data'
import type { Extension } from '@codemirror/state'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'
import CodeMirror from '@uiw/react-codemirror'
import { useMemo } from 'react'

export type LanguageType = 'markdown' | 'typescript' | 'javascript' | 'json' | 'yaml' | 'plain'

export interface CodeEditorProps {
  /** 编辑器内容 */
  value: string
  /** 内容变化回调（编辑模式下使用） */
  onChange?: (value: string) => void
  /** 是否只读 */
  readOnly?: boolean
  /** 语言类型，不传则根据 filename 自动检测 */
  language?: LanguageType
  /** 文件名，用于自动检测语言 */
  filename?: string
  /** 是否显示行号 */
  lineNumbers?: boolean
  /** 是否自动换行 */
  lineWrapping?: boolean
  /** 字体大小 */
  fontSize?: number
  /** 自定义 className */
  className?: string
  /** 自定义样式 */
  style?: React.CSSProperties
  /** 占位符文本 */
  placeholder?: string
  /** 编辑器最小高度（默认 240px） */
  editorMinHeight?: string
  /** 额外的内联样式（可覆盖） */
}

/** 根据文件名推断语言类型 */
function detectLanguage(filename?: string): LanguageType {
  if (!filename) return 'plain'
  const lower = filename.toLowerCase()
  if (lower.endsWith('.md')) return 'markdown'
  if (lower.endsWith('.ts') || lower.endsWith('.tsx')) return 'typescript'
  if (lower.endsWith('.js') || lower.endsWith('.jsx')) return 'javascript'
  if (lower.endsWith('.json')) return 'json'
  if (lower.endsWith('.yml') || lower.endsWith('.yaml')) return 'yaml'
  return 'plain'
}

/** 根据语言类型返回 CodeMirror 扩展 */
function getLanguageExtensions(language: LanguageType, filename?: string): Extension[] {
  switch (language) {
    case 'markdown':
      // Markdown 默认启用实时预览（隐藏语法标记，显示富文本效果）
      return [markdown({ base: markdownLanguage, codeLanguages: languages }), markdownPreview()]
    case 'typescript':
      return [javascript({ typescript: true, jsx: filename?.endsWith('.tsx') })]
    case 'javascript':
      return [javascript({ jsx: filename?.endsWith('.jsx') })]
    case 'json':
      return [json()]
    case 'yaml':
      return [yaml()]
    default:
      return []
  }
}

// 语法高亮：使用设计令牌，自动随 light/dark 变量切换
const codeHighlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.operatorKeyword, t.modifier], color: 'var(--primary)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--secondary)' },
  { tag: [t.number, t.integer, t.float], color: 'var(--chart-4)' },
  { tag: [t.bool, t.null, t.atom], color: 'var(--accent)' },
  { tag: [t.typeName, t.className], color: 'var(--chart-3)' },
  { tag: [t.function(t.variableName), t.propertyName], color: 'var(--chart-5)' },
  { tag: [t.variableName], color: 'var(--foreground)' },
  {
    tag: [t.comment, t.lineComment, t.blockComment],
    color: 'color-mix(in srgb, var(--muted-foreground) 80%, transparent)',
  },
  { tag: t.punctuation, color: 'color-mix(in srgb, var(--foreground) 70%, transparent)' },
])

/**
 * CodeEditor 组件
 *
 * @example
 * // 只读 Markdown 预览
 * <CodeEditor value={content} filename="README.md" readOnly />
 *
 * @example
 * // 可编辑的代码编辑器
 * <CodeEditor value={code} onChange={setCode} language="typescript" />
 */
export function CodeEditor({
  value,
  onChange,
  readOnly = false,
  language,
  filename,
  lineNumbers = true,
  lineWrapping = true,
  fontSize = 13,
  className = '',
  style,
  placeholder,
  editorMinHeight = '240px',
}: CodeEditorProps) {
  const resolvedLanguage = language ?? detectLanguage(filename)
  const extensions = useMemo(() => {
    const exts: Extension[] = [
      EditorState.readOnly.of(readOnly),
      ...getLanguageExtensions(resolvedLanguage, filename),
      syntaxHighlighting(codeHighlightStyle, { fallback: true }),
    ]
    exts.push(
      EditorView.theme({
        '.cm-line': {
          lineHeight: '21px',
        },
        '.cm-editor': {
          backgroundColor: 'var(--card)',
          color: 'var(--foreground)',
          borderRadius: '6px',
          border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
          height: '100%',
          minHeight: 'var(--code-editor-min-height, 240px)',
        },
        '.cm-content': {
          fontFamily: 'var(--font-mono)',
          backgroundColor: 'transparent',
        },
        '.cm-gutters': {
          fontFamily: 'var(--font-mono)',
          backgroundColor: 'var(--card)',
          color: 'color-mix(in srgb, var(--foreground) 60%, transparent)',
          borderRight: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
        },
        '.cm-scroller': {
          fontFamily: 'var(--font-mono)',
          overflow: 'auto',
        },
        '.cm-activeLine': {
          backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
        },
        '.cm-activeLineGutter': {
          backgroundColor: 'color-mix(in srgb, var(--primary) 6%, transparent)',
          color: 'var(--foreground)',
        },
        '.cm-selectionBackground, .cm-content ::selection': {
          backgroundColor: 'color-mix(in srgb, var(--primary) 24%, transparent)',
        },
        '&.cm-editor .cm-cursor': {
          borderLeftColor: 'var(--foreground)',
        },
        '.cm-matchingBracket, .cm-nonmatchingBracket': {
          backgroundColor: 'color-mix(in srgb, var(--primary) 10%, transparent)',
          outline: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
        },
        '.cm-tooltip': {
          backgroundColor: 'var(--popover)',
          color: 'var(--popover-foreground)',
          border: '1px solid color-mix(in srgb, var(--border) 80%, transparent)',
        },
        '.cm-tooltip-autocomplete': {
          '& > ul > li[aria-selected]': {
            background: 'color-mix(in srgb, var(--primary) 10%, transparent)',
            color: 'var(--foreground)',
          },
        },
        '.cm-searchMatch': {
          backgroundColor: 'color-mix(in srgb, var(--primary) 18%, transparent)',
          outline: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
        },
        '.cm-md-codeblock': {
          padding: '0',
          borderRadius: 0,
        },
      })
    )
    exts.push(
      keymap.of([
        {
          key: 'Mod-a',
          run: selectAll,
        },
      ])
    )

    // TODO: 集成 Shiki 高亮（代码文件与 Markdown fenced code）时需采用稳定的装饰实现，避免 CM6 插件范围错误

    if (lineWrapping) {
      exts.push(EditorView.lineWrapping)
    }
    return exts
  }, [resolvedLanguage, filename, readOnly, lineWrapping])

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      theme="none"
      basicSetup={{
        lineNumbers,
        foldGutter: !readOnly,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: !readOnly,
        closeBrackets: !readOnly,
        bracketMatching: !readOnly,
      }}
      extensions={extensions}
      className={`scrollbar-thin scrollbar-track-transparent overflow-auto ${className}`}
      style={{
        fontSize,
        ['--code-editor-min-height' as string]: editorMinHeight,
        ...style,
      }}
    />
  )
}

export default CodeEditor
