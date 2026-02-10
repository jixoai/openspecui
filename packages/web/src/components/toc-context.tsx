import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { TocItem } from './toc'

// ============================================================================
// TocCollector - 收集 ToC items 的核心类
// ============================================================================

interface TocRegistration {
  id: string
  /** CSS timeline index used by ToC active-state binding */
  timelineIndex: number
  /** How the heading is bound for timeline tracking */
  binding: 'section' | 'heading'
}

export class TocCollector {
  private items: TocItem[] = []
  private slugCount = new Map<string, number>()
  private levelOffset: number
  private nextTimelineIndex = 0
  private sectionHeadingBound = new Set<number>()

  constructor(levelOffset = 0) {
    this.levelOffset = levelOffset
  }

  /** 预留一个 Section timeline index，供 Section wrapper 绑定 viewTimelineName */
  reserveSection(): number {
    return this.reserveTimelineIndex()
  }

  /** 添加一个独立标题（timeline 绑定在 heading 上） */
  add(label: string, level: number, fixedId?: string): TocRegistration {
    const timelineIndex = this.reserveTimelineIndex()
    const id = this.createItem(label, level, timelineIndex, fixedId)
    return { id, timelineIndex, binding: 'heading' }
  }

  /**
   * 将标题绑定到 Section timeline。
   *
   * 一个 section 只绑定首个标题；同 section 的后续标题会退化为 heading 绑定，
   * 以避免多个 ToC 项共享同一 timeline 造成同时高亮。
   */
  bindSectionHeading(
    sectionTimelineIndex: number,
    label: string,
    level: number,
    fixedId?: string
  ): TocRegistration {
    if (!this.sectionHeadingBound.has(sectionTimelineIndex)) {
      this.sectionHeadingBound.add(sectionTimelineIndex)
      const id = this.createItem(label, level, sectionTimelineIndex, fixedId)
      return { id, timelineIndex: sectionTimelineIndex, binding: 'section' }
    }

    return this.add(label, level, fixedId)
  }

  /** 批量添加 items（用于嵌套 MarkdownViewer 合并） */
  addAll(items: TocItem[]): number {
    const startIndex = this.items.length
    for (const item of items) {
      const adjustedLevel = Math.min((item.level ?? 1) + this.levelOffset, 6)
      const timelineIndex = item.timelineIndex ?? this.reserveTimelineIndex()
      this.items.push({ ...item, level: adjustedLevel, timelineIndex })
    }
    return startIndex
  }

  /** 获取所有收集到的 items */
  getItems(): TocItem[] {
    return [...this.items]
  }

  /** 获取当前 item 数量（用于确定下一个 index） */
  getNextIndex(): number {
    return this.items.length
  }

  /** 重置收集器 */
  reset(): void {
    this.items = []
    this.slugCount.clear()
    this.nextTimelineIndex = 0
    this.sectionHeadingBound.clear()
  }

  /** 创建子 collector（用于 Section 内部，层级 +1） */
  createChild(additionalOffset = 1): TocCollector {
    return new TocCollector(this.levelOffset + additionalOffset)
  }

  private reserveTimelineIndex(): number {
    const timelineIndex = this.nextTimelineIndex
    this.nextTimelineIndex += 1
    return timelineIndex
  }

  private createItem(
    label: string,
    level: number,
    timelineIndex: number,
    fixedId?: string
  ): string {
    const adjustedLevel = Math.min(level + this.levelOffset, 6)
    const baseSlug = fixedId ?? (slugify(label) || 'heading')

    const count = this.slugCount.get(baseSlug) ?? 0
    this.slugCount.set(baseSlug, count + 1)
    const id = count > 0 ? `${baseSlug}-${count + 1}` : baseSlug

    this.items.push({ id, label, level: adjustedLevel, timelineIndex })
    return id
  }
}

// ============================================================================
// Slugify - 生成 URL 友好的 id
// ============================================================================

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// ============================================================================
// TocContext - React Context
// ============================================================================

interface TocContextValue {
  /** 当前的 collector 实例（顶层创建，所有嵌套共享） */
  collector: TocCollector
  /** 当前层级偏移（Section 嵌套时累加） */
  levelOffset: number
  /** 是否是顶层（决定是否渲染 ToC sidebar） */
  isRoot: boolean
}

const TocContext = createContext<TocContextValue | null>(null)

/** 获取当前 TocContext，如果不存在返回 null */
export function useTocContext(): TocContextValue | null {
  return useContext(TocContext)
}

/** 获取当前 TocContext，如果不存在则抛出错误 */
export function useTocContextRequired(): TocContextValue {
  const ctx = useContext(TocContext)
  if (!ctx) {
    throw new Error('useTocContextRequired must be used within a TocProvider')
  }
  return ctx
}

// ============================================================================
// TocProvider - 提供 TocContext
// ============================================================================

interface TocProviderProps {
  children: ReactNode
  /** collector 实例（顶层创建） */
  collector: TocCollector
  /** 当前层级偏移 */
  levelOffset?: number
  /** 是否是顶层 */
  isRoot?: boolean
}

export function TocProvider({
  children,
  collector,
  levelOffset = 0,
  isRoot = true,
}: TocProviderProps) {
  const value = useMemo<TocContextValue>(
    () => ({ collector, levelOffset, isRoot }),
    [collector, levelOffset, isRoot]
  )

  return <TocContext.Provider value={value}>{children}</TocContext.Provider>
}

/** 创建一个新的层级 Context（用于 Section） */
export function TocLevelProvider({
  children,
  additionalOffset = 1,
}: {
  children: ReactNode
  additionalOffset?: number
}) {
  const parentCtx = useTocContext()
  if (!parentCtx) {
    // 没有父级 Context，直接渲染 children
    return <>{children}</>
  }

  const value = useMemo<TocContextValue>(
    () => ({
      collector: parentCtx.collector,
      levelOffset: parentCtx.levelOffset + additionalOffset,
      isRoot: false,
    }),
    [parentCtx, additionalOffset]
  )

  return <TocContext.Provider value={value}>{children}</TocContext.Provider>
}

// ============================================================================
// 从 markdown 字符串提取标题
// ============================================================================

export interface ExtractedHeading {
  level: number
  text: string
}

/** 从 markdown 字符串中提取标题 */
export function extractHeadingsFromMarkdown(markdown: string): ExtractedHeading[] {
  const regex = /^(#{1,6})\s+(.+)$/gm
  const headings: ExtractedHeading[] = []
  let match
  while ((match = regex.exec(markdown)) !== null) {
    headings.push({ level: match[1].length, text: match[2].trim() })
  }
  return headings
}
