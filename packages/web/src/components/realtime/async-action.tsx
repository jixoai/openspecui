/**
 * Orthogonal intents (created 2026-07-24 Asia/Shanghai):
 * 1. Async command composition over the existing Button.activity behavior.
 *
 * Original request (2026-07-23): "加载状态机……任何触发网络请求的交互元必须默认绑定 Loading 状态锁。"
 * Owner direction (2026-07-23): "保持命令标签不变（Save 仍为 Save，不是 Saving...）。"
 *
 * Law preserved: the visible command label NEVER changes to routine status copy. The activity lock is visual
 * (Button.activity) plus aria-busy, and it duplicates input locally without closing a dialog or discarding a
 * draft. The correct terminal settlement (success/error) clears the lock at the call site.
 */
import { type ButtonProps, Button } from '@/components/button'
import { cn } from '@/lib/utils'

export interface AsyncActionProps extends Omit<ButtonProps, 'activity'> {
  /** True while the command is pending; activates the visual lock + aria-busy + duplicate-action prevention. */
  pending: boolean
}

/**
 * A command button whose label stays the command. While `pending`, it activates Button.activity (visual lock,
 * aria-disabled) and sets aria-busy. It does NOT relabel the children, close a dialog, or discard a draft.
 */
export function AsyncAction({
  pending,
  disabled,
  children,
  className,
  ...props
}: AsyncActionProps) {
  return (
    <Button
      {...props}
      activity={pending}
      disabled={disabled ?? false}
      aria-busy={pending || undefined}
      className={cn(className)}
    >
      {children}
    </Button>
  )
}
