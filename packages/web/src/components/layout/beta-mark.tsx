import { Badge } from '@/components/badge'

/**
 * 展开态的 beta pill：放在导航项文字之后，与面板内标题的 Badge 保持一致的视觉语言。
 */
export function BetaPill() {
  return (
    <Badge tone="subtle" size="xs" className="ml-auto" title="Beta feature">
      Beta
    </Badge>
  )
}

/**
 * 折叠态（icon-only）的 beta 角标：贴在图标右上角的一个小 "β"。
 * 信息量高于纯圆点，明确表达 beta；比斜向 ribbon 更适合窄长的侧边栏列表项。
 *
 * 父元素需为 `position: relative`。
 */
export function BetaCornerMark() {
  return (
    <span
      className="bg-primary text-primary-foreground absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold italic leading-none"
      aria-label="Beta feature"
    >
      β
    </span>
  )
}
