/**
 * Orthogonal intents (created 2026-07-16 Asia/Shanghai):
 * 1. Centralize semantic status badges and compact status dots.
 * 2. Keep labels caller-owned so presentation does not reinterpret upstream facts.
 *
 * Original request (2026-07-15): "前端缺少的东西你可以通过注释补充。"
 */
import type { LucideIcon } from 'lucide-react'
import { AlertCircle, CheckCircle2, CircleSlash, Loader2, MinusCircle } from 'lucide-react'

/**
 * 统一的语义状态徽章（健康/可达性/变更生命周期共用）。
 *
 * 设计意图（Style 指令）：把 Store 健康态、Backend 可达性、Store 变更状态这些
 * "语义化展示态"收敛到单一组件，避免每个视图各写一套带图标的彩色 pill。
 * 颜色与图标由 variant 单点映射，文案由调用方传入（保留客观上游事实）。
 */

/** Presentation-only semantic variants shared by badges and dots. */
export type StatusVariant =
  | 'healthy' // 绿：健康/在线/成功
  | 'issue' // 琥珀：需关注/警告
  | 'destructive' // 红：失败/错误
  | 'pending' // 琥珀+旋转：进行中/排队
  | 'neutral' // 灰：未知/离线/不可用
  | 'info' // 蓝：引用/信息

const VARIANT_STYLES: Record<
  StatusVariant,
  { className: string; icon: LucideIcon; spin?: boolean }
> = {
  healthy: {
    className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
    icon: CheckCircle2,
  },
  issue: {
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    icon: AlertCircle,
  },
  destructive: {
    className: 'bg-destructive/15 text-destructive',
    icon: AlertCircle,
  },
  pending: {
    className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
    icon: Loader2,
    spin: true,
  },
  neutral: {
    className: 'bg-muted text-muted-foreground',
    icon: CircleSlash,
  },
  info: {
    className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
    icon: MinusCircle,
  },
}

/** Accessible semantic badge input; callers retain ownership of objective labels. */
export interface StatusBadgeProps {
  variant: StatusVariant
  /** 展示文案（客观保留上游事实，不由徽章推断）。 */
  label: string
  /** 可访问性标签；缺省时用 label。 */
  ariaLabel?: string
  /** 隐藏图标（用于紧凑列表行内的纯色点）。 */
  hideIcon?: boolean
  className?: string
}

/** Render one icon-and-label semantic status badge. */
export function StatusBadge({
  variant,
  label,
  ariaLabel,
  hideIcon = false,
  className,
}: StatusBadgeProps) {
  const meta = VARIANT_STYLES[variant]
  const Icon = meta.icon
  return (
    <span
      role="status"
      aria-label={ariaLabel ?? label}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className} ${className ?? ''}`}
    >
      {hideIcon ? null : (
        <Icon className={`h-3 w-3 ${meta.spin ? 'animate-spin' : ''}`} aria-hidden />
      )}
      {label}
    </span>
  )
}

/** 紧凑的状态圆点（列表行内，无文案）。 */
export function StatusDot({ variant, ariaLabel }: { variant: StatusVariant; ariaLabel: string }) {
  const color =
    variant === 'healthy'
      ? 'bg-emerald-500'
      : variant === 'issue' || variant === 'pending'
        ? 'bg-amber-500'
        : variant === 'destructive'
          ? 'bg-destructive'
          : variant === 'info'
            ? 'bg-sky-500'
            : 'bg-muted-foreground'
  const pending = variant === 'pending'
  return (
    <span
      className={`h-2 w-2 shrink-0 rounded-full ${color} ${pending ? 'animate-pulse' : ''}`}
      role="status"
      aria-label={ariaLabel}
    />
  )
}
